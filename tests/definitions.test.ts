import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, classifyArtifact } from '../src/core.js';

const S = 'specs/001-demo/spec.md', P = 'specs/001-demo/plan.md', T = 'specs/001-demo/tasks.md';
const setOf = (files: Record<string, string[]>) => ({ name: 'demo', artifacts: Object.entries(files).map(([path, lines]) => classifyArtifact(path, lines.join('\n') + '\n')) });
async function findings(spec: string[], plan = ['# Plan', '', 'Implements REQ-001.']) {
  return (await analyze(setOf({ [S]: spec, [P]: plan }))).findings.filter(f => ['I1.2', 'I2.3'].includes(f.practiceId)).map(f => `${f.practiceId}:${f.evidence[0].line}:${f.message}`);
}

test('H3a: heading definitions resolve references and identify their body lines', async () => {
  assert.deepEqual(await findings(['# Demo', '', '### REQ-001 — Consent', '', 'The system MUST ask for consent before recording.']), []);
  assert.deepEqual(await findings(['# Demo', '', '### Consent', '', 'The system MUST ask for consent before recording.']), [
    'I1.2:5:Requirement has no stable identifier.', 'I2.3:3:Reference REQ-001 has no definition in the supplied specs.']);
  assert.deepEqual(await findings(['# Demo', '', '### REQ-001 — Consent', '', 'The system MUST ask for consent.', '', '### Notes', '', 'The system MUST log every export.']),
    ['I1.2:9:Requirement has no stable identifier.']);
});

test('H3a: mentions, traceability rows and dotted sub-IDs are not second definitions', async () => {
  assert.deepEqual(await findings(['# Demo', '', '**REQ-001 Consent.** The system MUST ask for consent.', '', 'Imported records MUST also follow REQ-001.']), []);
  assert.deepEqual(await findings(['# Demo', '', '### REQ-001 — Consent', '', 'The system MUST ask for consent.', '', '| Requirement | Tasks |', '|---|---|', '| REQ-001 | T001 |']), []);
  assert.deepEqual(await findings(['# Demo', '', '### REQ-2 — Consent', '', '- REQ-2.1: The system MUST record the time.', '- REQ-2.2: The system MUST record the scope.'], ['# Plan', '', 'Implements REQ-2.']), []);
  assert.deepEqual(await findings(['# Demo', '', '- REQ-001: The system MUST ask for consent.', '- REQ-001: The system MUST export JSON.']),
    ['I1.2:4:Duplicate requirement identifier REQ-001.']);
});

test('H5: hard-wrapped continuations belong to the item or paragraph they continue', async () => {
  assert.deepEqual(await findings(['# Demo', '', '- **REQ-001 Consent.** The system MUST ask for consent before it records',
    '  an episode, and it MUST stop recording when consent is withdrawn.']), []);
  assert.deepEqual(await findings(['# Demo', '', 'REQ-001: The system MUST ask for consent before it records',
    'an episode, and it MUST stop recording when consent is withdrawn.']), []);
  assert.deepEqual(await findings(['# Demo', '', '- The system MUST ask for consent before it records',
    '  an episode, and it MUST stop recording when consent is withdrawn.'], ['# Plan']), [
    'I1.2:3:Requirement has no stable identifier.', 'I1.2:4:Requirement has no stable identifier.']);
  assert.deepEqual(await findings(['# Demo', '', '| REQ-001 | The system MUST ask for consent |', 'The system MUST stop recording.']),
    ['I1.2:4:Requirement has no stable identifier.']);
});

test('H5: a continuation that starts with an ID is not a second definition', async () => {
  assert.deepEqual(await findings(['# Demo', '', '- **REQ-001:** The system MUST record an episode.',
    '- **REQ-002:** The recorder MUST stop when consent is withdrawn and MUST keep', '  REQ-001 episodes already written.']), []);
  assert.deepEqual(await findings(['# Demo', '', 'REQ-001 The system MUST record an episode.', 'REQ-002 The recorder MUST stop.',
    'REQ-001 The system MUST keep episodes.']), ['I1.2:5:Duplicate requirement identifier REQ-001.']);
});

test('H5a: an ID cited later in an item or paragraph does not identify its other lines', async () => {
  assert.deepEqual(await findings(['# Demo', '', 'The LLM response must be a valid manifest. If parsing fails, the',
    'import is treated as a failure (see FR-006).'], ['# Plan']), ['I1.2:3:Requirement has no stable identifier.']);
  assert.deepEqual(await findings(['# Demo', '', '### Never', '', '- `retry` MUST NOT reset a graph that waits for input',
    '  (FR-009), because that would dispatch the task again.'], ['# Plan']), ['I1.2:5:Requirement has no stable identifier.']);
});

test('H8: plan-local R-n labels are references only when the specification uses the R- family', async () => {
  const fr = ['# Demo', '', '- **FR-001:** The system MUST record every outcome.'];
  const local = ['# Plan', '', '**T001:** R-1 every outcome maps to one label; R-2 the selector is deterministic.'];
  assert.deepEqual(await findings(fr, local), []);
  assert.deepEqual(await findings(fr, ['# Plan', '', 'Covers FR-009; R-1 is a local check.']), ['I2.3:3:Reference FR-009 has no definition in the supplied specs.']);
  assert.deepEqual(await findings(['# Demo', '', '- **R-1:** The system MUST record every outcome.'], ['# Plan', '', 'Covers R-1; R-3 adds an audit trail.']),
    ['I2.3:3:Reference R-3 has no definition in the supplied specs.']);
  const assessment = await analyze(setOf({ [S]: fr, [P]: local, [T]: ['# Tasks', '', '- [ ] T001 Build it.'] }));
  assert.equal(assessment.practices.find(p => p.id === 'I2.3')?.status, 'missing');
  assert.deepEqual(assessment.traceability, []);
  const tasksOnly = setOf({ [S]: fr, [T]: ['# Tasks', '', '- [ ] T001 Steps: R-1 write the recorder; R-2 add the selector.'] });
  const statuses = (await analyze(tasksOnly)).practices.filter(p => ['C1.3', 'C2.3'].includes(p.id)).map(p => p.status);
  assert.deepEqual(statuses, ['missing', 'missing']);
});
