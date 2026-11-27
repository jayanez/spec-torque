/**
 * H104 adjudication packet (#104): for every feature whose P2.1 the candidate raises, the spec lines
 * that carry the new actor cue, with two lines of context, written as packet.json (for reviewers)
 * and key.json (never shown).
 *
 *   actor-packet.ts --detail <h6-scan.json> [--detail …] --roots <roots.json> [--roots …] --baseline <ref> --out <dir> [--seed 42104] [--max 100]
 *
 * The cue lines are found with the engines themselves: a line carries the new cue when, alone in a
 * spec with one admitted requirement, the candidate gives P2.1 `partial` and the baseline `missing`.
 */
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { archiveEngine, commit, type Engine } from './engines.js';
import { rootSchema, snapshot, type Root } from './sources.js';

const { values } = parseArgs({ options: {
  detail: { type: 'string', multiple: true }, roots: { type: 'string', multiple: true }, baseline: { type: 'string' },
  candidate: { type: 'string', default: 'HEAD' }, out: { type: 'string' }, seed: { type: 'string', default: '42104' }, max: { type: 'string', default: '100' },
} });
if (!values.detail?.length || !values.roots?.length || !values.baseline || !values.out) throw new Error('Use: actor-packet.ts --detail <h6-scan.json> --roots <roots.json> --baseline <ref> --out <dir>');
const roots: Root[] = (await Promise.all(values.roots.map(async f => rootSchema.parse(JSON.parse(await readFile(f, 'utf8')))))).flat();
if (roots.some(root => root.restricted)) throw new Error('Packets are built from public roots only.');
type Detail = { root: string; sha: string; feature: string; changes: { id: string; from: string; to: string }[] };
const details = (await Promise.all(values.detail.map(async f => JSON.parse(await readFile(f, 'utf8')).detail as Detail[]))).flat()
  .filter(d => d.changes.some(c => c.id === 'P2.1' && c.from === 'missing' && c.to === 'partial'));

// Same deterministic generator as the H3a, H5 and H6 packets.
let state = Number(values.seed);
const random = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
const shuffle = <T>(items: T[]) => { const pool = [...items]; const out: T[] = []; while (pool.length) out.push(pool.splice(Math.floor(random() * pool.length), 1)[0]); return out; };

const temp = await mkdtemp(join(tmpdir(), 'spectorque-h104-'));
const arms = { baseline: await archiveEngine(commit(values.baseline), join(temp, 'b')), candidate: await archiveEngine(commit(values.candidate!), join(temp, 'c')) };
const status = async (engine: Engine, line: string) => {
  const spec = `# Demo\n\n${line}\n\n- REQ-001: The demo MUST hold.\n`;
  return (await engine.analyze({ name: 'h104', artifacts: [engine.classifyArtifact('specs/001-demo/spec.md', spec)] })).practices.find(p => p.id === 'P2.1')?.status;
};
const carriesCue = async (line: string) => line.trim() !== '' && !/^\s*#/.test(line) &&
  await status(arms.candidate, line) === 'partial' && await status(arms.baseline, line) === 'missing';

const PROPOSITION = 'This line names a person or role who performs, requests or receives the specified product behavior.';
const snapshots = new Map<string, ReturnType<typeof snapshot>>();
const items: unknown[] = []; const key: { id: string; root: string; feature: string }[] = [];
const drawn = shuffle([...details].sort((a, b) => `${a.root}/${a.feature}` < `${b.root}/${b.feature}` ? -1 : 1)).slice(0, Number(values.max));
for (const d of drawn) {
  const root = roots.find(r => r.id === d.root)!;
  if (!snapshots.has(root.id)) snapshots.set(root.id, snapshot(root));
  const { files } = snapshots.get(root.id)!;
  const artifacts = [...files].filter(([path]) => arms.candidate.isSpecCandidate(path, true)).map(([path, content]) => arms.candidate.classifyArtifact(path, content));
  const specs = arms.candidate.selectFeature({ name: root.id, artifacts }, d.feature).artifacts.filter(a => a.role === 'spec');
  const lines: { path: string; line: number; context: string[] }[] = [];
  for (const artifact of specs) {
    const text = artifact.content.split(/\r?\n/);
    for (let i = 0; i < text.length && lines.length < 3; i++) {
      if (!await carriesCue(text[i])) continue;
      lines.push({ path: artifact.path, line: i + 1, context: text.slice(Math.max(0, i - 2), i + 3).map((t, j) => `${Math.max(0, i - 2) + j + 1}${Math.max(0, i - 2) + j === i ? ' >' : '  '} ${t}`) });
    }
  }
  const id = 'A' + String(items.length + 1).padStart(3, '0');
  items.push({ id, repository: root.repository, revision: d.sha, proposition: PROPOSITION, lines });
  key.push({ id, root: d.root, feature: d.feature });
}
await mkdir(values.out, { recursive: true, mode: 0o700 });
await writeFile(join(values.out, 'packet.json'), JSON.stringify({ version: 1, labels: ['positive', 'negative', 'unknown'], guide: 'docs/precision-adjudication.md#h104-actors-named-by-role-104', items }, null, 2) + '\n');
await writeFile(join(values.out, 'key.json'), JSON.stringify(key, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ changed: details.length, items: items.length, withoutLines: items.filter(i => !(i as { lines: unknown[] }).lines.length).length, out: values.out }));
