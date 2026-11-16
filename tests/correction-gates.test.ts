import test from 'node:test';
import assert from 'node:assert/strict';
import { createProposal, applyProposal } from '../src/core/refine.js';
import { contentHash, classifyArtifact } from '../src/core/artifacts.js';
import { analyze } from '../src/core/analyze.js';
for (const separator of ['\n', '\r', '\u2028', '\u2029']) test(`reject multiline proposal ${JSON.stringify(separator)}`, async () => {
  const original = 'FR-001: The system MUST run.';
  const replacement = original + separator + 'FR-999: Publish data.';
  await assert.rejects(createProposal('spec.md', original, 1, replacement, 'test'), /single line/);
  await assert.rejects(applyProposal(original, { id: 'external', path: 'spec.md', line: 1, original, replacement, reason: 'test', source: 'host', baseHash: await contentHash(original) }), /single line/);
});
for (const [positive, negative] of [['The system MUST allow access.', 'The system MUST never allow access.'], ['El sistema DEBE permitir acceso.', 'El sistema DEBE nunca permitir acceso.']]) test(`explicit polarity ${positive}`, async () => {
  const result = await analyze({ name: 'test', artifacts: [classifyArtifact('specs/f/spec.md', `FR-001: ${positive}\nFR-002: ${negative}`)] });
  assert.ok(result.findings.some(f => f.message.includes('Opposite obligations')));
});

test('contradiction normalization preserves modality, feature scope and quoted examples', async () => {
  for (const lines of [
    ['FR-001: The system MUST allow access.', 'FR-002: The system SHOULD NOT allow access.'],
    ['FR-001: The system MUST allow access.', 'FR-002: The system MUST allow access.'],
    ['FR-001: The system MUST allow access.', '> FR-002: The system MUST never allow access.'],
    ['FR-001: The system MUST allow access.', 'FR-002: The system MUST allow access unless authorized.'],
  ]) {
    const a = await analyze({ name: 'test', artifacts: [classifyArtifact('specs/a/spec.md', lines.join('\n'))] });
    assert.ok(!a.findings.some(f => f.message.includes('Opposite obligations')));
  }
  const a = await analyze({ name: 'test', artifacts: [classifyArtifact('specs/a/spec.md', 'FR-001: The system MUST allow access.'), classifyArtifact('specs/b/spec.md', 'FR-002: The system MUST never allow access.')] });
  assert.ok(!a.findings.some(f => f.message.includes('Opposite obligations')));
});
for (const [a, b] of [['The system MUST accept requests.', 'The system SHALL NOT accept requests.'], ['El sistema DEBE permitir reservas.', 'El sistema nunca DEBE permitir reservas.'], ['The system SHALL accept tokens.', 'The system SHALL NOT accept tokens.'], ['Los servicios DEBEN permitir acceso.', 'Los servicios NO DEBEN permitir acceso.'], ['El servicio DEBERÁ permitir acceso.', 'El servicio DEBERÁ nunca permitir acceso.']]) test(`opposition in both orders ${a}`, async () => {
  for (const pair of [[a,b],[b,a]]) {
    const result = await analyze({ name: 'test', artifacts: [classifyArtifact('specs/a/spec.md', `FR-001: ${pair[0]}\nFR-002: ${pair[1]}`)] });
    assert.ok(result.findings.some(f => f.message.includes('Opposite obligations')));
  }
});

test('refinement cannot add a new formal requirement on the same line', async () => {
  await assert.rejects(createProposal('spec.md', 'FR-001: The system MUST run.', 1, 'FR-001: The system MUST run. FR-999: Publish data.', 'test'), /identifiers/);
});

test('case-insensitive identifiers cannot disguise removed quantities', async () => {
  const original = 'FR-001: The system MUST respond in 999 seconds.';
  const replacement = 'FR-001: The system MUST respond. fr-999 seconds: Publish data.';
  await assert.rejects(createProposal('spec.md', original, 1, replacement, 'test'), /quantities|identifiers/);
});
