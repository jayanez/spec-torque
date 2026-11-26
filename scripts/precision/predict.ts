/**
 * Writes an arm's per-item predictions for a packet, for scripts/precision/score.ts (#52).
 * Each item is classified in the context of its first occurrence, with the engine at --ref.
 *
 *   node --import tsx scripts/precision/predict.ts --packet <packet.json> --roots <roots.json> --ref <git ref> --out <predictions.json>
 */
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { archiveEngine } from './engines.js';
import { predictLine } from './probe.js';
import { rootSchema } from './sources.js';

const { values } = parseArgs({ options: { packet: { type: 'string' }, roots: { type: 'string' }, ref: { type: 'string' }, out: { type: 'string' } } });
if (!values.packet || !values.roots || !values.ref || !values.out) throw new Error('Use --packet, --roots, --ref and --out.');
const roots = new Map(rootSchema.parse(JSON.parse(await readFile(values.roots, 'utf8'))).map(root => [root.id, root]));
const packet = JSON.parse(await readFile(values.packet, 'utf8')) as { items: { id: string; occurrences: { root: string; revision: string; path: string; line: number }[] }[] };

const temp = await mkdtemp(join(tmpdir(), 'spectorque-predict-'));
try {
  const engine = await archiveEngine(values.ref, join(temp, 'engine'));
  const predictions: Record<string, string> = {};
  for (const item of packet.items) {
    const [first] = item.occurrences;
    const root = roots.get(first.root);
    if (!root || root.restricted) throw new Error('Predictions are produced from public roots only.');
    const content = execFileSync('git', ['-C', root.path, 'show', `${first.revision}:${first.path}`], { encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] });
    predictions[item.id] = (await predictLine(engine, first.path, content, first.line)).kind;
  }
  await writeFile(values.out, JSON.stringify(predictions, null, 2) + '\n');
  console.log(JSON.stringify({ items: packet.items.length, requirement: Object.values(predictions).filter(kind => kind === 'requirement').length }));
} finally {
  await rm(temp, { recursive: true, force: true });
}
