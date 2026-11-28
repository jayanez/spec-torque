import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyArtifact, contentHash } from '../src/core/artifacts.js';
import { analyze, reachableTotal } from '../src/core/analyze.js';
import { PRACTICES } from '../src/core/catalog.js';
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

test('a feature named all does not widen assessment or export scope', async () => {
  const { selectFeature } = await import('../src/core/artifacts.js');
  const set = { name: 'generic', artifacts: [classifyArtifact('all/spec.md', 'one'), classifyArtifact('other/spec.md', 'two')] };
  assert.deepEqual(selectFeature(set, 'all').artifacts.map(a => a.path), ['all/spec.md']);
  assert.equal(selectFeature(set, null).artifacts.length, 2);
});

test('month enumerations do not supply a normative cue or admit a requirement', async () => {
  const lines = [
    '  - : One of "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" (case-sensitive).',
    '  - : One of `Jan`, `Feb`, `Mar`, `Apr`, `May`, `Jun`, `Jul`, `Aug`, `Sep`, `Oct`, `Nov`, `Dec` (case sensitive).',
    'Supported months include APRIL, MAY, JUNE.',
    'Supported months include “April”, “May”, “June”.',
  ];
  for (const line of lines) {
    const result = await analyze({ name: 'months', artifacts: [classifyArtifact('spec.md', '# Calendar\n' + line)] });
    for (const id of ['E1.2', 'E1.4', 'E2.1', 'I1.2', 'I2.2']) {
      assert.equal(result.practices.find(practice => practice.id === id)?.status, 'unknown', `${id}: ${line}`);
    }
    assert.ok(!result.findings.some(finding => finding.practiceId === 'I1.2'), line);
    assert.equal(result.artifacts[0]?.hash, await contentHash('# Calendar\n' + line));
  }
});

test('month enumeration suppression preserves independent modal and identifier evidence', async () => {
  for (const line of [
    'Operators may stop after selecting from Apr, May, Jun.',
    'Apr, May, Jun are selectable. Operators MAY stop.',
    'Operators may stop in May.',
    'After April, operators may stop in June.',
    'The service MAY accept Apr, May, Jun choices.',
    'The names April, May, July are selectable.',
    'El operador PUEDE elegir entre Apr, May, Jun.',
  ]) {
    const result = await analyze({ name: 'permission', artifacts: [classifyArtifact('spec.md', line)] });
    const practice = result.practices.find(row => row.id === 'E1.4');
    assert.equal(practice?.status, 'supported', line);
    assert.deepEqual(practice?.evidence, [{ path: 'spec.md', line: 1, text: line }]);
  }
  const explicit = await analyze({ name: 'identifier', artifacts: [classifyArtifact('spec.md', 'FR-1: Months are Apr, May, Jun.')] });
  assert.equal(explicit.practices.find(row => row.id === 'E1.4')?.status, 'missing');
  assert.equal(explicit.practices.find(row => row.id === 'I1.2')?.status, 'supported');

  const example = await analyze({ name: 'example', artifacts: [classifyArtifact('spec.md',
    '> Operators may stop. The options are Apr, May, Jun.\n\n```md\nOperators may stop.\n```')] });
  assert.equal(example.practices.find(row => row.id === 'E1.4')?.status, 'unknown');
});
test('H106: a labeled dependency field with an ID counts for P1.3, an absent value does not', async () => {
  const status = async (line: string) => (await analyze({ name: 'h106', artifacts: [
    classifyArtifact('specs/001-demo/spec.md', '# Demo\n\n- REQ-001: The system MUST export the report.\n'),
    classifyArtifact('specs/001-demo/tasks.md', `# Tasks\n\n- [ ] T001 (REQ-001): Write the schema.\n- [ ] T002 (REQ-001): Write the exporter.\n  ${line}\n`),
  ] })).practices.find(p => p.id === 'P1.3')?.status;
  const twins: Array<[string, string, 'partial' | 'missing']> = [
    ['Dependencies: T001. Target files: `src/export.py`.', 'Dependencias: T001. Archivos: `src/export.py`.', 'partial'],
    ['Dependencies: T001, T003.', 'Dependencias: T001, T003.', 'partial'],
    ['Blocked by: T001.', 'Bloqueado por: T001.', 'partial'],
    ['**Dependencies:** REQ-001', '**Dependencias:** REQ-001', 'partial'],
    ['Dependencies: T001–T004.', 'Dependencias: SPEC-028/T001.', 'partial'],
    ['Depends on T001.', 'Depende de T001.', 'partial'],
    ['Dependencies: none.', 'Dependencias: ninguna.', 'missing'],
    ['Dependencies: —', 'Dependencias: —', 'missing'],
    ['Dependencies:', 'Dependencias:', 'missing'],
    ['Dependencies: the exporter must finish first.', 'Dependencias: el exportador debe terminar antes.', 'missing'],
    ['Dependencies: none. Verified by T009.', 'Dependencias: ninguna. Verificado por T009.', 'missing'],
    ['Dependencies between tasks are tracked separately (see T001).', 'Las dependencias entre tareas se revisan aparte (ver T001).', 'missing'],
    // Amendment H106-2.
    ['**Dependencies**: T001', '**Dependencias**: T001', 'partial'],
    ['Dependency: T001.', 'Dependencia: T001.', 'partial'],
    ['Dependencies: see spec.md, T001.', 'Dependencias: ver spec.md, T001.', 'partial'],
    ['**Primary Dependencies**: FastAPI, ISO-8601 parsing', '**Dependencias principales**: FastAPI, ISO-8601', 'missing'],
    ['Dependencies: utf-8 encoding, AWS t3.', 'Dependencias: codificación utf-8, AWS t3.', 'missing'],
    ['Dependencies: *none* (see T003).', 'Dependencias: _ninguna_ (ver T003).', 'missing'],
    ['Dependencies: nothing blocks this; T001 is optional.', 'Dependencias: sin dependencias (ver T001).', 'missing'],
    ['Dependencies: N/A, T001 later.', 'Dependencias: N/A, T001 después.', 'missing'],
    // Known limit: the unchanged verb phrase of 0.1.16 still counts a labeled "Depends on: none".
    ['Depends on: none. Verified by T009.', 'Depende de: ninguna. Verificado por T009.', 'partial'],
  ];
  for (const [en, es, expected] of twins) for (const line of [en, es]) assert.equal(await status(line), expected, line);
  // Untrusted Markdown: long padding or repeated labels stay linear.
  const p13 = PRACTICES.find(p => p.id === 'P1.3')!.pattern!;
  for (const line of ['Dependencies:' + '*'.repeat(100_000), 'Dependencies:' + ' '.repeat(100_000), 'Dependencies: x; '.repeat(6_000)]) {
    const started = performance.now();
    assert.equal(p13.test(line), false);
    assert.ok(performance.now() - started < 500, 'P1.3 pattern backtracks on a long line');
  }
});
test('H85: a demonstrative that leads a noun phrase is not a pronoun subject (E1.3)', async () => {
  const flagged = async (line: string) => (await analyze({ name: 'h85', artifacts: [classifyArtifact('specs/001-demo/spec.md', `# Demo\n\n${line}\n`)] }))
    .findings.some(f => f.practiceId === 'E1.3');
  for (const line of ['- REQ-001: This amendment MUST keep the export format.', 'That endpoint MUST return 404.', 'This `export` flag MUST stay off.', 'This status MUST stay visible.', 'This process MUST stop on failure.',
    '- REQ-001: Esta enmienda DEBE conservar el formato.']) assert.equal(await flagged(line), false, line);
  for (const line of ['- REQ-001: This MUST keep the export format.', 'That means the endpoint MUST return 404.', 'This, in turn, MUST hold.',
    "That's why the export MUST include the date.", 'This in turn means the export MUST include the date.', 'This only applies when the export MUST run.',
    'It MUST include the date.', 'This allowed the export to fail; the service MUST retry.', 'That cannot happen; the export MUST retry.', "That won't happen; the export MUST retry.", "This can't fail; the export MUST retry.", "This isn't optional: the export MUST retry.", 'This doesn’t change; the export MUST retry.', '- REQ-001: Esto DEBE conservar el formato.']) {
    assert.equal(await flagged(line), true, line);
  }
});

test('the reachable maximum is 20/30 for a full scope and follows non-applicability (#125)', async () => {
  // Only five practices have a deterministic check that can report supported; every other one stops at partial.
  assert.deepEqual(PRACTICES.filter(p => p.supportable).map(p => p.id), ['E1.2', 'E1.4', 'E2.1', 'I1.2', 'I2.2']);
  assert.equal(reachableTotal(), 20);
  const spec = classifyArtifact('spec.md', '# Booking\nFR-001: The system MUST confirm a booking within 2 seconds.');
  const full = await analyze({ name: 'full', artifacts: [spec] });
  assert.equal(full.summary.maximum, 30);
  assert.equal(full.summary.reachable, 20);
  // The flags match the engine: this fixture makes exactly the supportable practices supported.
  assert.deepEqual(full.practices.filter(p => p.status === 'supported').map(p => p.id), ['E1.2', 'E1.4', 'E2.1', 'I1.2', 'I2.2']);
  // With the three partial-only E1 practices not applicable, E1 can reach 3, so the total can reach 21.
  const reason = 'Not relevant to this single-requirement fixture.';
  const scoped = await analyze({ name: 'scoped', artifacts: [spec] }, { notApplicable: { 'E1.1': reason, 'E1.3': reason, 'E1.5': reason } });
  assert.equal(scoped.summary.reachable, 21);
  // A dimension with no applicable practice can never be scored, so no total is reachable.
  const c2 = Object.fromEntries(['C2.1', 'C2.2', 'C2.3', 'C2.4'].map(id => [id, reason]));
  assert.equal((await analyze({ name: 'no C2', artifacts: [spec] }, { notApplicable: c2 })).summary.reachable, null);
  // A supported status from a practice the catalog does not mark supportable fails loudly.
  const e12 = PRACTICES.find(p => p.id === 'E1.2')!;
  delete e12.supportable;
  try { await assert.rejects(analyze({ name: 'unmarked', artifacts: [spec] }), /E1\.2 reported supported but is not marked supportable/); } finally { e12.supportable = true; }
});
