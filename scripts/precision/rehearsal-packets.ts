/**
 * Builds blind reviewer packets for the E1.2 rehearsal (#57).
 *
 *   node --import tsx scripts/precision/rehearsal-packets.ts --phase calibration|reserve [--out dir]
 *   node --import tsx scripts/precision/rehearsal-packets.ts --phase live --attempts <attempts.json> [--out dir]
 *
 * Writes one packet per reviewer (R1, R2) and run (1-3), ordered by the seed
 * rule in docs/clarification-actionability.md. Operator-only files (item map,
 * withheld attempts, leakage flags) go to a separate `operator/` folder and
 * never into a packet. Nothing is sent: the operator starts each review by hand.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { attemptSchema, calibrationItems, liveItems, load, packet, sha256, type Phase } from './rehearsal.js';

const { values } = parseArgs({ options: {
  phase: { type: 'string' }, attempts: { type: 'string' }, out: { type: 'string', default: '.spec-torque/rehearsal/packets' },
} });
const phase = z.enum(['calibration', 'reserve', 'live']).parse(values.phase) as Phase;
const loaded = await load(process.cwd());
const dir = join(values.out!, phase);
const operator = join(dir, 'operator');
await mkdir(operator, { recursive: true });

let items;
if (phase === 'live') {
  if (!values.attempts) throw new Error('--attempts is required for the live phase.');
  const attempts = z.array(attemptSchema).parse(JSON.parse(await readFile(values.attempts, 'utf8')));
  const split = liveItems(loaded, attempts);
  items = split.sent;
  await writeFile(join(operator, 'withheld.json'), JSON.stringify(split.withheld, null, 2) + '\n');
  await writeFile(join(operator, 'leaks.json'), JSON.stringify(split.leaks, null, 2) + '\n');
  console.log(`${items.length} sent, ${split.withheld.length} withheld, ${split.leaks.length} leaked.`);
} else {
  items = calibrationItems(loaded, phase);
  const list = phase === 'calibration' ? loaded.calibration.items : loaded.calibration.reserve;
  const map = Object.fromEntries(items.map((item, i) => [item.id, list[i].id]));
  await writeFile(join(operator, 'item-map.json'), JSON.stringify(map, null, 2) + '\n');
}
const digests: Record<string, string> = {};
for (const reviewer of ['R1', 'R2'] as const) for (const run of [1, 2, 3]) {
  const body = JSON.stringify(packet(loaded, phase, reviewer, run, items), null, 2) + '\n';
  const file = `${reviewer}-run${run}.json`;
  await writeFile(join(dir, file), body);
  digests[file] = sha256(body);
}
await writeFile(join(operator, 'digests.json'), JSON.stringify(digests, null, 2) + '\n');
console.log(`6 packets of ${items.length} items in ${dir}.`);
