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
