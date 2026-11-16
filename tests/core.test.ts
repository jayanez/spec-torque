import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyArtifact, contentHash } from '../src/core/artifacts.js';
import { analyze } from '../src/core/analyze.js';
import { createProposal, applyProposal } from '../src/core/refine.js';
import { buildArtifacts } from '../src/core/builder.js';

test('framework and feature detection keeps archives and agent instructions distinct', () => {
  assert.equal(classifyArtifact('.kiro/specs/booking/requirements.md', '').framework, 'kiro');
  assert.equal(classifyArtifact('openspec/changes/archive/old/specs/auth/spec.md', '').archived, true);
  assert.equal(classifyArtifact('AGENTS.md', '').role, 'instructions');
  assert.equal(classifyArtifact('specs/001-booking/plan.md', '').featureId, 'specs/001-booking');
});
test('missing companion documents are unknown, not silently scored zero', async () => {
  const result = await analyze({ name: 'single', artifacts: [classifyArtifact('spec.md', '# Booking\nFR-001: The system MUST be fast.')] });
  assert.equal(result.practices.length, 40);
  assert.equal(result.summary.score, null);
  assert.equal(result.practices.find(p => p.id === 'C2.2')?.status, 'unknown');
  const vague = result.findings.find(f => f.message.includes('fast'));
  assert.equal(vague?.evidence[0]?.line, 2);
  assert.equal(vague?.evidence[0]?.path, 'spec.md');
});
test('English and Spanish vague requirements are detected; quoted examples are not obligations', async () => {
  for (const line of ['FR-001: The system MUST be fast.', 'FR-001: El sistema DEBE ser rápido.']) {
    const result = await analyze({ name: 'test', artifacts: [classifyArtifact('spec.md', line)] });
    assert.ok(result.findings.some(f => f.practiceId === 'E1.2'));
  }
  const result = await analyze({ name: 'example', artifacts: [classifyArtifact('spec.md', '```\nThe system MUST be fast.\n```')] });
  assert.equal(result.findings.filter(f => f.practiceId === 'E1.2').length, 0);
});
test('explicit non-applicability requires a reason and does not earn points', async () => {
  await assert.rejects(analyze({ name: 'test', artifacts: [] }, { notApplicable: { 'E2.5': '' } }));
  const result = await analyze({ name: 'test', artifacts: [classifyArtifact('spec.md', 'FR-001: System MUST run.')] }, { notApplicable: { 'E2.5': 'No personal or sensitive data is processed.' } });
  assert.equal(result.practices.find(p => p.id === 'E2.5')?.status, 'not_applicable');
});
test('IDs and empty structure do not establish measurements or scope separation', async () => {
  const a = await analyze({ name: 'unmeasured', artifacts: [classifyArtifact('spec.md', 'FR-001: The system MUST support booking.')] });
  assert.equal(a.practices.find(p => p.id === 'E1.2')?.status, 'missing');
  assert.equal(a.practices.find(p => p.id === 'P2.1')?.status, 'missing');
  const b = await analyze({ name: 'empty companions', artifacts: [classifyArtifact('spec.md', 'FR-001: The system MUST support booking.'), classifyArtifact('plan.md', ''), classifyArtifact('tasks.md', '')] });
  assert.equal(b.practices.find(p => p.id === 'C1.2')?.status, 'missing');
});
test('patches reject stale content, changed obligations and invented quantities', async () => {
  const content = '# Spec\nFR-001: The system MUST respond within 2 seconds.\n';
  const patch = await createProposal('spec.md', content, 2, 'FR-001: The booking system MUST respond within 2 seconds.', 'Name the subject', 'host');
  assert.match(await applyProposal(content, patch), /booking system/);
  await assert.rejects(applyProposal(content + 'changed', patch), /changed|stale/i);
  await assert.rejects(createProposal('spec.md', content, 2, 'FR-001: The system MAY respond within 2 seconds.', 'change', 'provider'), /obligation/i);
  await assert.rejects(createProposal('spec.md', content, 2, 'FR-001: The system MUST respond within 1 second.', 'change', 'provider'), /quantit/i);
  assert.equal(patch.baseHash, await contentHash(content));
});
test('builder preserves unresolved decisions instead of creating product facts', () => {
  const artifacts = buildArtifacts({ name: 'Booking', purpose: 'Reserve a room', actors: 'Visitors', behavior: 'Visitors can reserve a room.', success: '', exclusions: '', dependencies: '', failures: '', privacy: '', language: 'en' });
  assert.equal(artifacts.length, 3);
  assert.ok(artifacts[0].content.includes('[NEEDS CLARIFICATION:'));
  assert.ok(!artifacts[0].content.includes('99.9'));
  assert.ok(artifacts[2].content.includes('FR-001'));
});

test('feature namespaces prevent duplicates, cross-feature links and contradictions', async () => {
  const result = await analyze({ name: 'monorepo', artifacts: [
    classifyArtifact('specs/a/spec.md', 'FR-001: The service MUST accept requests.'),
    classifyArtifact('specs/a/tasks.md', '- [ ] Implement FR-002.'),
    classifyArtifact('specs/b/spec.md', 'FR-001: The service MUST NOT accept requests.\nFR-002: The service MUST reject invalid tokens.'),
  ] });
  assert.ok(!result.findings.some(f => /Duplicate|Opposite/.test(f.message)));
  assert.equal(result.traceability[0].resolved, false);
  assert.ok(result.findings.some(f => f.message.includes('FR-002')));
  assert.equal(result.practices.find(p => p.id === 'C1.2')?.status, 'unknown');
});

test('protocol versions do not count as measurable acceptance thresholds', async () => {
  const result = await analyze({ name: 'protocol', artifacts: [classifyArtifact('spec.md', 'FR-001: The service MUST support HTTP/2.')] });
  assert.equal(result.practices.find(p => p.id === 'E1.2')?.status, 'missing');
});

test('Spanish plural obligations and words containing MAY remain protected correctly', async () => {
  const text = 'FR-001: Los usuarios DEBEN recibir el resumen mayor.';
  await assert.rejects(createProposal('spec.md', text, 1, 'FR-001: Los usuarios PUEDEN recibir el resumen mayor.', 'changed'), /obligation/);
  await createProposal('spec.md', text, 1, 'FR-001: Los usuarios DEBEN recibir un resumen de mayor detalle.', 'clarify');
});

test('accented normative words cannot disappear during refinement', async () => {
  await assert.rejects(createProposal('spec.md', 'FR-001: El servicio DEBERÁ rechazar la solicitud.', 1, 'FR-001: El servicio rechaza la solicitud.', 'rewrite'), /obligation/);
});

test('feature selection applies the same scope to reports and editable exports', async () => {
  const { selectFeature } = await import('../src/core/artifacts.js');
  const set = { name: 'features', artifacts: [classifyArtifact('specs/a/spec.md', 'A'), classifyArtifact('specs/b/spec.md', 'B'), classifyArtifact('AGENTS.md', 'Shared')] };
  assert.deepEqual(selectFeature(set, 'specs/a').artifacts.map(a => a.path), ['specs/a/spec.md', 'AGENTS.md']);
});
