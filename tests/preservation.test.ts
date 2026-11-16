import test from 'node:test';
import assert from 'node:assert/strict';
import { applyProposal, createProposal } from '../src/core/refine.js';
import { contentHash } from '../src/core/artifacts.js';

const cases = [
  ['FR-001: The system MUST never disclose credentials.', 'FR-001: The system MUST disclose credentials, never log errors.'],
  ['FR-001: El sistema DEBE conservar los datos sin publicarlos.', 'FR-001: El sistema DEBE conservar y publicar los datos.'],
  ['FR-001: The system MUST NOT log credentials.', 'FR-001: The system MUST NOT log errors.'],
  ['FR-001: El sistema NO DEBE publicar datos privados.', 'FR-001: El sistema NO DEBE publicar errores.'],
  ['FR-001: The system MUST store records without names.', 'FR-001: The system MUST store names without records.'],
  ['FR-001: El sistema DEBE funcionar salvo durante el mantenimiento.', 'FR-001: El sistema DEBE funcionar salvo durante las reservas.'],
  ['FR-001: The system MUST retain records unless deleted.', 'FR-001: The system MUST retain deleted records.'],
  ['FR-001: The system MUST never disclose credentials. It never logs tokens.', 'FR-001: The system MUST disclose credentials. It never logs tokens.'],
];

for (const [original, replacement] of cases) {
  test(`refinement rejects altered negative scope: ${original}`, async () => {
    await assert.rejects(createProposal('spec.md', original, 1, replacement, 'rewrite'), /negative clauses/);
    // A manually assembled or provider-supplied proposal cannot bypass apply.
    await assert.rejects(applyProposal(original, {
      id: 'external', path: 'spec.md', baseHash: await contentHash(original), line: 1,
      original, replacement, reason: 'external rewrite', source: 'host',
    }), /negative clauses/);
  });
}

test('negative clauses allow whitespace changes and changes in separate positive sentences', async () => {
  const original = 'FR-001: The system MUST never disclose credentials. Reports are readable.';
  const replacement = 'FR-001: The system MUST never  disclose credentials. Reports are available in plain text.';
  const proposal = await createProposal('spec.md', original, 1, replacement, 'Clarify report format');
  assert.equal(await applyProposal(original, proposal), replacement);
});

test('negative markers use Unicode word boundaries and preserve duplicates', async () => {
  await createProposal('spec.md', 'FR-001: The system MUST announce a result.', 1, 'FR-001: The system MUST announce the result.', 'clarify');
  await assert.rejects(createProposal('spec.md', 'FR-001: Never disclose data. Never disclose data.', 1, 'FR-001: Never disclose data.', 'deduplicate'), /negative clauses/);
});
