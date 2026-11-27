import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyze, classifyArtifact } from '../src/core.js';
import { archiveEngine, git } from '../scripts/precision/engines.js';
import { definingHeadings, judge } from '../scripts/precision/heading-judge.js';

// H52 (#52): defining ID headings count as identified requirement units for I1.2 and I2.2.
type Twin = { id: string; files: Record<string, string[]>; expected: string[]; status: Record<string, string> };
const { cases } = JSON.parse(readFileSync(new URL('../fixtures/precision/h52-pairs.json', import.meta.url), 'utf8')) as { cases: Twin[] };
const setOf = (twin: Twin) => ({ name: twin.id, artifacts: Object.entries(twin.files).map(([path, lines]) => classifyArtifact(path, lines.join('\n') + '\n')) });
const keyOf = (f: { practiceId: string; message: string; evidence: { path: string; line: number }[] }) => `${f.practiceId}|${f.evidence[0]?.path}|${f.evidence[0]?.line}|${f.message}`;

test('every H52 twin meets its pinned I1.2/I2.2 status and findings', async () => {
  for (const twin of cases) {
    const a = await analyze(setOf(twin));
    for (const [id, status] of Object.entries(twin.status)) assert.equal(a.practices.find(p => p.id === id)?.status, status, `${twin.id} ${id}`);
    assert.deepEqual(a.findings.filter(f => ['I1.2', 'I2.3'].includes(f.practiceId)).map(keyOf).sort(), [...twin.expected].sort(), twin.id);
  }
});

test('a defining heading is cited as I1.2 evidence when no admitted line carries an ID', async () => {
  const a = await analyze(setOf(cases.find(c => c.id === 'gwt-only-en')!));
  assert.deepEqual(a.practices.find(p => p.id === 'I1.2')!.evidence.map(e => e.line), [3]);
});

test('definingHeadings follows the pre-registered definition', () => {
  const found = (id: string) => definingHeadings(setOf(cases.find(c => c.id === id)!).artifacts).map(e => e.line);
  assert.deepEqual(found('gwt-only-en'), [3]);
  assert.deepEqual(found('duplicate-headings-es'), [3, 7]);
  for (const id of ['heading-without-id-en', 'id-late-in-title-en', 'non-family-user-story-en', 'non-family-document-id-en', 'fenced-heading-en', 'dotted-sub-id-en', 'heading-in-plan-en', 'heading-in-checklist-en']) assert.deepEqual(found(id), [], id);
});

// The 0.1.19 comparator is needed in full; shallow CI clones skip this test visibly.
const comparator = (() => { try { git('cat-file', '-e', 'a4e1d38^{commit}'); return true; } catch { return false; } })();
test('the judge accepts every twin against 0.1.19 and counts violations', { skip: comparator ? false : 'comparator a4e1d38 is not in this clone' }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'spectorque-h52-'));
  try {
    const baseline = await archiveEngine('a4e1d38', join(directory, 'engine'));
    for (const twin of cases) {
      const set = setOf(twin);
      assert.deepEqual(judge(await baseline.analyze(set), await analyze(set), definingHeadings(set.artifacts)), [], twin.id);
    }
    const set = setOf(cases.find(c => c.id === 'gwt-plus-unidentified-en')!);
    const [before, after] = [await baseline.analyze(set), await analyze(set)];
    const headings = definingHeadings(set.artifacts);
    assert.deepEqual(judge(before, { ...after, findings: [] }, headings), ['findings changed']);
    const promoted = { ...after, practices: after.practices.map(p => p.id === 'I1.2' ? { ...p, status: 'supported' as const } : p) };
    assert.deepEqual(judge(before, promoted, headings), ['I1.2 missing->supported']);
    assert.deepEqual(judge(before, after, []), ['assessment changed without a defining heading']);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
