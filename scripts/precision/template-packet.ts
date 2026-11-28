/**
 * H92 (#92) adjudication packet: draws excluded paths (framework templates in the candidate, candidates
 * in the baseline) from public roots, one per repository and path, with a fixed seed, and writes them
 * with their full committed text for blind labeling. Labels never see the engine, the rule or the path rule's name.
 *
 *   node --import tsx scripts/precision/template-packet.ts --baseline <ref> --candidate <ref> --roots <roots.json> --out <dir> --seed <n> [--size 100]
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { archiveEngine, commit } from './engines.js';
import { rootSchema, snapshot } from './sources.js';
import { sha256 } from './probe.js';
import { sample } from './prose.js';

const { values } = parseArgs({ options: { baseline: { type: 'string' }, candidate: { type: 'string', default: 'HEAD' }, roots: { type: 'string' }, out: { type: 'string' },
  seed: { type: 'string' }, size: { type: 'string', default: '100' } } });
// The seed is per hypothesis (H92 42092, H92a 42093), so it is never defaulted.
if (!values.baseline || !values.roots || !values.out || !values.seed) throw new Error('Use: template-packet.ts --baseline <ref> [--candidate <ref>] --roots <roots.json> --out <dir> --seed <n> [--size 100]');
const revisions = { baseline: commit(values.baseline), candidate: commit(values.candidate!) };
if (revisions.baseline === revisions.candidate) throw new Error('Both arms are the same revision.');
const temp = await mkdtemp(join(tmpdir(), 'spectorque-template-packet-'));
const baseline = await archiveEngine(revisions.baseline, join(temp, 'baseline'));
const candidate = await archiveEngine(revisions.candidate, join(temp, 'candidate'));

const roots = rootSchema.parse(JSON.parse((await readFile(values.roots)).toString()));
if (!roots.length) throw new Error('No roots.');
const pool: { repository: string; revision: string; path: string; text: string }[] = [];
for (const root of roots) {
  if (root.restricted) throw new Error('Restricted roots are not supported.');
  const { sha, files } = snapshot(root);
  // A path counts once when either mode (workspace basename, GitHub full path) stops discovering it.
  const dropped = (path: string, basename: boolean) => baseline.isSpecCandidate(path, basename) && !candidate.isSpecCandidate(path, basename);
  for (const [path, text] of files) if (dropped(path, true) || dropped(path, false)) pool.push({ repository: root.repository, revision: sha, path, text });
}
await rm(temp, { recursive: true, force: true });
pool.sort((a, b) => (a.repository + a.path < b.repository + b.path ? -1 : 1));
const drawn = sample(pool, Number(values.size), Number(values.seed));
await mkdir(values.out, { recursive: true });
const items = drawn.map((item, index) => ({ id: `T${String(index + 1).padStart(3, '0')}`, ...item, textHash: sha256(item.text), lines: item.text.split(/\r?\n/).length }));
await writeFile(join(values.out, 'packet.json'), JSON.stringify({ seed: Number(values.seed), pool: pool.length, revisions, items }, null, 2) + '\n');
// The labeling copy has no revision, engine or rule information.
await writeFile(join(values.out, 'labeling.json'), JSON.stringify(items.map(({ id, repository, path, text }) => ({ id, repository, path, text })), null, 2) + '\n');
console.log(JSON.stringify({ pool: pool.length, drawn: items.length, repositories: new Set(items.map(i => i.repository)).size }));
