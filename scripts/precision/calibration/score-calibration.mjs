#!/usr/bin/env node
/**
 * Deterministic calibration scorer for the #57 rehearsal (docs/clarification-actionability.md and its
 * dated amendments).
 *
 *   node score-calibration.mjs seal  --results <dir>
 *   node score-calibration.mjs score --phase calibration|reserve --results <dir> --packets <packets/<phase>> --fixture <calibration.json> [--out report.json]
 *
 * `seal` records the SHA-256 of all six runs' raw.jsonl and done.json in frozen.json and never
 * overwrites a seal. `score` reads each sealed file once, checks its bytes against the seal, verifies
 * the packets and runs, and only then reads the operator item map and the keys.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { ITEM_COUNT, LABELS, LANGUAGES, packetProblems, PHASES, RUNS, runOf, sha256 } from './protocol.mjs';

export { RUNS, LABELS };
export const GATES = { kappa: 0.80, accuracy: 0.90, instability: 0.10, undefinedKappaAgreement: 0.90 };
const EPS = 1e-9;
const VALID = { acceptable: ['yes', 'no', 'unknown'], fills_slot: ['yes', 'no', 'unknown', 'not_applicable'], invented_decision: ['yes', 'no', 'unknown'] };
const FIELDS = ['action', 'scope', 'text', 'note'];

/** Trims whitespace and one pair of enclosing quotation marks (amendment 2). */
export function stripQuotes(span) {
  const s = String(span).trim();
  const pairs = [['"', '"'], ["'", "'"], ['“', '”'], ['‘', '’'], ['«', '»'], ['`', '`']];
  for (const [a, b] of pairs) if (s.length >= 2 && s.startsWith(a) && s.endsWith(b)) return s.slice(1, -1).trim();
  return s;
}

/** A span verifies when it is a non-empty string occurring verbatim within one of the response's action, scope, text or note. */
export function spanVerified(span, response) {
  if (typeof span !== 'string') return false;
  const needle = stripQuotes(span);
  if (!needle) return false;
  return FIELDS.some(f => typeof response[f] === 'string' && response[f].includes(needle));
}

/**
 * Labels for one final record. Malformed → all unknown; invalid value → unknown; fills_slot
 * `not_applicable` is valid only when the open slot is "none"; a "yes" whose span does not verify → unknown.
 */
export function labelsOf(record, response, isQuestion) {
  const unknown = Object.fromEntries(LABELS.map(l => [l, 'unknown']));
  if (!record || !record.wellFormed) return unknown;
  let parsed;
  try { parsed = JSON.parse(String(record.raw).trim()); } catch { return unknown; }
  const out = {};
  for (const label of LABELS) {
    const value = parsed[label];
    const valid = VALID[label].includes(value) && !(label === 'fills_slot' && value === 'not_applicable' && isQuestion);
    if (!valid) { out[label] = 'unknown'; continue; }
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
  return { n, kappa: Math.abs(1 - pe) < EPS ? null : (po - pe) / (1 - pe), observed: po, categories: cats };
}

/** κ gate with the protocol's undefined-κ exception; thresholds use a small tolerance for float error. */
export function kappaPasses(k) {
  if (!k.n) return false;
  if (k.kappa === null) return k.observed + EPS >= GATES.undefinedKappaAgreement && !(k.categories.length === 1 && k.categories[0] === 'unknown');
  return k.kappa + EPS >= GATES.kappa;
}
const atLeast = (rate, gate) => rate !== null && rate + EPS >= gate;
const atMost = (rate, gate) => rate !== null && rate - EPS <= gate;

// ---------------------------------------------------------------- seal

export function seal(results) {
  const target = join(results, 'frozen.json');
  if (existsSync(target)) throw new Error(`${target} exists; a seal is never overwritten.`);
  const files = {};
  for (const run of RUNS) for (const f of ['raw.jsonl', 'done.json']) {
    const p = join(results, run, f);
    if (!existsSync(p)) throw new Error(`Missing ${run}/${f}: every run must finish before sealing.`);
    files[`${run}/${f}`] = sha256(readFileSync(p));
  }
  const body = { sealedAt: new Date().toISOString(), files };
  writeFileSync(target, JSON.stringify(body, null, 2) + '\n', { flag: 'wx' });
  return body;
}

/** Reads every sealed file once and returns its verified bytes. The seal must list exactly the six runs. */
export function readSealed(results) {
  const p = join(results, 'frozen.json');
  if (!existsSync(p)) throw new Error('Results are not sealed (frozen.json missing). Seal before reading keys.');
  const { files } = JSON.parse(readFileSync(p, 'utf8'));
  const expected = RUNS.flatMap(run => [`${run}/raw.jsonl`, `${run}/done.json`]);
  const listed = Object.keys(files ?? {});
  if (listed.length !== expected.length || !expected.every(f => typeof files[f] === 'string')) throw new Error('Seal does not list exactly the six runs.');
  const bytes = {};
  for (const f of expected) {
    const b = readFileSync(join(results, f));
    if (sha256(b) !== files[f]) throw new Error(`${f} changed after sealing.`);
    bytes[f] = b;
  }
  return bytes;
}
export const verifySeal = results => { readSealed(results); };

// ---------------------------------------------------------------- runs and population

/** Final records of one run, bound to its packet: one final record per packet item and nothing else. */
export function parseRun(run, rawBytes, doneBytes, packet, packetSha) {
  const done = JSON.parse(doneBytes.toString('utf8'));
  if (done.rawSha256 !== sha256(rawBytes)) throw new Error(`${run}: raw.jsonl does not match done.json.`);
  const reviewer = run.slice(0, 2), n = Number(run.slice(-1));
  if (done.reviewer !== reviewer) throw new Error(`${run}: done.json is for ${done.reviewer}.`);
  if (done.screen) throw new Error(`${run}: is an exploratory screening run.`);
  if (done.packetSha256 !== packetSha) throw new Error(`${run}: done.json names a different packet.`);
  if (done.run !== undefined && done.run !== n) throw new Error(`${run}: done.json is run ${done.run}.`);
  const lines = rawBytes.toString('utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  for (const r of lines) {
    if (r.dryRun) throw new Error(`${run}: contains dry-run records.`);
    if (r.screen) throw new Error(`${run}: contains exploratory screening records.`);
    if (r.packetSha256 !== undefined && r.packetSha256 !== packetSha) throw new Error(`${run}: record for ${r.id} names a different packet.`);
    if (r.reviewer !== undefined && r.reviewer !== reviewer) throw new Error(`${run}: record for ${r.id} is from ${r.reviewer}.`);
  }
  const finals = lines.filter(r => r.final);
  const ids = new Set(packet.items.map(i => i.id));
  const seen = new Set();
  for (const r of finals) {
    if (!ids.has(r.id)) throw new Error(`${run}: record for ${r.id} is not in its packet.`);
    if (seen.has(r.id)) throw new Error(`${run}: two final records for ${r.id}.`);
    seen.add(r.id);
  }
  if (seen.size !== ids.size) throw new Error(`${run}: ${ids.size - seen.size} packet items have no final record.`);
  const stats = { finals: finals.length, malformed: finals.filter(r => !r.wellFormed).length,
    retried: finals.filter(r => r.attempt === 2).length, transportFailures: lines.reduce((s, r) => s + (r.transportFailures ?? 0), 0),
    models: [...new Set(finals.map(r => r.model))] };
  return { records: new Map(finals.map(r => [r.id, r])), stats };
}

/** The six packets must follow the protocol and share one population: same IDs and identical item material. */
export function checkPopulation(packets, phase) {
  if (!RUNS.every(r => packets[r]) || Object.keys(packets).length !== RUNS.length) throw new Error('Expected the six packets R1-run1 … R2-run3.');
  for (const run of RUNS) {
    const problems = packetProblems(packets[run], { phase, reviewer: run.slice(0, 2), run: Number(run.slice(-1)) });
    if (problems.length) throw new Error(`${run}: ${problems.join('; ')}.`);
  }
  const canon = p => JSON.stringify([...p.items].sort((a, b) => (a.id < b.id ? -1 : 1)));
  const ref = canon(packets[RUNS[0]]);
  for (const run of RUNS.slice(1)) if (canon(packets[run]) !== ref) throw new Error(`${run}: items differ from ${RUNS[0]}.`);
  if (packets[RUNS[0]].items.length !== ITEM_COUNT[phase]) throw new Error(`Expected ${ITEM_COUNT[phase]} items for ${phase}.`);
}

/** One-to-one mapping from packet IDs to the phase's fixture items, each with a known language. */
export function bindKeys(packetItems, map, fixtureItems) {
  const byId = new Map(fixtureItems.map(i => [i.id, i]));
  const used = new Set();
  const items = packetItems.map(p => {
    const fid = map[p.id];
    const f = byId.get(fid);
    if (!f) throw new Error(`No fixture item for ${p.id}.`);
    if (used.has(fid)) throw new Error(`Fixture item ${fid} is mapped twice.`);
    used.add(fid);
    if (!LANGUAGES.includes(f.language)) throw new Error(`Unknown language ${f.language} for ${fid}.`);
    const isQuestion = p.openSlot !== 'none';
    if (isQuestion !== (f.key.fills_slot !== 'not_applicable')) throw new Error(`${p.id}: open slot and key disagree on whether it is a question item.`);
    if (JSON.stringify(p.response) !== JSON.stringify(f.response)) throw new Error(`${p.id}: packet response differs from the fixture.`);
    return { id: p.id, language: f.language, response: p.response, isQuestion, key: f.key };
  });
  if (used.size !== fixtureItems.length) throw new Error(`${fixtureItems.length - used.size} fixture items are not in the packets.`);
  return items;
}

/** Descriptive count of "yes" labels turned unknown because their quoted span did not verify. */
export function unverifiedYes(records, responses) {
  let yes = 0, unverified = 0;
  for (const [id, r] of records) {
    if (!r.wellFormed) continue;
    let p; try { p = JSON.parse(String(r.raw).trim()); } catch { continue; }
    for (const l of LABELS) if (p[l] === 'yes') { yes++; if (!spanVerified(p.evidence?.[l], responses.get(id))) unverified++; }
  }
  return { yes, unverified };
}

// ---------------------------------------------------------------- evaluation

/** Pure scoring. `items`: [{ id, language, response, isQuestion, key }]. `runs`: { 'R1-run1': Map(id → record), ... }. */
export function evaluate(items, runs) {
  const per = {};
  for (const item of items) {
    per[item.id] = {};
    for (const r of ['R1', 'R2']) {
      const votes = [1, 2, 3].map(n => labelsOf(runs[`${r}-run${n}`].get(item.id), item.response, item.isQuestion));
      per[item.id][r] = {
        votes,
        majority: Object.fromEntries(LABELS.map(l => [l, majority(votes.map(v => v[l]))])),
        unstable: LABELS.some(l => new Set(votes.map(v => v[l])).size > 1),
      };
    }
  }
  const report = {};
  for (const lang of LANGUAGES) {
    const scope = items.filter(i => i.language === lang);
    const question = scope.filter(i => i.isQuestion);
    const pool = label => (label === 'fills_slot' ? question : scope);
    const r = { items: scope.length, questionItems: question.length, kappa: {}, accuracy: { R1: {}, R2: {} }, instability: {} };
    for (const label of LABELS) {
      const k = kappa(pool(label).map(i => per[i.id].R1.majority[label]), pool(label).map(i => per[i.id].R2.majority[label]));
      r.kappa[label] = { ...k, passes: kappaPasses(k) };
      for (const rev of ['R1', 'R2']) {
        const hits = pool(label).filter(i => per[i.id][rev].majority[label] === i.key[label]).length;
        const rate = pool(label).length ? hits / pool(label).length : null;
        r.accuracy[rev][label] = { hits, n: pool(label).length, rate, passes: atLeast(rate, GATES.accuracy) };
      }
    }
    for (const rev of ['R1', 'R2']) {
      const unstable = scope.filter(i => per[i.id][rev].unstable).length;
      const rate = scope.length ? unstable / scope.length : null;
      r.instability[rev] = { unstable, n: scope.length, rate, passes: atMost(rate, GATES.instability) };
    }
    r.passes = scope.length > 0 && LABELS.every(l => r.kappa[l].passes)
      && ['R1', 'R2'].every(rev => LABELS.every(l => r.accuracy[rev][l].passes) && r.instability[rev].passes);
    report[lang] = r;
  }
  report.calibrationPasses = LANGUAGES.every(l => report[l].passes);
  return { report, perItem: per };
}

function main() {
  const [mode] = process.argv.slice(2);
  const { values } = parseArgs({ args: process.argv.slice(3), options: {
    phase: { type: 'string' }, results: { type: 'string' }, packets: { type: 'string' }, fixture: { type: 'string' }, out: { type: 'string' },
  } });
  if (mode === 'seal') { console.log(JSON.stringify(seal(values.results), null, 2)); return; }
  const phases = PHASES.filter(p => p !== 'live');
  if (mode !== 'score' || !phases.includes(values.phase)) {
    console.error(`Usage: seal --results <dir> | score --phase ${phases.join('|')} --results <dir> --packets <dir> --fixture <calibration*.json> [--out report.json]`);
    process.exit(2);
  }
  const sealed = readSealed(values.results);
  const packets = {}, packetShas = {};
  for (const run of RUNS) {
    const b = readFileSync(join(values.packets, `${run}.json`));
    packets[run] = JSON.parse(b); packetShas[run] = sha256(b);
  }
  checkPopulation(packets, values.phase);
  const parsed = Object.fromEntries(RUNS.map(run => [run, parseRun(run, sealed[`${run}/raw.jsonl`], sealed[`${run}/done.json`], packets[run], packetShas[run])]));
  // Keys and the item map are read only after the seal, packets and runs are verified.
  const map = JSON.parse(readFileSync(join(values.packets, 'operator', 'item-map.json'), 'utf8'));
  const fixture = JSON.parse(readFileSync(values.fixture, 'utf8'));
  const n = runOf(values.phase);
  const expectedFixture = n === 1 ? 'e12-calibration/1' : `e12-calibration-run${n}/1`;
  if (fixture.version !== expectedFixture) throw new Error(`Fixture ${fixture.version} does not match phase ${values.phase}.`);
  const items = bindKeys(packets['R1-run1'].items, map, values.phase.startsWith('calibration') ? fixture.items : fixture.reserve);
  const runs = Object.fromEntries(RUNS.map(run => [run, parsed[run].records]));
  const { report, perItem } = evaluate(items, runs);
  const responses = new Map(items.map(i => [i.id, i.response]));
  report.phase = values.phase;
  report.packets = packetShas;
  report.runs = Object.fromEntries(RUNS.map(run => [run, { ...parsed[run].stats, ...unverifiedYes(parsed[run].records, responses) }]));
  if (values.out) writeFileSync(values.out, JSON.stringify({ report, perItem }, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
