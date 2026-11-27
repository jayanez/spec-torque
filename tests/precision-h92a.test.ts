import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyze, classifyArtifact, isFrameworkTemplate, isSpecCandidate } from '../src/core.js';
import { scopeDiff } from '../scripts/precision/scope-judge.js';
import { archiveEngine } from '../scripts/precision/engines.js';

// H92a (#92): the replay's judgement of prediction 5, on the committed scope twins and on hand-made violations.
const { cases } = JSON.parse(readFileSync(new URL('../fixtures/precision/h92a-scopes.json', import.meta.url), 'utf8')) as { cases: { id: string; files: Record<string, string> }[] };
const arms = (files: Record<string, string>) => {
  const all = Object.entries(files).map(([path, content]) => classifyArtifact(path, content));
  return { baseline: { name: 'b', artifacts: all }, candidate: { name: 'c', artifacts: all.filter(a => isSpecCandidate(a.path, true)) } };
};

test('the scope twins: kinds as registered; only the duplicate-ID gap breaks prediction 5', async () => {
  const kinds: Record<string, string> = {};
  const breaks: Record<string, string[]> = {};
  for (const entry of cases) {
    const selected = arms(entry.files);
    const d = scopeDiff(await analyze(selected.baseline), await analyze(selected.candidate), selected, isFrameworkTemplate);
    kinds[entry.id] = d.kind; breaks[entry.id] = d.breaks;
  }
  assert.deepEqual(kinds, { emptied: 'emptied', 'kept-template-defined': 'kept', 'kept-control': 'kept' });
  // Found in the H92a review, after measurement began: a template nested in a feature that redefines a spec's ID
  // makes I1.2 report a duplicate on the spec line alone. Prediction 5 does not allow its removal; the judge stays strict.
  assert.deepEqual(breaks, { emptied: [], 'kept-template-defined': [], 'kept-control': ['finding-removed I1.2|specs/001-a/spec.md:4|Duplicate requirement identifier FR-009.'] });
});

test('violations of prediction 5 are counted', async () => {
  const kept = arms(cases.find(c => c.id === 'kept-template-defined')!.files);
  const before = await analyze(kept.baseline);
  const after = await analyze(kept.candidate);
  // A non-template finding that disappears from a kept scope breaks the prediction.
  const extra = { ...before.findings[0] ?? { id: 'x', practiceId: 'E1.3', dimension: 'E1', severity: 'warning' as const, message: 'synthetic', suggestion: '', source: 'rule' as const, evidence: [] }, evidence: [{ path: 'specs/001-a/spec.md', line: 3, text: '- FR-001: The system MUST export the report.' }], message: 'synthetic' };
  assert.equal(scopeDiff({ ...before, findings: [...before.findings, extra] }, after, kept, isFrameworkTemplate).breaks.length, 1);
  // An edge added in an emptied scope breaks it too.
  const emptied = arms(cases.find(c => c.id === 'emptied')!.files);
  const [b, a] = [await analyze(emptied.baseline), await analyze(emptied.candidate)];
  const edge = { from: 'specs/x/tasks.md', to: 'FR-777', resolved: false, evidence: { path: '.specify/memory/task_notes.md', line: 3, text: '- [ ] T001 Verify FR-001.' } };
  assert.deepEqual(scopeDiff(b, { ...a, traceability: [...a.traceability, edge] }, emptied, isFrameworkTemplate).breaks.map(x => x.split(' ')[0]), ['edge-added']);
});

test('liftDocumentLimit removes only the 500-document guard in an archived engine', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'spectorque-lift-'));
  try {
    const engine = await archiveEngine('HEAD', join(directory, 'engine'), true);
    const many = { name: 'many', artifacts: Array.from({ length: 501 }, (_, i) => engine.classifyArtifact(`docs/n${i}/spec.md`, '# A\n')) };
    assert.equal((await engine.analyze(many)).artifacts.length, 501);
    await assert.rejects(engine.analyze({ name: 'big', artifacts: [engine.classifyArtifact('spec.md', 'a'.repeat(1_000_001))] }), /1 MB/);
    await assert.rejects(analyze(many), /Analysis limit/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
