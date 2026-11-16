import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../src/node/server.js';
import { createProposal } from '../src/core/refine.js';
import { parseGitHubSource } from '../src/node/github.js';
import { requestRewrite } from '../src/node/provider.js';
import { boundedJson } from '../src/node/http.js';

test('GitHub importer rejects unrelated hosts and invalid traversal', () => {
  assert.deepEqual(parseGitHubSource('jayanez/spec-torque'), { owner: 'jayanez', repo: 'spec-torque', ref: undefined, folder: undefined });
  assert.equal(parseGitHubSource('https://github.com/org/repo/tree/main/specs/feature').folder, 'specs/feature');
  for (const url of ['https://127.0.0.1/private', 'https://github.com.evil.test/org/repo', 'https://user@github.com/org/repo', 'https://github.com/org/repo?token=x', 'https://github.com/org/repo/tree/main/%2e%2e']) assert.throws(() => parseGitHubSource(url));
});
test('provider failures and malformed output never produce an edit', async () => {
  const config = { kind: 'ollama' as const, model: 'test' };
  await assert.rejects(requestRewrite(config, 'original', '', 'en', async () => { throw new Error('private upstream error'); }), /connection failed/);
  await assert.rejects(requestRewrite(config, 'original', '', 'en', async () => new Response('bad', { status: 401 })), /401/);
  await assert.rejects(requestRewrite(config, 'original', '', 'en', async () => Response.json({ message: { content: 'not json' } })), /invalid proposal/);
  const valid = await requestRewrite(config, 'original', '', 'en', async () => Response.json({ message: { content: JSON.stringify({ replacement: 'text', reason: 'reason' }) } }));
  assert.equal(valid.replacement, 'text');
});
test('response size limits abort streams before unbounded buffering', async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(100)); }, cancel() { cancelled = true; } }));
  await assert.rejects(boundedJson(response, 150), /size limit/);
  assert.equal(cancelled, true);
  await assert.rejects(boundedJson(new Response('{}', { headers: { 'Content-Length': '2000' } }), 100), /size limit/);
});
test('local HTTP enforces origin, session and exact reviewed write; undo checks the current revision', async () => {
  const root = await mkdtemp(join(tmpdir(), 'spectorque-http-'));
  const { server, url, token } = await startServer(root, 0);
  try {
    const source = 'FR-001: The system MUST respond in 2 seconds.\n';
    await writeFile(join(root, 'spec.md'), source);
    assert.equal((await fetch(url + '/api/workspace')).status, 403);
    assert.equal((await fetch(url + '/api/session', { headers: { Origin: 'https://evil.test' } })).status, 403);
    const csp = (await fetch(url + '/api/session')).headers.get('content-security-policy')!;
    assert.match(csp, /frame-ancestors 'self' vscode-webview: vscode-file:\/\/vscode-app;/);
    assert.ok(!csp.includes('*'), 'Embedding remains restricted to the local workbench and VS Code.');
    const headers = { 'Content-Type': 'application/json', 'X-SpecTorque-Token': token };
    const set = await (await fetch(url + '/api/workspace', { headers })).json();
    assert.equal(set.artifacts.length, 1);
    const proposal = await createProposal('spec.md', source, 1, 'FR-001: The booking system MUST respond in 2 seconds.', 'Name actor');
    assert.equal((await fetch(url + '/api/apply', { method: 'POST', headers, body: JSON.stringify({ proposal, approved: false }) })).status, 400);
    const applied = await (await fetch(url + '/api/apply', { method: 'POST', headers, body: JSON.stringify({ proposal, approved: true }) })).json();
    assert.ok(applied.undoId);
    assert.equal(await readFile(join(root, 'spec.md'), 'utf8'), applied.content);
    assert.equal((await fetch(url + '/api/undo', { method: 'POST', headers, body: JSON.stringify({ id: applied.undoId, approved: true }) })).status, 200);
    assert.equal(await readFile(join(root, 'spec.md'), 'utf8'), source);
    assert.equal((await fetch(url + '/api/undo', { method: 'POST', headers, body: JSON.stringify({ id: applied.undoId, approved: true }) })).status, 400);
  } finally { await new Promise<void>((r, reject) => server.close(e => e ? reject(e) : r())); await rm(root, { recursive: true, force: true }); }
});
