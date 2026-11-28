import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, classifyArtifact } from '../src/core.js';
import { DISCLAIMER, findingCard, findingChoice, summaryLine, titleLine, workbenchLine, workbenchUrl } from '../src/core/presentation.js';
import { choiceScope, scopeChoices, scopeValue, terminalSummary, type HostScope } from '../src/integration.js';
import { listFeatures } from '../src/core/artifacts.js';
import { markdownReport } from '../src/core/report.js';

const sample = () => analyze({ name: 'Sample', artifacts: [classifyArtifact('specs/001-a/spec.md', '# A\n\n- FR-001: The system MUST be fast.\n- FR-002: The system MUST respond as needed.\n')] });

test('summaryLine uses the summary maximum, singular counts and the engine version', async () => {
  const a = await sample();
  assert.equal(summaryLine(a), `${a.summary.score === null ? 'Incomplete assessment' : `${a.summary.score}/${a.summary.maximum} (highest reachable ${a.summary.reachable})`} · ${a.findings.length} findings · ${a.decisions.length} open decisions · engine ${a.engineVersion}`);
  const one = { ...a, summary: { ...a.summary, score: 12 }, findings: a.findings.slice(0, 1), decisions: [a.findings[0].evidence[0]] };
  assert.equal(summaryLine(one), `12/30 (highest reachable 20) · 1 finding · 1 open decision · engine ${a.engineVersion}`);
  // #125: the Markdown report states the reachable maximum next to the score.
  assert.match(markdownReport(one), /^Score: 12\/30 · highest reachable for this scope: 20$/m);
});

test('findingCard labels the position, practice, severity, location, evidence and fix', async () => {
  const a = await sample();
  const f = a.findings[1], e = f.evidence[0];
  assert.deepEqual(findingCard(a, 1), [`Finding 2 of ${a.findings.length} · ${f.practiceId} · ${f.severity}`, `${e.path}:${e.line}`, f.message, `Evidence: «${e.text}»`, `Fix: ${f.suggestion}`]);
  assert.equal(findingChoice(a, 1), `Finding 2 of ${a.findings.length} · ${f.practiceId} · ${f.severity} · ${e.path}:${e.line}`);
  assert.deepEqual(findingCard(a, a.findings.length), []);
  const other = { path: 'specs/001-a/plan.md', line: 9, text: 'Second citation.' };
  assert.deepEqual(findingCard(a, 1, other).slice(1, 4), ['specs/001-a/plan.md:9', f.message, 'Evidence: «Second citation.»']);
  const withoutEvidence = { findings: [{ ...f, evidence: [] }] };
  assert.deepEqual(findingCard(withoutEvidence, 0), [`Finding 1 of 1 · ${f.practiceId} · ${f.severity}`, f.message, `Fix: ${f.suggestion}`]);
});

test('workbenchLine always shows the localhost address and names the feature it opens on', () => {
  assert.equal(workbenchUrl('http://127.0.0.1:4321'), 'http://localhost:4321/');
  assert.equal(workbenchUrl('http://localhost:4321/'), 'http://localhost:4321/');
  assert.equal(workbenchLine('http://127.0.0.1:4321', 'specs/066-system-one-shadow'), 'Workbench: http://localhost:4321/ — opens on specs/066-system-one-shadow');
  assert.equal(workbenchLine('http://127.0.0.1:4321'), 'Workbench: http://localhost:4321/');
});

test('titles carry the product version, and the terminal summary is built from the helpers', async () => {
  const a = await sample();
  assert.equal(titleLine('0.2.2'), 'SpecTorque 0.2.2');
  assert.equal(titleLine('0.2.2', 'Sample'), 'SpecTorque 0.2.2 · Sample');
  const lines = terminalSummary(a);
  assert.match(lines[0], /^SpecTorque \d+\.\d+\.\d+ · Sample$/);
  assert.equal(lines[1], summaryLine(a));
  assert.ok(lines.includes(`${findingChoice(a, 0)} · ${a.findings[0].message}`));
  assert.equal(DISCLAIMER, 'Heuristic evidence, not a correctness certificate.');
});

test('scope choices keep a current folder or based branch scope selectable', () => {
  const features = listFeatures([
    { role: 'spec', framework: 'generic', featureId: 'templates', archived: false },
    { role: 'spec', framework: 'spec-kit', featureId: 'specs/001-a', archived: false },
    { role: 'spec', framework: 'generic', featureId: 'docs/notes', archived: false },
  ]);
  // Known layouts first, then generic groups by ID: a user folder named templates is not demoted.
  assert.deepEqual(features.map(f => [f.id, f.layout]), [['specs/001-a', true], ['docs/notes', false], ['templates', false]]);
  const index = { root: '/r', name: 'r', mode: 'git' as const, focus: null, entries: [], features };
  assert.deepEqual(scopeChoices(index).map(c => c.title), ['All documents', 'Changed on this branch', 'specs/001-a', 'Other · docs/notes', 'Other · templates']);
  for (const scope of [{ kind: 'path', path: 'docs/specs' }, { kind: 'changed', base: 'develop' }, { kind: 'feature', id: 'specs/001-a' }, { kind: 'all' }, { kind: 'changed' }] as HostScope[]) {
    const choices = scopeChoices(index, scope);
    assert.ok(choices.some(c => c.value === scopeValue(scope)), JSON.stringify(scope));
    assert.deepEqual(choiceScope(scopeValue(scope)), scope);
  }
  assert.equal(scopeChoices(index, { kind: 'path', path: 'docs/specs' })[0].title, 'Folder · docs/specs');
  // A based branch scope keeps the default one selectable too.
  assert.deepEqual(scopeChoices(index, { kind: 'changed', base: 'develop' }).filter(c => c.category === 'Scope').map(c => c.title),
    ['All documents', 'Changed on this branch', 'Changed on this branch (vs develop)']);
});

test('VS Code lists the remembered scope first, marked current, with the shared labels', async () => {
  const { scopeItems } = await import('../integrations/vscode/src/scope-items.js');
  const listing = { total: 12, features: [{ id: 'specs/001-a', layout: true }, { id: 'specs/066-b', layout: true }, { id: 'docs/notes', layout: false }] };
  assert.deepEqual(scopeItems(listing, undefined).map(i => [i.label, i.description]), [['All documents', undefined], ['Changed on this branch', 'Features changed since the default branch'], ['specs/001-a', undefined], ['specs/066-b', undefined], ['Other · docs/notes', undefined]]);
  const remembered = scopeItems(listing, 'specs/066-b');
  assert.deepEqual([remembered[0].label, remembered[0].value, remembered[0].description], ['specs/066-b', 'f:specs/066-b', 'current']);
  assert.equal(remembered.filter(i => i.value === 'f:specs/066-b').length, 1);
  assert.deepEqual(scopeItems(listing, null)[0], { label: 'All documents', value: 'all', category: 'Scope', description: 'current' });
  // Above the read limit there is no All documents entry, so a remembered "all" marks nothing.
  assert.equal(scopeItems({ ...listing, total: 900 }, null).some(i => i.description === 'current'), false);
});
