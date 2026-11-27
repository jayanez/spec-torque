/**
 * H52 adjudication packet (#52): for every feature whose I1.2 or I2.2 status the candidate changes
 * (all, or `--max` drawn with `--seed`), one of its defining headings, drawn with the same seed, with
 * its heading chain and its section up to the next heading of the same or a higher level (at most 30
 * lines). Written as packet.json (for labelers) and key.json (never shown).
 *
 *   heading-packet.ts --scan <h52-scan.json> [--scan …] --roots <roots.json> [--roots …] --out <dir> [--seed 42052] [--max 100]
 *
 * Files are read at the scan's revision, so line numbers and sections are those the scan judged.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { sectionOf } from './heading-judge.js';
import { sample } from './prose.js';
import { rootSchema, snapshot } from './sources.js';

const { values } = parseArgs({ options: {
  scan: { type: 'string', multiple: true }, roots: { type: 'string', multiple: true }, out: { type: 'string' },
  seed: { type: 'string', default: '42052' }, max: { type: 'string', default: '100' },
} });
if (!values.scan?.length || !values.roots?.length || !values.out) throw new Error('Use: heading-packet.ts --scan <h52-scan.json> --roots <roots.json> --out <dir> [--seed 42052] [--max 100]');
const [max, seed] = [Number(values.max), Number(values.seed)];
if (!Number.isInteger(max) || max < 1 || !Number.isInteger(seed)) throw new Error('--max and --seed must be integers.');
const roots = (await Promise.all(values.roots.map(async f => rootSchema.parse(JSON.parse(await readFile(f, 'utf8')))))).flat();
if (roots.some(root => root.restricted)) throw new Error('Packets are built from public roots only.');
type Changed = { root: string; repository: string; sha: string; feature: string; transitions: Record<string, string>; headings: { path: string; line: number; text: string }[] };
const changed = (await Promise.all(values.scan.map(async f => JSON.parse(await readFile(f, 'utf8')).changed as Changed[]))).flat()
  .filter((d, i, all) => all.findIndex(e => e.root === d.root && e.sha === d.sha && e.feature === d.feature) === i);
if (new Set(roots.map(r => r.id)).size !== roots.length) throw new Error('Root IDs repeat across the --roots files.');
if (!changed.length) throw new Error('No changed feature in the scans.');
const drawn = changed.length > max ? sample(changed, max, seed) : changed;

const snapshots = new Map<string, Map<string, string>>();
const entries: { item: { repository: string; revision: string; path: string; line: number; chain: string[]; section: string[] }; key: { root: string; feature: string; transitions: Record<string, string> } }[] = [];
drawn.forEach((d, n) => {
  const root = roots.find(r => r.id === d.root);
  if (!root) throw new Error(`No root for ${d.root}.`);
  const at = `${root.id}@${d.sha}`;
  if (!snapshots.has(at)) {
    const { sha, files } = snapshot({ ...root, ref: d.sha });
    if (sha !== d.sha) throw new Error(`${root.id} resolved to ${sha}, not the scanned ${d.sha}.`);
    snapshots.set(at, files);
  }
  const heading = sample(d.headings, 1, seed + n)[0];
  const content = snapshots.get(at)!.get(heading.path);
  if (content === undefined) throw new Error(`${heading.path} is not in ${root.id}@${d.sha}.`);
  const lines = content.split(/\r?\n/);
  if (lines[heading.line - 1]?.slice(0, 300) !== heading.text) throw new Error(`${root.id} ${heading.path}:${heading.line} does not match the scan.`);
  entries.push({ item: { repository: d.repository, revision: d.sha, path: heading.path, line: heading.line, ...sectionOf(lines, heading.line) },
    key: { root: d.root, feature: d.feature, transitions: d.transitions } });
});
// Shuffle, then number, so neither order nor ID carries the set, root or direction.
const shuffled = sample(entries, entries.length, seed).map((e, i) => ({ id: `h52-${String(i + 1).padStart(3, '0')}`, ...e }));
const items = shuffled.map(({ id, item }) => ({ id, ...item }));
const key = shuffled.map(({ id, key: k }) => ({ id, ...k }));
await mkdir(values.out, { recursive: true, mode: 0o700 });
await writeFile(join(values.out, 'packet.json'), JSON.stringify({ version: 1, labels: ['positive', 'negative', 'unknown'], guide: 'docs/precision-adjudication.md#h52-requirement-headings-52', items }, null, 2) + '\n');
await writeFile(join(values.out, 'key.json'), JSON.stringify(key, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ changed: changed.length, items: items.length, seed }));
