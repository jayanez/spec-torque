import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { unzipSync } from 'fflate';

const manifest = JSON.parse(await readFile(new URL('../integrations/codex/plugin.json', import.meta.url), 'utf8'));
const archive = resolve(process.argv[2] ?? 'artifacts/spectorque-codex-' + manifest.version + '.zip');
const bytes = await readFile(archive);
const digest = createHash('sha256').update(bytes).digest('hex');
assert.equal((await readFile(archive + '.sha256', 'utf8')).split(' ')[0], digest);
const entries = unzipSync(bytes);
assert.equal(JSON.parse(Buffer.from(entries['plugin.json'])).version, manifest.version);
assert.ok(!entries['mcp.json'] && !entries['.mcp.json'], 'Only the project config should register the MCP server.');
for (const path of ['setup-workspace.mjs', 'runtime/server.mjs', 'runtime/viewer.html', 'runtime/workbench.mjs', 'web-dist/index.html',
  'skills/spec-author/SKILL.md', 'skills/spec-refine/SKILL.md', 'skills/spec-review/SKILL.md',
  'skills/spec-view/SKILL.md', 'skills/spec-view/agents/openai.yaml',
  'skills/spec-workbench/SKILL.md', 'skills/spec-workbench/agents/openai.yaml',
  'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES']) assert.ok(entries[path]?.length > 0, path);

const scratch = await realpath(await mkdtemp(join(tmpdir(), 'spectorque codex package ')));
const install = join(scratch, 'installed plugin');
const worktree = join(scratch, "trusted project's worktree");
const env = { ...process.env };
delete env.OPENAI_API_KEY;
delete env.CODEX_API_KEY;
delete env.NODE_PATH;
try {
  for (const [path, content] of Object.entries(entries)) {
    assert.ok(!path.startsWith('/') && !/[:\\]/.test(path) && !path.split('/').includes('..'));
    const file = join(install, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, content, { flag: 'wx' });
  }
  await mkdir(join(worktree, 'specs', 'demo'), { recursive: true });
  const specPath = join(worktree, 'specs', 'demo', 'spec.md');
  const spec = '# Demo\nFR-001: The system MUST be fast.\n';
  await writeFile(specPath, spec);
  const root = await realpath(worktree);
  const runtime = join(install, 'runtime');
  const beforeSetup = await readdir(worktree, { recursive: true });
  const setup = execFileSync(process.execPath, [join(install, 'setup-workspace.mjs'), worktree], { cwd: scratch, env, encoding: 'utf8' });
  assert.ok(setup.includes('args = [' + JSON.stringify(join(runtime, 'server.mjs')) + ']'));
  assert.ok(setup.includes('SPECTORQUE_ROOT = ' + JSON.stringify(root)));
  assert.match(setup, /add --feature <feature-id>/);
  assert.deepEqual((await readdir(worktree, { recursive: true })).sort(), beforeSetup.sort(), 'Setup must not create files or directories.');
  assert.equal(await readFile(specPath, 'utf8'), spec);
  const environmentDir = join(worktree, '.codex', 'environments');
  const environmentPath = join(environmentDir, 'environment.toml');
  const existingEnvironment = 'version = 1\nname = "Existing environment"\n\n[setup]\nscript = "npm ci"\n';
  const configPath = join(worktree, '.codex', 'config.toml');
  const existingConfig = '# Existing project configuration\n';
  await mkdir(environmentDir, { recursive: true });
  await writeFile(environmentPath, existingEnvironment);
  await writeFile(configPath, existingConfig);
  const beforeScopedSetup = await readdir(worktree, { recursive: true });
  const scoped = execFileSync(process.execPath, [join(install, 'setup-workspace.mjs'), worktree, 'specs/demo'], { cwd: scratch, env, encoding: 'utf8' });
  assert.match(scoped, /'--feature' 'specs\/demo'|--feature specs\/demo|'--feature' "specs\/demo"/);
  assert.deepEqual((await readdir(worktree, { recursive: true })).sort(), beforeScopedSetup.sort());
  assert.equal(await readFile(environmentPath, 'utf8'), existingEnvironment, 'Setup must not edit an existing environment.');
  assert.equal(await readFile(configPath, 'utf8'), existingConfig, 'Setup must not edit the project MCP configuration.');
  assert.equal(await readFile(specPath, 'utf8'), spec);
  let actionCommand;
  if (process.platform === 'win32') {
    for (const output of [setup, scoped]) {
      assert.match(output, /environment action is unavailable on Windows/);
      assert.doesNotMatch(output, /\[\[actions\]\]/);
    }
  } else {
    assert.match(setup, /Create \.codex\/environments\/environment\.toml/);
    assert.match(setup, /\nversion = 1\nname = "SpecTorque workbench"\n\n\[setup\]\nscript = ""\n/);
    assert.match(scoped, /Merge this block into the worktree’s \.codex\/environments\/environment\.toml/);
    assert.doesNotMatch(scoped, /\[setup\]|^version = /mu);
    actionCommand = readActionCommand(setup);
    assert.match(readActionCommand(scoped), / '--feature' 'specs\/demo'$/);
  }
  const stamp = JSON.stringify({ digest, version: manifest.version, node: process.version, platform: process.platform + '/' + process.arch });
  console.log(stamp);
  await checkMcp();
  await checkWorkbench(actionCommand);
  console.log('Relocated package, print-only setup, scoped MCP resource, evidence and workbench HTTP passed.');
} finally {
  await rm(scratch, { recursive: true, force: true });
}

function readActionCommand(output) {
  const block = /\n\[\[actions\]\]\nname = "Open SpecTorque workbench"\nicon = "run"\ncommand = ("[^\n]+")\n/u.exec(output);
  assert.ok(block, 'Setup must print the workbench action.');
  const command = JSON.parse(block[1]);
  assert.equal(command, output.trimEnd().split('\n').at(-1), 'The action must run the same command as the terminal fallback.');
  return command;
}

async function withProcess(args, options, callback, executable = process.execPath) {
  const child = spawn(executable, args, {
    cwd: scratch, env: { ...env, ...options }, stdio: ['pipe', 'pipe', 'pipe'],
  });
  const closed = once(child, 'close').catch(() => {});
  const lines = createInterface({ input: child.stdout });
  child.stderr.on('data', chunk => process.stderr.write(chunk));
  child.stdin.on('error', () => {});
  try {
    await callback(child, lines);
  } finally {
    lines.close();
    child.kill();
    await closed;
  }
}

async function checkMcp() {
  await withProcess([join(install, 'runtime/server.mjs')], { SPECTORQUE_ROOT: worktree }, async (child, lines) => {
    const input = lines[Symbol.asyncIterator]();
    let sequence = 0;
    const send = message => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');
    async function request(method, params) {
      const id = ++sequence;
      send({ id, method, params });
      const timeout = AbortSignal.timeout(8000);
      const next = await Promise.race([input.next(), once(timeout, 'abort').then(() => { throw new Error('MCP timeout: ' + method); })]);
      assert.ok(!next.done, 'MCP exited during ' + method);
      const response = JSON.parse(next.value);
      assert.equal(response.id, id);
      assert.ok(!response.error, JSON.stringify(response.error));
      return response.result;
    }
    const init = await request('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'package-check', version: '1' } });
    assert.equal(init.serverInfo.name, 'spectorque-workspace', 'spec-view names this server');
    send({ method: 'notifications/initialized' });
    const { tools } = await request('tools/list', {});
    assert.deepEqual(tools.map(tool => tool.name).sort(), ['assess_worktree', 'open_spectorque', 'preview_refinement']);
    assert.ok(tools.every(tool => tool.annotations.readOnlyHint));
    const open = tools.find(tool => tool.name === 'open_spectorque');
    assert.deepEqual(Object.keys(open.inputSchema.properties).sort(), ['base', 'changed', 'feature'], 'spec-view passes these arguments');
    const { contents } = await request('resources/read', { uri: open._meta.ui.resourceUri });
    assert.equal(contents[0].mimeType, 'text/html;profile=mcp-app');
    assert.equal(contents[0].text, await readFile(join(install, 'runtime/viewer.html'), 'utf8'));
    const response = await request('tools/call', { name: 'assess_worktree', arguments: { feature: 'specs/demo' } });
    assert.deepEqual(response.content, [{ type: 'text', text: 'Local assessment available in the viewer.' }]);
    assert.equal(response.structuredContent, undefined);
    const view = response._meta.assessmentView;
    assert.equal(view.root, await realpath(worktree));
    assert.equal(view.feature, 'specs/demo');
    assert.ok(view.assessment.findings.some(f => f.evidence.some(e => e.path === 'specs/demo/spec.md' && e.line === 2)));
  });
}

async function checkWorkbench(actionCommand) {
  const args = actionCommand ? ['-c', 'exec ' + actionCommand] : [join(install, 'runtime/workbench.mjs'), 'serve', '--root', worktree, '--port', '0'];
  await withProcess(args, {}, async (_child, lines) => {
    const timeout = AbortSignal.timeout(8000);
    const output = lines[Symbol.asyncIterator]();
    const [address, workspace] = await Promise.race([
      Promise.all([output.next(), output.next()]),
      once(timeout, 'abort').then(() => { throw new Error('Workbench startup timed out.'); }),
    ]);
    const url = /^SpecTorque workbench: (http:\/\/127\.0\.0\.1:\d+)$/.exec(address.value)?.[1];
    assert.ok(url, address.value);
    assert.equal(workspace.value, 'Workspace: ' + await realpath(worktree));
    const page = await fetch(url + '/');
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<title>SpecTorque<\/title>|<title>SpecTorque[^<]*<\/title>/);
    assert.equal((await fetch(url + '/?review=1')).status, 200);
    const session = await (await fetch(url + '/api/session')).json();
    assert.match(session.token, /^[a-f0-9]{64}$/);
  }, actionCommand ? '/bin/sh' : process.execPath);
}
