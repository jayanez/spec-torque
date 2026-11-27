import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyze, classifyArtifact } from '../src/core.js';
import { archiveEngine, git } from '../scripts/precision/engines.js';
import { definingHeadings, judge, sectionOf } from '../scripts/precision/heading-judge.js';

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
  assert.deepEqual(found('content-under-subheading-en'), [3]);
  for (const id of ['heading-without-id-en', 'id-late-in-title-en', 'non-family-user-story-en', 'non-family-document-id-en', 'fenced-heading-en', 'dotted-sub-id-en', 'heading-in-plan-en', 'heading-in-checklist-en', 'r-family-risk-en', 'range-heading-es', 'removed-heading-en', 'removed-heading-es', 'empty-headings-en']) assert.deepEqual(found(id), [], id);
});

// The 0.1.19 comparator is needed in full. A shallow CI clone lacks it and skips visibly; any other git failure fails.
const COMPARATOR = 'a4e1d388229a0c48975e526f52a49f47a91c3966';
const comparator = (() => {
  if (git('rev-parse', '--is-shallow-repository') !== 'true') return true;
  try { git('cat-file', '-e', `${COMPARATOR}^{commit}`); return true; } catch { return false; }
})();
test('the judge accepts every twin against 0.1.19 and counts violations', { skip: comparator ? false : 'comparator 0.1.19 is not in this shallow clone' }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'spectorque-h52-'));
  try {
    const baseline = await archiveEngine(COMPARATOR, join(directory, 'engine'));
    for (const twin of cases) {
      const set = setOf(twin);
      assert.deepEqual(judge(await baseline.analyze(set), await analyze(set), definingHeadings(set.artifacts)), [], twin.id);
    }
    const set = setOf(cases.find(c => c.id === 'gwt-plus-unidentified-en')!);
    const [before, after] = [await baseline.analyze(set), await analyze(set)];
    const headings = definingHeadings(set.artifacts);
    assert.deepEqual(judge(before, { ...after, findings: [] }, headings), ['findings changed']);
    const promoted = { ...after, practices: after.practices.map(p => p.id === 'I1.2' ? { ...p, status: 'supported' as const } : p) };
    assert.deepEqual(judge(before, promoted, headings), ['I1.2 missing->supported', 'I1.2 reason', 'summary counts']);
    assert.deepEqual(judge(before, after, []), ['assessment changed without a requirement heading']);
    const withPractice = (id: string, patch: object) => ({ ...after, practices: after.practices.map(p => p.id === id ? { ...p, ...patch } : p) });
    const evidence = after.practices.find(p => p.id === 'I1.2')!.evidence;
    assert.deepEqual(judge(before, withPractice('I1.2', { evidence: [...evidence].reverse().concat(evidence).slice(0, 2) }), headings), ['I1.2 evidence']);
    assert.deepEqual(judge(before, withPractice('E1.4', { status: 'missing' }), headings), ['practices changed', 'summary counts']);
    const control = setOf(cases.find(c => c.id === 'heading-with-modal-body-en')!);
    const [was, now, controlHeadings] = [await baseline.analyze(control), await analyze(control), definingHeadings(control.artifacts)];
    const patched = (id: string, patch: object) => ({ ...now, practices: now.practices.map(p => p.id === id ? { ...p, ...patch } : p) });
    assert.deepEqual(judge(was, now, controlHeadings), []);
    assert.ok(judge(was, patched('I2.2', { status: 'partial' }), controlHeadings).includes('I2.2 supported->partial'));
    assert.deepEqual(judge(was, patched('I1.2', { reason: 'other' }), controlHeadings), ['I1.2 reason']);
    assert.deepEqual(judge(was, { ...now, summary: { ...now.summary, supported: now.summary.supported + 1 } }, controlHeadings), ['summary counts']);
    const fell = { ...after, dimensions: after.dimensions.map(d => d.id === 'I1' ? { ...d, score: (d.score ?? 0) - 1 } : d) };
    assert.ok(judge(before, fell, headings).includes('dimension I1'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('identifiers on four or more lines keep their evidence; headings come after them', async () => {
  const spec = ['# Demo', '', '### REQ-001 — Drafts', '', ...[2, 3, 4, 5].map(n => `- REQ-00${n}: The export MUST hold rule ${n}.`)];
  const a = await analyze({ name: 'four', artifacts: [classifyArtifact('specs/001-demo/spec.md', spec.join('\n'))] });
  assert.deepEqual(a.practices.find(p => p.id === 'I1.2')!.evidence.map(e => e.line), [5, 6, 7, 8]);
});

test('sectionOf: the chain, a same-level stop, fenced headings and the 30-line cap', () => {
  const lines = ['# Spec', '## Requirements', '### FR-001 — Drafts', 'Body', '#### Detail', '```', '## not a heading', '```', 'tail', '', '### FR-002 — Next'];
  assert.deepEqual(sectionOf(lines, 3), { chain: ['# Spec', '## Requirements'], section: lines.slice(2, 9) });
  const long = ['### FR-001 — Long', ...Array.from({ length: 40 }, (_, i) => `line ${i}`)];
  assert.equal(sectionOf(long, 1).section.length, 30);
  assert.throws(() => sectionOf(lines, 4), /not a heading/);
});
