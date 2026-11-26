/**
 * Scores a labeled adjudication packet against one arm's predictions (#52).
 *
 *   node --import tsx scripts/precision/score.ts --packet <packet.json> --predictions <predictions.json> [--out <file>]
 *
 * `predictions.json` maps item ID to `requirement | acceptance | other`. Bounds are one-sided
 * 95% Clopper-Pearson upper limits counted by lineage (docs/requirement-classification.md).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { z } from 'zod';

export const kinds = ['requirement', 'acceptance', 'other'] as const;
export type Kind = (typeof kinds)[number];
export type Label = Kind | 'unknown';

export interface ScoredItem {
  id: string;
  lineages: string[];
  reviewerA: Label | null;
  reviewerB: Label | null;
  adjudicated: Label | null;
}

export const MINIMUM_LINEAGES = 100;
export const BOUNDS = { precision: 0.05, recall: 0.05, acceptance: 0.10 } as const;

const logFactorial = (() => {
  const cache = [0];
  return (n: number) => { for (let i = cache.length; i <= n; i++) cache.push(cache[i - 1] + Math.log(i)); return cache[n]; };
})();
const logChoose = (n: number, k: number) => logFactorial(n) - logFactorial(k) - logFactorial(n - k);

/** P(X <= errors) for X ~ Binomial(n, p). */
function binomialCdf(errors: number, n: number, p: number) {
  if (p <= 0) return 1;
  if (p >= 1) return errors >= n ? 1 : 0;
  let sum = 0;
  for (let k = 0; k <= errors; k++) sum += Math.exp(logChoose(n, k) + k * Math.log(p) + (n - k) * Math.log1p(-p));
  return sum;
}

/** Upper limit of the one-sided Clopper-Pearson interval: the p at which P(X <= errors) = alpha. */
export function clopperPearsonUpper(errors: number, n: number, alpha = 0.05) {
  if (n <= 0) return 1;
  if (errors >= n) return 1;
  let low = 0;
  let high = 1;
  for (let step = 0; step < 80; step++) {
    const mid = (low + high) / 2;
    if (binomialCdf(errors, n, mid) > alpha) low = mid; else high = mid;
  }
  return high;
}

/** Cohen's kappa over items both reviewers labeled; null when chance agreement is total. */
export function cohenKappa(pairs: [string, string][]) {
  if (!pairs.length) return null;
  const labels = [...new Set(pairs.flat())];
  const observed = pairs.filter(([a, b]) => a === b).length / pairs.length;
  const expected = labels.reduce((sum, label) =>
    sum + (pairs.filter(([a]) => a === label).length / pairs.length) * (pairs.filter(([, b]) => b === label).length / pairs.length), 0);
  return expected === 1 ? null : (observed - expected) / (1 - expected);
}

interface Bound { items: number; lineages: number; errorLineages: number; upper: number; limit: number; pass: boolean; reason?: string }

/** Counts by lineage: a lineage is an error when any of its items is. */
function bound(entries: { item: ScoredItem; error: boolean }[], limit: number): Bound {
  const lineage = new Map<string, boolean>();
  for (const { item, error } of entries) for (const name of item.lineages) lineage.set(name, (lineage.get(name) ?? false) || error);
  const errorLineages = [...lineage.values()].filter(Boolean).length;
  const upper = clopperPearsonUpper(errorLineages, lineage.size);
  const enough = lineage.size >= MINIMUM_LINEAGES;
  return { items: entries.length, lineages: lineage.size, errorLineages, upper, limit, pass: enough && upper <= limit,
    ...(enough ? {} : { reason: `fewer than ${MINIMUM_LINEAGES} lineages` }) };
}

/**
 * Precision: lines the arm admits as requirement but the adjudicator did not call requirement.
 * Recall: adjudicated requirements (and unknowns, conservatively) the arm does not admit.
 * Acceptance: lines the arm tags acceptance but the adjudicator did not.
 * Unadjudicated items count as unknown, and unknown counts as an error.
 */
export function score(items: ScoredItem[], predictions: Record<string, Kind>) {
  const final = (item: ScoredItem): Label => item.adjudicated ?? 'unknown';
  const predicted = (item: ScoredItem) => predictions[item.id];
  const missing = items.filter(item => !predicted(item)).map(item => item.id);
  const known = items.filter(item => predicted(item));
  const pairs = items.filter(item => item.reviewerA && item.reviewerB).map(item => [item.reviewerA!, item.reviewerB!] as [string, string]);
  const result = {
    items: items.length,
    missingPredictions: missing,
    labels: Object.fromEntries([...kinds, 'unknown'].map(label => [label, items.filter(item => final(item) === label).length])),
    reviewers: { kappa: cohenKappa(pairs), compared: pairs.length },
    precision: bound(known.filter(item => predicted(item) === 'requirement').map(item => ({ item, error: final(item) !== 'requirement' })), BOUNDS.precision),
    recall: bound(known.filter(item => ['requirement', 'unknown'].includes(final(item))).map(item => ({ item, error: predicted(item) !== 'requirement' })), BOUNDS.recall),
    acceptance: bound(known.filter(item => predicted(item) === 'acceptance').map(item => ({ item, error: final(item) !== 'acceptance' })), BOUNDS.acceptance),
  };
  return { ...result, pass: !missing.length && result.precision.pass && result.recall.pass && result.acceptance.pass };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { packet: { type: 'string' }, predictions: { type: 'string' }, out: { type: 'string' } } });
  if (!values.packet || !values.predictions) throw new Error('Use --packet <packet.json> --predictions <predictions.json>.');
  const label = z.enum([...kinds, 'unknown']).nullable();
  const packet = z.object({ items: z.array(z.object({
    id: z.string(), occurrences: z.array(z.object({ lineage: z.string() })),
    labels: z.object({ reviewerA: label, reviewerB: label, adjudicated: label }),
  })) }).parse(JSON.parse(await readFile(values.packet, 'utf8')));
  const predictions = z.record(z.string(), z.enum(kinds)).parse(JSON.parse(await readFile(values.predictions, 'utf8')));
  const items = packet.items.map(item => ({ id: item.id, lineages: [...new Set(item.occurrences.map(o => o.lineage))], ...item.labels }));
  const result = JSON.stringify(score(items, predictions), null, 2) + '\n';
  if (values.out) await writeFile(values.out, result); else process.stdout.write(result);
}
