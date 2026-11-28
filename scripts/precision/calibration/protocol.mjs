/**
 * Pinned facts for the #57 rehearsal tooling, shared by the runner and the scorer.
 * Source: docs/clarification-actionability.md and its dated amendments.
 */
import { createHash } from 'node:crypto';

export const sha256 = data => createHash('sha256').update(data).digest('hex');

/** Seeds and presentation IDs derive from the frozen protocol hash (amendment of 2026-11-23). */
export const FROZEN_PROTOCOL_SHA256 = '16659f6e7f7317f2e10e1b3b6bbb87cb8304732ed17fcb7e9a8a024984525826';
/** Prompt per phase: the first calibration used the frozen prompt; the reserve and live phases use the single revision (2026-11-24). */
const REVISED = '5d2be8faf3a3d0a5940f0b8afb46230857e9595315ee769624144e0564b6e0ab';
/** Prompt clarified before calibration run 2 (amendment of 2026-11-24), used for run-2 calibration. */
const CLARIFIED = '2ac88d84b776f336bbfd16f69badea2598663d4717b79c6687369ad81bf97a50';
/** Prompt after run 2's single format revision; used for the run-2 reserve and the live phase. */
const RUN2_REVISED = 'c5a28aecbf6fc09ce8b9d50279cd9a23b746cdb3054e6618e167f9a340ed7464';
export const PROMPT_SHA256 = {
  calibration: '406cae4c818b43ba725dcdc2d83a098dae3ec8207da4ec94e470e0b34f787f58',
  reserve: REVISED, live: RUN2_REVISED, 'calibration-run2': CLARIFIED, 'reserve-run2': RUN2_REVISED,
  // Run 3 (#65) calibrates the live prompt unchanged; a format revision for its reserve would need a dated amendment.
  'calibration-run3': RUN2_REVISED, 'reserve-run3': RUN2_REVISED,
};
export const ITEM_COUNT = { calibration: 72, reserve: 24, 'calibration-run2': 96, 'reserve-run2': 48, 'calibration-run3': 96, 'reserve-run3': 48 };
export const PHASES = ['calibration', 'reserve', 'live', 'calibration-run2', 'reserve-run2', 'calibration-run3', 'reserve-run3'];
/** Calibration run of a phase: 1 for the original protocol's phases (and live), else the suffix. */
export const runOf = phase => Number(/-run([23])$/.exec(String(phase))?.[1] ?? 1);
/**
 * LF SHA-256 of docs/clarification-actionability-run2.md at its freeze, the base of run-2 seeds.
 * Null until the maintainer confirms the freeze; run-2 packets are rejected while it is null.
 */
export const RUN2_PROTOCOL_SHA256 = '847ed2750fd7aaf71290e9a9d1ae04dd764082cbfbd63b8b3e7fcfbd152a5724';
/** LF SHA-256 of docs/clarification-actionability-run3.md at its freeze; null until the maintainer confirms it in #65. */
export const RUN3_PROTOCOL_SHA256 = null;
const RUN_PROTOCOL_SHA256 = { 2: RUN2_PROTOCOL_SHA256, 3: RUN3_PROTOCOL_SHA256 };
export const REVIEWERS = ['R1', 'R2'];
export const RUN_NUMBERS = [1, 2, 3];
export const RUNS = REVIEWERS.flatMap(r => RUN_NUMBERS.map(n => `${r}-run${n}`));
export const LABELS = ['acceptable', 'fills_slot', 'invented_decision'];
export const LANGUAGES = ['en', 'es'];

export const seedFor = (phase, reviewer, run, base = runOf(phase) === 1 ? FROZEN_PROTOCOL_SHA256 : RUN_PROTOCOL_SHA256[runOf(phase)]) =>
  sha256(`${base}:${phase}:${reviewer}:${run}`).slice(0, 16);
export const orderKey = (seed, id) => sha256(`${seed}:${id}`);

/**
 * Checks a packet against the protocol: phase, reviewer, run, frozen protocol hash, the phase's prompt,
 * the seed rule, the seeded order and unique IDs. Returns a list of problems (empty when valid).
 */
export function packetProblems(packet, { reviewer, run, phase } = {}) {
  const problems = [];
  if (!PHASES.includes(packet.phase)) problems.push(`unknown phase ${packet.phase}`);
  if (phase && packet.phase !== phase) problems.push(`phase ${packet.phase}, expected ${phase}`);
  if (!REVIEWERS.includes(packet.reviewer)) problems.push(`unknown reviewer ${packet.reviewer}`);
  if (reviewer && packet.reviewer !== reviewer) problems.push(`reviewer ${packet.reviewer}, expected ${reviewer}`);
  if (!RUN_NUMBERS.includes(packet.run)) problems.push(`run ${packet.run} is not 1, 2 or 3`);
  if (run && packet.run !== run) problems.push(`run ${packet.run}, expected ${run}`);
  if (packet.protocolSha256 !== FROZEN_PROTOCOL_SHA256) problems.push('not built from the frozen protocol hash');
  const n = runOf(packet.phase);
  if (n !== 1) {
    if (!RUN_PROTOCOL_SHA256[n]) problems.push(`run ${n} is not frozen (RUN${n}_PROTOCOL_SHA256 is not pinned)`);
    else if (packet.runProtocolSha256 !== RUN_PROTOCOL_SHA256[n]) problems.push(`not built from the frozen run-${n} pre-registration`);
  }
  if (PROMPT_SHA256[packet.phase] && sha256(packet.prompt ?? '') !== PROMPT_SHA256[packet.phase]) problems.push(`prompt is not the ${packet.phase} prompt`);
  const seed = seedFor(packet.phase, packet.reviewer, packet.run);
  if (packet.seed !== seed) problems.push('seed does not follow the seed rule');
  const ids = (packet.items ?? []).map(i => i.id);
  if (new Set(ids).size !== ids.length) problems.push('duplicate item IDs');
  const keys = ids.map(id => orderKey(seed, id));
  if (keys.some((k, i) => i > 0 && keys[i - 1] > k)) problems.push('items are not in the seeded order');
  if (ITEM_COUNT[packet.phase] && ids.length !== ITEM_COUNT[packet.phase]) problems.push(`${ids.length} items, expected ${ITEM_COUNT[packet.phase]}`);
  return problems;
}
