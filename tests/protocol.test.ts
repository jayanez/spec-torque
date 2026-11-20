import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { createInterface } from 'node:readline';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
const exec = promisify(execFile);

test('CLI exposes machine-readable output and an explicit incomplete-evidence failure policy', async () => {
  const output = await exec(process.execPath, ['--import', 'tsx', 'src/cli.ts', 'analyze', 'fixtures', '--json']);
  assert.equal(JSON.parse(output.stdout).practices.length, 40);
  await assert.rejects(exec(process.execPath, ['--import', 'tsx', 'src/cli.ts', 'analyze', 'fixtures', '--require-complete']), (e: any) => e.code === 2);
});

test('real MCP stdio handshake, analysis, validation errors and read-only tool surface', async t => {
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/mcp.ts'], { env: { ...process.env, SPECTORQUE_ROOT: resolve('fixtures') }, stdio: ['pipe', 'pipe', 'pipe'] });
  t.after(() => { child.kill(); });
  let id = 0;
  const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  const lines = createInterface({ input: child.stdout });
  lines.on('line', line => { const msg = JSON.parse(line); const p = pending.get(msg.id); if (p) { clearTimeout(p.timer); pending.delete(msg.id); p.resolve(msg); } });
  const request = (method: string, params: unknown) => new Promise<any>((resolve, reject) => {
    const requestId = ++id;
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('MCP response timed out')); }, 8000);
    pending.set(requestId, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params }) + '\n');
  });
  const init = await request('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'spectorque-test', version: '1' } });
  assert.equal(init.result.serverInfo.name, 'spectorque');
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const list = await request('tools/list', {});
  assert.equal(list.result.tools.length, 6);
  assert.ok(list.result.tools.every((tool: any) => tool.annotations.readOnlyHint));
  assert.ok(!list.result.tools.some((tool: any) => /apply|write/i.test(tool.name)));
  const assessment = await request('tools/call', { name: 'analyze_specs', arguments: {} });
  assert.equal(JSON.parse(assessment.result.content[0].text).practices.length, 40);
  const escaped = await request('tools/call', { name: 'refinement_context', arguments: { path: '../README.md', line: 1 } });
  assert.equal(escaped.result.isError, true);
});

test('CLI nested-file proposals retain workspace-relative paths for native apply', async () => {
  const root = resolve('fixtures/en-draft');
  const result = await exec(process.execPath, ['--import', 'tsx', 'src/cli.ts', 'refine', resolve(root, 'specs/booking/spec.md'), '--root', root, '--line', '5', '--replacement', 'FR-001: The system MUST be [NEEDS CLARIFICATION: define fast].']);
  assert.equal(JSON.parse(result.stdout).proposal.path, 'specs/booking/spec.md');
});

test('CLI rejects multiline refinements without changing the source file', async () => {
  const { mkdtemp, writeFile, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const root = await mkdtemp(join(tmpdir(), 'spectorque-cli-line-'));
  const path = join(root, 'spec.md');
  const source = 'FR-001: The service MUST run.';
  try {
    await writeFile(path, source);
    await assert.rejects(exec(process.execPath, ['--import', 'tsx', 'src/cli.ts', 'refine', path, '--root', root, '--line', '1', '--replacement', source + '\nAnother line.', '--apply']), /single line/);
    assert.equal(await readFile(path, 'utf8'), source);
  } finally { await rm(root, { recursive: true, force: true }); }
});
