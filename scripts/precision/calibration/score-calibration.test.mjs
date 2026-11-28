// Synthetic tests only: no keys, packets or responses from the rehearsal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bindKeys, checkPopulation, evaluate, kappa, kappaPasses, labelsOf, majority, parseRun, readSealed, seal,
  spanVerified, stripQuotes, unverifiedYes, RUNS } from './score-calibration.mjs';
import { classifyR1, classifyR2, clientVersion, codexHeader, inspectImage, SCREEN_IMAGE, loadRecords, material, minimalEnv, nextAttempt, wellFormed } from './run-reviewer.mjs';
import { FROZEN_PROTOCOL_SHA256, PROMPT_SHA256, RUN2_PROTOCOL_SHA256, orderKey, packetProblems, seedFor, sha256 } from './protocol.mjs';

const edit = { action: 'edit', scope: 'target line', text: 'X MUST refresh within 500 ms.', note: null };
const rec = obj => ({ final: true, wellFormed: true, raw: JSON.stringify(obj) });
const yesAll = { acceptable: 'yes', fills_slot: 'yes', invented_decision: 'no', evidence: { acceptable: 'within 500 ms', fills_slot: 'within 500 ms' } };

// ---- scorer: labels and spans (findings 8, 9)

test('quotes are stripped once; spans must be strings within a single field', () => {
  assert.equal(stripQuotes(' "within 500 ms" '), 'within 500 ms');
  assert.equal(spanVerified('"within 500 ms"', edit), true);
  assert.equal(spanVerified('within 900 ms', edit), false);
  assert.equal(spanVerified('', edit), false);
  assert.equal(spanVerified('target line\nX MUST', edit), false, 'no match across field boundaries');
  assert.equal(spanVerified([500], edit), false, 'no type coercion');
  assert.equal(spanVerified('leave', { action: 'leave', scope: null, text: null, note: null }), true);
});

test('malformed, invalid, contextually invalid and unverified labels become unknown per label', () => {
  const unknown = { acceptable: 'unknown', fills_slot: 'unknown', invented_decision: 'unknown' };
  assert.deepEqual(labelsOf({ final: true, wellFormed: false, raw: 'nope' }, edit, true), unknown);
  assert.deepEqual(labelsOf(undefined, edit, true), unknown);
  const l = labelsOf(rec({ acceptable: 'yes', fills_slot: 'maybe', invented_decision: 'yes',
    evidence: { acceptable: 'within 500 ms', invented_decision: 'not in response' } }), edit, true);
  assert.deepEqual(l, { acceptable: 'yes', fills_slot: 'unknown', invented_decision: 'unknown' });
  const na = rec({ acceptable: 'no', fills_slot: 'not_applicable', invented_decision: 'no' });
  assert.equal(labelsOf(na, edit, true).fills_slot, 'unknown', 'not_applicable is invalid on a question item');
  assert.equal(labelsOf(na, edit, false).fills_slot, 'not_applicable');
});

test('majority needs two of three', () => {
  assert.equal(majority(['yes', 'yes', 'no']), 'yes');
  assert.equal(majority(['yes', 'no', 'unknown']), 'unknown');
});

// ---- scorer: kappa and gates (finding 10)

test('kappa, the undefined case, and an exact 0.80 passing the gate', () => {
  assert.equal(kappa(['yes', 'no', 'yes', 'no'], ['yes', 'no', 'yes', 'no']).kappa, 1);
  const und = kappa(['no', 'no', 'no'], ['no', 'no', 'no']);
  assert.equal(und.kappa, null);
  assert.equal(kappaPasses(und), true);
  assert.equal(kappaPasses(kappa(['unknown', 'unknown'], ['unknown', 'unknown'])), false);
  assert.equal(kappaPasses(kappa([], [])), false);
  const a = [...Array(5).fill('yes'), ...Array(29).fill('no'), 'yes', 'no'];
  const b = [...Array(5).fill('yes'), ...Array(29).fill('no'), 'no', 'yes'];
  const k = kappa(a, b);
  assert.ok(Math.abs(k.kappa - 0.8) < 1e-9);
  assert.equal(kappaPasses(k), true);
});

test('evaluate scores per language, uses question items for fills_slot, and gates', () => {
  const items = [
    { id: 'a', language: 'en', response: edit, isQuestion: true, key: { acceptable: 'yes', fills_slot: 'yes', invented_decision: 'no' } },
    { id: 'b', language: 'en', response: edit, isQuestion: false, key: { acceptable: 'no', fills_slot: 'not_applicable', invented_decision: 'no' } },
    { id: 'c', language: 'es', response: edit, isQuestion: true, key: { acceptable: 'no', fills_slot: 'no', invented_decision: 'no' } },
  ];
  const right = { a: rec(yesAll), b: rec({ acceptable: 'no', fills_slot: 'not_applicable', invented_decision: 'no' }),
    c: rec({ acceptable: 'no', fills_slot: 'no', invented_decision: 'no' }) };
  const runs = Object.fromEntries(RUNS.map(r => [r, new Map(Object.entries(right))]));
  const { report } = evaluate(items, runs);
  assert.equal(report.en.questionItems, 1);
  assert.equal(report.en.accuracy.R1.fills_slot.n, 1);
  assert.equal(report.calibrationPasses, true);
  runs['R2-run3'] = new Map(Object.entries({ ...right, c: rec({ acceptable: 'yes', fills_slot: 'no', invented_decision: 'no' }) }));
  const second = evaluate(items, runs).report;
  assert.equal(second.es.instability.R2.unstable, 1);
  assert.equal(second.es.passes, false);
});

// ---- scorer: seal (finding 5)

test('seal: needs all runs, never overwrites, rejects empty or partial seals and later edits', () => {
  const dir = mkdtempSync(join(tmpdir(), 'seal-'));
  assert.throws(() => readSealed(dir), /not sealed/);
  for (const run of RUNS) { mkdirSync(join(dir, run)); writeFileSync(join(dir, run, 'raw.jsonl'), '{}\n'); }
  assert.throws(() => seal(dir), /Missing/);
  for (const run of RUNS) writeFileSync(join(dir, run, 'done.json'), '{}\n');
  seal(dir);
  assert.throws(() => seal(dir), /never overwritten/);
  assert.equal(Object.keys(readSealed(dir)).length, 12);
  appendFileSync(join(dir, 'R1-run1', 'raw.jsonl'), 'x');
  assert.throws(() => readSealed(dir), /changed after sealing/);
  const empty = mkdtempSync(join(tmpdir(), 'seal-'));
  writeFileSync(join(empty, 'frozen.json'), JSON.stringify({ files: {} }));
  assert.throws(() => readSealed(empty), /exactly the six runs/);
});

// ---- scorer: run binding (finding 1)

test('parseRun binds a run to its packet, reviewer and run number, and requires every item', () => {
  const packet = { items: [{ id: 'a' }, { id: 'b' }] };
  const pSha = 'p'.repeat(64);
  const make = (lines, done = {}) => {
    const raw = Buffer.from(lines.map(l => JSON.stringify(l)).join('\n') + '\n');
    return [raw, Buffer.from(JSON.stringify({ reviewer: 'R1', run: 1, packetSha256: pSha, rawSha256: sha256(raw), ...done }))];
  };
  const ok = parseRun('R1-run1', ...make([{ id: 'a', final: true, wellFormed: true }, { id: 'b', final: true, wellFormed: false, attempt: 2 }]), packet, pSha);
  assert.equal(ok.stats.finals, 2); assert.equal(ok.stats.malformed, 1); assert.equal(ok.stats.retried, 1);
  assert.throws(() => parseRun('R1-run1', ...make([{ id: 'a', final: true }]), packet, pSha), /no final record/);
  assert.throws(() => parseRun('R1-run1', ...make([{ id: 'z', final: true }, { id: 'a', final: true }, { id: 'b', final: true }]), packet, pSha), /not in its packet/);
  assert.throws(() => parseRun('R1-run1', ...make([{ id: 'a', final: true }, { id: 'a', final: true }, { id: 'b', final: true }]), packet, pSha), /two final/);
  assert.throws(() => parseRun('R1-run2', ...make([{ id: 'a', final: true }, { id: 'b', final: true }]), packet, pSha), /run 1/, 'a run copied into another slot');
  assert.throws(() => parseRun('R1-run1', ...make([{ id: 'a', final: true }, { id: 'b', final: true }], { reviewer: 'R2' }), packet, pSha), /for R2/);
  assert.throws(() => parseRun('R1-run1', ...make([{ id: 'a', final: true }, { id: 'b', final: true }]), packet, 'q'.repeat(64)), /different packet/);
  assert.throws(() => parseRun('R1-run1', ...make([{ id: 'a', final: true, dryRun: true }, { id: 'b', final: true }]), packet, pSha), /dry-run/);
  const [raw, done] = make([{ id: 'a', final: true }, { id: 'b', final: true }]);
  assert.throws(() => parseRun('R1-run1', Buffer.concat([raw, Buffer.from('x')]), done, packet, pSha), /does not match/);
});

// ---- scorer: population and keys (finding 2) and packet rules (finding 11)

function packetFor(phase, reviewer, run, items, prompt) {
  const seed = seedFor(phase, reviewer, run);
  const ordered = [...items].sort((a, b) => (orderKey(seed, a.id) < orderKey(seed, b.id) ? -1 : 1));
  return { phase, reviewer, run, seed, protocolSha256: FROZEN_PROTOCOL_SHA256, prompt, items: ordered };
}

test('packet rules: prompt, seed, order and counts', () => {
  const items = Array.from({ length: 24 }, (_, i) => ({ id: `reserve:${i}` }));
  const prompt = 'not the reserve prompt';
  const p = packetFor('reserve', 'R1', 1, items, prompt);
  assert.match(packetProblems(p).join(), /prompt is not the reserve prompt/);
  const swapped = { ...p, items: [p.items[1], p.items[0], ...p.items.slice(2)] };
  assert.match(packetProblems(swapped).join(), /seeded order/);
  assert.match(packetProblems({ ...p, run: 4 }).join(), /run 4/);
  assert.match(packetProblems({ ...p, items: p.items.slice(1) }).join(), /23 items/);
  assert.equal(PROMPT_SHA256.live, PROMPT_SHA256['reserve-run2'], 'the live phase uses the prompt the run-2 reserve calibrates');
  assert.notEqual(PROMPT_SHA256['reserve-run2'], PROMPT_SHA256['calibration-run2'], 'run 2 revised its prompt once');
  assert.notEqual(PROMPT_SHA256.reserve, PROMPT_SHA256.live, 'run 1 reserve used the earlier prompt');
});

test('population: the six packets must hold the same items; keys bind one-to-one', () => {
  const items = Array.from({ length: 24 }, (_, i) => ({ id: `r:${i}`, openSlot: 'none', response: edit }));
  const packets = Object.fromEntries(RUNS.map(r => [r, packetFor('reserve', r.slice(0, 2), Number(r.slice(-1)), items, 'x')]));
  assert.throws(() => checkPopulation(packets, 'reserve'), /prompt/);
  const fixture = items.map((p, i) => ({ id: `f:${i}`, language: i % 2 ? 'es' : 'en', response: edit,
    key: { acceptable: 'yes', fills_slot: 'not_applicable', invented_decision: 'no' } }));
  const map = Object.fromEntries(items.map((p, i) => [p.id, `f:${i}`]));
  assert.equal(bindKeys(items, map, fixture).length, 24);
  assert.throws(() => bindKeys(items, { ...map, 'r:1': 'f:0' }, fixture), /mapped twice/);
  assert.throws(() => bindKeys(items.slice(1), map, fixture), /not in the packets/);
  assert.throws(() => bindKeys(items, map, fixture.map(f => ({ ...f, key: { ...f.key, fills_slot: 'yes' } }))), /disagree/);
  assert.throws(() => bindKeys(items, map, fixture.map(f => ({ ...f, language: 'fr' }))), /language/);
});

test('unverified yes counts spans that are not literal', () => {
  const records = new Map([['a', rec({ ...yesAll, evidence: { acceptable: 'within 500 ms', fills_slot: '"within 500 ms" - states the bound' } })]]);
  assert.deepEqual(unverifiedYes(records, new Map([['a', edit]])), { yes: 2, unverified: 1 });
});

// ---- runner (findings 3, 4, 6, 7)

test('resume continues reviewer attempts and never gives a third answer', () => {
  assert.equal(nextAttempt([], 'a'), 1);
  assert.equal(nextAttempt([{ id: 'a', attempt: 1, wellFormed: false, final: false }], 'a'), 2);
  assert.equal(nextAttempt([{ id: 'a', attempt: 1, wellFormed: false, final: false }, { id: 'a', attempt: 2, final: true }], 'a'), null);
  assert.equal(nextAttempt([{ id: 'a', attempt: 1, wellFormed: true, final: true }], 'a'), null);
});

test('a torn final line is dropped on resume; corruption elsewhere stops', () => {
  const dir = mkdtempSync(join(tmpdir(), 'raw-'));
  const f = join(dir, 'raw.jsonl');
  writeFileSync(f, '{"id":"a","final":true}\n{"id":"b","fin');
  assert.deepEqual(loadRecords(f).map(r => r.id), ['a']);
  assert.equal(readFileSync(f, 'utf8'), '{"id":"a","final":true}\n');
  writeFileSync(f, '{"id":"a"\n{"id":"b","final":true}\n');
  assert.throws(() => loadRecords(f), /corrupt record on line 1/);
});

test('client results: blank output is transport; pins are enforced on every call', () => {
  const env = r => JSON.stringify({ is_error: false, result: r, modelUsage: { 'claude-sonnet-5-5': {} } });
  assert.equal(classifyR1(env('{"a":1}'), 0).raw, '{"a":1}');
  assert.match(classifyR1(env('  '), 0).error, /blank/);
  assert.match(classifyR1(JSON.stringify({ is_error: false, result: 'x', modelUsage: { 'claude-sonnet-5-5': {}, 'claude-haiku-5-5': {} } }), 0).fatal, /expected only/);
  assert.match(classifyR1('not json', 0).error, /unparseable/);
  const head = 'model: gpt-6-luna\nsandbox: read-only\nreasoning effort: medium\n';
  assert.equal(classifyR2(head, 0, '{"a":1}').model, 'gpt-6-luna');
  assert.match(classifyR2(head, 0, '').error, /blank/);
  assert.match(classifyR2('model: gpt-6-luna\n', 0, 'x').error, /incomplete/);
  assert.match(classifyR2(head.replace('medium', 'high'), 0, 'x').fatal, /effort high/);
});

test('codex header, minimal environment, well-formed output and prompt material order', () => {
  assert.deepEqual(codexHeader('model: gpt-6-luna\nsandbox: read-only\nreasoning effort: medium\n'), { model: 'gpt-6-luna', effort: 'medium', sandbox: 'read-only' });
  assert.deepEqual(minimalEnv({ PATH: '/bin', HOME: '/h', ANTHROPIC_API_KEY: 'x', CLAUDE_EFFORT: 'high', CLAUDECODE: '1' }), { PATH: '/bin', HOME: '/h' });
  assert.equal(wellFormed(' {"a":1} '), true);
  assert.equal(wellFormed('```json\n{"a":1}\n```'), false);
  assert.equal(wellFormed('[1]'), false);
  const m = material({ source: { path: 'p.md', targetLine: 1, text: '>>  1  X' }, companions: [], roleBrief: 'B',
    openSlot: 'none', acceptableResolutions: ['R'], invariants: [{ kind: 'k', assertion: 'a' }],
    response: { action: 'leave', scope: null, text: null, note: null } });
  const order = ['SOURCE', 'COMPANIONS:', 'ROLE BRIEF:', 'OPEN SLOT:', 'ACCEPTABLE RESOLUTIONS:', 'INVARIANTS:', 'RESPONSE:'].map(h => m.indexOf(h));
  assert.ok(order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])));
});

test('run-2 packets must carry the pinned run-2 pre-registration hash', () => {
  const items = Array.from({ length: 96 }, (_, i) => ({ id: `c2:${i}` }));
  const p = { phase: 'calibration-run2', reviewer: 'R1', run: 1, seed: 'x', protocolSha256: FROZEN_PROTOCOL_SHA256,
    runProtocolSha256: 'a'.repeat(64), prompt: '', items };
  assert.match(packetProblems(p).join(), /frozen run-2 pre-registration/);
  assert.equal(RUN2_PROTOCOL_SHA256, '847ed2750fd7aaf71290e9a9d1ae04dd764082cbfbd63b8b3e7fcfbd152a5724');
});

test('exploratory screening runs never enter a gated score', () => {
  const packet = { items: [{ id: 'a' }] }; const pSha = 'p'.repeat(64);
  const raw = Buffer.from(JSON.stringify({ id: 'a', final: true, screen: 'gpt-6-luna:high' }) + '\n');
  const done = Buffer.from(JSON.stringify({ reviewer: 'R2', run: 1, packetSha256: pSha, rawSha256: sha256(raw), screen: 'gpt-6-luna:high' }));
  assert.throws(() => parseRun('R2-run1', raw, done, packet, pSha), /exploratory/);
  const done2 = Buffer.from(JSON.stringify({ reviewer: 'R2', run: 1, packetSha256: pSha, rawSha256: sha256(raw) }));
  assert.throws(() => parseRun('R2-run1', raw, done2, packet, pSha), /exploratory/);
});

test('run-3 phases: live prompt unchanged, seeds wait for the run-3 freeze', async () => {
  const { runOf, RUN3_PROTOCOL_SHA256, ITEM_COUNT } = await import('./protocol.mjs');
  assert.equal(PROMPT_SHA256['calibration-run3'], PROMPT_SHA256.live, 'run 3 calibrates the live prompt');
  assert.deepEqual([runOf('calibration'), runOf('live'), runOf('reserve-run2'), runOf('calibration-run3')], [1, 1, 2, 3]);
  assert.equal(ITEM_COUNT['calibration-run3'], 96);
  const p = { phase: 'calibration-run3', reviewer: 'R1', run: 1, seed: 'x', protocolSha256: FROZEN_PROTOCOL_SHA256,
    runProtocolSha256: 'y', prompt: '', items: [] };
  if (RUN3_PROTOCOL_SHA256 === null) assert.ok(packetProblems(p).some(m => /run 3 is not frozen/.test(m)));
});

test('R2 verifies the client in the resolved screening image without pulling or using the network', () => {
  const id = `sha256:${'a'.repeat(64)}`;
  const commands = [];
  const spawn = (name, args) => {
    commands.push([name, ...args]);
    return { status: 0, stdout: args[0] === 'image' ? `${id}\n` : 'codex-cli 0.170.0\n' };
  };
  const image = inspectImage(SCREEN_IMAGE, spawn);
  assert.equal(image, id);
  assert.equal(clientVersion('R2', image, spawn), 'codex-cli 0.170.0');
  assert.deepEqual(commands, [
    ['docker', 'image', 'inspect', SCREEN_IMAGE, '--format', '{{.Id}}'],
    ['docker', 'run', '--rm', '--pull=never', '--network', 'none', '--entrypoint', 'codex', id, '--version'],
  ]);
});

test('R2 refuses an unresolved image or a failed version probe', () => {
  assert.throws(() => inspectImage(SCREEN_IMAGE, () => ({ status: 0, stdout: '' })), /missing or invalid image ID/);
  assert.throws(() => inspectImage(SCREEN_IMAGE, () => ({ status: 1, stderr: 'image absent' })), /image absent/);
  const id = `sha256:${'b'.repeat(64)}`;
  assert.throws(() => clientVersion('R2', id, () => ({ status: 1, stdout: 'codex-cli 0.170.0', stderr: 'container failed' })), /container failed/);
});
