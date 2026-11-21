import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadEngine, repository } from '../scripts/precision/engines.js';
import { suppress } from '../scripts/precision/metrics.js';
import { commentLines, fencedLines, isolate, predictLine, quotedOnlyModal, segments } from '../scripts/precision/probe.js';
import { audit } from '../scripts/precision/audit-denominators.js';
import { z } from 'zod';

const label = z.enum(['positive', 'negative', 'unknown']);
const fixture = z.strictObject({ version: z.literal(1), description: z.string(), cases: z.array(z.strictObject({
  id: z.string(), family: z.string(), language: z.enum(['en', 'es']), path: z.string(),
  eol: z.enum(['\n', '\r\n']).optional(), bom: z.boolean().optional(), nfd: z.boolean().optional(),
  lines: z.array(z.string()).min(1),
  targets: z.array(z.strictObject({ line: z.number().int().positive(), admitted: z.boolean().nullable(),
    'E1.4': label, 'E1.2': label, note: z.string().optional() })).min(1),
})) });
const cases = fixture.parse(JSON.parse(await readFile(new URL('../fixtures/precision/minimal-pairs.json', import.meta.url), 'utf8'))).cases;
const contentOf = (entry: (typeof cases)[number]) => {
  const text = (entry.bom ? '﻿' : '') + entry.lines.join(entry.eol ?? '\n');
  return entry.nfd ? text.normalize('NFD') : text;
};

test('minimal pairs have unique IDs, in-range targets and both languages per family', () => {
  assert.equal(new Set(cases.map(entry => entry.id)).size, cases.length);
  for (const entry of cases) for (const target of entry.targets) assert.ok(target.line <= entry.lines.length, entry.id);
  for (const family of ['fence-mismatch', 'fence-control', 'quoted-modal', 'comparator']) {
    assert.deepEqual(new Set(cases.filter(entry => entry.family === family).map(entry => entry.language)), new Set(['en', 'es']), family);
  }
});

test('the probe keeps separators, BOM and target bytes while blanking other candidates', () => {
  const content = '﻿The app MUST start.\r\n```\r\nFR-002 MUST stop.\r\n```\r\nThe app MUST log.';
  const probe = isolate(content, 5);
  assert.equal(probe, '\r\n```\r\n\r\n```\r\nThe app MUST log.');
  assert.equal(segments(probe).length, segments(content).length);
  assert.equal(isolate(content, 1).startsWith('﻿The app MUST start.\r\n'), true);
});

test('the fence oracle pairs characters and run lengths', () => {
  assert.deepEqual([...fencedLines('~~~\n```\nx\n```\n~~~\ny')], [1, 2, 3, 4, 5]);
  assert.deepEqual([...fencedLines('````\na\n```\nb\n````\nc')], [1, 2, 3, 4, 5]);
  assert.deepEqual([...fencedLines('```json``` x\ny')], []);
  assert.deepEqual([...fencedLines('```\na\n```text\nb\n```\nc')], [1, 2, 3, 4, 5]);
  assert.deepEqual([...commentLines('a\n<!-- b\nc -->\nd')], [2, 3]);
  assert.equal(quotedOnlyModal('Use `MUST` here.'), true);
  assert.equal(quotedOnlyModal('The app MUST use `SHALL`.'), false);
});

test('the current engine meets every quoted-modal and control expectation', async () => {
  const engine = await loadEngine(repository);
  // Fence-mismatch structures (H1, stopped) remain known baseline errors and are not asserted.
  for (const entry of cases.filter(item => ['quoted-modal', 'fence-control', 'admission-control'].includes(item.family) || item.id === 'bom-first-line-en')) {
    const content = contentOf(entry);
    for (const target of entry.targets) {
      const prediction = await predictLine(engine, entry.path, content, target.line);
      const where = `${entry.id}:${target.line}`;
      if (target.admitted !== null) assert.equal(prediction.admitted, target.admitted, where);
      if (prediction.admitted) assert.equal(prediction['E1.4'], target['E1.4'], where);
      assert.notEqual(prediction.evidenceValid, false, where);
    }
  }
});

test('the audit derives every denominator from fixture labels', () => {
  // 12 positive, 8 negative and 4 unknown references, as in the second synthetic calibration.
  const fixtures = [
    ...Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, label: 'positive', targetLine: `Line ${i} MUST log.` })),
    ...Array.from({ length: 8 }, (_, i) => ({ id: `n${i}`, label: 'negative', targetLine: `Note ${i}.` })),
    ...Array.from({ length: 4 }, (_, i) => ({ id: `u${i}`, label: 'unknown', targetLine: `Maybe ${i}.` })),
  ];
  const results = [
    ...fixtures.slice(0, 10).map((row, i) => ({ id: row.id, label: 'yes', evidence: i < 6 ? 'MUST log' : 'invented span' })),
    { id: 'p10', label: 'no' }, { id: 'p11', label: 'no' },
    ...fixtures.slice(12, 20).map(row => ({ id: row.id, label: 'no' })),
    ...fixtures.slice(20).map(row => ({ id: row.id, label: 'yes', evidence: 'Maybe' })),
  ];
  const report = audit(fixtures, results);
  assert.deepEqual(report.perClass, {
    positive: { correct: 10, denominator: 12 }, negative: { correct: 8, denominator: 8 }, unknown: { correct: 0, denominator: 4 },
  });
  assert.deepEqual([report.exactEvidence.numerator, report.exactEvidence.denominator], [6, 20]);
  assert.deepEqual([report.strictCorrect.numerator, report.strictCorrect.denominator], [14, 24]);
  assert.equal(report.confusion.referenceUnknown, 4);
  assert.equal(report.confusion.unknownDecided, 4);
  const missing = audit(fixtures, results.slice(1));
  assert.equal(missing.unanswered, 1);
  assert.equal(missing.confusion.positiveAbstentions, 1);
});

test('restricted aggregates suppress small line counts but keep recurrence totals exact', () => {
  assert.deepEqual(suppress({ roots: 3, documents: 4, failure: { repositories: 2, lineages: 1, distinctLines: 3 }, adjacent: { E1: { added: 0, removed: 7 } } }),
    { roots: 3, documents: '<5', failure: { repositories: 2, lineages: 1, distinctLines: '<5' }, adjacent: { E1: { added: 0, removed: 7 } } });
});
