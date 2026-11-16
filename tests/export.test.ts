import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { artifactArchive } from '../src/web/archive.js';
import { classifyArtifact } from '../src/core/artifacts.js';

test('artifact ZIP preserves feature paths and bilingual text without basename collisions', () => {
  const set = { name: 'two features', artifacts: [classifyArtifact('specs/a/spec.md', 'FR-001: Reservar una habitación.'), classifyArtifact('specs/b/spec.md', 'FR-001: Book a room.')] };
  const files = unzipSync(new Uint8Array(artifactArchive(set)));
  assert.deepEqual(Object.keys(files), ['specs/a/spec.md', 'specs/b/spec.md']);
  assert.equal(strFromU8(files['specs/a/spec.md']), set.artifacts[0].content);
});
test('artifact exports reject extraction traversal and duplicate normalized paths', () => {
  for (const path of ['../spec.md', '/spec.md', 'C:/spec.md', 'a/../spec.md']) assert.throws(() => artifactArchive({ name: 'unsafe', artifacts: [classifyArtifact(path, 'text')] }), /Unsafe/);
  assert.throws(() => artifactArchive({ name: 'duplicate', artifacts: [classifyArtifact('a/spec.md', 'a'), classifyArtifact('a\\spec.md', 'b')] }), /Duplicate/);
});
