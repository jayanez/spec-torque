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

test('exports reject Windows-normalized traversal, reserved names and portable collisions', () => {
  for (const path of ['.. /spec.md', 'specs/CON.md', 'specs/spec.md.', 'specs/spec.md ', 'specs/COM¹.md', 'specs/a:b.md']) assert.throws(() => artifactArchive({ name: 'unsafe', artifacts: [classifyArtifact(path, 'text')] }), /Unsafe/);
  for (const paths of [['specs/A/spec.md', 'specs/a/spec.md'], ['specs/café.md', 'specs/cafe\u0301.md']]) assert.throws(() => artifactArchive({ name: 'colliding', artifacts: paths.map(p => classifyArtifact(p, 'text')) }), /Duplicate/);
});
test('export size bound rejects oversized input before creating an archive', () => {
  assert.throws(() => artifactArchive({ name: 'large', artifacts: [classifyArtifact('spec.md', 'a'.repeat(20_000_001))] }), /20 MB/);
});
