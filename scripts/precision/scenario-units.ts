/**
 * H52c replay (#52): scenario steps with a modal as requirement lines. Compares two committed engine
 * revisions on the synthetic twins, on every feature of pinned public roots, or on a local work tree
 * (counts only), and judges each feature with `scenario-judge.ts`. A violated prediction fails the run.
 *
 *   scenario-units.ts synthetic --baseline <ref> [--candidate <ref>] [--fixture fixtures/precision/h52c-pairs.json]
 *   scenario-units.ts scan --baseline <ref> [--candidate <ref>] --roots <roots.json> --out <dir>
 *   scenario-units.ts worktree --baseline <ref> [--candidate <ref>] --root <dir>
 *
 * `scan` writes the entering lines of every changed feature to `<out>/h52c-scan.json` for the blind
 * packet. `worktree` prints counts only and stores no document text.
 */
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { indexWorkspace } from '../../src/node/scope.js';
import type { Assessment, ArtifactSet } from '../../src/core/types.js';
import { archiveEngine, commit, repository } from './engines.js';
import { enteringLines, judge } from './scenario-judge.js';
import { classifyAll, rootSchema, snapshot, statusSchema } from './sources.js';

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  baseline: { type: 'string' }, candidate: { type: 'string', default: 'HEAD' }, fixture: { type: 'string', default: 'fixtures/precision/h52c-pairs.json' },
  roots: { type: 'string' }, out: { type: 'string' }, root: { type: 'string' },
} });
const mode = positionals[0];
if (!values.baseline || !(mode === 'synthetic' || (mode === 'scan' && values.roots && values.out) || (mode === 'worktree' && values.root))) {
  throw new Error('Use: scenario-units.ts synthetic|scan|worktree --baseline <ref> [--candidate <ref>] (scan: --roots <roots.json> --out <dir>; worktree: --root <dir>)');
}
const temp = await mkdtemp(join(tmpdir(), 'spectorque-h52c-'));
const revisions = { baseline: commit(values.baseline), candidate: commit(values.candidate!) };
const arms = { baseline: await archiveEngine(revisions.baseline, join(temp, 'b')), candidate: await archiveEngine(revisions.candidate, join(temp, 'c')) };
const identity = { revisions, engines: { baseline: arms.baseline.ENGINE_VERSION, candidate: arms.candidate.ENGINE_VERSION } };
const keyOf = (f: Assessment['findings'][number]) => `${f.practiceId}|${f.evidence[0]?.path}|${f.evidence[0]?.line}|${f.message}`;
let failed = false;

if (mode === 'synthetic') {
  const fixture = z.strictObject({ version: z.literal(1), description: z.string(), cases: z.array(z.strictObject({
    id: z.string(), construct: z.string(), language: z.enum(['en', 'es']), files: z.record(z.string(), z.array(z.string())),
    findings: z.array(z.string()), status: z.record(z.string(), statusSchema), note: z.string(),
  })) }).parse(JSON.parse(await readFile(join(repository, values.fixture!), 'utf8')));
  const rows = [];
  for (const entry of fixture.cases) {
    const run = async (engine: typeof arms.baseline) => {
      const a = await engine.analyze({ name: entry.id, artifacts: Object.entries(entry.files).map(([path, lines]) => engine.classifyArtifact(path, lines.join('\n') + '\n')) });
      return { findings: a.findings.map(keyOf).sort(), status: Object.fromEntries(Object.keys(entry.status).map(id => [id, a.practices.find(p => p.id === id)?.status])) };
    };
    const [b, c] = [await run(arms.baseline), await run(arms.candidate)];
    const meets = (arm: typeof b) => JSON.stringify(arm.findings) === JSON.stringify([...entry.findings].sort()) && JSON.stringify(arm.status) === JSON.stringify(entry.status);
    rows.push({ id: entry.id, construct: entry.construct, baseline: b, candidate: c, baselineMeets: meets(b), candidateMeets: meets(c) });
  }
  const summary = { cases: rows.length, baselineMeets: rows.filter(r => r.baselineMeets).length, candidateMeets: rows.filter(r => r.candidateMeets).length,
    regressions: rows.filter(r => r.baselineMeets && !r.candidateMeets).map(r => r.id), unmet: rows.filter(r => !r.candidateMeets).map(r => r.id) };
  failed = summary.unmet.length > 0;
  console.log(JSON.stringify({ kind: 'h52c-synthetic', ...identity, summary, rows }, null, 2));
} else {
  const totals = { roots: 0, features: 0, withEntering: 0, changed: 0, transitions: {} as Record<string, number> };
  const changed: { root: string; repository: string; sha: string; feature: string; entering: { path: string; line: number; text: string }[] }[] = [];
  const violations: { root: string; feature: string; violations: string[] }[] = [];
  const overLimit: { root: string; feature: string }[] = [];
  let ordinal = 0;
  const compare = async (root: string, repo: string, sha: string, feature: string, set: ArtifactSet, keepText: boolean) => {
    // Work-tree features are numbered, never named: no restricted text is printed.
    const label = keepText ? feature : `(work tree feature ${++ordinal})`;
    if (set.artifacts.length > 500 || set.artifacts.some(a => a.content.length > 1_000_000)) { overLimit.push({ root, feature: label }); return; }
    totals.features++;
    const entering = enteringLines(set.artifacts);
    if (entering.length) totals.withEntering++;
    const [before, after] = [await arms.baseline.analyze(set), await arms.candidate.analyze(set)];
    const found = judge(before, after, entering);
    if (found.length) violations.push({ root, feature: label, violations: found });
    let moved = false;
    for (const p of before.practices) {
      const next = after.practices.find(q => q.id === p.id)!.status;
      if (p.status !== next) { moved = true; const t = `${p.id} ${p.status}->${next}`; totals.transitions[t] = (totals.transitions[t] ?? 0) + 1; }
    }
    if (moved || JSON.stringify(before.findings.map(keyOf)) !== JSON.stringify(after.findings.map(keyOf))) {
      totals.changed++;
      if (keepText) changed.push({ root, repository: repo, sha, feature, entering: entering.map(({ path, line, text }) => ({ path, line, text })) });
    }
  };
  if (mode === 'scan') {
    const roots = rootSchema.parse(JSON.parse(await readFile(values.roots!, 'utf8')));
    if (roots.some(root => root.restricted)) throw new Error('The H52c scan takes public roots only; use worktree mode for restricted data.');
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
    await writeFile(join(values.out!, 'h52c-scan.json'), JSON.stringify({ kind: 'h52c-scan', ...identity, totals, violations, overLimit, changed }, null, 2) + '\n', { mode: 0o600 });
  } else {
    const index = await indexWorkspace(values.root!);
    totals.roots = 1;
    for (const feature of index.features) await compare('work tree', '', '', feature.id, await arms.baseline.discoverWorkspace(values.root!, { feature: feature.id }, index), false);
  }
  failed = violations.length > 0;
  console.log(JSON.stringify({ kind: `h52c-${mode}`, ...identity, totals, violations, overLimit }, null, 2));
  if (overLimit.length) console.error(`${overLimit.length} feature(s) over the analysis limit were not judged.`);
}
await rm(temp, { recursive: true, force: true });
if (failed) process.exitCode = 1;
