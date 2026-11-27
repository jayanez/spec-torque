/**
 * H92 (#92) adjudication packet: draws excluded paths (framework templates in the candidate, candidates
 * in the baseline) from public roots, one per repository and path, with a fixed seed, and writes them
 * with their committed text for blind labeling. Labels never see the engine, the rule or the path rule's name.
 *
 *   node --import tsx scripts/precision/template-packet.ts --baseline <ref> --candidate <ref> --roots <roots.json> --out <dir> [--seed 42092] [--size 100]
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { archiveEngine, commit } from './engines.js';
import { rootSchema, snapshot } from './sources.js';
import { sha256 } from './probe.js';

const { values } = parseArgs({ options: { baseline: { type: 'string' }, candidate: { type: 'string', default: 'HEAD' }, roots: { type: 'string' }, out: { type: 'string' },
  seed: { type: 'string', default: '42092' }, size: { type: 'string', default: '100' } } });
if (!values.baseline || !values.roots || !values.out) throw new Error('Use: template-packet.ts --baseline <ref> [--candidate <ref>] --roots <roots.json> --out <dir>');
const revisions = { baseline: commit(values.baseline), candidate: commit(values.candidate!) };
if (revisions.baseline === revisions.candidate) throw new Error('Both arms are the same revision.');
const temp = await mkdtemp(join(tmpdir(), 'spectorque-template-packet-'));
const baseline = await archiveEngine(revisions.baseline, join(temp, 'baseline'));
const candidate = await archiveEngine(revisions.candidate, join(temp, 'candidate'));

// Mulberry32: a small deterministic generator, so the draw is reproducible from the seed alone.
function random(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const roots = rootSchema.parse(JSON.parse((await readFile(values.roots)).toString()));
if (!roots.length) throw new Error('No roots.');
const pool: { repository: string; revision: string; path: string; text: string }[] = [];
for (const root of roots) {
  if (root.restricted) throw new Error('Restricted roots are not supported.');
  const { sha, files } = snapshot(root);
  // A path counts once when either mode (workspace basename, GitHub full path) stops discovering it.
  const dropped = (basename: boolean) => (path: string) => baseline.isSpecCandidate(path, basename) && !candidate.isSpecCandidate(path, basename);
  for (const [path, text] of files) if (dropped(true)(path) || dropped(false)(path)) pool.push({ repository: root.repository, revision: sha, path, text });
}
await rm(temp, { recursive: true, force: true });
pool.sort((a, b) => (a.repository + a.path < b.repository + b.path ? -1 : 1));
const next = random(Number(values.seed));
for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
const drawn = pool.slice(0, Number(values.size));
await mkdir(values.out, { recursive: true });
const items = drawn.map((item, index) => ({ id: `T${String(index + 1).padStart(3, '0')}`, ...item, textHash: sha256(item.text), text: item.text.slice(0, 6000), truncated: item.text.length > 6000 }));
await writeFile(join(values.out, 'packet.json'), JSON.stringify({ seed: Number(values.seed), pool: pool.length, revisions, items }, null, 2) + '\n');
// The labeling copy has no revision, engine or rule information.
await writeFile(join(values.out, 'labeling.json'), JSON.stringify(items.map(({ id, repository, path, text, truncated }) => ({ id, repository, path, text, truncated })), null, 2) + '\n');
console.log(JSON.stringify({ pool: pool.length, drawn: items.length, repositories: new Set(items.map(i => i.repository)).size }));
