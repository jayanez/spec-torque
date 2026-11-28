/**
 * H52c adjudication packet (#52): the entering lines of the changed features (scenario steps with a
 * modal), deduplicated by text, all or `--max` drawn with `--seed`, each with its heading chain and
 * three lines of context on each side, read at the scanned revision. Written as packet.json (for
 * labelers) and key.json (never shown). No line leaves admission under H52c, so there is no leaving
 * direction to draw.
 *
 *   scenario-packet.ts --scan <h52c-scan.json> [--scan …] --roots <roots.json> [--roots …] --out <dir> [--seed 42054] [--max 100]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { headingChain, sample } from './prose.js';
import { rootSchema, snapshot } from './sources.js';

const { values } = parseArgs({ options: {
  scan: { type: 'string', multiple: true }, roots: { type: 'string', multiple: true }, out: { type: 'string' },
  seed: { type: 'string', default: '42054' }, max: { type: 'string', default: '100' },
} });
if (!values.scan?.length || !values.roots?.length || !values.out) throw new Error('Use: scenario-packet.ts --scan <h52c-scan.json> --roots <roots.json> --out <dir> [--seed 42054] [--max 100]');
const [max, seed] = [Number(values.max), Number(values.seed)];
if (!Number.isInteger(max) || max < 1 || !Number.isInteger(seed)) throw new Error('--max and --seed must be integers.');
const roots = (await Promise.all(values.roots.map(async f => rootSchema.parse(JSON.parse(await readFile(f, 'utf8')))))).flat();
if (roots.some(root => root.restricted)) throw new Error('Packets are built from public roots only.');
if (new Set(roots.map(r => r.id)).size !== roots.length) throw new Error('Root IDs repeat across the --roots files.');
type Changed = { root: string; repository: string; sha: string; feature: string; entering: { path: string; line: number; text: string }[] };
const changed = (await Promise.all(values.scan.map(async f => JSON.parse(await readFile(f, 'utf8')).changed as Changed[]))).flat();
// One candidate per distinct line text, first occurrence in scan order.
const byText = new Map<string, Changed & { at: Changed['entering'][number] }>();
for (const d of changed) for (const at of d.entering) if (!byText.has(at.text.trim())) byText.set(at.text.trim(), { ...d, at });
const pool = [...byText.values()];
if (!pool.length) throw new Error('No entering line in the scans.');
const drawn = pool.length > max ? sample(pool, max, seed) : pool;

const snapshots = new Map<string, Map<string, string>>();
const entries = drawn.map(d => {
  const root = roots.find(r => r.id === d.root);
  if (!root) throw new Error(`No root for ${d.root}.`);
  const at = `${root.id}@${d.sha}`;
  if (!snapshots.has(at)) {
    const { sha, files } = snapshot({ ...root, ref: d.sha });
    if (sha !== d.sha) throw new Error(`${root.id} resolved to ${sha}, not the scanned ${d.sha}.`);
    snapshots.set(at, files);
  }
  const content = snapshots.get(at)!.get(d.at.path);
  if (content === undefined) throw new Error(`${d.at.path} is not in ${at}.`);
  const lines = content.split(/\r?\n/);
  if (lines[d.at.line - 1]?.slice(0, 300) !== d.at.text) throw new Error(`${at} ${d.at.path}:${d.at.line} does not match the scan.`);
  const i = d.at.line - 1;
  return {
    item: { repository: d.repository, revision: d.sha, path: d.at.path, line: d.at.line, headings: headingChain(lines, d.at.line), before: lines.slice(Math.max(0, i - 3), i), text: lines[i], after: lines.slice(i + 1, i + 4) },
    key: { root: d.root, feature: d.feature, direction: 'entering' },
  };
});
// Shuffle, then number, so neither order nor ID carries the set or root.
const shuffled = sample(entries, entries.length, seed).map((e, n) => ({ id: `h52c-${String(n + 1).padStart(3, '0')}`, ...e }));
await mkdir(values.out, { recursive: true, mode: 0o700 });
await writeFile(join(values.out, 'packet.json'), JSON.stringify({ version: 1, labels: ['positive', 'negative', 'unknown'], guide: 'docs/precision-adjudication.md#h52c-scenario-steps-with-a-modal-52', items: shuffled.map(({ id, item }) => ({ id, ...item })) }, null, 2) + '\n');
await writeFile(join(values.out, 'key.json'), JSON.stringify(shuffled.map(({ id, key }) => ({ id, ...key })), null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ changed: changed.length, distinct: pool.length, items: shuffled.length, seed }));
