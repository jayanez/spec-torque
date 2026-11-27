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
