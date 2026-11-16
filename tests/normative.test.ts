import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../src/core/analyze.js';
import { classifyArtifact } from '../src/core/artifacts.js';

const statements = [
  'The service MUST respond quickly.', 'The service SHALL respond quickly.',
  'The service SHOULD respond quickly.', 'The service MAY respond quickly.',
  'El servicio DEBE responder rápido.', 'Los servicios DEBEN responder rápido.',
  'El servicio DEBERÁ responder rápido.', 'Los servicios DEBERÁN responder rápido.',
  'El servicio DEBERÍA responder rápido.', 'Los servicios DEBERÍAN responder rápido.',
  'El servicio PUEDE responder rápido.', 'Los servicios PUEDEN responder rápido.',
];

for (const statement of statements) for (const prefix of ['', 'FR-001: ']) {
  test(`normative evidence with ${prefix ? 'an ID' : 'no ID'}: ${statement}`, async () => {
    const text = prefix + statement;
    const result = await analyze({ name: 'normative', artifacts: [classifyArtifact('spec.md', '# Example\n' + text)] });
    const normative = result.practices.find(p => p.id === 'E1.4')!;
    assert.equal(normative.status, 'supported');
    assert.deepEqual(normative.evidence, [{ path: 'spec.md', line: 2, text }]);
    assert.ok(result.findings.some(f => f.practiceId === 'E1.2' && f.evidence[0].line === 2));
    assert.equal(result.findings.some(f => f.message === 'Requirement has no stable identifier.'), !prefix);
    assert.equal(result.summary.score, null, 'missing companions must still prevent a total');
  });
}

test('Unicode token boundaries reject embedded normative words with and without IDs', async () => {
  for (const word of ['MAYOR', 'MAYoría', 'DEBEMOS', 'DEBERÍAMOS', 'PUEDES', 'SHOULDER', 'éMUST', 'MUSTé', '_DEBE', 'DEBE_á', 'DEBE\u0301', 'DEBE2']) {
    for (const prefix of ['', 'FR-001: ']) {
      const result = await analyze({ name: 'embedded', artifacts: [classifyArtifact('spec.md', prefix + word + ' rápido.')] });
      assert.equal(result.practices.find(p => p.id === 'E1.4')?.status, prefix ? 'missing' : 'unknown', word);
      assert.equal(result.findings.some(f => f.practiceId === 'E1.2'), Boolean(prefix), word);
    }
  }
});

test('Unicode punctuation and lowercase forms retain exact source evidence', async () => {
  for (const word of ['deberá', 'deberían', 'pueden', 'may']) {
    const text = `El servicio «${word}» responder rápido.`;
    const result = await analyze({ name: 'punctuation', artifacts: [classifyArtifact('spec.md', text)] });
    assert.equal(result.practices.find(p => p.id === 'E1.4')?.status, 'supported', word);
    assert.deepEqual(result.practices.find(p => p.id === 'E1.4')?.evidence, [{ path: 'spec.md', line: 1, text }]);
  }
});

test('embedded mandatory words cannot generate contradictions in ID-labelled requirements', async () => {
  for (const word of ['éDEBE', 'éMUST', 'éSHALL']) {
    const lines = [`FR-001: El servicio ${word} permitir acceso.`, `FR-002: El servicio ${word} nunca permitir acceso.`];
    const result = await analyze({ name: 'embedded opposition', artifacts: [classifyArtifact('spec.md', lines.join('\n'))] });
    assert.equal(result.findings.some(f => f.message.includes('Opposite obligations')), false, word);
  }
});

test('normative recognition still excludes headings, quotes, fenced code and scenario lines', async () => {
  for (const text of [
    '# FR-001: Los servicios DEBEN responder rápido.', '> FR-001: El servicio DEBERÁ responder rápido.',
    '```text\nFR-001: Los servicios DEBEN responder rápido.\n```',
    '~~~text\nFR-001: El servicio DEBERÍA responder rápido.\n~~~',
    'DADO Los servicios DEBEN responder rápido.', 'GIVEN The service MAY respond quickly.',
  ]) {
    const result = await analyze({ name: 'examples', artifacts: [classifyArtifact('spec.md', text)] });
    assert.equal(result.practices.find(p => p.id === 'E1.4')?.status, 'unknown', text);
    assert.deepEqual(result.findings, [], text);
  }
});

test('unidentified Spanish mandatory opposites are detected in both orders', async () => {
  for (const modal of ['DEBE', 'DEBEN', 'DEBERÁ', 'DEBERÁN']) {
    for (const lines of [[`El servicio ${modal} permitir acceso.`, `El servicio NO ${modal} permitir acceso.`], [`El servicio NO ${modal} permitir acceso.`, `El servicio ${modal} permitir acceso.`]]) {
      const result = await analyze({ name: 'opposition', artifacts: [classifyArtifact('spec.md', lines.join('\n'))] });
      assert.equal(result.findings.filter(f => f.message.includes('Opposite obligations')).length, 1, lines.join('\n'));
    }
  }
});

test('recommendations and permissions do not become mandatory contradictions', async () => {
  for (const modal of ['SHOULD', 'MAY', 'DEBERÍA', 'DEBERÍAN', 'PUEDE', 'PUEDEN']) {
    const spanish = !['SHOULD', 'MAY'].includes(modal);
    const lines = spanish ? [`El servicio DEBE permitir acceso.`, `El servicio NO ${modal} permitir acceso.`] : ['The service MUST allow access.', `The service ${modal} NOT allow access.`];
    const result = await analyze({ name: 'strength', artifacts: [classifyArtifact('spec.md', lines.join('\n'))] });
    assert.equal(result.findings.some(f => f.message.includes('Opposite obligations')), false, modal);
    assert.equal(result.practices.find(p => p.id === 'E1.4')?.status, 'supported', modal);
  }
  const result = await analyze({ name: 'features', artifacts: [
    classifyArtifact('specs/a/spec.md', 'Los servicios DEBEN permitir acceso.'),
    classifyArtifact('specs/b/spec.md', 'Los servicios NO DEBEN permitir acceso.'),
  ] });
  assert.equal(result.findings.some(f => f.message.includes('Opposite obligations')), false);
  assert.equal(result.practices.find(p => p.id === 'C1.2')?.status, 'unknown');
});
