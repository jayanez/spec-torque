import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { analyze } from '../src/core.js';
import { hostIndex, readScope, scopeRequest, listFeatures } from '../src/integration.js';
import { bindWorkspace } from '../src/node/scoped-review.js';
import { startServer } from '../src/node/server.js';

const exec = promisify(execFile);
const tsx = import.meta.resolve('tsx');
const git = (cwd: string, ...args: string[]) => exec('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'init.defaultBranch=main', ...args], { cwd });
async function put(root: string, path: string, content: string) { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), content); }
const withoutTime = ({ createdAt: _, ...rest }: { createdAt: string }) => rest;

async function mcpAnalyze(cwd: string, feature: string) {
  const child = spawn(process.execPath, ['--import', tsx, resolve('src/mcp.ts')], { cwd, env: { ...process.env, SPECTORQUE_ROOT: '' }, stdio: ['pipe', 'pipe', 'pipe'] });
  try {
    const lines = createInterface({ input: child.stdout });
    const replies = new Map<number, (value: any) => void>();
    lines.on('line', line => { const message = JSON.parse(line); replies.get(message.id)?.(message); });
    let id = 0;
    const request = (method: string, params: unknown) => new Promise<any>(done => { replies.set(++id, done); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
    await request('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'parity', version: '1' } });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    const index = JSON.parse((await request('tools/call', { name: 'discover_specs', arguments: { index: true } })).result.content[0].text);
    const assessment = JSON.parse((await request('tools/call', { name: 'analyze_specs', arguments: { feature } })).result.content[0].text);
    return { features: index.features.map((f: { id: string }) => f.id), assessment };
  } finally { child.kill(); }
}

test('CLI, MCP, the workbench, Codex and the in-process adapters agree on features and assessments', async () => {
  const root = await mkdtemp(join(tmpdir(), 'spectorque-parity-'));
  try {
    await git(root, 'init', '-q');
    await put(root, '.gitignore', '.claude/worktrees/\n');
    await put(root, 'AGENTS.md', '# Agents\nRequirements use FR IDs.\n');
    for (const [id, text] of [['001-booking', 'The system MUST be fast.'], ['002-payments', 'The system MUST refund within 5 days.']]) {
      await put(root, `specs/${id}/spec.md`, `# ${id}\n\n- FR-001: ${text}\n`);
      await put(root, `specs/${id}/plan.md`, '# Plan\nImplements FR-001.\n');
      await put(root, `specs/${id}/tasks.md`, '- [ ] T001 Implement FR-001.\n');
    }
    await put(root, 'docs/notes/product-spec.md', '# Product\nThe service SHOULD log requests.\n');
    await put(root, '.claude/worktrees/copy/specs/009-copy/spec.md', '# Copy\n- FR-001: Copy.\n');
    await git(root, 'add', '-A'); await git(root, 'commit', '-qm', 'fixture');
    const feature = 'specs/002-payments';

    // OpenCode and Pi read through the shared host index in process.
    const index = await hostIndex(join(root, 'specs'));
    const features = index.features.map(f => f.id);
    assert.deepEqual(features, ['specs/001-booking', 'specs/002-payments', 'docs/notes']);
    assert.deepEqual(listFeatures(index.entries).map(f => f.id), features);
    const expected: any = withoutTime(await analyze(await readScope(index, scopeRequest({ kind: 'feature', id: feature }))) as any);
    assert.ok(expected.artifacts.some((a: { path: string }) => a.path === 'AGENTS.md'));

    // The Claude pane and scripts use the CLI.
    const cliFeatures = JSON.parse((await exec(process.execPath, ['--import', tsx, resolve('src/cli.ts'), 'features', '--json'], { cwd: join(root, 'specs') })).stdout);
    assert.deepEqual(cliFeatures.features.map((f: { id: string }) => f.id), features);
    const cli = JSON.parse((await exec(process.execPath, ['--import', tsx, resolve('src/cli.ts'), 'analyze', root, '--feature', feature, '--json'])).stdout);
    assert.deepEqual(withoutTime(cli), expected);

    // Generic MCP hosts.
    const mcp = await mcpAnalyze(root, feature);
    assert.deepEqual(mcp.features, features);
    assert.deepEqual(withoutTime(mcp.assessment), expected);

    // Codex Desktop.
    const codex = await (await bindWorkspace(root)).assess(feature);
    assert.deepEqual(codex.features, features);
    assert.deepEqual(withoutTime(codex.assessment as any), expected);

    // The common workbench, used by VS Code and every host handoff.
    const { server, url } = await startServer(root, 0, feature);
    try {
      const token = (await (await fetch(url + '/api/session')).json()).token;
      const headers = { 'X-SpecTorque-Token': token };
      const listed = await (await fetch(url + '/api/features', { headers })).json();
      assert.deepEqual(listed.features.map((f: { id: string }) => f.id), features);
      assert.equal(listed.preselected, feature);
      const set = await (await fetch(url + '/api/workspace?feature=' + encodeURIComponent(feature), { headers })).json();
      assert.deepEqual(withoutTime(await analyze(set) as any), expected);
    } finally { server.close(); server.closeAllConnections(); }
  } finally { await rm(root, { recursive: true, force: true }); }
});
