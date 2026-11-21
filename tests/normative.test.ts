import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../src/core/analyze.js';
import { classifyArtifact } from '../src/core/artifacts.js';
import { createProposal } from '../src/core/refine.js';

const statements = [
  'The service MUST respond quickly.', 'The service SHALL respond quickly.',
  'The service SHOULD respond quickly.', 'The service MAY respond quickly.',
  'El servicio DEBE responder rápido.', 'Los servicios DEBEN responder rápido.',
  'El servicio DEBERÁ responder rápido.', 'Los servicios DEBERÁN responder rápido.',
  'El servicio DEBERÍA responder rápido.', 'Los servicios DEBERÍAN responder rápido.',
  'El servicio PUEDE responder rápido.', 'Los servicios PUEDEN responder rápido.',
];

test('canonical Unicode accents keep original evidence and mandatory polarity', async () => {
  for (const word of ['DEBERÁ', 'DEBERÁN', 'DEBERÍA', 'DEBERÍAN']) {
    const decomposed = word.normalize('NFD');
    const text = `El servicio ${decomposed} responder rápido.`;
    const result = await analyze({ name: 'decomposed', artifacts: [classifyArtifact('spec.md', text)] });
    assert.equal(result.practices.find(p => p.id === 'E1.4')?.status, 'supported', word);
    assert.deepEqual(result.practices.find(p => p.id === 'E1.4')?.evidence, [{ path: 'spec.md', line: 1, text }]);
    await assert.rejects(createProposal('spec.md', text, 1, 'El servicio responder rápido.', 'removed modal'), /obligation/);
    const opposite = await analyze({ name: 'decomposed opposition', artifacts: [classifyArtifact('spec.md', `El servicio ${decomposed} permitir acceso.\nEl servicio NO ${decomposed} permitir acceso.`)] });
    assert.equal(opposite.findings.some(f => f.message.includes('Opposite obligations')), word === 'DEBERÁ' || word === 'DEBERÁN', word);
  }
});

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
  // Guillemets mark a mention since engine 0.1.5 (H2a); parentheses and exclamation marks do not.
  for (const word of ['deberá', 'deberían', 'pueden', 'may']) for (const text of [`El servicio (${word}) responder rápido.`, `El servicio ¡${word}! responder rápido.`]) {
    const result = await analyze({ name: 'punctuation', artifacts: [classifyArtifact('spec.md', text)] });
    assert.equal(result.practices.find(p => p.id === 'E1.4')?.status, 'supported', word);
    assert.deepEqual(result.practices.find(p => p.id === 'E1.4')?.evidence, [{ path: 'spec.md', line: 1, text }]);
  }
  const mention = await analyze({ name: 'guillemets', artifacts: [classifyArtifact('spec.md', 'El servicio «deberá» responder rápido.')] });
  assert.equal(mention.practices.find(p => p.id === 'E1.4')?.status, 'unknown');
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

test('bilingual measurement recognizes explicit rates and plural denial with original evidence', async () => {
  const samples = [
    ['The terminal SHALL accept ≤ 120 entries per minute.', 'supported'],
    ['Los puestos DEBERA\u0301N enviar ≤ 120\u202fturnos por minuto.', 'supported'],
    ['Los paneles DEBEN rechazar recorridos por un portal clausurado.', 'supported'],
    ['Los lectores DEBERA\u0301N denegar el acceso.', 'supported'],
    ['Los servicios DEBERÍAN rechazar solicitudes no autorizadas.', 'supported'],
    ['The service SHOULD reject unauthorized requests.', 'supported'],
    ['Los servicios DEBERI\u0301AN denegar el acceso.', 'supported'],
    ['Los registros DEBEN guardar el lote al menos 2 semanas.', 'supported'],
    ['El servicio tarda 12 segundos.', 'supported'],
    ['The catalog SHOULD show the release marked v2.4.', 'missing'],
    ['Los avisos PUEDEN aparecer en el capítulo 3.', 'missing'],
    ['Los servicios PUEDEN rechazar solicitudes no autorizadas.', 'missing'],
    ['Los servicios DEBEN enviar ≤ 120 turnos por minutoé.', 'missing'],
    ['El servicio tarda 12 segundosé.', 'missing'],
    ['Los puestos DEBEN enviar un resumen cuando sea necesario.', 'missing'],
  ];
  for (const [statement, status] of samples) {
    const text = `FR-001: ${statement}`;
    const result = await analyze({ name: 'measurement', artifacts: [classifyArtifact('prd.md', text)] });
    const measurement = result.practices.find(item => item.id === 'E1.2')!;
    assert.equal(measurement.status, status, text);
    assert.deepEqual(measurement.evidence, status === 'supported' ? [{ path: 'prd.md', line: 1, text }] : []);
  }
});

test('clear May date phrases do not count as permission, while real permission remains visible', async () => {
  for (const [text, status] of [
    ['FR-001: May 12 is the inventory date.', 'missing'],
    ['FR-001: May 2027 is the deployment month.', 'missing'],
    ['The west studio opened in May.', 'unknown'],
    ['In May, the branch moved to the library.', 'unknown'],
    ['The operator May publish the register in May.', 'supported'],
    ['The operator MAY notify the team when May 12 is a working day.', 'supported'],
  ]) {
    const result = await analyze({ name: 'May boundary', artifacts: [classifyArtifact('prd.md', text)] });
    const normative = result.practices.find(item => item.id === 'E1.4')!;
    assert.equal(normative.status, status, text);
    assert.deepEqual(normative.evidence, status === 'supported' ? [{ path: 'prd.md', line: 1, text }] : []);
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

test('modal words mentioned in code spans or double quotes are not requirements', async () => {
  const lines = [
    'Keywords such as `SHALL` and `MUST` stay in English.',
    'Show an example: "The system SHALL log."',
    'Mostrar: “El sistema DEBE registrar.”',
    '¿Qué "debe" significar el término?',
    'FR-010: Reject bodies without `MUST`.',
    'The parser MUST reject lines without `SHALL`.',
    'La app DEBE mostrar "Guardado" tras editar.',
    'The screen MUST be 5" wide.',
  ];
  const text = lines.join('\r\n');
  const result = await analyze({ name: 'mentions', artifacts: [classifyArtifact('spec.md', text)] });
  const e14 = result.practices.find(p => p.id === 'E1.4')!;
  assert.equal(e14.status, 'partial');
  assert.deepEqual(e14.evidence.map(item => item.line), [6, 7, 8]);
  assert.deepEqual(e14.evidence.map(item => item.text), [lines[5], lines[6], lines[7]]);
  const unidentified = result.findings.filter(f => f.message === 'Requirement has no stable identifier.').map(f => f.evidence[0].line);
  assert.deepEqual(unidentified, [6, 7, 8]);
});

test('a requirement ID admits a line only in its defining position', async () => {
  const lines = [
    '- RF-3: El servicio registrará cada acceso.',
    '- [ ] Conectar el formulario de acceso (RF-3)',
    '| FR-4 | Export a monthly report |',
    '| T-7 | FR-4 | Done |',
    'Satisfies FR-3 and FR-4.',
    '**RNF-5:** Los tokens caducan tras una hora.',
    'See FR-5; the token MUST be rotated.',
  ];
  const result = await analyze({ name: 'id-position', artifacts: [classifyArtifact('spec.md', lines.join('\n'))] });
  const e14 = result.practices.find(p => p.id === 'E1.4')!;
  assert.equal(e14.status, 'partial');
  assert.deepEqual(e14.evidence.map(item => item.line), [7]);
  // Lines 2, 4 and 5 only cite IDs, so they are not requirements and raise no findings.
  const lines14 = result.findings.flatMap(f => f.evidence.map(e => e.line));
  for (const line of [2, 4, 5]) assert.ok(!lines14.includes(line), `line ${line} should not be a requirement`);
});

test('constraint IDs admit lines in the defining position; success criteria do not', async () => {
  const lines = [
    '| C-003 | No credential appears in argv (FR-18) |',
    '- **CON-2:** The tool runs offline.',
    '- **SC-002**: 95% of users finish in under 2 minutes (FR-3).',
    'This change applies C-003.',
    'The CLI MUST exit with code 2 on invalid input.',
  ];
  const result = await analyze({ name: 'constraints', artifacts: [classifyArtifact('spec.md', lines.join('\n'))] });
  const e14 = result.practices.find(p => p.id === 'E1.4')!;
  assert.equal(e14.status, 'partial');
  assert.deepEqual(e14.evidence.map(item => item.line), [5]);
  const unidentified = result.findings.filter(f => f.message === 'Requirement has no stable identifier.').map(f => f.evidence[0].line);
  assert.deepEqual(unidentified, [5]);
});
