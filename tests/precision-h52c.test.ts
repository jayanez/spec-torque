import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyze, classifyArtifact } from '../src/core.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { archiveEngine, git } from '../scripts/precision/engines.js';
import { enteringLines, judge } from '../scripts/precision/scenario-judge.js';

// The comparator 0.1.20 is needed in full. A shallow CI clone lacks it and skips visibly; any other git failure fails.
const COMPARATOR = '297b7ed2c71b38955e9995f696d4e16cad6ee9e5';
const comparator = (() => {
  if (git('rev-parse', '--is-shallow-repository') !== 'true') return true;
  try { git('cat-file', '-e', `${COMPARATOR}^{commit}`); return true; } catch { return false; }
})();

// H52c (#52): scenario steps that carry a modal are requirement lines.
type Twin = { id: string; files: Record<string, string[]>; findings: string[]; status: Record<string, string> };
const load = (name: string) => (JSON.parse(readFileSync(new URL(`../fixtures/precision/${name}`, import.meta.url), 'utf8')) as { cases: Twin[] }).cases;
// The H52c twins and the H52c-a twins for the predictions H52c missed.
const cases = [...load('h52c-pairs.json'), ...load('h52ca-pairs.json')];
const setOf = (twin: Twin) => ({ name: twin.id, artifacts: Object.entries(twin.files).map(([path, lines]) => classifyArtifact(path, lines.join('\n') + '\n')) });
const twin = (id: string) => setOf(cases.find(c => c.id === id)!);
const keyOf = (f: { practiceId: string; message: string; evidence: { path: string; line: number }[] }) => `${f.practiceId}|${f.evidence[0]?.path}|${f.evidence[0]?.line}|${f.message}`;

test('every H52c twin meets its pinned statuses and findings', async () => {
  for (const entry of cases) {
    const a = await analyze(setOf(entry));
    for (const [id, status] of Object.entries(entry.status)) assert.equal(a.practices.find(p => p.id === id)?.status, status, `${entry.id} ${id}`);
    assert.deepEqual(a.findings.map(keyOf).sort(), [...entry.findings].sort(), entry.id);
  }
});

test('enteringLines: scenario steps with a modal, outside fences and quotes, with the 0.1.20 modal test', () => {
  const lines = (id: string) => enteringLines(twin(id).artifacts).map(e => e.line);
  assert.deepEqual(lines('step-only-en'), [7]);
  assert.deepEqual(lines('conditional-prose-es'), [3]);
  for (const id of ['step-without-modal-en', 'given-step-es', 'step-with-id-no-modal-en', 'fenced-step-en', 'quoted-step-es', 'bold-step-en', 'plain-requirement-es']) assert.deepEqual(lines(id), [], id);
  const may = enteringLines([{ path: 'specs/001-x/spec.md', content: '- WHEN the report runs in May 2026, it is archived.', archived: false, role: 'spec' }]);
  assert.deepEqual(may, []);
});

test('the judge accepts every twin against 0.1.20 and counts violations', { skip: comparator ? false : 'comparator 0.1.20 is not in this shallow clone' }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'spectorque-h52c-'));
  try {
  const baseline = await archiveEngine(COMPARATOR, join(directory, 'engine'));
  for (const entry of cases) {
    const each = setOf(entry);
    assert.deepEqual(judge(await baseline.analyze(each), await analyze(each), enteringLines(each.artifacts)), [], entry.id);
  }
  const set = twin('step-with-and-en');
  const [before, after] = [await baseline.analyze(set), await analyze(set)];
  const entering = enteringLines(set.artifacts);
  const stray = { ...after.findings[0], evidence: [{ path: 'specs/001-demo/spec.md', line: 1, text: '# Lock' }] };
  assert.ok(judge(after, { ...after, findings: [...after.findings, stray] }, entering).some(v => v.startsWith('finding added')));
  assert.ok(judge(after, { ...after, findings: after.findings.slice(1) }, entering).some(v => v.startsWith('finding removed')));
  const e14 = { ...after, practices: after.practices.map(p => p.id === 'E1.4' ? { ...p, status: 'partial' as const } : p) };
  assert.ok(judge({ ...after, practices: after.practices.map(p => p.id === 'E1.4' ? { ...p, status: 'supported' as const } : p) }, e14, entering).includes('E1.4 supported->partial'));
  const p13 = { ...after, practices: after.practices.map(p => p.id === 'P1.3' ? { ...p, status: 'partial' as const } : p) };
  assert.ok(judge(after, p13, entering).some(v => v.startsWith('P1.3')));
  assert.deepEqual(judge(before, after, []), ['assessment changed without an entering line']);
  assert.deepEqual(judge(before, after, entering), []);
  // H52c-a allowances: each holds only for its own construct.
  const ns = twin('namespace-from-step-en');
  const [nsBefore, nsAfter, nsEntering] = [await baseline.analyze(ns), await analyze(ns), enteringLines(ns.artifacts)];
  assert.deepEqual(judge(nsBefore, nsAfter, nsEntering), []);
  const foreign = { ...nsAfter.findings[0], evidence: [{ ...nsAfter.findings[0].evidence[0], text: '- [ ] T001 Wire OTHER-REQ-02.' }] };
  assert.ok(judge(nsBefore, { ...nsAfter, findings: [foreign] }, nsEntering).some(v => v.startsWith('finding added')));
  const duplicated = { ...after, findings: [...after.findings, after.findings[0]] };
  assert.ok(judge(before, duplicated, entering).some(v => v.startsWith('finding duplicated')));
  const severity = { ...after, findings: after.findings.map((f, i) => i === 0 ? { ...f, severity: 'error' as const } : f) };
  assert.ok(judge(before, severity, entering).some(v => v.startsWith('finding added')));
  const conflict = twin('conflict-unchanged-en');
  const [cBefore, cAfter] = [await baseline.analyze(conflict), await analyze(conflict)];
  assert.ok(judge(cBefore, { ...cAfter, findings: cAfter.findings.filter(f => f.practiceId !== 'I2.3') }, enteringLines(conflict.artifacts)).some(v => v.startsWith('finding removed I2.3')));
  const toPartial = twin('e14-missing-to-partial-en');
  assert.deepEqual(judge(await baseline.analyze(toPartial), await analyze(toPartial), enteringLines(toPartial.artifacts)), []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a scenario step with an ID and a modal is an identified requirement that resolves its reference', async () => {
  const a = await analyze({ name: 'id-step', artifacts: [
    classifyArtifact('specs/001-demo/spec.md', '# Demo\n\n- GIVEN FR-001 the service MUST respond.\n'),
    classifyArtifact('specs/001-demo/tasks.md', '# Tasks\n\n- [ ] T001 Implement FR-001.\n'),
  ] });
  assert.deepEqual(a.findings.filter(f => f.practiceId === 'I1.2' || f.practiceId === 'I2.3').map(f => f.message), []);
  assert.deepEqual(a.traceability.map(e => [e.to, e.resolved]), [['FR-001', true]]);
});
