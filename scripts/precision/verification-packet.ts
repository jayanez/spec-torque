/**
 * H6 adjudication packet (#88): the first new evidence line of every practice whose status the
 * candidate raises, with context, written as packet.json (for reviewers) and key.json (never shown).
 *
 *   verification-packet.ts --detail <h6-scan.json> --roots <roots.json> --out <dir> [--seed 42039] [--context 4]
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { rootSchema } from './sources.js';

const { values } = parseArgs({ options: {
  detail: { type: 'string' }, roots: { type: 'string' }, out: { type: 'string' },
  seed: { type: 'string', default: '42039' }, context: { type: 'string', default: '4' },
} });
if (!values.detail || !values.roots || !values.out) throw new Error('Use: verification-packet.ts --detail <h6-scan.json> --roots <roots.json> --out <dir>');
const roots = rootSchema.parse(JSON.parse(await readFile(values.roots, 'utf8')));
if (roots.some(root => root.restricted)) throw new Error('Packets are built from public roots only.');
type Evidence = { path: string; line: number; text: string };
const scan = JSON.parse(await readFile(values.detail, 'utf8')) as { detail: { root: string; sha: string; feature: string;
  changes: { id: string; from: string; to: string }[]; evidence: Record<string, Evidence[]> }[] };

// Same deterministic generator as the H3a and H5 packets.
let state = Number(values.seed);
const random = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
const shuffle = <T>(items: T[]) => { const pool = [...items]; const out: T[] = []; while (pool.length) out.push(pool.splice(Math.floor(random() * pool.length), 1)[0]); return out; };

const PROPOSITIONS: Record<string, string> = {
  'E3.1': 'This line states, or directly introduces, an observable verification criterion (an acceptance criterion or scenario with an expected outcome) for the feature.',
  'E3.2': 'This line states, or directly introduces, a method for checking the feature: an executable test or command, or a described manual check.',
  'E3.4': 'This line states, or directly introduces, what evidence is required to consider the feature\'s verification complete.',
};
const changes = scan.detail.flatMap(d => d.changes.filter(c => c.from === 'missing' && c.to === 'partial' && PROPOSITIONS[c.id])
  .map(c => ({ root: d.root, sha: d.sha, feature: d.feature, practice: c.id, evidence: d.evidence[c.id]?.[0] })))
  .filter(c => c.evidence);
const around = Number(values.context);
const git = (root: string, ...args: string[]) => execFileSync('git', ['-C', roots.find(r => r.id === root)!.path, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });

const items: unknown[] = []; const key: { id: string; practice: string; root: string; feature: string }[] = [];
for (const change of shuffle(changes)) {
  const { path, line } = change.evidence!;
  const lines = git(change.root, 'show', `${change.sha}:${path}`).split(/\r?\n/);
  const id: string = 'V' + String(items.length + 1).padStart(3, '0');
  items.push({
    id, repository: roots.find(r => r.id === change.root)!.repository, revision: change.sha, path, line,
    proposition: PROPOSITIONS[change.practice],
    context: lines.slice(Math.max(0, line - 1 - around), line + around).map((text, index) => `${Math.max(1, line - around) + index}${Math.max(1, line - around) + index === line ? ' >' : '  '} ${text}`),
  });
  key.push({ id, practice: change.practice, root: change.root, feature: change.feature });
}
await mkdir(values.out, { recursive: true, mode: 0o700 });
await writeFile(join(values.out, 'packet.json'), JSON.stringify({ version: 1, labels: ['positive', 'negative', 'unknown'], guide: 'docs/precision-adjudication.md#h6-verification-evidence-88', items }, null, 2) + '\n');
await writeFile(join(values.out, 'key.json'), JSON.stringify(key, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ items: items.length, byPractice: Object.fromEntries(Object.keys(PROPOSITIONS).map(p => [p, key.filter(k => k.practice === p).length])), out: values.out }));
