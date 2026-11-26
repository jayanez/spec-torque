import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { appendFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, request as httpRequest } from 'node:http';
import { createRequire } from 'node:module';
import { release, tmpdir, version } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { unzipSync } from 'fflate';
import { analyze, discoverWorkspace, selectFeature } from '../dist/integration.js';
import { runTerminal } from './qualify-opencode-terminal.mjs';

const [binary, zipPath, toolsPath, variant, ...extra] = process.argv.slice(2);
assert.ok(binary && zipPath && toolsPath && variant && !extra.length,
  'Usage: qualify:opencode -- <OpenCode binary> <ZIP> <node_modules with node-pty and @xterm/headless> <binary variant>');
const target = (process.platform === 'win32' ? 'windows' : process.platform) + '-' + process.arch;
assert.ok(variant === target || variant.startsWith(target + '-'), 'Use the matching runner architecture.');
const executable = resolve(binary);
const run = promisify(execFile);
const require = createRequire(import.meta.url);
const pty = require(resolve(toolsPath, 'node-pty'));
const { Terminal } = require(resolve(toolsPath, '@xterm/headless'));
const scratch = await mkdtemp(join(tmpdir(), 'spectorque-opencode-'));
await mkdir('.spec-torque', { recursive: true });
const output = await mkdtemp(resolve('.spec-torque/opencode-'));
const bytes = await readFile(zipPath);
const files = unzipSync(bytes);
const resources = Object.keys(files).sort();
const manifest = JSON.parse(Buffer.from(files['package.json']).toString());
assert.equal(manifest.exports['./tui'], './tui.tsx');
for (const name of ['tui.tsx', 'runtime/integration.js', 'runtime/cli.js', 'runtime/mcp.js', 'web-dist/index.html', 'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES']) {
  assert.ok(files[name]?.length, 'Required archive entry: ' + name);
}
assert.ok(!resources.some(name => name.startsWith('skills/')));
const artifact = join(scratch, 'installed package');
for (const name of resources) {
  assert.ok(name.split('/').every(part => part && part !== '..' && !/[\\:]/.test(part)), 'Unexpected archive path');
  const path = join(artifact, name);
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, files[name]);
}

const blocked = [];
const proxy = createServer((req, res) => { blocked.push(req.headers.host); res.writeHead(403).end(); });
proxy.on('connect', (req, socket) => { blocked.push(req.url); socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); });
await new Promise(done => proxy.listen(0, '127.0.0.1', done));

async function profile(name, installed) {
  const home = join(scratch, name);
  const config = join(home, 'config');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    /^(PATH|SYSTEMROOT|WINDIR|COMSPEC|PATHEXT|TEMP|TMP|TMPDIR|TERM|LANG)$/i.test(key)));
  const reject = 'http://127.0.0.1:' + proxy.address().port;
  Object.assign(env, {
    HOME: home, USERPROFILE: home, APPDATA: join(home, 'roaming'), LOCALAPPDATA: join(home, 'local'),
    XDG_CONFIG_HOME: config, XDG_DATA_HOME: join(home, 'data'), XDG_CACHE_HOME: join(home, 'cache'),
    XDG_STATE_HOME: join(home, 'state'), TERM: 'xterm-256color', COLORTERM: 'truecolor',
    OPENCODE_PASSWORD: randomBytes(32).toString('hex'), OPENCODE_DISABLE_MODELS_FETCH: '1',
    OPENCODE_DISABLE_AUTOUPDATE: '1', OPENCODE_DISABLE_FREE_MODELS: '1',
    HTTP_PROXY: reject, HTTPS_PROXY: reject, ALL_PROXY: reject, NO_PROXY: '127.0.0.1,localhost',
  });
  const directory = join(config, 'opencode');
  await mkdir(directory, { recursive: true });
  const cli = join(directory, 'cli.json');
  await writeFile(cli, JSON.stringify({ highlights: false, plugins: installed ? [artifact] : [] }));
  await writeFile(join(directory, 'opencode.json'), JSON.stringify({ autoupdate: false, share: 'disabled' }));
  return { env, cli };
}

async function openService(workspace, env) {
  const child = spawn(executable, ['serve', '--hostname', '127.0.0.1', '--port', '0'], {
    cwd: workspace, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  const exit = new Promise(done => child.once('close', done));
  const stop = async () => { child.kill(); await exit; };
  let startup = '';
  try {
    const url = await new Promise((done, reject) => {
      const timer = setTimeout(() => reject(new Error('OpenCode private service startup timed out')), 15_000);
      const log = data => {
        startup += data;
        const address = startup.match(/server listening on (http:\/\/127\.0\.0\.1:\d+)/)?.[1];
        if (address) { clearTimeout(timer); done(address); }
      };
      child.stdout.on('data', log);
      child.stderr.on('data', log);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); reject(new Error('Private service exited ' + code + '\n' + startup)); });
    });
    return { url, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}

async function api(service, workspace, env, operation, ...args) {
  const { stdout } = await run(executable, ['api', '--server', service.url, operation, ...args], {
    cwd: workspace, env, timeout: 15_000, windowsHide: true,
  });
  return JSON.parse(stdout);
}

async function controlledConnection(url) {
  let intercept;
  const server = createServer(async (req, res) => {
    if (req.method === 'GET' && req.url.split('?')[0] === intercept?.path) {
      const action = intercept;
      intercept = undefined;
      action.arrived();
      if (!await action.release) {
        res.writeHead(503, { 'Content-Type': 'application/json' }).end('{"error":"Qualification service unavailable"}');
        return;
      }
    }
    const remote = httpRequest(url + req.url, { method: req.method, headers: req.headers }, incoming => {
      res.writeHead(incoming.statusCode, incoming.headers);
      incoming.pipe(res);
    });
    remote.on('error', () => res.destroy());
    res.on('close', () => remote.destroy());
    req.pipe(remote);
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  return {
    url: 'http://127.0.0.1:' + server.address().port,
    hold(sessionID) {
      let complete;
      const release = new Promise(done => { complete = done; });
      const arrived = new Promise(done => { intercept = { path: '/api/session/' + sessionID, arrived: done, release }; });
      return { arrived, complete };
    },
    async stop() {
      server.closeAllConnections();
      await new Promise(done => server.close(done));
    },
  };
}

const scope = 'specs/booking';
const other = 'specs/other';
const empty = 'specs/empty';
async function expected(workspace, feature = null) {
  return analyze(selectFeature(await discoverWorkspace(workspace), feature));
}

async function assertDisconnected(url) {
  for (let attempt = 0; attempt < 30; attempt++) {
    if (await fetch(url, { signal: AbortSignal.timeout(500) }).then(() => false, () => true)) return;
    await delay(100);
  }
  throw new Error('The old workbench still accepts connections: ' + url);
}

async function walkthrough(language) {
  const workspace = join(scratch, language);
  await cp(resolve('fixtures/' + language + '-draft'), workspace, { recursive: true });
  const source = join(workspace, scope, 'spec.md');
  const initial = await readFile(source, 'utf8');
  const original = initial.split(/\r?\n/)[4];
  const replacement = language === 'es'
    ? 'FR-001: El sistema DEBE responder en [NEEDS CLARIFICATION: Cual es el limite de respuesta?].'
    : 'FR-001: The system MUST respond within [NEEDS CLARIFICATION: What is the response-time limit?].';
  const longLine = 'FR-034: The system MUST respond quickly ' + 'context '.repeat(44) + 'LONG_EVIDENCE_END.';
  await mkdir(join(workspace, other), { recursive: true });
  await mkdir(join(workspace, empty), { recursive: true });
  await writeFile(join(workspace, other, 'spec.md'), '# Other scope\n\n' + longLine + '\n');
  await writeFile(join(workspace, empty, 'spec.md'), '# No rule findings\n');
  const { env, cli } = await profile(language + '-profile', true);
  const service = await openService(workspace, env);
  const connection = await controlledConnection(service.url);
  try {
    const { data: session } = await api(service, workspace, env, 'session.create', '--data',
      JSON.stringify({ title: 'SpecTorque native ' + language, location: { directory: workspace } }));
    const secondary = join(scratch, language + '-secondary');
    await cp(resolve('fixtures/en-complete'), secondary, { recursive: true });
    const { data: otherSession } = await api(service, secondary, env, 'session.create', '--data',
      JSON.stringify({ title: 'Secondary workspace ' + language, location: { directory: secondary } }));
    const homeArgs = ['--server', connection.url, workspace];
    const terminal = (name, args, action, profileEnv = env) =>
      runTerminal({ pty, Terminal, executable, args, workspace, env: profileEnv, log: join(output, language + '-' + name + '.txt') }, action);
    await terminal('home', homeArgs, async ({ see, slash, text }) => {
      await see('ctrl+p');
      await slash('spectorque', 'Open SpecTorque');
      await see('open decisions');
      assert.ok(!text().includes('q Close panel'), 'Home should show the fallback dialog.');
    });
    let browserUrl;
    await terminal('active', [...homeArgs, '--session', session.id], async ({ see, key, slash, text }) => {
      async function closePanel() {
        await key('q');
        await see(/^(?![\s\S]*q Close panel)[\s\S]*ctrl\+p commands/);
      }
      await see('SpecTorque native ' + language);
      await slash('spectorque', 'Open SpecTorque');
      await see(/SpecTorque \d+\.\d+\.\d+ · /);
      await see('q Close panel');
      await see('Heuristic evidence, not a correctness certificate.');
      await see((await expected(workspace)).id);
      async function selectScope(name) {
        await key('s');
        await see('Select scope');
        await key(name === null ? 'All documents' : name);
        await key('\r');
        await see((await expected(workspace, name)).id);
      }
      await selectScope(empty);
      await see('No rule findings in this scope.');
      await selectScope(other);
      await key('e');
      await see('Select finding');
      await key('\r');
      await see('specs/other/spec.md:3');
      await see('LONG_EVIDENCE_END.');
      await key('\r');
      await selectScope(scope);

      async function propose() {
        await key('r');
        await see('Select finding');
        await key('\r');
        await see('Proposed replacement for line 5');
        await see(original);
        await key('\x15');
        await key(replacement);
        await key('\r');
        await see('Apply reviewed change?');
        await see('Before:');
        await see('After:');
        await see(original);
        // The dialog wraps a long line, and panel text can share those terminal rows.
        await see(new RegExp(replacement.split(/\s+/).map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\S]{1,400}?')));
      }
      await propose();
      await key('\x1b[C');
      await key('\r');
      await see('0 open decisions');
      assert.equal(await readFile(source, 'utf8'), initial);

      await propose();
      await key('\r');
      const accepted = initial.replace(original, replacement);
      await see(/[1-9]\d* open decisions?/);
      assert.equal(await readFile(source, 'utf8'), accepted);
      await see((await expected(workspace, scope)).id);
      await see('NEEDS CLARIFICATION');
      await key('w');
      await see('Common workbench');
      // One workbench line, the same address the panel links, naming the feature it opens on.
      const frame = await see(/Workbench: http:\/\/localhost:\d+\/ — opens on[\s\S]{1,400}?specs\/[\s\S]{0,400}?booking/);
      browserUrl = frame.match(/http:\/\/localhost:\d+/)[0].replace('localhost', '127.0.0.1');
      const handoff = await run(process.execPath, ['--import', 'tsx', resolve('scripts/qualify-common-handoff.mjs'),
        workspace, '--url', browserUrl, '--feature', scope], { timeout: 90_000 });
      const result = JSON.parse(handoff.stdout);
      assert.equal(result.reportId, (await expected(workspace, scope)).id);
      assert.equal(result.attached, true);
      console.log(language, 'browser evidence:', result.output);
      await key('\x1b');

      await writeFile(source, initial);
      await closePanel();
      await slash('spectorque', 'Open SpecTorque');
      await see((await expected(workspace, scope)).id);
      await propose();
      const external = '\nExternal scratch edit.\n';
      await appendFile(source, external);
      await key('\r');
      await see('proposal is stale');
      assert.equal(await readFile(source, 'utf8'), initial + external);
      await key('\r');
      await closePanel();

      const failed = connection.hold(session.id);
      await slash('spectorque', 'Open SpecTorque');
      await Promise.race([failed.arrived, delay(3000).then(() => assert.fail('Failed lookup did not reach the gate'))]);
      failed.complete(false);
      await see('OpenCode session unavailable.');
      await key('\r');
      assert.equal(await readFile(source, 'utf8'), initial + external);
      await closePanel();
      await slash('spectorque', 'Open SpecTorque');
      await see((await expected(workspace, scope)).id);

      await closePanel();
      const delayed = connection.hold(session.id);
      const alternate = await expected(secondary);
      try {
        await slash('spectorque', 'Open SpecTorque');
        await Promise.race([delayed.arrived, delay(3000).then(() => assert.fail('Session lookup did not reach the gate'))]);
        await closePanel();
        await slash('sessions', 'Switch session');
        await see('Sessions');
        await key('\x01');
        await key('Secondary workspace ' + language);
        await see('Secondary workspace ' + language);
        await key('\r');
        await see(new RegExp(language + '-secondary[^\\n]*ctrl\\+p commands'));
        await key('\x10');
        await see('Commands');
        await key('Open SpecTorque');
        await see('Open SpecTorque');
        await key('\r');
        await see(alternate.id);
      } finally {
        delayed.complete(true);
      }
      await see(alternate.id);
      assert.ok(!text().includes((await expected(workspace, scope)).id));
      await assertDisconnected(browserUrl);
      await key('w');
      await see('Common workbench');
      const recoveredFrame = await see(/http:\/\/localhost:\d+/);
      const recoveredUrl = recoveredFrame.match(/http:\/\/localhost:\d+/)[0].replace('localhost', '127.0.0.1');
      assert.notEqual(recoveredUrl, browserUrl);
      assert.equal((await fetch(recoveredUrl)).ok, true);
      browserUrl = recoveredUrl;
    });
    await assertDisconnected(browserUrl);

    const messages = await api(service, workspace, env, 'GET', '/api/session/' + session.id + '/message');
    assert.deepEqual(messages.data, [], 'The seed session must have no model or user messages');
    const secondaryMessages = await api(service, secondary, env, 'GET', '/api/session/' + otherSession.id + '/message');
    assert.deepEqual(secondaryMessages.data, [], 'The secondary session must have no model or user messages');
    const after = await readFile(source);
    const separate = await profile(language + '-separate', false);
    for (const [name, profileEnv] of [['unconfigured', separate.env], ['removed', env]]) {
      if (name === 'removed') await writeFile(cli, JSON.stringify({ highlights: false, plugins: [] }));
      // Each profile has its own local service password. Standalone avoids cross-profile service attachment.
      await terminal(name, ['--standalone', workspace], async ({ see, key, text }) => {
        await see('ctrl+p');
        await key('/spectorque');
        await see('/spectorque');
        assert.ok(!text().includes('Open SpecTorque'), name + ' profile discovered /spectorque');
        await key('-review');
        await see('/spectorque-review');
        assert.ok(!text().includes('Review SpecTorque evidence'), name + ' profile discovered /spectorque-review');
      }, profileEnv);
    }
    assert.deepEqual(await readFile(source), after);
  } finally {
    await connection.stop();
    await service.stop();
  }
}

const sourceStatus = (await run('git', ['status', '--porcelain'])).stdout.trim();
const metadata = {
  commit: (await run('git', ['rev-parse', 'HEAD'])).stdout.trim(),
  cleanSource: !sourceStatus,
  sourceStatus,
  node: process.version,
  platform: process.platform,
  architecture: process.arch,
  osRelease: release(),
  osVersion: version(),
  variant,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  resources,
  results: {},
  networkBoundary: process.env.SPECTORQUE_OPENCODE_NETWORK ?? 'rejecting-proxy',
  blockedProxyDestinations: blocked,
};
try {
  if (process.env.CI === 'true') assert.equal(sourceStatus, '', 'Build the qualification archive from a clean checkout.');
  const clean = await profile('version', false);
  metadata.opencode = (await run(executable, ['--version'], { env: clean.env, cwd: scratch, timeout: 10_000 })).stdout.trim();
  assert.equal(metadata.opencode, 'opencode v2.1.4');
  for (const language of ['en', 'es']) {
    await walkthrough(language);
    metadata.results[language] = 'passed';
  }
  assert.deepEqual(blocked, [], 'OpenCode attempted outbound HTTP(S) through the rejecting proxy');
} finally {
  await writeFile(join(output, 'evidence.json'), JSON.stringify(metadata, null, 2));
  console.log('OpenCode evidence:', output);
  proxy.closeAllConnections();
  await new Promise(done => proxy.close(done));
  await rm(scratch, { recursive: true, force: true });
}
