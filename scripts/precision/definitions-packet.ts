/**
 * H3a adjudication packet (#83): a seeded sample of removed I1.2/I2.3 findings and every added one,
 * with context, written as packet.json (for reviewers) and key.json (direction, never shown to them).
 *
 *   definitions-packet.ts --detail <h3-scan.json> --roots <roots.json> --out <dir> [--sample 100] [--seed 42039]
 *                         [--context 3] [--propositions h3a|h5]
 *
 * H5 (#78) reuses the builder with a wider context and a missing-identifier proposition that also
 * considers the list item or paragraph the line belongs to. H9 (#84) uses an unresolved-reference
 * proposition that asks whether the ID is meant as this feature's requirement; its key records the
 * rule (`not-adopted` when the line carries a non-adoption marker, otherwise `qualified`).
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { rootSchema } from './sources.js';

const { values } = parseArgs({ options: {
  detail: { type: 'string' }, roots: { type: 'string' }, out: { type: 'string' },
  sample: { type: 'string', default: '100' }, seed: { type: 'string', default: '42039' },
  context: { type: 'string', default: '3' }, propositions: { type: 'string', default: 'h3a' },
} });
if (!['h3a', 'h5', 'h9'].includes(values.propositions!)) throw new Error('--propositions must be h3a, h5 or h9.');
const around = Number(values.context);
if (!values.detail || !values.roots || !values.out) throw new Error('Use: definitions-packet.ts --detail <h3-scan.json> --roots <roots.json> --out <dir>');
const roots = rootSchema.parse(JSON.parse(await readFile(values.roots, 'utf8')));
if (roots.some(root => root.restricted)) throw new Error('Packets are built from public roots only.');
const scan = JSON.parse(await readFile(values.detail, 'utf8')) as { detail: { root: string; sha: string; feature: string; removed: string[]; added: string[] }[] };

// Deterministic LCG; the same generator draws every sample in this experiment.
let state = Number(values.seed);
const random = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
const draw = <T>(items: T[], count: number) => { const pool = [...items]; const out: T[] = []; const target = Math.min(count, items.length); while (out.length < target) out.push(pool.splice(Math.floor(random() * pool.length), 1)[0]); return out; };

type Change = { root: string; sha: string; feature: string; key: string; direction: 'removed' | 'added' };
const all: Change[] = scan.detail.flatMap(d => [
  ...d.removed.map(key => ({ root: d.root, sha: d.sha, feature: d.feature, key, direction: 'removed' as const })),
  ...d.added.map(key => ({ root: d.root, sha: d.sha, feature: d.feature, key, direction: 'added' as const })),
]);
const chosen = [...draw(all.filter(c => c.direction === 'removed'), Number(values.sample)), ...all.filter(c => c.direction === 'added')];

const git = (root: string, ...args: string[]) => execFileSync('git', ['-C', roots.find(r => r.id === root)!.path, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
const proposition = (message: string) => message.startsWith('Duplicate')
  ? 'This line states a second, separate requirement under an ID that the same feature already uses for a different requirement.'
  : message.startsWith('Requirement has no stable identifier')
    ? values.propositions === 'h5'
      ? 'This line states a requirement that has no stable identifier: neither the line, nor the list item or paragraph it belongs to (including its wrapped lines), nor an enclosing requirement heading identifies it.'
      : 'This line states a requirement that has no stable identifier of its own and is not under an enclosing requirement heading that identifies it.'
    : values.propositions === 'h9'
      ? 'The requirement ID cited on this line is meant as a requirement of this feature, and the feature\'s specification documents do not define it.'
      : 'The requirement ID cited on this line has no definition anywhere in the feature\'s specification documents.';
const specDocument = (path: string) => /\.md$/i.test(path) && /spec|requirement|prd|proposal/i.test(path.split('/').pop()!);

const items = []; const key = [];
for (const change of draw(chosen, chosen.length)) {
  const [practice, path, lineText, message] = change.key.split('|');
  const line = Number(lineText);
  const lines = git(change.root, 'show', `${change.sha}:${path}`).split(/\r?\n/);
  const id = message.match(/(?:FR|NFR|REQ|R)-\d+/i)?.[0];
  const occurrences: string[] = [];
  if (id) {
    const files = git(change.root, 'ls-tree', '-r', '--name-only', change.sha).split('\n').filter(f => f.startsWith(change.feature + '/') && specDocument(f));
    for (const file of files) git(change.root, 'show', `${change.sha}:${file}`).split(/\r?\n/).forEach((text, index) => {
      if (occurrences.length < 8 && new RegExp(`\\b${id}\\b(?!\\.\\d)`, 'i').test(text)) occurrences.push(`${file}:${index + 1}: ${text.trim().slice(0, 240)}`);
    });
  }
  const itemId: string = 'D' + String(items.length + 1).padStart(3, '0');
  items.push({
    id: itemId, repository: roots.find(r => r.id === change.root)!.repository, revision: change.sha, path, line,
    proposition: proposition(message), subjectId: id ?? null,
    context: lines.slice(Math.max(0, line - 1 - around), line + around).map((text, index) => `${Math.max(1, line - around) + index}${Math.max(1, line - around) + index === line ? ' >' : '  '} ${text}`),
    occurrences,
  });
  const rule = values.propositions === 'h9' ? { rule: /not[ -]adopted|no[ \t]+adoptad[oa]s?/i.test(lines[line - 1] ?? '') ? 'not-adopted' : 'qualified' } : {};
  key.push({ id: itemId, direction: change.direction, practice, message, root: change.root, feature: change.feature, ...rule });
}
await mkdir(values.out, { recursive: true, mode: 0o700 });
await writeFile(join(values.out, 'packet.json'), JSON.stringify({ version: 1, labels: ['positive', 'negative', 'unknown'], guide: { h3a: 'docs/precision-adjudication.md#h3a-requirement-definitions-83', h5: 'docs/precision-adjudication.md#h5-wrapped-continuations-78', h9: 'docs/precision-adjudication.md#h9-qualified-and-non-adopted-references-84' }[values.propositions!], items }, null, 2) + '\n');
await writeFile(join(values.out, 'key.json'), JSON.stringify(key, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ items: items.length, removed: key.filter(k => k.direction === 'removed').length, added: key.filter(k => k.direction === 'added').length, out: values.out }));
