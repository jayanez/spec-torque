import { z } from 'zod';

export const labels = z.enum(['positive', 'negative', 'unknown', 'unsupported']);
export type Label = z.infer<typeof labels>;
const annotation = z.object({ label: labels, reason: z.string().trim().min(1) }).strict();
const reviewer = z.object({
  id: z.string().trim().min(1),
  annotations: z.record(z.string(), annotation),
}).strict();
export const reviewFile = z.object({
  packet: z.string().regex(/^[a-f0-9]{64}$/u),
  reviewers: z.tuple([reviewer, reviewer]),
  adjudicator: reviewer.optional(),
}).strict().superRefine(({ reviewers, adjudicator }, ctx) => {
  const ids = [reviewers[0].id, reviewers[1].id, ...(adjudicator ? [adjudicator.id] : [])];
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: 'custom', message: 'Reviewers and adjudicator must have distinct IDs.' });
  }
});
export type Reviews = z.infer<typeof reviewFile>;
export type Reference = Label | 'pending' | 'disputed';

export function referenceFor(id: string, reviews?: Reviews): Reference {
  const first = reviews?.reviewers[0].annotations[id];
  const second = reviews?.reviewers[1].annotations[id];
  if (!first || !second) return 'pending';
  if (first.label === second.label) return first.label;
  return reviews?.adjudicator?.annotations[id]?.label ?? 'disputed';
}

export function summarize(rows: readonly { reference: Reference; prediction: Label }[]) {
  const counts = {
    tp: 0, fp: 0, tn: 0, fn: 0, abstainedPositive: 0, abstainedNegative: 0,
    referenceUnknown: 0, unsupported: 0, pending: 0, disputed: 0,
  };
  for (const { reference, prediction } of rows) {
    if (reference === 'pending' || reference === 'disputed' || reference === 'unsupported') {
      counts[reference]++;
    } else if (reference === 'unknown') {
      counts.referenceUnknown++;
    } else if (prediction === 'unknown' || prediction === 'unsupported') {
      if (reference === 'positive') counts.abstainedPositive++;
      else counts.abstainedNegative++;
    } else if (prediction === 'positive') {
      if (reference === 'positive') counts.tp++;
      else counts.fp++;
    } else if (reference === 'positive') {
      counts.fn++;
    } else {
      counts.tn++;
    }
  }
  const { tp, fp, tn, fn, abstainedPositive, abstainedNegative, pending, disputed } = counts;
  const decided = tp + fp + tn + fn;
  const eligible = decided + abstainedPositive + abstainedNegative;
  const rate = (numerator: number, denominator: number) =>
    ({ numerator, denominator, value: !pending && !disputed && denominator ? numerator / denominator : null });
  return {
    ...counts, total: rows.length, eligible, decided,
    falsePositiveRate: rate(fp, fp + tn), precision: rate(tp, tp + fp),
    recall: rate(tp, tp + fn), coverage: rate(decided, eligible),
  };
}
