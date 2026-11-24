#!/usr/bin/env node
/**
 * Deterministic calibration scorer for the #57 rehearsal (docs/clarification-actionability.md).
 *
 *   node score-calibration.mjs seal  --results <dir>
 *   node score-calibration.mjs score --results <dir> --packets <packets/calibration> --fixture <calibration.json> [--out report.json]
 *
 * `seal` records the SHA-256 of every run's raw.jsonl and done.json in frozen.json. `score` refuses to
 * read keys or the operator item map unless frozen.json exists and every hash still matches.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export const RUNS = ['R1-run1', 'R1-run2', 'R1-run3', 'R2-run1', 'R2-run2', 'R2-run3'];
export const LABELS = ['acceptable', 'fills_slot', 'invented_decision'];
const VALID = {
  acceptable: ['yes', 'no', 'unknown'],
  fills_slot: ['yes', 'no', 'unknown', 'not_applicable'],
  invented_decision: ['yes', 'no', 'unknown'],
};
export const GATES = { kappa: 0.80, accuracy: 0.90, instability: 0.10, undefinedKappaAgreement: 0.90 };
const sha256 = b => createHash('sha256').update(b).digest('hex');

/**
 * A quoted span is verified when, after trimming whitespace and one pair of enclosing quotation
 * marks, it occurs verbatim in the response's action, scope, text or note.
 */
export function stripQuotes(span) {
  const s = String(span).trim();
  const pairs = [['"', '"'], ["'", "'"], ['“', '”'], ['‘', '’'], ['«', '»'], ['`', '`']];
  for (const [a, b] of pairs) if (s.length >= 2 && s.startsWith(a) && s.endsWith(b)) return s.slice(1, -1).trim();
  return s;
}
export function spanVerified(span, response) {
  const needle = stripQuotes(span ?? '');
  if (!needle) return false;
  const hay = [response.action, response.scope, response.text, response.note].filter(Boolean).join('\n');
  return hay.includes(needle);
}

/** Labels for one final record: malformed → all unknown; invalid value → unknown; unverified yes → unknown. */
export function labelsOf(record, response) {
  if (!record || !record.wellFormed) return Object.fromEntries(LABELS.map(l => [l, 'unknown']));
  let parsed;
  try { parsed = JSON.parse(String(record.raw).trim()); } catch { return Object.fromEntries(LABELS.map(l => [l, 'unknown'])); }
  const out = {};
  for (const label of LABELS) {
    const value = parsed[label];
    if (!VALID[label].includes(value)) { out[label] = 'unknown'; continue; }
    out[label] = value === 'yes' && !spanVerified(parsed.evidence?.[label], response) ? 'unknown' : value;
  }
  return out;
}

export const majority = values => {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  for (const [v, n] of counts) if (n >= 2) return v;
  return 'unknown';
};

/** Cohen's kappa with each observed value (including unknown) as its own category. */
export function kappa(a, b) {
  const n = a.length;
  if (!n) return { n: 0, kappa: null, observed: null, categories: [] };
  const cats = [...new Set([...a, ...b])].sort();
  const po = a.filter((x, i) => x === b[i]).length / n;
  const pe = cats.reduce((s, c) => s + (a.filter(x => x === c).length / n) * (b.filter(x => x === c).length / n), 0);
  return { n, kappa: pe === 1 ? null : (po - pe) / (1 - pe), observed: po, categories: cats };
}

/** κ gate with the protocol's undefined-κ exception. */
export function kappaPasses(k) {
  if (!k.n) return false;
  if (k.kappa === null) return k.observed >= GATES.undefinedKappaAgreement && !(k.categories.length === 1 && k.categories[0] === 'unknown');
  return k.kappa >= GATES.kappa;
}

const readRun = (dir, run) => {
  const lines = readFileSync(join(dir, run, 'raw.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  return new Map(lines.filter(r => r.final).map(r => [r.id, r]));
};

export function seal(results) {
  const files = {};
  for (const run of RUNS) for (const f of ['raw.jsonl', 'done.json']) {
    const p = join(results, run, f);
    if (!existsSync(p)) throw new Error(`Missing ${run}/${f}: every run must finish before sealing.`);
    files[`${run}/${f}`] = sha256(readFileSync(p));
  }
  const body = { sealedAt: new Date().toISOString(), files };
  writeFileSync(join(results, 'frozen.json'), JSON.stringify(body, null, 2) + '\n');
  return body;
}

export function verifySeal(results) {
  const p = join(results, 'frozen.json');
  if (!existsSync(p)) throw new Error('Results are not sealed (frozen.json missing). Seal before reading keys.');
  const { files } = JSON.parse(readFileSync(p, 'utf8'));
  for (const [f, h] of Object.entries(files)) if (sha256(readFileSync(join(results, f))) !== h) throw new Error(`${f} changed after sealing.`);
}

/**
 * Pure scoring. `items`: [{ id, language, response, key }] with key fills_slot 'not_applicable' on controls.
 * `runs`: { 'R1-run1': Map(id → record), ... }.
 */
export function evaluate(items, runs) {
  const per = {};
  for (const item of items) {
    per[item.id] = {};
    for (const r of ['R1', 'R2']) {
      const votes = [1, 2, 3].map(n => labelsOf(runs[`${r}-run${n}`].get(item.id), item.response));
      per[item.id][r] = {
        majority: Object.fromEntries(LABELS.map(l => [l, majority(votes.map(v => v[l]))])),
        unstable: LABELS.some(l => new Set(votes.map(v => v[l])).size > 1),
        missing: [1, 2, 3].filter(n => !runs[`${r}-run${n}`].has(item.id)).length,
      };
    }
  }
  const report = {};
  for (const lang of ['en', 'es']) {
    const scope = items.filter(i => i.language === lang);
    const question = scope.filter(i => i.key.fills_slot !== 'not_applicable');
    const pool = label => label === 'fills_slot' ? question : scope;
    const r = { items: scope.length, questionItems: question.length, kappa: {}, accuracy: { R1: {}, R2: {} }, instability: {}, missingRecords: {} };
    for (const label of LABELS) {
      const k = kappa(pool(label).map(i => per[i.id].R1.majority[label]), pool(label).map(i => per[i.id].R2.majority[label]));
      r.kappa[label] = { ...k, passes: kappaPasses(k) };
      for (const rev of ['R1', 'R2']) {
        const hits = pool(label).filter(i => per[i.id][rev].majority[label] === i.key[label]).length;
        const rate = pool(label).length ? hits / pool(label).length : null;
        r.accuracy[rev][label] = { hits, n: pool(label).length, rate, passes: rate !== null && rate >= GATES.accuracy };
      }
    }
    for (const rev of ['R1', 'R2']) {
      const unstable = scope.filter(i => per[i.id][rev].unstable).length;
      const rate = scope.length ? unstable / scope.length : null;
      r.instability[rev] = { unstable, n: scope.length, rate, passes: rate !== null && rate <= GATES.instability };
      r.missingRecords[rev] = scope.reduce((s, i) => s + per[i.id][rev].missing, 0);
    }
    r.passes = LABELS.every(l => r.kappa[l].passes)
      && ['R1', 'R2'].every(rev => LABELS.every(l => r.accuracy[rev][l].passes) && r.instability[rev].passes);
    report[lang] = r;
  }
  report.calibrationPasses = report.en.passes && report.es.passes;
  return { report, perItem: per };
}

function main() {
  const [mode] = process.argv.slice(2);
  const { values } = parseArgs({ args: process.argv.slice(3), options: {
    results: { type: 'string' }, packets: { type: 'string' }, fixture: { type: 'string' }, out: { type: 'string' },
  } });
  if (mode === 'seal') { console.log(JSON.stringify(seal(values.results), null, 2)); return; }
  if (mode !== 'score') { console.error('Usage: seal --results <dir> | score --results <dir> --packets <dir> --fixture <calibration.json>'); process.exit(2); }
  verifySeal(values.results);
  // Keys and the item map are read only after the seal is verified.
  const packet = JSON.parse(readFileSync(join(values.packets, 'R1-run1.json'), 'utf8'));
  const map = JSON.parse(readFileSync(join(values.packets, 'operator', 'item-map.json'), 'utf8'));
  const fixture = JSON.parse(readFileSync(values.fixture, 'utf8'));
  const byFixtureId = new Map(fixture.items.map(i => [i.id, i]));
  const items = packet.items.map(p => {
    const f = byFixtureId.get(map[p.id]);
    if (!f) throw new Error(`No key for ${p.id}.`);
    return { id: p.id, language: f.language, response: p.response, key: f.key };
  });
  const runs = Object.fromEntries(RUNS.map(run => [run, readRun(values.results, run)]));
  const { report, perItem } = evaluate(items, runs);
  if (values.out) writeFileSync(values.out, JSON.stringify({ report, perItem }, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
