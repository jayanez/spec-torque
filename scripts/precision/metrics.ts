import type { Label } from './probe.js';

export interface Row { reference: Label; prediction: Label }
const rate = (numerator: number, denominator: number) => ({ value: denominator ? numerator / denominator : null, numerator, denominator });

/**
 * Confusion counts with every denominator derived from the supplied reference labels.
 * Engine abstentions (prediction `unknown`) stay separate from decisions, and reference
 * unknowns are reported apart from binary references.
 */
export function confusion(rows: Row[]) {
  const counts = { units: rows.length, positives: 0, negatives: 0, referenceUnknown: 0, tp: 0, fp: 0, tn: 0, fn: 0,
    positiveAbstentions: 0, negativeAbstentions: 0, unknownDecided: 0, unknownAbstained: 0 };
  for (const { reference, prediction } of rows) {
    if (reference === 'unknown') {
      counts.referenceUnknown++;
      if (prediction === 'unknown') counts.unknownAbstained++; else counts.unknownDecided++;
      continue;
    }
    if (reference === 'positive') counts.positives++; else counts.negatives++;
    if (prediction === 'unknown') {
      if (reference === 'positive') counts.positiveAbstentions++; else counts.negativeAbstentions++;
    } else if (reference === 'positive') {
      if (prediction === 'positive') counts.tp++; else counts.fn++;
    } else if (prediction === 'positive') counts.fp++; else counts.tn++;
  }
  const decided = counts.tp + counts.fp + counts.tn + counts.fn;
  return {
    ...counts,
    precision: rate(counts.tp, counts.tp + counts.fp),
    recall: rate(counts.tp, counts.positives),
    falsePositiveRate: rate(counts.fp, counts.negatives),
    coverage: rate(decided, counts.positives + counts.negatives),
    strictCorrect: rate(counts.tp + counts.tn + counts.unknownAbstained, rows.length),
  };
}
export type Confusion = ReturnType<typeof confusion>;
