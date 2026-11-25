import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, classifyArtifact, isSpecCandidate } from '../src/core.js';

const S = 'specs/001-demo/spec.md';
async function status(files: Record<string, string[]>) {
  const set = { name: 'demo', artifacts: Object.entries(files).map(([path, lines]) => classifyArtifact(path, lines.join('\n') + '\n')) };
  const practices = (await analyze(set)).practices;
  return { 'E3.1': practices.find(p => p.id === 'E3.1')?.status, 'E3.2': practices.find(p => p.id === 'E3.2')?.status };
}
const spec = (...body: string[]) => ['# Demo', '', ...body, '', '- **REQ-001:** The system MUST record an episode.'];

test('H6: acceptance scenarios and one-line Given/When/Then scenarios are verification criteria', async () => {
  assert.equal((await status({ [S]: spec('## Requirements and acceptance scenarios') }))['E3.1'], 'partial');
  assert.equal((await status({ [S]: spec('## Requisitos y escenarios de aceptación') }))['E3.1'], 'partial');
  assert.equal((await status({ [S]: spec('- **SC-001:** Given a valid request, when it is recorded, then the episode file exists.') }))['E3.1'], 'partial');
  assert.equal((await status({ [S]: spec('- **SC-001:** Given a valid request, the episode is recorded.') }))['E3.1'], 'missing');
});

test('H6: validation rows that name a test file are validation methods', async () => {
  const plan = (row: string) => ({ [S]: spec('## Requirements'), 'specs/001-demo/plan.md': ['# Plan', '', '| Requirement | Scenario | File |', '|---|---|---|', row] });
  assert.equal((await status(plan('| REQ-001 | SC-001 | tests/test_recorder.py |')))['E3.2'], 'partial');
  assert.equal((await status(plan('| **SC-002** | `recorder.test.ts` | RecorderTests |')))['E3.2'], 'partial');
  assert.equal((await status(plan('| REQ-001 | SC-001 | src/recorder.py |')))['E3.2'], 'missing');
});

test('H6: the Spec Kit quickstart is a feature artifact in work-tree discovery', () => {
  assert.equal(isSpecCandidate('specs/001-demo/quickstart.md', true), true);
  assert.equal(classifyArtifact('specs/001-demo/quickstart.md', '').role, 'context');
  assert.equal(isSpecCandidate('docs/quickstart.md', true), false);
});

test('H6a: quickstart lines are validation evidence only, not requirements text', async () => {
  const Q = 'specs/001-demo/quickstart.md';
  const set = (path: string, line: string) => ({ name: 'demo', artifacts: [classifyArtifact(S, spec('## Requirements').join('\n') + '\n'), classifyArtifact(path, ['# Guide', '', line].join('\n') + '\n')] });
  const twoMusts = 'The operator must start the recorder and must confirm that the episode folder exists.';
  assert.deepEqual((await analyze(set(Q, twoMusts))).findings.map(f => f.practiceId), []);
  assert.deepEqual((await analyze(set('specs/001-demo/plan.md', twoMusts))).findings.map(f => f.practiceId), ['E2.1']);
  const done = (await analyze(set(Q, '## Definition of done'))).practices.find(p => p.id === 'E3.4')?.status;
  assert.equal(done, 'missing');
});

test('H6a: unittest, go test and other runners are validation methods; scripts and builds are not', async () => {
  const plan = (line: string) => ({ [S]: spec('## Requirements'), 'specs/001-demo/plan.md': ['# Plan', '', line] });
  for (const line of ['python3 -m unittest discover -s tests', 'Run `go test ./...`.', 'node --test', 'make check', './gradlew test']) {
    assert.equal((await status(plan(line)))['E3.2'], 'partial', line);
  }
  for (const line of ['python3 scripts/seed_demo.py', 'Run `go build ./...`.']) assert.equal((await status(plan(line)))['E3.2'], 'missing', line);
});
