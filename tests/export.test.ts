import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { fileURLToPath } from 'node:url';
import { artifactArchive } from '../src/web/archive.js';
import { classifyArtifact } from '../src/core/artifacts.js';
import { discoverWorkspace } from '../src/node/workspace.js';
import { analyze } from '../src/core/analyze.js';
import { markdownReport } from '../src/core/report.js';

test('artifact ZIP preserves nested feature paths and bilingual bytes without basename collisions', async () => {
  const project = new URL('../fixtures/calibration/controls/nested-projects/', import.meta.url);
  const set = await discoverWorkspace(fileURLToPath(project));
  const files = unzipSync(new Uint8Array(artifactArchive(set)));
  const paths = set.artifacts.map(artifact => artifact.path).sort();
  assert.ok(paths.includes('apps/east/specs/intake/spec.md'));
  assert.ok(paths.includes('apps/west/specs/intake/spec.md'));
  assert.deepEqual(Object.keys(files).sort(), paths);
  for (const artifact of set.artifacts) assert.equal(strFromU8(files[artifact.path]), artifact.content);
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

test('portable collision detection covers Windows Unicode uppercase equivalence', () => {
  assert.throws(() => artifactArchive({ name: 'Turkish paths', artifacts: [classifyArtifact('specs/I.md', 'one'), classifyArtifact('specs/ı.md', 'two')] }), /Duplicate/);
});

test('Markdown report has no trailing whitespace while the JSON evidence keeps the source text (#126)', async () => {
  const cut = 'FR-001: The system MUST record each booking. ' + 'x'.repeat(254) + ' tail';
  const padded = 'FR-002: The system MUST be fast.  ';
  const tabbed = 'FR-003: The system MUST log each booking.\t';
  assert.equal(cut[299], ' ');
  const result = await analyze({ name: 'whitespace', artifacts: [classifyArtifact('spec.md', `# Booking\n${cut}\n${padded}\n${tabbed}\n`)] });
  const texts = [...result.practices.flatMap(p => p.evidence), ...result.findings.flatMap(f => f.evidence)].map(e => e.text);
  assert.ok(texts.includes(cut.slice(0, 300)), 'evidence keeps the untrimmed 300-character cut');
  assert.ok(texts.includes(padded) && texts.includes(tabbed), 'evidence keeps the trailing spaces and tab of the source lines');
  const report = markdownReport(result);
  for (const text of [cut.slice(0, 300), padded, tabbed]) assert.ok(report.includes(text.trimEnd() + '\n'), 'the evidence stays in the report, trimmed');
  assert.deepEqual(report.split('\n').filter(line => /[ \t]$/.test(line)), []);
  // Only ends of lines are trimmed: spaces before a lone carriage return inside a quoted line stay.
  const lone = await analyze({ name: 'cr', artifacts: [classifyArtifact('spec.md', '# Booking\nFR-001: The system MUST be fast.  \rnext\n')] });
  assert.ok(markdownReport(lone).includes('fast.  \rnext\n'));
  // Linear trimming: a long run of spaces inside a line does not make the report quadratic.
  const spaced = ' '.repeat(200_000) + 'x';
  assert.ok(markdownReport({ ...result, name: spaced }).startsWith(`# SpecTorque report: ${spaced}\n`));
});
