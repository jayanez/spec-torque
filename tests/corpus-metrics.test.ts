import test from 'node:test';
import assert from 'node:assert/strict';
import { referenceFor, reviewFile, reviewProvenance, summarize, type Label, type Reference } from '../scripts/corpus-metrics.js';

test('a reference needs two matching judgments or independent adjudication', () => {
  const input = {
    packet: 'a'.repeat(64),
    reviewers: [
      { id: 'a', annotations: { contested: { label: 'positive', reason: 'first' }, single: { label: 'negative', reason: 'first' } } },
      { id: 'b', annotations: { contested: { label: 'negative', reason: 'second' } } },
    ],
  };
  assert.equal(reviewFile.safeParse({ ...input, adjudicator: input.reviewers[0] }).success, false);
  const reviews = reviewFile.parse(input);
  assert.equal(referenceFor('single', reviews), 'pending');
  assert.equal(referenceFor('contested', reviews), 'disputed');
  assert.equal(referenceFor('contested', {
    ...reviews, adjudicator: { id: 'c', kind: 'human', annotations: { contested: { label: 'unknown', reason: 'Insufficient context' } } },
  }), 'unknown');
});

test('agent annotation files declare the model and retain agent provenance', () => {
  const first = { id: 'agent-a', kind: 'agent', model: 'model-1', annotations: {} };
  const second = { id: 'agent-b', kind: 'agent', model: 'model-1', annotations: {} };
  const input = { packet: 'a'.repeat(64), reviewers: [first, second] };
  assert.equal(reviewFile.safeParse({ ...input, reviewers: [{ ...first, model: undefined }, second] }).success, false);
  assert.deepEqual(reviewProvenance(reviewFile.parse(input)), {
    kind: 'agent', reviewers: [
      { id: 'agent-a', kind: 'agent', model: 'model-1' },
      { id: 'agent-b', kind: 'agent', model: 'model-1' },
    ], adjudicator: null,
  });
});

test('corpus metrics retain abstentions and suppress rates for incomplete groups', () => {
  const rows: { reference: Reference; prediction: Label }[] = [
    { reference: 'positive', prediction: 'positive' },
    { reference: 'positive', prediction: 'negative' },
    { reference: 'negative', prediction: 'positive' },
    { reference: 'negative', prediction: 'negative' },
    { reference: 'positive', prediction: 'unknown' },
    { reference: 'negative', prediction: 'unknown' },
    { reference: 'unknown', prediction: 'positive' },
    { reference: 'unsupported', prediction: 'unknown' },
  ];
  assert.deepEqual(summarize(rows), {
    tp: 1, fp: 1, tn: 1, fn: 1, abstainedPositive: 1, abstainedNegative: 1,
    referenceUnknown: 1, unsupported: 1, pending: 0, disputed: 0, total: 8, eligible: 6, decided: 4,
    falsePositiveRate: { numerator: 1, denominator: 2, value: 0.5 },
    precision: { numerator: 1, denominator: 2, value: 0.5 },
    recall: { numerator: 1, denominator: 2, value: 0.5 },
    coverage: { numerator: 4, denominator: 6, value: 4 / 6 },
  });
  assert.equal(summarize([...rows, { reference: 'pending', prediction: 'positive' }]).precision.value, null);
  assert.equal(summarize([...rows, { reference: 'disputed', prediction: 'negative' }]).coverage.value, null);
  assert.equal(summarize([]).recall.value, null);
});
