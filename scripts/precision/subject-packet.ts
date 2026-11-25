/**
 * H85 adjudication packet (#85): removed E1.3 findings from a verification.ts scan, deduplicated by
 * line text, all of them or a seeded sample, with context. Writes packet.json (for reviewers) and
 * key.json (engine output, never shown to them).
 *
 *   subject-packet.ts --detail <h6-scan.json> --roots <roots.json> --out <dir> [--sample 100] [--seed 42039] [--context 4]
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { rootSchema } from './sources.js';

const { values } = parseArgs({ options: {
  detail: { type: 'string' }, roots: { type: 'string' }, out: { type: 'string' },
  sample: { type: 'string', default: '100' }, seed: { type: 'string', default: '42039' }, context: { type: 'string', default: '4' },
} });
if (!values.detail || !values.roots || !values.out) throw new Error('Use: subject-packet.ts --detail <h6-scan.json> --roots <roots.json> --out <dir>');
const roots = rootSchema.parse(JSON.parse(await readFile(values.roots, 'utf8')));
if (roots.some(root => root.restricted)) throw new Error('Packets are built from public roots only.');
type Finding = { key: string; text: string };
const scan = JSON.parse(await readFile(values.detail, 'utf8')) as { detail: { root: string; sha: string; feature: string; findingsRemoved: Finding[]; findingsAdded: Finding[] }[] };

// Same deterministic generator as the H3a, H5 and H6 packets.
let state = Number(values.seed);
const random = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
const shuffle = <T>(items: T[]) => { const pool = [...items]; const out: T[] = []; while (pool.length) out.push(pool.splice(Math.floor(random() * pool.length), 1)[0]); return out; };

const PROPOSITION = 'The subject of this line is a bare pronoun: the reader must look outside the line to know what the requirement is about.';
// One item per distinct trimmed line text; the first occurrence supplies the context.
const distinct = new Map<string, { root: string; sha: string; feature: string; path: string; line: number; occurrences: number }>();
for (const d of scan.detail) for (const f of d.findingsRemoved.filter(f => f.key.startsWith('E1.3|'))) {
  const [, path, line] = f.key.split('|');
  const seen = distinct.get(f.text.trim());
  if (seen) seen.occurrences++;
  else distinct.set(f.text.trim(), { root: d.root, sha: d.sha, feature: d.feature, path, line: Number(line), occurrences: 1 });
}
const chosen = shuffle([...distinct.values()]).slice(0, Number(values.sample));
const around = Number(values.context);
const git = (root: string, ...args: string[]) => execFileSync('git', ['-C', roots.find(r => r.id === root)!.path, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });

const items: unknown[] = []; const key: unknown[] = [];
for (const change of chosen) {
  const { path, line } = change;
  const lines = git(change.root, 'show', `${change.sha}:${path}`).split(/\r?\n/);
  const id = 'S' + String(items.length + 1).padStart(3, '0');
  items.push({
    id, repository: roots.find(r => r.id === change.root)!.repository, revision: change.sha, path, line, proposition: PROPOSITION,
    context: lines.slice(Math.max(0, line - 1 - around), line + around).map((text, index) => `${Math.max(1, line - around) + index}${Math.max(1, line - around) + index === line ? ' >' : '  '} ${text}`),
  });
  key.push({ id, direction: 'removed', practice: 'E1.3', root: change.root, feature: change.feature, occurrences: change.occurrences });
}
await mkdir(values.out, { recursive: true, mode: 0o700 });
await writeFile(join(values.out, 'packet.json'), JSON.stringify({ version: 1, labels: ['positive', 'negative', 'unknown'], guide: 'docs/precision-adjudication.md#h85-demonstrative-subjects-85', items }, null, 2) + '\n');
await writeFile(join(values.out, 'key.json'), JSON.stringify(key, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ items: items.length, distinct: distinct.size, out: values.out }));
