import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
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
for (const path of ['runtime/server.mjs', 'runtime/viewer.html', 'runtime/workbench.mjs', 'web-dist/index.html',
  'skills/spec-author/SKILL.md', 'skills/spec-refine/SKILL.md', 'skills/spec-review/SKILL.md',
  'skills/spec-view/SKILL.md', 'skills/spec-view/agents/openai.yaml',
  'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES']) assert.ok(entries[path], path);

const scratch = await realpath(await mkdtemp(join(tmpdir(), 'spectorque codex package ')));
const install = join(scratch, 'installed plugin');
const worktree = join(scratch, 'trusted worktree');
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
  await writeFile(join(worktree, 'specs', 'demo', 'spec.md'), '# Demo\nFR-001: The system MUST be fast.\n');
  const root = await realpath(worktree);
  const runtime = join(install, 'runtime');
  const setup = execFileSync(process.execPath, [join(install, 'setup-workspace.mjs'), worktree], { cwd: scratch, env, encoding: 'utf8' });
  assert.ok(setup.includes('args = [' + JSON.stringify(join(runtime, 'server.mjs')) + ']'));
  assert.ok(setup.includes('SPECTORQUE_ROOT = ' + JSON.stringify(root)));
  assert.match(setup, /add --feature <feature-id>/);
  const scoped = execFileSync(process.execPath, [join(install, 'setup-workspace.mjs'), worktree, 'specs/demo'], { cwd: scratch, env, encoding: 'utf8' });
  assert.match(scoped, /'--feature' 'specs\/demo'|--feature specs\/demo|'--feature' "specs\/demo"/);
  const stamp = JSON.stringify({ digest, version: manifest.version, node: process.version, platform: process.platform + '/' + process.arch });
  console.log(stamp);
  await checkMcp();
  await checkWorkbench();
  console.log('Relocated package, scoped MCP resource, evidence and workbench HTTP passed.');
} finally {
  await rm(scratch, { recursive: true, force: true });
}

async function withProcess(args, options, callback) {
  const child = spawn(process.execPath, args, {
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
    await request('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'package-check', version: '1' } });
    send({ method: 'notifications/initialized' });
    const { tools } = await request('tools/list', {});
    assert.deepEqual(tools.map(tool => tool.name).sort(), ['assess_worktree', 'open_spectorque', 'preview_refinement']);
    assert.ok(tools.every(tool => tool.annotations.readOnlyHint));
    const open = tools.find(tool => tool.name === 'open_spectorque');
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

async function checkWorkbench() {
  await withProcess([join(install, 'runtime/workbench.mjs'), 'serve', '--root', worktree, '--port', '0'], {}, async (_child, lines) => {
    const timeout = AbortSignal.timeout(8000);
    const [line] = await Promise.race([once(lines, 'line'), once(timeout, 'abort').then(() => { throw new Error('Workbench startup timed out.'); })]);
    const url = /^SpecTorque workbench: (http:\/\/127\.0\.0\.1:\d+)$/.exec(line)?.[1];
    assert.ok(url, line);
    const page = await fetch(url + '/?review=1');
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<title>SpecTorque<\/title>|<title>SpecTorque[^<]*<\/title>/);
    const session = await (await fetch(url + '/api/session')).json();
    assert.match(session.token, /^[a-f0-9]{64}$/);
  });
}
