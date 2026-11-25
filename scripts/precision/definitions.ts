/**
 * H3 replay (#83): requirement definitions. Compares I1.2 and I2.3 findings between two committed
 * engine revisions on the synthetic twins and on whole features of pinned public roots.
 * H8 (#80) also compares the reference statuses (I2.3, C1.3, C2.3); a twin may pin them in `status`.
 *
 *   synthetic: fixtures/precision/h3-pairs.json, expected findings per case.
 *   scan:      every Spec Kit feature of each root, analyzed whole (definitions cross lines).
 */
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { archiveEngine, commit, repository, type Engine } from './engines.js';
import { rootSchema, snapshot } from './sources.js';

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  baseline: { type: 'string' }, candidate: { type: 'string', default: 'HEAD' },
  fixture: { type: 'string', default: 'fixtures/precision/h3-pairs.json' }, roots: { type: 'string' }, out: { type: 'string' },
} });
const mode = positionals[0];
if (!['synthetic', 'scan'].includes(mode ?? '') || !values.baseline || (mode === 'scan' && (!values.roots || !values.out))) {
  throw new Error('Use: definitions.ts synthetic --baseline <ref> [--candidate <ref>] | scan --baseline <ref> --roots <roots.json> --out <dir>');
}
const fixtureSchema = z.strictObject({ version: z.literal(1), description: z.string(), cases: z.array(z.strictObject({
  id: z.string(), construct: z.string(), language: z.enum(['en', 'es']), files: z.record(z.string(), z.array(z.string())),
  expected: z.array(z.string()), status: z.record(z.string(), z.string()).optional(), note: z.string(),
})) });
const ENDPOINTS = new Set(['I1.2', 'I2.3']);
const keyOf = (f: { practiceId: string; message: string; evidence: { path: string; line: number }[] }) => `${f.practiceId}|${f.evidence[0]?.path}|${f.evidence[0]?.line}|${f.message}`;
async function endpointFindings(engine: Engine, files: Record<string, string>) {
  const set = { name: 'h3', artifacts: Object.entries(files).map(([path, content]) => engine.classifyArtifact(path, content)) };
  const assessment = await engine.analyze(set);
  const practice = (id: string) => assessment.practices.find(p => p.id === id)?.status;
  const status: Record<string, string | undefined> = Object.fromEntries(['I1.2', 'I2.2', 'I2.3', 'C1.3', 'C2.3'].map(id => [id, practice(id)]));
  return { findings: assessment.findings.filter(f => ENDPOINTS.has(f.practiceId)).map(keyOf).sort(), status };
}
const temp = await mkdtemp(join(tmpdir(), 'spectorque-h3-'));
const revisions = { baseline: commit(values.baseline), candidate: commit(values.candidate!) };
const arms = { baseline: await archiveEngine(revisions.baseline, join(temp, 'b')), candidate: await archiveEngine(revisions.candidate, join(temp, 'c')) };
const identity = { revisions, engines: { baseline: arms.baseline.ENGINE_VERSION, candidate: arms.candidate.ENGINE_VERSION } };

if (mode === 'synthetic') {
  const fixture = fixtureSchema.parse(JSON.parse(await readFile(join(repository, values.fixture!), 'utf8')));
  const rows = [];
  for (const entry of fixture.cases) {
    const files = Object.fromEntries(Object.entries(entry.files).map(([path, lines]) => [path, lines.join('\n') + '\n']));
    const [baseline, candidate] = await Promise.all([endpointFindings(arms.baseline, files), endpointFindings(arms.candidate, files)]);
    const expected = [...entry.expected].sort();
    const meets = (arm: typeof baseline) => JSON.stringify(arm.findings) === JSON.stringify(expected) &&
      Object.entries(entry.status ?? {}).every(([id, value]) => arm.status[id] === value);
    rows.push({ id: entry.id, construct: entry.construct, language: entry.language, expected, expectedStatus: entry.status,
      baseline: baseline.findings, candidate: candidate.findings, baselineStatus: baseline.status, candidateStatus: candidate.status,
      baselineMeets: meets(baseline), candidateMeets: meets(candidate) });
  }
  const summary = { cases: rows.length, baselineMeets: rows.filter(r => r.baselineMeets).length, candidateMeets: rows.filter(r => r.candidateMeets).length,
    regressions: rows.filter(r => r.baselineMeets && !r.candidateMeets).map(r => r.id), unmet: rows.filter(r => !r.candidateMeets).map(r => r.id) };
  console.log(JSON.stringify({ kind: 'h3-synthetic', ...identity, summary, rows }, null, 2));
} else {
  const roots = rootSchema.parse(JSON.parse(await readFile(values.roots!, 'utf8')));
  await mkdir(values.out!, { recursive: true, mode: 0o700 });
  const totals = { roots: 0, features: 0, removed: 0, added: 0, unchanged: 0, statusChanges: 0 };
  const detail = [];
  for (const root of roots) {
    const { sha, files } = snapshot(root);
    totals.roots++;
    const artifacts = [...files].filter(([path]) => arms.baseline.isSpecCandidate(path)).map(([path, content]) => arms.baseline.classifyArtifact(path, content));
    const features = [...new Set(artifacts.filter(a => !a.archived && a.role === 'spec' && a.framework === 'spec-kit').map(a => a.featureId))].sort();
    for (const feature of features) {
      const scope = arms.baseline.selectFeature({ name: root.id, artifacts }, feature);
      if (scope.artifacts.length > 500) continue;
      const contents = Object.fromEntries(scope.artifacts.map(a => [a.path, a.content]));
      const [b, c] = await Promise.all([endpointFindings(arms.baseline, contents), endpointFindings(arms.candidate, contents)]);
      const removed = b.findings.filter(k => !c.findings.includes(k)); const added = c.findings.filter(k => !b.findings.includes(k));
      totals.features++; totals.removed += removed.length; totals.added += added.length; totals.unchanged += b.findings.filter(k => c.findings.includes(k)).length;
      const statusChanged = JSON.stringify(b.status) !== JSON.stringify(c.status);
      if (statusChanged) totals.statusChanges++;
      if (removed.length || added.length || statusChanged) detail.push({ root: root.id, repository: root.repository, sha, feature, removed, added, status: { baseline: b.status, candidate: c.status } });
    }
  }
  await writeFile(join(values.out!, 'h3-scan.json'), JSON.stringify({ kind: 'h3-scan', ...identity, totals, detail }, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify({ kind: 'h3-scan', ...identity, totals }, null, 2));
}
