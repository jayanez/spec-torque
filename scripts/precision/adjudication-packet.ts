/**
 * Builds a blind adjudication packet from a public scan detail file: one item per distinct
 * changed line, with the full source line and two lines of context read from the pinned
 * revision. Arm decisions are withheld so reviewers label without seeing the rule's output.
 *
 * Only lines whose admission changed are included. With --sample, a seeded sample of distinct
 * lines is drawn (same generator as the replay review samples).
 *
 *   node --import tsx scripts/precision/adjudication-packet.ts --detail <public-detail.json> --roots <roots.json> --out <dir> [--sample 100 --seed 42039]
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { sha256 } from './probe.js';

const { values } = parseArgs({ options: { detail: { type: 'string' }, roots: { type: 'string' }, out: { type: 'string' }, sample: { type: 'string' }, seed: { type: 'string', default: '42039' } } });
if (!values.detail || !values.roots || !values.out) throw new Error('Use --detail <file> --roots <file> --out <dir>.');

interface Row { baseline: { admitted: boolean }; candidate: { admitted: boolean }; root: string; framework: string; lineage: string; path: string; line: number; language: string; revision: string }
const detail = JSON.parse(await readFile(values.detail, 'utf8')) as { rows: Row[] };
const roots = JSON.parse(await readFile(values.roots, 'utf8')) as { id: string; path: string; restricted: boolean }[];
const rootPath = new Map(roots.map(root => [root.id, root]));

const files = new Map<string, string[]>();
function source(row: Row) {
  const key = `${row.root}:${row.revision}:${row.path}`;
  if (!files.has(key)) {
    const root = rootPath.get(row.root);
    if (!root || root.restricted) throw new Error('Packets are built from public roots only.');
    const text = execFileSync('git', ['-C', root.path, 'show', `${row.revision}:${row.path}`], { encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] });
    files.set(key, text.normalize('NFC').split(/\r?\n/));
  }
  return files.get(key)!;
}

const items = new Map<string, { id: string; text: string; language: string; direction: 'excluded' | 'admitted'; occurrences: { root: string; lineage: string; path: string; line: number }[]; context: { before: string[]; after: string[] } }>();
for (const row of detail.rows.filter(row => row.baseline.admitted !== row.candidate.admitted)) {
  const lines = source(row);
  const text = lines[row.line - 1] ?? '';
  const key = text.trim();
  if (!items.has(key)) items.set(key, {
    id: `L${sha256(key).slice(0, 10)}`, text, language: row.language, direction: row.candidate.admitted ? 'admitted' : 'excluded', occurrences: [],
    context: { before: lines.slice(Math.max(0, row.line - 3), row.line - 1), after: lines.slice(row.line, row.line + 2) },
  });
  items.get(key)!.occurrences.push({ root: row.root, lineage: row.lineage, path: row.path, line: row.line });
}
// Stable order by ID, so the packet does not reveal scan order.
let selected = [...items.values()].sort((a, b) => a.id.localeCompare(b.id));
if (values.sample && selected.length > Number(values.sample)) {
  let state = Number(values.seed);
  const next = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pool = [...selected]; selected = [];
  while (selected.length < Number(values.sample)) selected.push(pool.splice(Math.floor(next() * pool.length), 1)[0]);
  selected.sort((a, b) => a.id.localeCompare(b.id));
}
// The direction of each change is kept in a separate key, so reviewers stay blind to it.
const packet = selected.map(({ direction: _direction, ...item }) => ({
  ...item, lineages: new Set(item.occurrences.map(o => o.lineage)).size,
  labels: { reviewerA: null, reviewerB: null, adjudicated: null, note: null },
}));
await mkdir(values.out, { recursive: true });
await writeFile(join(values.out, 'packet.json'), JSON.stringify({
  kind: 'adjudication-packet', detailHash: sha256(await readFile(values.detail)), distinctChanged: items.size, sample: values.sample ? { size: packet.length, seed: Number(values.seed) } : null, labelSet: ['mention', 'requirement', 'unknown'],
  guide: 'docs/precision-adjudication.md', items: packet,
}, null, 2) + '\n');
await writeFile(join(values.out, 'key.json'), JSON.stringify(Object.fromEntries(selected.map(item => [item.id, item.direction])), null, 2) + '\n');
console.log(JSON.stringify({ items: packet.length, distinctChanged: items.size, languages: Object.fromEntries(['en', 'es', 'und'].map(l => [l, packet.filter(i => i.language === l).length])) }));
