/**
 * Builds a blind adjudication packet: one item per distinct line, with the full source line,
 * its heading chain and two lines of context, read from the pinned revision. Arm decisions are
 * withheld so reviewers label without seeing the rule's output.
 *
 *   changed (default): lines whose admission changed in a public scan detail file (#51).
 *   prose:             a seeded sample of non-structural prose lines from the spec artifacts of
 *                      public roots (#52); `--sample` is required. `key.json` is empty.
 *
 *   node --import tsx scripts/precision/adjudication-packet.ts --detail <public-detail.json> --roots <roots.json> --out <dir> [--sample 100 --per-root 40 --seed 42039]
 *   node --import tsx scripts/precision/adjudication-packet.ts --population prose --roots <roots.json> --out <dir> --sample 400
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { loadEngine, repository } from './engines.js';
import { lineLanguage, sha256 } from './probe.js';
import { headingChain, proseLines, sample, stratify } from './prose.js';
import { classifyAll, lineageOf, rootSchema, snapshot, targetsOf } from './sources.js';

interface Occurrence { root: string; revision: string; lineage: string; path: string; line: number }
interface Row { baseline: { admitted: boolean }; candidate: { admitted: boolean }; root: string; framework: string; lineage: string; path: string; line: number; language: string; revision: string }
interface Item {
  id: string; text: string; language: string; direction?: 'excluded' | 'admitted'; occurrences: Occurrence[];
  headings: string[]; context: { before: string[]; after: string[] };
}

const { values } = parseArgs({ options: {
  detail: { type: 'string' }, roots: { type: 'string' }, out: { type: 'string' }, population: { type: 'string', default: 'changed' },
  sample: { type: 'string' }, 'per-root': { type: 'string' }, seed: { type: 'string', default: '42039' },
} });
if (!values.roots || !values.out) throw new Error('Use --roots <file> --out <dir>.');
if (!['changed', 'prose'].includes(values.population!)) throw new Error('--population is changed or prose.');
if (values.population === 'changed' && !values.detail) throw new Error('The changed population needs --detail <public-detail.json>.');
if (values.population === 'prose' && !values.sample) throw new Error('The prose population needs --sample <n>.');

const roots = rootSchema.parse(JSON.parse(await readFile(values.roots, 'utf8')));
const rootById = new Map(roots.map(root => [root.id, root]));

const files = new Map<string, string[]>();
function source(row: { root: string; revision: string; path: string }) {
  const key = `${row.root}:${row.revision}:${row.path}`;
  if (!files.has(key)) {
    const root = rootById.get(row.root);
    if (!root || root.restricted) throw new Error('Packets are built from public roots only.');
    const text = execFileSync('git', ['-C', root.path, 'show', `${row.revision}:${row.path}`], { encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] });
    files.set(key, text.normalize('NFC').split(/\r?\n/));
  }
  return files.get(key)!;
}

const items = new Map<string, Item>();
function add(lines: string[], row: { root: string; revision: string; lineage: string; path: string; line: number; language: string }, direction?: 'excluded' | 'admitted') {
  const text = lines[row.line - 1] ?? '';
  const key = text.trim();
  if (!items.has(key)) items.set(key, {
    id: `L${sha256(key).slice(0, 10)}`, text, language: row.language, ...(direction ? { direction } : {}), occurrences: [],
    headings: headingChain(lines, row.line), context: { before: lines.slice(Math.max(0, row.line - 3), row.line - 1), after: lines.slice(row.line, row.line + 2) },
  });
  items.get(key)!.occurrences.push({ root: row.root, revision: row.revision, lineage: row.lineage, path: row.path, line: row.line });
}

let detailHash: string | null = null;
if (values.population === 'changed') {
  const detailBytes = await readFile(values.detail!);
  detailHash = sha256(detailBytes);
  const detail = JSON.parse(detailBytes.toString()) as { rows: Row[] };
  for (const row of detail.rows.filter(row => row.baseline.admitted !== row.candidate.admitted)) add(source(row), row, row.candidate.admitted ? 'admitted' : 'excluded');
} else {
  const engine = await loadEngine(repository);
  for (const root of roots) {
    if (root.restricted) throw new Error('Packets are built from public roots only.');
    const { sha, files: committed } = snapshot(root);
    for (const artifact of targetsOf(classifyAll(engine, committed))) {
      const lineage = `${root.repository}|${lineageOf(artifact.path, artifact.framework, artifact.featureId)}`;
      const lines = source({ root: root.id, revision: sha, path: artifact.path });
      for (const line of proseLines(artifact.content)) add(lines, { root: root.id, revision: sha, lineage, path: artifact.path, line, language: lineLanguage(lines[line - 1] ?? '') });
    }
  }
}

// Stable order by ID, so the packet does not reveal scan order.
let selected = [...items.values()].sort((a, b) => a.id.localeCompare(b.id));
// --per-root caps each root's share, so one large repository cannot dominate the sample.
if (values['per-root']) selected = stratify(selected, item => item.occurrences[0].root, Number(values['per-root']), Number(values.seed)).sort((a, b) => a.id.localeCompare(b.id));
if (values.sample && selected.length > Number(values.sample)) selected = sample(selected, Number(values.sample), Number(values.seed)).sort((a, b) => a.id.localeCompare(b.id));
// The direction of each change is kept in a separate key, so reviewers stay blind to it.
const packet = selected.map(({ direction: _direction, ...item }) => ({
  ...item, lineages: new Set(item.occurrences.map(o => o.lineage)).size,
  labels: { reviewerA: null, reviewerB: null, adjudicated: null, note: null },
}));
const labelSet = values.population === 'prose' ? ['requirement', 'acceptance', 'other', 'unknown'] : ['mention', 'requirement', 'unknown'];
await mkdir(values.out, { recursive: true });
await writeFile(join(values.out, 'packet.json'), JSON.stringify({
  kind: 'adjudication-packet', population: values.population, detailHash, rootsHash: sha256(await readFile(values.roots)), distinctLines: items.size,
  sample: values.sample ? { size: packet.length, seed: Number(values.seed) } : null, labelSet,
  guide: values.population === 'prose' ? 'docs/requirement-classification.md' : 'docs/precision-adjudication.md', items: packet,
}, null, 2) + '\n');
await writeFile(join(values.out, 'key.json'), JSON.stringify(Object.fromEntries(selected.filter(item => item.direction).map(item => [item.id, item.direction])), null, 2) + '\n');
console.log(JSON.stringify({ items: packet.length, distinctLines: items.size, languages: Object.fromEntries(['en', 'es', 'und'].map(l => [l, packet.filter(i => i.language === l).length])) }));
