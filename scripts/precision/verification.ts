/**
 * H6 replay (#88): verification criteria (E3.1), validation methods (E3.2) and Spec Kit
 * quickstart.md as a feature artifact. Compares two committed engine revisions.
 *
 *   synthetic: fixtures/precision/h6-pairs.json, expected practice status per case (E3.1/E3.2 for
 *              H6); a case may also fix its findings, artifact roles and decision count (H6a, H7).
 *   scan:      every Spec Kit feature of each root. Each arm discovers with the work-tree rule
 *              (basename only) and classifies with its own rules, so a discovery change is part
 *              of the comparison.
 */
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { archiveEngine, commit, repository, type Engine } from './engines.js';
import { rootSchema, snapshot, statusSchema as status } from './sources.js';

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  baseline: { type: 'string' }, candidate: { type: 'string', default: 'HEAD' },
  fixture: { type: 'string', default: 'fixtures/precision/h6-pairs.json' }, roots: { type: 'string' }, out: { type: 'string' },
} });
const mode = positionals[0];
if (!['synthetic', 'scan'].includes(mode ?? '') || !values.baseline || (mode === 'scan' && (!values.roots || !values.out))) {
  throw new Error('Use: verification.ts synthetic --baseline <ref> [--candidate <ref>] | scan --baseline <ref> --roots <roots.json> --out <dir>');
}
const fixtureSchema = z.strictObject({ version: z.literal(1), description: z.string(), cases: z.array(z.strictObject({
  id: z.string(), construct: z.string(), language: z.enum(['en', 'es']), files: z.record(z.string(), z.array(z.string())),
  // H85: any practice may be an endpoint. H7: a case may also fix roles and the decision count.
  expected: z.record(z.string().regex(/^[A-Z]\d\.\d$/u), status), findings: z.array(z.string()).optional(),
  roles: z.record(z.string(), z.enum(['spec', 'plan', 'tasks', 'instructions', 'context'])).optional(),
  decisions: z.number().int().nonnegative().optional(), note: z.string(),
})) });

async function assess(engine: Engine, files: Map<string, string> | Record<string, string>, feature?: string) {
  const entries = files instanceof Map ? [...files] : Object.entries(files);
  const artifacts = entries.filter(([path]) => engine.isSpecCandidate(path, true)).map(([path, content]) => engine.classifyArtifact(path, content));
  const set = engine.selectFeature({ name: 'h6', artifacts }, feature ?? null);
  if (set.artifacts.length > 500) return undefined;
  const report = await engine.analyze(set);
  const findings: Record<string, number> = {};
  for (const f of report.findings) findings[f.practiceId] = (findings[f.practiceId] ?? 0) + 1;
  return {
    roles: Object.fromEntries(set.artifacts.map(a => [a.path, a.role])),
    status: Object.fromEntries(report.practices.map(p => [p.id, p.status])),
    evidence: Object.fromEntries(report.practices.map(p => [p.id, p.evidence])),
    dimensions: Object.fromEntries(report.dimensions.map(d => [d.id, d.score])),
    findings, decisions: report.decisions.length, decisionLines: report.decisions,
    findingKeys: report.findings.map(f => `${f.practiceId}|${f.evidence[0]?.path}|${f.evidence[0]?.line}`).sort(),
    // H85: structured findings with their line text, for removed/added finding lists.
    findingLines: report.findings.map(f => ({ practiceId: f.practiceId, path: f.evidence[0]?.path ?? '', line: f.evidence[0]?.line ?? 0, message: f.message, text: f.evidence[0]?.text ?? '' })),
  };
}
const findingKey = (f: { practiceId: string; path: string; line: number; message: string }) => `${f.practiceId}|${f.path}|${f.line}|${f.message}`;
const temp = await mkdtemp(join(tmpdir(), 'spectorque-h6-'));
const revisions = { baseline: commit(values.baseline), candidate: commit(values.candidate!) };
const arms = { baseline: await archiveEngine(revisions.baseline, join(temp, 'b')), candidate: await archiveEngine(revisions.candidate, join(temp, 'c')) };
const identity = { revisions, engines: { baseline: arms.baseline.ENGINE_VERSION, candidate: arms.candidate.ENGINE_VERSION } };

if (mode === 'synthetic') {
  const fixture = fixtureSchema.parse(JSON.parse(await readFile(join(repository, values.fixture!), 'utf8')));
  const rows = [];
  for (const entry of fixture.cases) {
    const files = Object.fromEntries(Object.entries(entry.files).map(([path, lines]) => [path, lines.join('\n') + '\n']));
    const feature = Object.keys(files).map(p => arms.baseline.classifyPath(p).featureId).find(id => id.includes('specs/'));
    const [b, c] = await Promise.all([assess(arms.baseline, files, feature), assess(arms.candidate, files, feature)]);
    const pick = (r: typeof b) => Object.fromEntries(Object.keys(entry.expected).map(id => [id, r?.status[id]]));
    const baseline = pick(b); const candidate = pick(c);
    // H6a: a case may also fix the complete finding list (practice|path|line). H7: and roles and decisions.
    const rolesOf = (r: typeof b) => entry.roles && Object.fromEntries(Object.keys(entry.roles).map(path => [path, r?.roles[path]]));
    const meets = (r: typeof b, statuses: Record<string, unknown>) => JSON.stringify(statuses) === JSON.stringify(entry.expected) &&
      (!entry.findings || JSON.stringify(r?.findingKeys) === JSON.stringify([...entry.findings].sort())) &&
      (!entry.roles || JSON.stringify(rolesOf(r)) === JSON.stringify(entry.roles)) &&
      (entry.decisions === undefined || r?.decisions === entry.decisions);
    rows.push({ id: entry.id, construct: entry.construct, language: entry.language, expected: entry.expected, expectedFindings: entry.findings, baseline, candidate,
      baselineFindings: entry.findings ? b?.findingKeys : undefined, candidateFindings: entry.findings ? c?.findingKeys : undefined,
      baselineRoles: rolesOf(b), candidateRoles: rolesOf(c),
      baselineDecisions: entry.decisions === undefined ? undefined : b?.decisions, candidateDecisions: entry.decisions === undefined ? undefined : c?.decisions,
      baselineMeets: meets(b, baseline), candidateMeets: meets(c, candidate) });
  }
  const summary = { cases: rows.length, baselineMeets: rows.filter(r => r.baselineMeets).length, candidateMeets: rows.filter(r => r.candidateMeets).length,
    regressions: rows.filter(r => r.baselineMeets && !r.candidateMeets).map(r => r.id), unmet: rows.filter(r => !r.candidateMeets).map(r => r.id) };
  console.log(JSON.stringify({ kind: 'h6-synthetic', ...identity, summary, rows }, null, 2));
} else {
  const roots = rootSchema.parse(JSON.parse(await readFile(values.roots!, 'utf8')));
  await mkdir(values.out!, { recursive: true, mode: 0o700 });
  const rank = { missing: 0, partial: 1, supported: 2 } as Record<string, number>;
  const totals = { roots: 0, features: 0, changedFeatures: 0, artifactsAdded: 0, statusUp: {} as Record<string, number>, statusDown: {} as Record<string, number>,
    findingsAdded: {} as Record<string, number>, findingsRemoved: {} as Record<string, number>, dimensionsUp: 0, dimensionsDown: 0, decisionsAdded: 0 };
  const bump = (bag: Record<string, number>, key: string, n = 1) => { bag[key] = (bag[key] ?? 0) + n; };
  const detail = [];
  for (const root of roots) {
    const { sha, files } = snapshot(root);
    totals.roots++;
    const artifacts = [...files].filter(([path]) => arms.baseline.isSpecCandidate(path, true)).map(([path, content]) => arms.baseline.classifyArtifact(path, content));
    const features = [...new Set(artifacts.filter(a => !a.archived && a.role === 'spec' && a.framework === 'spec-kit').map(a => a.featureId))].sort();
    for (const feature of features) {
      const [b, c] = await Promise.all([assess(arms.baseline, files, feature), assess(arms.candidate, files, feature)]);
      if (!b || !c) continue;
      totals.features++;
      // Discovery additions by path; reclassified files are reported as roleChanges.
      const added = Object.keys(c.roles).filter(p => !(p in b.roles));
      totals.artifactsAdded += added.length;
      const changes = Object.keys(c.status).filter(id => c.status[id] !== b.status[id]).map(id => ({ id, from: b.status[id], to: c.status[id] }));
      for (const ch of changes) bump((rank[ch.to] ?? -1) > (rank[ch.from] ?? -1) ? totals.statusUp : totals.statusDown, ch.id);
      const findingDelta = Object.fromEntries([...new Set([...Object.keys(b.findings), ...Object.keys(c.findings)])]
        .map(id => [id, (c.findings[id] ?? 0) - (b.findings[id] ?? 0)]).filter(([, n]) => n !== 0));
      for (const [id, n] of Object.entries(findingDelta)) bump(Number(n) > 0 ? totals.findingsAdded : totals.findingsRemoved, id, Math.abs(Number(n)));
      for (const id of Object.keys(c.dimensions)) {
        if (c.dimensions[id] !== null && b.dimensions[id] !== null && c.dimensions[id]! > b.dimensions[id]!) totals.dimensionsUp++;
        if (c.dimensions[id] !== null && b.dimensions[id] !== null && c.dimensions[id]! < b.dimensions[id]!) totals.dimensionsDown++;
      }
      totals.decisionsAdded += c.decisions - b.decisions;
      const [bKeys, cKeys] = [b, c].map(r => new Set(r.findingLines.map(findingKey)));
      const findingsRemoved = b.findingLines.filter(f => !cKeys.has(findingKey(f)));
      const findingsAdded = c.findingLines.filter(f => !bKeys.has(findingKey(f)));
      // H7: role changes, the exact finding locations each arm reports and the removed decision lines.
      const roleChanges = Object.keys(c.roles).filter(path => b.roles[path] && b.roles[path] !== c.roles[path]).map(path => ({ path, from: b.roles[path], to: c.roles[path] }));
      const before = new Set(b.findingKeys); const after = new Set(c.findingKeys);
      const removedFindings = b.findingKeys.filter(k => !after.has(k)); const addedFindings = c.findingKeys.filter(k => !before.has(k));
      const kept = new Set(c.decisionLines.map(l => `${l.path}:${l.line}`));
      if (added.length || roleChanges.length || changes.length || Object.keys(findingDelta).length || findingsRemoved.length || findingsAdded.length || c.decisions !== b.decisions) {
        totals.changedFeatures++;
        detail.push({ root: root.id, repository: root.repository, sha, feature, added, roleChanges, changes, findingDelta, findingsRemoved, findingsAdded, removedFindings, addedFindings,
          decisions: { baseline: b.decisions, candidate: c.decisions }, evidence: Object.fromEntries(changes.map(ch => [ch.id, c.evidence[ch.id]])),
          baselineEvidence: Object.fromEntries(changes.map(ch => [ch.id, b.evidence[ch.id]])),
          removedDecisions: b.decisionLines.filter(l => !kept.has(`${l.path}:${l.line}`)) });
      }
    }
  }
  await writeFile(join(values.out!, 'h6-scan.json'), JSON.stringify({ kind: 'h6-scan', ...identity, totals, detail }, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify({ kind: 'h6-scan', ...identity, totals }, null, 2));
}
