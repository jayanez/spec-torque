/**
 * Calibration audit whose denominators come from the fixture's reference labels, never from a
 * hard-coded fixture mix. Joins a fixture JSONL and a result JSONL by ID and prints aggregate
 * counts only (no IDs, text or evidence), so it can run on restricted files.
 *
 *   node --import tsx scripts/precision/audit-denominators.ts --fixture <f.jsonl> --results <r.jsonl>
 *     [--id id] [--reference label] [--target targetLine] [--decision label] [--evidence evidence]
 */
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { confusion } from './metrics.js';
import type { Label } from './probe.js';

export interface FieldMap { id: string; reference: string; target: string; decision: string; evidence: string }
export const defaultFields: FieldMap = { id: 'id', reference: 'label', target: 'targetLine', decision: 'label', evidence: 'evidence' };

const positive = new Set(['positive', 'yes', 'true']);
const negative = new Set(['negative', 'no', 'false']);
function normalize(value: unknown): Label | undefined {
  const text = String(value ?? '').trim().toLowerCase();
  return positive.has(text) ? 'positive' : negative.has(text) ? 'negative' : text === 'unknown' ? 'unknown' : undefined;
}
const field = (record: Record<string, unknown>, path: string) =>
  path.split('.').reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], record);

export function audit(fixtures: Record<string, unknown>[], results: Record<string, unknown>[], fields: FieldMap = defaultFields) {
  const key = (record: Record<string, unknown>) => {
    const value = field(record, fields.id);
    return typeof value === 'string' && value.length > 0 ? value : typeof value === 'number' ? String(value) : undefined;
  };
  const byId = new Map<string, Record<string, unknown>>();
  let duplicateResults = 0, resultsWithoutId = 0, parseErrors = 0;
  for (const result of results) {
    if (result.__parseError) { parseErrors++; continue; }
    const id = key(result);
    if (id === undefined) { resultsWithoutId++; continue; }
    if (byId.has(id)) duplicateResults++;
    else byId.set(id, result);
  }
  const rows: { reference: Label; decision: Label; exact: boolean; answered: boolean }[] = [];
  const seen = new Set<string>();
  let invalidReferences = 0, fixturesWithoutId = 0, duplicateFixtures = 0;
  for (const fixture of fixtures) {
    const id = key(fixture);
    if (id === undefined) { fixturesWithoutId++; continue; }
    if (seen.has(id)) { duplicateFixtures++; continue; }
    seen.add(id);
    const reference = normalize(field(fixture, fields.reference));
    if (!reference) { invalidReferences++; continue; }
    const result = byId.get(id);
    // Missing, unparsable or undecided results are abstentions, not negatives.
    const decision = result ? normalize(field(result, fields.decision)) ?? 'unknown' : 'unknown';
    const target = String(field(fixture, fields.target) ?? '');
    const evidence = result ? field(result, fields.evidence) : undefined;
    const exact = typeof evidence === 'string' && evidence.length > 0 && target.includes(evidence);
    rows.push({ reference, decision, exact, answered: Boolean(result) });
  }
  const unmatchedResults = [...byId.keys()].filter(id => !seen.has(id)).length;
  const decidedReference = rows.filter(row => row.reference !== 'unknown' && row.decision !== 'unknown');
  const strict = rows.filter(row => row.reference === 'unknown'
    ? row.decision === 'unknown'
    : row.decision === row.reference && (row.reference === 'negative' || row.exact));
  const byReference = (label: Label) => {
    const subset = rows.filter(row => row.reference === label);
    return { correct: subset.filter(row => row.decision === label).length, denominator: subset.length };
  };
  return {
    fixtures: fixtures.length, results: results.length, invalidReferences, duplicateFixtures, fixturesWithoutId,
    duplicateResults, resultsWithoutId, parseErrors, unmatchedResults,
    unanswered: rows.filter(row => !row.answered).length,
    confusion: confusion(rows.map(row => ({ reference: row.reference, prediction: row.decision }))),
    perClass: { positive: byReference('positive'), negative: byReference('negative'), unknown: byReference('unknown') },
    exactEvidence: { numerator: decidedReference.filter(row => row.exact).length, denominator: decidedReference.length,
      scope: 'decided reference cases (binary reference and a decided result)' },
    strictCorrect: { numerator: strict.length, denominator: rows.length,
      rule: 'positive needs exact evidence; negative needs the label; unknown needs an abstention' },
  };
}

async function jsonl(path: string) {
  return (await readFile(path, 'utf8')).split(/\r?\n/u).filter(line => line.trim()).map(line => {
    try { return JSON.parse(line) as Record<string, unknown>; } catch { return { __parseError: true }; }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { values } = parseArgs({ options: {
    fixture: { type: 'string' }, results: { type: 'string' }, id: { type: 'string' }, reference: { type: 'string' },
    target: { type: 'string' }, decision: { type: 'string' }, evidence: { type: 'string' },
  } });
  if (!values.fixture || !values.results) throw new Error('Use --fixture <fixture.jsonl> --results <results.jsonl>.');
  const fields: FieldMap = { ...defaultFields, ...Object.fromEntries(Object.entries(values)
    .filter(([key, value]) => key in defaultFields && value)) };
  try {
    console.log(JSON.stringify(audit(await jsonl(values.fixture), await jsonl(values.results), fields), null, 2));
  } catch (error) {
    console.error(`Audit failed: ${error instanceof Error ? error.name : 'Error'}`);
    process.exitCode = 1;
  }
}
