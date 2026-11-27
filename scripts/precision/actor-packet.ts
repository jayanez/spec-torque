/**
 * H104 adjudication packet (#104): for every feature whose P2.1 the candidate raises, the spec lines
 * that carry the new actor cue, with two lines of context, written as packet.json (for reviewers)
 * and key.json (never shown).
 *
 *   actor-packet.ts --detail <h6-scan.json> [--detail …] --roots <roots.json> [--roots …] --baseline <ref> --out <dir> [--seed 42104] [--max 100]
 *
 * The cue lines are found with the engines themselves: a line carries the new cue when, alone in a
 * spec with one admitted requirement, the candidate gives P2.1 `partial` and the baseline `missing`.
 * Lines are read outside their fence context, so a fenced line with a modal is missed; such an item
 * would have no lines, and the run fails. Reading the files at the scan's revision keeps line numbers
 * and context on the commit the packet names.
 */
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { archiveEngine, commit, type Engine } from './engines.js';
import { sample } from './prose.js';
import { rootSchema, snapshot, type Root } from './sources.js';

const { values } = parseArgs({ options: {
  detail: { type: 'string', multiple: true }, roots: { type: 'string', multiple: true }, baseline: { type: 'string' },
  candidate: { type: 'string' }, out: { type: 'string' }, seed: { type: 'string', default: '42104' }, max: { type: 'string', default: '100' },
} });
if (!values.detail?.length || !values.roots?.length || !values.baseline || !values.candidate || !values.out) throw new Error('Use: actor-packet.ts --detail <h6-scan.json> --roots <roots.json> --baseline <ref> --candidate <ref> --out <dir>');
const [max, seed] = [Number(values.max), Number(values.seed)];
if (!Number.isInteger(max) || max < 1 || !Number.isInteger(seed)) throw new Error('--max and --seed must be integers.');
const roots: Root[] = (await Promise.all(values.roots.map(async f => rootSchema.parse(JSON.parse(await readFile(f, 'utf8')))))).flat();
if (roots.some(root => root.restricted)) throw new Error('Packets are built from public roots only.');
type Detail = { root: string; sha: string; feature: string; changes: { id: string; from: string; to: string }[] };
const details = (await Promise.all(values.detail.map(async f => JSON.parse(await readFile(f, 'utf8')).detail as Detail[]))).flat()
  .filter(d => d.changes.some(c => c.id === 'P2.1' && c.from === 'missing' && c.to === 'partial'))
  .filter((d, i, all) => all.findIndex(e => e.root === d.root && e.sha === d.sha && e.feature === d.feature) === i);

const temp = await mkdtemp(join(tmpdir(), 'spectorque-h104-'));
const arms = { baseline: await archiveEngine(commit(values.baseline), join(temp, 'b')), candidate: await archiveEngine(commit(values.candidate), join(temp, 'c')) };
if (arms.baseline.ENGINE_VERSION === arms.candidate.ENGINE_VERSION) throw new Error(`Baseline and candidate are the same engine (${arms.candidate.ENGINE_VERSION}); name the candidate revision.`);
const status = async (engine: Engine, line: string) => {
  const spec = `# Demo\n\n${line}\n\n- REQ-001: The demo MUST hold.\n`;
  const status = (await engine.analyze({ name: 'h104', artifacts: [engine.classifyArtifact('specs/001-demo/spec.md', spec)] })).practices.find(p => p.id === 'P2.1')?.status;
  if (!status) throw new Error('P2.1 is missing from the assessment.');
  return status;
};
const carriesCue = async (line: string) => line.trim() !== '' && !/^\s*#/.test(line) &&
  await status(arms.candidate, line) === 'partial' && await status(arms.baseline, line) === 'missing';

const PROPOSITION = 'This line names a person or role who performs, requests or receives the specified product behavior.';
type Cue = { path: string; line: number; context: string[] };
const classified = new Map<string, ReturnType<Engine['classifyArtifact']>[]>();
const items: { id: string; repository: string; revision: string; proposition: string; lines: Cue[] }[] = []; const key: { id: string; root: string; feature: string }[] = [];
// Same deterministic generator as the H3a, H5 and H6 packets.
const drawn = sample(details.sort((a, b) => `${a.root}/${a.feature}` < `${b.root}/${b.feature}` ? -1 : 1), max, seed);
for (const d of drawn) {
  const root = roots.find(r => r.id === d.root);
  if (!root) throw new Error(`Root ${d.root} is not in --roots.`);
  if (!classified.has(root.id)) {
    const { sha, files } = snapshot({ ...root, ref: d.sha });
    if (sha !== d.sha) throw new Error(`Root ${root.id} resolves to ${sha}, but the scan read ${d.sha}.`);
    classified.set(root.id, [...files].filter(([path]) => arms.candidate.isSpecCandidate(path, true)).map(([path, content]) => arms.candidate.classifyArtifact(path, content)));
  }
  const artifacts = classified.get(root.id)!;
  const specs = arms.candidate.selectFeature({ name: root.id, artifacts }, d.feature).artifacts.filter(a => a.role === 'spec' && !a.archived);
  const lines: Cue[] = [];
  for (const artifact of specs) {
    if (lines.length >= 3) break;
    const text = artifact.content.split(/\r?\n/);
    for (let i = 0; i < text.length && lines.length < 3; i++) {
      if (!await carriesCue(text[i])) continue;
      const from = Math.max(0, i - 2);
      lines.push({ path: artifact.path, line: i + 1, context: text.slice(from, i + 3).map((t, j) => `${from + j + 1}${from + j === i ? ' >' : '  '} ${t}`) });
    }
  }
  const id = 'A' + String(items.length + 1).padStart(3, '0');
  items.push({ id, repository: root.repository, revision: d.sha, proposition: PROPOSITION, lines });
  key.push({ id, root: d.root, feature: d.feature });
}
await mkdir(values.out, { recursive: true, mode: 0o700 });
await writeFile(join(values.out, 'packet.json'), JSON.stringify({ version: 1, labels: ['positive', 'negative', 'unknown'], guide: 'docs/precision-adjudication.md#h104-actors-named-by-role-104', items }, null, 2) + '\n');
await writeFile(join(values.out, 'key.json'), JSON.stringify(key, null, 2) + '\n', { mode: 0o600 });
await rm(temp, { recursive: true, force: true });
const withoutLines = items.filter(i => !i.lines.length).map(i => i.id);
if (withoutLines.length) throw new Error(`Items without a cue line: ${withoutLines.join(', ')}. Check the candidate revision and the artifact scope.`);
console.log(JSON.stringify({ changed: details.length, items: items.length,  out: values.out }));
