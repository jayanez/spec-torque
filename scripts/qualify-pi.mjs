import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { access, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { qualifyTerminal } from './qualify-pi-terminal.mjs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { unzipSync } from 'fflate';
import { analyze, discoverWorkspace, reviewWorkspace, selectFeature, terminalSummary } from '../dist/integration.js';

const [cli, option, packagePath, terminalOption, ptyPath, ...extra] = process.argv.slice(2);
if (!cli || extra.length || (option !== undefined && (!['--installed-package', '--installed-archive'].includes(option) || !packagePath)) ||
  (terminalOption !== undefined && (terminalOption !== '--terminal-driver' || !ptyPath))) {
  throw new Error('Usage: qualify:pi -- <pi-cli.js> [--installed-package <folder> | --installed-archive <ZIP>] [--terminal-driver <node-pty-folder>]');
}
const client = resolve(cli);
const pty = ptyPath && createRequire(import.meta.url)(resolve(ptyPath));
const scratch = await mkdtemp(join(tmpdir(), 'spectorque-pi-'));

function isolatedEnv(agent) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    /^(PATH|SYSTEMROOT|WINDIR|COMSPEC|PATHEXT|TEMP|TMP|TMPDIR|TERM|LANG)$/i.test(name)));
  Object.assign(env, {
    HOME: agent, USERPROFILE: agent, XDG_CONFIG_HOME: agent,
    PI_CODING_AGENT_DIR: agent, PI_OFFLINE: '1', PI_TELEMETRY: '0', TERM: 'xterm-256color',
  });
  return env;
}

function runPi(workspace, agent, args, input) {
  const result = spawnSync(process.execPath, [client, ...args], {
    cwd: workspace, env: isolatedEnv(agent), input, encoding: 'utf8', timeout: 60_000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

const common = ['--offline', '--no-session', '--no-context-files', '--no-mcp'];
const skills = ['spec-author', 'spec-refine', 'spec-review'];
const resources = ['spectorque', ...skills.map(name => 'skill:' + name)];

function verifyDiscovery(workspace, agent, trust, installed, artifact) {
  const { stdout } = runPi(workspace, agent, [...common, trust, '--mode', 'rpc'],
    JSON.stringify({ type: 'get_commands' }) + '\n');
  const response = stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
    .find(event => event.type === 'response' && event.command === 'get_commands');
  assert.equal(response?.success, true, stdout);
  const discovered = response.data.commands.filter(command => resources.includes(command.name));
  assert.deepEqual(discovered.map(command => command.name).sort(), installed ? [...resources].sort() : []);
  for (const command of discovered) {
    assert.equal(command.source, command.name === 'spectorque' ? 'extension' : 'skill');
    const path = command.sourceInfo?.path ?? command.path;
    assert.ok(path, 'Pi must report resource provenance');
    const fromArtifact = relative(artifact, path);
    assert.ok(fromArtifact && !isAbsolute(fromArtifact) && !fromArtifact.startsWith('..'), path);
    console.log(`discovered ${command.name} from ${fromArtifact}`);
  }
}

// RPC hosts (for example desktop shells) render dialogs through the extension UI
// protocol. Choose one feature and cancel at evidence selection, so nothing is written.
async function verifyRpcScope(workspace, agent, load, feature) {
  const child = spawn(process.execPath, [client, ...common, ...load, '--mode', 'rpc'], {
    cwd: workspace, env: isolatedEnv(agent), stdio: ['pipe', 'pipe', 'pipe'],
  });
  const seen = { scopes: undefined, widget: undefined, evidence: undefined };
  let buffer = '';
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  const done = new Promise((resolveDone, rejectDone) => {
    const timer = setTimeout(() => fail(new Error('RPC scope check timed out')), 60_000);
    const fail = error => { clearTimeout(timer); rejectDone(new Error(error.message + '\n' + stderr)); };
    child.on('error', fail);
    child.on('exit', code => fail(new Error('Pi exited before evidence selection: ' + code)));
    child.stdout.on('data', chunk => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        let event;
        try { event = JSON.parse(line); } catch { fail(new Error('Unexpected RPC output: ' + line)); return; }
        if (event.type === 'agent_start') fail(new Error('No model turn may start'));
        if (event.type !== 'extension_ui_request') continue;
        if (event.method === 'setWidget' && event.widgetKey === 'spectorque') seen.widget = event.widgetLines;
        if (event.method !== 'select') continue;
        if (event.title === 'SpecTorque · select scope') {
          seen.scopes = event.options;
          child.stdin.write(JSON.stringify({ type: 'extension_ui_response', id: event.id, value: 'Feature · ' + feature }) + '\n');
        } else if (event.title === 'SpecTorque · select evidence') {
          seen.evidence = event.options;
          child.stdin.write(JSON.stringify({ type: 'extension_ui_response', id: event.id, cancelled: true }) + '\n');
          clearTimeout(timer);
          resolveDone();
        }
      }
    });
  });
  child.stdin.write(JSON.stringify({ id: 'scope', type: 'prompt', message: '/spectorque' }) + '\n');
  try { await done; } finally { child.kill(); }
  return seen;
}

async function extractPiArchive(archivePath, artifact) {
  const bytes = await readFile(archivePath);
  const files = Object.entries(unzipSync(bytes));
  for (const [path, content] of files) {
    assert.ok(path.split('/').every(part => /^[a-z0-9_-][a-z0-9_.-]*$/i.test(part) && !part.endsWith('.')),
      'Unexpected path in Pi archive: ' + path);
    const target = join(artifact, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, { flag: 'wx' });
  }
  console.log('Package ZIP SHA-256: ' + createHash('sha256').update(bytes).digest('hex'));
}

try {
  let artifact;
  if (packagePath) {
    artifact = join(scratch, 'pi-spectorque');
    if (option === '--installed-archive') await extractPiArchive(packagePath, artifact);
    else await cp(resolve(packagePath), artifact, { recursive: true, filter: path => !path.split(/[\\/]/).includes('node_modules') });
    const manifest = JSON.parse(await readFile(join(artifact, 'package.json'), 'utf8'));
    assert.equal(manifest.name, 'pi-spectorque');
    for (const path of ['index.ts', 'runtime/integration.js', 'runtime/cli.js', 'web-dist/index.html',
      'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES', ...skills.map(name => `skills/${name}/SKILL.md`)]) {
      await access(join(artifact, path));
    }
    const digest = createHash('sha256');
    const files = await readdir(artifact, { recursive: true, withFileTypes: true });
    const paths = files.filter(entry => entry.isFile())
      .map(entry => relative(artifact, join(entry.parentPath, entry.name)).split('\\').join('/')).sort();
    for (const path of paths) {
      const hash = createHash('sha256').update(await readFile(join(artifact, path))).digest('hex');
      digest.update(JSON.stringify([path, hash]) + '\n');
    }
    console.log(`Package file digest (SHA-256): ${digest.digest('hex')}`);
    console.log(`Pi ${runPi(scratch, scratch, ['--version']).stdout.trim()} / ${manifest.name}@${manifest.version} / Node ${process.version} / ${process.platform}/${process.arch}`);
  }
  for (const language of ['en', 'es']) {
    const workspace = join(scratch, language);
    const agent = join(scratch, language + '-agent');
    await mkdir(agent);
    await cp(resolve('fixtures/' + language + '-draft'), workspace, { recursive: true });
    const source = join(workspace, 'specs/booking/spec.md');
    const before = await readFile(source);
    const expected = terminalSummary(await reviewWorkspace(workspace)).join('\n');
    if (artifact) {
      runPi(workspace, agent, ['install', artifact, '--local', '--approve']);
      const settings = JSON.parse(await readFile(join(workspace, '.pi', 'settings.json'), 'utf8'));
      assert.equal(settings.packages.length, 1);
      await assert.rejects(access(join(agent, 'settings.json')), { code: 'ENOENT' });
      verifyDiscovery(workspace, agent, '--no-approve', false, artifact);
      verifyDiscovery(workspace, agent, '--approve', true, artifact);
    }
    for (const mode of ['text', 'json']) {
      const load = artifact ? ['--approve'] : [
        '--no-extensions', '--no-skills', '--extension', resolve('integrations/pi/index.ts'),
      ];
      const result = runPi(workspace, agent, [...common, ...load, '--mode', mode, '-p', '/spectorque']);
      assert.equal(result.stderr, '');
      if (mode === 'text') assert.equal(result.stdout, expected + '\n');
      else {
        const events = result.stdout.trim().split('\n').map(line => JSON.parse(line));
        const messages = events.filter(event => event.type === 'message_end').map(event => event.message);
        assert.equal(messages.length, 1);
        assert.equal(messages[0].role, 'custom');
        assert.equal(messages[0].customType, 'spectorque');
        assert.equal(messages[0].content, expected);
        assert.ok(!events.some(event => event.type === 'agent_start'), 'No model turn may start');
      }
      assert.deepEqual(await readFile(source), before);
      console.log(`${language}/${mode}: exact summary, source unchanged, isolated offline client passed`);
    }
    {
      const load = artifact ? ['--approve'] : [
        '--no-extensions', '--no-skills', '--extension', resolve('integrations/pi/index.ts'),
      ];
      const other = join(workspace, 'specs/other');
      await cp(resolve('fixtures/en-complete/specs/booking'), other, { recursive: true });
      const scoped = await analyze(selectFeature(await discoverWorkspace(workspace), 'specs/booking'));
      const seen = await verifyRpcScope(workspace, agent, load, 'specs/booking');
      assert.deepEqual(seen.scopes, ['All documents', 'Feature · specs/booking', 'Feature · specs/other']);
      assert.equal(seen.widget?.[0], terminalSummary(scoped)[0] + ' · Scope: specs/booking');
      assert.deepEqual(seen.evidence, scoped.findings.map((f, i) => `${i + 1}. ${f.message} · ${f.evidence[0].path}:${f.evidence[0].line}`));
      assert.deepEqual(await readFile(source), before);
      await rm(other, { recursive: true });
      console.log(`${language}/rpc: feature scope offered and applied, source unchanged`);
    }
    if (artifact) {
      if (pty) await qualifyTerminal(pty, {
        client, args: [...common, '--approve'], env: isolatedEnv(agent), workspace, language,
      });
      runPi(workspace, agent, ['remove', artifact, '--local', '--approve']);
      verifyDiscovery(workspace, agent, '--approve', false, artifact);
    }
  }
} finally {
  await rm(scratch, { recursive: true, force: true });
}
