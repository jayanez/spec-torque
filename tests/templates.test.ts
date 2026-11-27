import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classifyPath, isSpecCandidate, listFeatures } from '../src/core/artifacts.js';

// H92 (#92): framework template folders are scaffolding, never discovered; user folders named templates stay.
const twins = JSON.parse(readFileSync(new URL('../fixtures/precision/h92-paths.json', import.meta.url), 'utf8')) as {
  excluded: string[]; kept: string[]; listing: { paths: string[]; features: string[] };
};

test('framework template folders are not discovery candidates in either mode', () => {
  for (const path of twins.excluded) for (const basenameOnly of [true, false]) assert.equal(isSpecCandidate(path, basenameOnly), false, `${path} (${basenameOnly ? 'workspace' : 'GitHub'})`);
});

test('user folders named templates and near names stay candidates', () => {
  for (const path of twins.kept) for (const basenameOnly of [true, false]) assert.equal(isSpecCandidate(path, basenameOnly), true, `${path} (${basenameOnly ? 'workspace' : 'GitHub'})`);
});

test('a user templates folder is an ordinary feature, sorted by name', () => {
  assert.deepEqual(listFeatures(twins.listing.paths.map(p => classifyPath(p))).map(f => f.id), twins.listing.features);
});

test('GitHub import neither fetches nor returns framework templates', async () => {
  const { importGitHub } = await import('../src/node/github.js');
  const tree = ['.specify/templates/spec-template.md', '.kittify/missions/software-dev/templates/spec-template.md', 'specs/001-a/spec.md', 'templates/spec.md']
    .map((path, i) => ({ path, type: 'blob', size: 10, sha: `sha${i}` }));
  const fetched: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    fetched.push(url);
    const body = url.endsWith('/demo/repo') ? { default_branch: 'main', private: false }
      : url.includes('/commits/') ? { sha: 'c0ffee' }
      : url.includes('/git/trees/') ? { tree, truncated: false }
      : { encoding: 'base64', content: Buffer.from('# Spec\n').toString('base64') };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try {
    const set = await importGitHub('demo/repo');
    assert.deepEqual(set.artifacts.map(a => a.path), ['specs/001-a/spec.md', 'templates/spec.md']);
    assert.deepEqual(fetched.filter(u => u.includes('/git/blobs/')).map(u => u.split('/').at(-1)), ['sha2', 'sha3']);
  } finally { globalThis.fetch = original; }
});

test('an explicit scope inside a template folder fails with a reason; its parent still reads', async () => {
  const { mkdtemp, mkdir, rm, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { dirname, join } = await import('node:path');
  const { indexWorkspace } = await import('../src/node/scope.js');
  const { readScope } = await import('../src/node/workspace.js');
  const root = await mkdtemp(join(tmpdir(), 'spectorque-h92-'));
  const put = async (path: string, text: string) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), text); };
  try {
    await put('.specify/templates/spec-template.md', '# Feature Specification: [FEATURE NAME]\n');
    await put('.specify/memory/constitution.md', '# Constitution\n');
    await put('.specify/specs/001-a/templates/spec.md', '# A\n\n- FR-001: The system MUST be fast.\n');
    const index = await indexWorkspace(root);
    assert.deepEqual(index.entries.map(e => e.path), ['.specify/memory/constitution.md', '.specify/specs/001-a/templates/spec.md']);
    for (const request of [{ paths: ['.specify/templates'] }, { paths: ['.specify/templates/spec-template.md'] }, { feature: '.specify/templates' }])
      await assert.rejects(readScope(index, request), /template folder; templates are not analyzed/, JSON.stringify(request));
    await assert.rejects(readScope({ ...index, focus: '.specify/templates' }), /template folder/);
    assert.deepEqual((await readScope(index, { paths: ['.specify'] })).artifacts.map(a => a.path), ['.specify/memory/constitution.md', '.specify/specs/001-a/templates/spec.md']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a GitHub tree URL to a template folder fails before any request', async () => {
  const { importGitHub } = await import('../src/node/github.js');
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = (async () => { requests++; throw new Error('no network'); }) as typeof fetch;
  try {
    await assert.rejects(importGitHub('https://github.com/demo/repo/tree/main/.specify/templates'), /templates, which are not analyzed/);
    assert.equal(requests, 0);
  } finally { globalThis.fetch = original; }
});
