import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { analyze, clarifyE12, classifyArtifact, contentHash } from '../src/core.js';
import type { ArtifactSet, Evidence, Language } from '../src/core.js';

interface StudyCase {
  id: string;
  language: Language;
  path: string;
  source: string;
  sha256: string;
  route: 'engine' | 'injected' | 'silent';
  evidence: Evidence;
  expected: { outcome: 'ask' | 'abstain' | 'clear' };
}
interface FreshCase {
  lineage: string;
  language: Language;
  path: string;
  source: string;
  companions?: Record<string, string>;
  kind: 'question' | 'abstain' | 'review';
  focus: string;
}
const fixture = (name: string) => readFileSync(new URL('./fixtures/e12/' + name + '.json', import.meta.url), 'utf8');
const study: { cases: StudyCase[] } = JSON.parse(fixture('study'));
const fresh: FreshCase[] = JSON.parse(fixture('fresh'));

function documents(path: string, source: string, companions: Record<string, string> = {}): ArtifactSet {
  return {
    name: 'E1.2 clarification',
    artifacts: [classifyArtifact(path, source),
      ...Object.entries(companions).map(([name, content]) => classifyArtifact(name, content))],
  };
}

async function check(set: ArtifactSet, language: Language) {
  const assessment = await analyze(set);
  const finding = assessment.findings.find(f => f.practiceId === 'E1.2' && f.evidence[0]?.path === set.artifacts[0].path);
  assert(finding, 'The shared detector must emit the test finding');
  const documentsBefore = structuredClone(set);
  const reportBefore = structuredClone(assessment);
  const result = await clarifyE12(set, assessment, finding.id, language);
  assert(result);
  assert.equal(result.revision, assessment.id);
  assert.deepEqual(set, documentsBefore);
  assert.deepEqual(assessment, reportBefore);
  for (const evidence of result.evidence) {
    const artifact = set.artifacts.find(a => a.path === evidence.path);
    assert.equal(artifact?.content.split(/\r?\n/)[evidence.line - 1], evidence.text);
    assert.equal(artifact?.featureId, set.artifacts[0].featureId);
  }
  return { result, assessment, finding };
}

test('the 12 frozen study units keep real, injected and silent targets separate', async () => {
  assert.equal(study.cases.length, 12);
  const counts = { engine: 0, injected: 0, silent: 0, questions: 0, abstained: 0 };
  for (const row of study.cases) {
    assert.equal(await contentHash(row.source), row.sha256, row.id);
    const set = documents(row.path, row.source);
    const report = await analyze(set);
    const hits = report.findings.filter(f => f.practiceId === 'E1.2' &&
      f.evidence.some(e => e.path === row.evidence.path && e.line === row.evidence.line && e.text === row.evidence.text));
    counts[row.route]++;
    if (row.route !== 'engine') {
      assert.equal(hits.length, 0, row.id);
      assert.equal(await clarifyE12(set, report, row.id, row.language), undefined);
      continue;
    }
    assert.equal(hits.length, 1, row.id);
    const { result } = await check(set, row.language);
    const expectedKind = row.expected.outcome === 'ask' ? 'question' : 'abstain';
    assert.equal(result.kind, expectedKind, row.id);
    counts[result.kind === 'question' ? 'questions' : 'abstained']++;
    assert.deepEqual(result.evidence[0], row.evidence, row.id);
  }
  assert.deepEqual(counts, { engine: 6, injected: 4, silent: 2, questions: 4, abstained: 2 });
});

for (const row of fresh) {
  test('fresh lineage ' + row.lineage, async () => {
    const { result } = await check(documents(row.path, row.source, row.companions), row.language);
    assert.equal(result.kind, row.kind);
    assert.equal(result.focus.startsWith('measurement-') ? 'measurement' : result.focus, row.focus);
    if (row.lineage === 'document-roster') {
      assert.equal(result.kind, 'question');
      assert.equal(result.question, 'Which event ends the elapsed-time measurement?');
    }
    if (row.lineage === 'status-icon' || row.lineage === 'aviso-entrega') {
      assert.equal(result.kind, 'question');
      assert.match(result.question, /event or condition|evento o condición/);
    }
    if (row.lineage === 'gallery-preview' || row.lineage === 'acuse-etiquetado') {
      assert.equal(result.evidence.length, 3);
      assert.ok(result.evidence.slice(1).every(e => /(?:plan|design)\.md$/.test(e.path)));
    }
  });
}

test('quoted, fenced, commented and unlinked context does not resolve an event', async () => {
  const { result } = await check(documents('specs/indicator/spec.md', 'FR-008: The indicator MUST disappear as needed.', {
    'specs/indicator/plan.md': '> FR-008 Trigger event: open the settings.\n```md\nFR-008 Trigger event: close the settings.\n```\n<!--\nFR-008 Trigger event: activate the menu.\n-->\nFR-009 Trigger event: no session.\n',
  }), 'en');
  assert.equal(result.kind, 'question');
  assert.equal(result.focus, 'trigger');
  assert.equal(result.evidence.length, 1);
});

test('equivalent stated bounds and inline boundaries avoid a redundant question', async () => {
  const { result } = await check(documents('specs/query/spec.md',
    'NFR-090: The query MUST load quickly within 0.3 seconds, measured from submit to first paint.', {
      'specs/query/plan.md': '- NFR-090 Latency limit: 300 ms.\n',
    }), 'en');
  assert.equal(result.kind, 'abstain');
  assert.equal(result.focus, 'already-specified');
});

test('a negative obligation, existing decision or comparison does not trigger a question', async () => {
  for (const text of [
    'FR-317: The reservation MUST NOT disappear as needed.',
    'FR-317: The reservation MUST disappear as needed [NEEDS CLARIFICATION: removal event pending].',
    'FR-317: The new search MUST be as fast as the current one.',
  ]) {
    const { result } = await check(documents('specs/rooms/spec.md', text), 'en');
    assert.equal(result.kind, 'abstain');
  }
});

test('a stale companion or false evidence cannot produce guidance', async () => {
  const root = 'specs/alerts/';
  const source = 'FR-308: The alert MUST disappear as needed.';
  const plan = root + 'plan.md';
  const set = documents(root + 'spec.md', source, { [plan]: '- FR-308 Trigger event: dismiss button release.' });
  const { assessment, finding } = await check(set, 'en');
  const updated = documents(root + 'spec.md', source, { [plan]: '- FR-308 Trigger event: timeout.' });
  assert.equal(await clarifyE12(updated, assessment, finding.id, 'en'), undefined);
  finding.evidence[0].text = 'Unrelated other text';
  assert.equal(await clarifyE12(set, assessment, finding.id, 'en'), undefined);
});

test('linked trigger placeholders leave the decision open in both languages', async () => {
  for (const [language, source, placeholder] of [
    ['en', 'FR-008: The indicator MUST disappear as needed.', 'Trigger event: when necessary.'],
    ['es', 'FR-008: El indicador DEBE desaparecer cuando sea necesario.', 'Evento disparador: cuando sea necesario.'],
  ] as const) {
    const { result } = await check(documents('specs/indicator/spec.md', source, {
      'specs/indicator/plan.md': '- FR-008 ' + placeholder,
    }), language);
    assert.equal(result.kind, 'question');
    assert.equal(result.focus, 'trigger');
  }
});

test('a pending inline or linked measurement endpoint still needs a question', async () => {
  for (const [language, source, companions] of [
    ['en', 'FR-100: The lookup MUST be fast within 300 ms, measured from submit to TBD.', {}],
    ['es', 'FR-100: La consulta DEBE ser rápida en 300 ms, medida desde el envío hasta por determinar.', {}],
    ['en', 'FR-100: The lookup MUST be fast within 300 ms.', {
      'specs/query/plan.md': '- FR-100 Measurement start: submit.\n- FR-100 Measurement end: to be determined.',
    }],
  ] as const) {
    const { result } = await check(documents('specs/query/spec.md', source, companions), language);
    assert.equal(result.kind, 'question');
    assert.equal(result.focus, 'measurement-end');
  }
});

test('undefined adaptation requests observable behavior before a time limit', async () => {
  for (const [language, source, wording] of [
    ['en', 'FR-091: The queue MUST adapt quickly when tagged patterns are added.\nPaused jobs are excluded from reordering.', /observable behavior/],
    ['es', 'FR-112: El planificador DEBE adaptarse rápido cuando cambie el cupo.\nLos envíos aprobados quedan excluidos.', /comportamiento observable/],
  ] as const) {
    const { result } = await check(documents('specs/adaptation/spec.md', source), language);
    assert.equal(result.kind, 'question');
    assert.equal(result.focus, 'behavior');
    assert.match(result.question, wording);
  }
});

test('the closest modality governs clarification of mixed or negated clauses', async () => {
  for (const [language, source, kind] of [
    ['en', 'FR-020: The console MUST retain the record and MAY dismiss the alert as needed.', 'abstain'],
    ['es', 'FR-020: La consola DEBE conservar el registro y PUEDE retirar el aviso cuando sea necesario.', 'abstain'],
    ['en', 'FR-021: The console MUST never dismiss the alert as needed.', 'abstain'],
    ['es', 'FR-021: La consola DEBE nunca retirar el aviso cuando sea necesario.', 'abstain'],
    ['en', 'FR-022: The console MAY archive the record but MUST dismiss the alert as needed.', 'question'],
  ] as const) {
    const { result } = await check(documents('specs/notice/spec.md', source), language);
    assert.equal(result.kind, kind, source);
  }
});

test('quoted labels cannot override the real modality or supply the selected cue', async () => {
  for (const [language, source, kind] of [
    ['en', 'FR-031: The console MAY remove the “MUST” alert as needed.', 'abstain'],
    ['es', 'FR-031: La consola PUEDE retirar el aviso «DEBE» cuando sea necesario.', 'abstain'],
    ['en', 'FR-032: The console MUST remove the `MAY` alert as needed.', 'question'],
    ['es', 'FR-032: La consola DEBE retirar el aviso «PUEDE» cuando sea necesario.', 'question'],
    ['en', 'FR-033: The console MUST remove the label “Remove as needed” from historical views.', 'abstain'],
  ] as const) {
    const { result } = await check(documents('specs/notice/spec.md', source), language);
    assert.equal(result.kind, kind, source);
  }
});
