/**
 * H52 replay (#52): defining ID headings as identified requirement units for I1.2 and I2.2.
 * Compares two committed engine revisions on every feature of pinned public roots, or of a local
 * work tree (counts only), and judges each feature with `heading-judge.ts`.
 *
 *   node --import tsx scripts/precision/heading-units.ts scan --baseline <ref> [--candidate <ref>] --roots <roots.json> --out <dir>
 *   node --import tsx scripts/precision/heading-units.ts worktree --baseline <ref> [--candidate <ref>] --root <dir>
 *
 * `scan` writes the changed features (with their defining headings) to `<out>/h52-scan.json` for the
 * blind packet. `worktree` prints counts only and stores no document text.
 */
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { indexWorkspace } from '../../src/node/scope.js';
import type { ArtifactSet } from '../../src/core/types.js';
import { archiveEngine, commit } from './engines.js';
import { definingHeadings, judge } from './heading-judge.js';
import { classifyAll, rootSchema, snapshot } from './sources.js';

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  baseline: { type: 'string' }, candidate: { type: 'string', default: 'HEAD' },
  roots: { type: 'string' }, out: { type: 'string' }, root: { type: 'string' },
} });
const mode = positionals[0];
if (!values.baseline || !((mode === 'scan' && values.roots && values.out) || (mode === 'worktree' && values.root))) {
  throw new Error('Use: heading-units.ts scan --baseline <ref> [--candidate <ref>] --roots <roots.json> --out <dir> | worktree --baseline <ref> [--candidate <ref>] --root <dir>');
}
const temp = await mkdtemp(join(tmpdir(), 'spectorque-h52-'));
const revisions = { baseline: commit(values.baseline), candidate: commit(values.candidate!) };
const arms = { baseline: await archiveEngine(revisions.baseline, join(temp, 'b')), candidate: await archiveEngine(revisions.candidate, join(temp, 'c')) };
const identity = { revisions, engines: { baseline: arms.baseline.ENGINE_VERSION, candidate: arms.candidate.ENGINE_VERSION } };

const totals = { roots: 0, features: 0, overLimit: 0, withHeadings: 0, changed: 0, violations: 0, transitions: {} as Record<string, number> };
const changed: { root: string; repository: string; sha: string; feature: string; transitions: Record<string, string>; headings: { path: string; line: number; text: string }[] }[] = [];
const violations: { root: string; feature: string; violations: string[] }[] = [];
const overLimit: { root: string; feature: string }[] = [];

let ordinal = 0;
async function compare(root: string, repository: string, sha: string, feature: string, set: ArtifactSet, keepText: boolean) {
  // Work-tree features are numbered, never named: no restricted text is printed.
  const label = keepText ? feature : `(work tree feature ${++ordinal})`;
  // The engine refuses such sets; they are listed, never silently dropped.
  if (set.artifacts.length > 500 || set.artifacts.some(a => a.content.length > 1_000_000)) { totals.overLimit++; overLimit.push({ root, feature: label }); return; }
  totals.features++;
  const headings = definingHeadings(set.artifacts);
  if (headings.length) totals.withHeadings++;
  const [before, after] = await Promise.all([arms.baseline.analyze(set), arms.candidate.analyze(set)]);
  const found = judge(before, after, headings);
  if (found.length) { totals.violations++; violations.push({ root, feature: label, violations: found }); }
  const transitions: Record<string, string> = {};
  for (const id of ['I1.2', 'I2.2']) {
    const b = before.practices.find(p => p.id === id)!.status; const c = after.practices.find(p => p.id === id)!.status;
    if (b !== c) { transitions[id] = `${b}->${c}`; totals.transitions[`${id} ${b}->${c}`] = (totals.transitions[`${id} ${b}->${c}`] ?? 0) + 1; }
  }
  if (Object.keys(transitions).length) {
    totals.changed++;
    if (keepText) changed.push({ root, repository, sha, feature, transitions, headings });
  }
}

if (mode === 'scan') {
  const roots = rootSchema.parse(JSON.parse(await readFile(values.roots!, 'utf8')));
  if (roots.some(root => root.restricted)) throw new Error('The H52 scan takes public roots only; use worktree mode for restricted data.');
  await mkdir(values.out!, { recursive: true, mode: 0o700 });
  for (const root of roots) {
    const { sha, files } = snapshot(root);
    totals.roots++;
    const artifacts = classifyAll(arms.baseline, files);
    const set = { name: root.id, artifacts };
    for (const feature of [...new Set(artifacts.filter(a => !a.archived && a.role === 'spec').map(a => a.featureId))].sort()) {
      await compare(root.id, root.repository, sha, feature, arms.baseline.selectFeature(set, feature), true);
    }
  }
  await writeFile(join(values.out!, 'h52-scan.json'), JSON.stringify({ kind: 'h52-scan', ...identity, totals, violations, overLimit, changed }, null, 2) + '\n', { mode: 0o600 });
} else {
  const index = await indexWorkspace(values.root!);
  totals.roots = 1;
  for (const feature of index.features) {
    await compare('work tree', '', '', feature.id, await arms.baseline.discoverWorkspace(values.root!, { feature: feature.id }, index), false);
  }
}
await rm(temp, { recursive: true, force: true });
console.log(JSON.stringify({ kind: `h52-${mode}`, ...identity, totals, violations, overLimit }, null, 2));
if (overLimit.length) console.error(`${overLimit.length} feature(s) over the analysis limit were not judged.`);
// A violated prediction fails the run.
if (totals.violations) process.exitCode = 1;
