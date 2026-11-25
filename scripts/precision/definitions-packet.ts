/**
 * H3a adjudication packet (#83): a seeded sample of removed I1.2/I2.3 findings and every added one,
 * with context, written as packet.json (for reviewers) and key.json (direction, never shown to them).
 *
 *   definitions-packet.ts --detail <h3-scan.json> --roots <roots.json> --out <dir> [--sample 100] [--seed 42039]
 *                         [--context 3] [--propositions h3a|h5|h8]
 *
 * H5 (#78) reuses the builder with a wider context and a missing-identifier proposition that also
 * considers the list item or paragraph the line belongs to. H8 (#80) asks whether a removed R-n
 * reference cites a requirement of the feature's specification. H9 (#84) asks whether
 * the ID is meant as this feature's requirement; its key records the rule (`not-adopted` when the
 * engine's non-adoption marker is attached to the subject ID, otherwise `qualified`), and its
 * occurrences skip namespaced forms such as `VP-REQ-01`.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { around as idContext, markedNotAdopted, namespaceOf } from '../../src/core/references.js';
import { rootSchema } from './sources.js';

const { values } = parseArgs({ options: {
  detail: { type: 'string' }, roots: { type: 'string' }, out: { type: 'string' },
  sample: { type: 'string', default: '100' }, seed: { type: 'string', default: '42039' },
  context: { type: 'string', default: '3' }, propositions: { type: 'string', default: 'h3a' },
} });
const H3A_MISSING = 'This line states a requirement that has no stable identifier of its own and is not under an enclosing requirement heading that identifies it.';
const H3A_REFERENCE = 'The requirement ID cited on this line has no definition anywhere in the feature\'s specification documents.';
/** Per proposition set: guide anchor, proposition texts, and whether occurrences come from every feature document. */
const MODES = {
  h3a: { guide: 'docs/precision-adjudication.md#h3a-requirement-definitions-83', missing: H3A_MISSING, reference: H3A_REFERENCE, siblings: false },
  h5: { guide: 'docs/precision-adjudication.md#h5-wrapped-continuations-78', missing: 'This line states a requirement that has no stable identifier: neither the line, nor the list item or paragraph it belongs to (including its wrapped lines), nor an enclosing requirement heading identifies it.', reference: H3A_REFERENCE, siblings: false },
  // H8: an R-n label is usually defined in a sibling document (research, plan), so search every Markdown file of the feature.
  h9: { guide: 'docs/precision-adjudication.md#h9-qualified-and-non-adopted-references-84', missing: H3A_MISSING, reference: 'The requirement ID cited on this line is meant as a requirement of this feature, and the feature\'s specification documents do not define it.', siblings: false },
  h8: { guide: 'docs/precision-adjudication.md#h8-plan-local-r-n-labels-80', missing: H3A_MISSING, reference: 'The R-n label named in subjectId, on this line, cites a requirement of the feature\'s specification, so its missing definition is a true problem.', siblings: true },
};
if (!Object.hasOwn(MODES, values.propositions!)) throw new Error(`--propositions must be one of ${Object.keys(MODES).join(', ')}.`);
const mode = MODES[values.propositions as keyof typeof MODES];
const h9 = values.propositions === 'h9';
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
  : message.startsWith('Requirement has no stable identifier') ? mode.missing : mode.reference;
/** Matches of the bare ID on a line; for H9, namespaced forms such as `VP-REQ-01` are not the ID. */
const matchesOf = (pattern: RegExp, text: string) => [...text.matchAll(pattern)]
  .filter(match => !h9 || !namespaceOf(idContext(text, match.index, match[0].length).before));
const specDocument = (path: string) => /\.md$/i.test(path) && /spec|requirement|prd|proposal/i.test(path.split('/').pop()!);
const searched = mode.siblings ? (path: string) => /\.md$/i.test(path) : specDocument;

const items = []; const key = [];
for (const change of draw(chosen, chosen.length)) {
  const [practice, path, lineText, message] = change.key.split('|');
  const line = Number(lineText);
  const lines = git(change.root, 'show', `${change.sha}:${path}`).split(/\r?\n/);
  const id = message.match(/(?:FR|NFR|REQ|R)-\d+/i)?.[0];
  const occurrences: string[] = [];
  const pattern = id && new RegExp(`\\b${id}\\b(?!\\.\\d)`, 'gi');
  if (pattern) {
    const files = git(change.root, 'ls-tree', '-r', '--name-only', change.sha).split('\n').filter(f => f.startsWith(change.feature + '/') && searched(f));
    for (const file of files) git(change.root, 'show', `${change.sha}:${file}`).split(/\r?\n/).forEach((text, index) => {
      if (mode.siblings && file === path && index + 1 === line) return;
      if (occurrences.length < 8 && matchesOf(pattern, text).length) occurrences.push(`${file}:${index + 1}: ${text.trim().slice(0, 240)}`);
    });
  }
  const itemId: string = 'D' + String(items.length + 1).padStart(3, '0');
  items.push({
    id: itemId, repository: roots.find(r => r.id === change.root)!.repository, revision: change.sha, path, line,
    proposition: proposition(message), subjectId: id ?? null,
    context: lines.slice(Math.max(0, line - 1 - around), line + around).map((text, index) => `${Math.max(1, line - around) + index}${Math.max(1, line - around) + index === line ? ' >' : '  '} ${text}`),
    occurrences,
  });
  // The rule that left the finding out, read with the engine's own marker test.
  const target = lines[line - 1] ?? '';
  const rule = h9 ? { rule: pattern && matchesOf(pattern, target).some(match => markedNotAdopted(idContext(target, match.index, match[0].length))) ? 'not-adopted' : 'qualified' } : {};
  key.push({ id: itemId, direction: change.direction, practice, message, root: change.root, feature: change.feature, ...rule });
}
await mkdir(values.out, { recursive: true, mode: 0o700 });
await writeFile(join(values.out, 'packet.json'), JSON.stringify({ version: 1, labels: ['positive', 'negative', 'unknown'], guide: mode.guide, items }, null, 2) + '\n');
await writeFile(join(values.out, 'key.json'), JSON.stringify(key, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ items: items.length, removed: key.filter(k => k.direction === 'removed').length, added: key.filter(k => k.direction === 'added').length, out: values.out }));
