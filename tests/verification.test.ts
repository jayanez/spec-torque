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
