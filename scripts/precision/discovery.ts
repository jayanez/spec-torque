/**
 * H92 (#92) discovery replay: compares what two engine revisions discover, list and score on the
 * committed Markdown of local Git roots. Per root it reports the candidate paths in workspace mode
 * (basename names) and GitHub mode (full paths), the feature list, the result of every common
 * feature, and the "All documents" and template-parent folder scopes.
 *
 *   node --import tsx scripts/precision/discovery.ts --baseline <ref> --candidate <ref> --roots <roots.json> [--out <file>]
 *
 * Public roots only: the detail names paths. Nothing is written to a root.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { archiveEngine, commit, type Engine } from './engines.js';
import { rootSchema, snapshot } from './sources.js';
import { excludedPath } from '../../src/node/scope.js';
import { githubExcluded } from '../../src/node/github.js';

const { values } = parseArgs({ options: { baseline: { type: 'string' }, candidate: { type: 'string', default: 'HEAD' }, roots: { type: 'string' }, out: { type: 'string' } } });
if (!values.baseline || !values.roots) throw new Error('Use: discovery.ts --baseline <ref> [--candidate <ref>] --roots <roots.json> [--out <file>]');

type Result = Awaited<ReturnType<Engine['analyze']>>;
type Selection = { name: string; artifacts: ReturnType<Engine['classifyArtifact']>[] };
const LIMIT = 500;
// A path with a folder named like a template, outside or inside framework folders (negative control).
const templateNamed = /(?:^|\/)[^/]*templates?[^/]*\//i;

const temp = await mkdtemp(join(tmpdir(), 'spectorque-discovery-'));
const revisions = { baseline: commit(values.baseline), candidate: commit(values.candidate!) };
// H92a prediction 6: both arms analyze "All documents" beyond the 500-document guard; hosts still apply it (`overLimit`).
const arms = { baseline: await archiveEngine(revisions.baseline, join(temp, 'baseline'), true), candidate: await archiveEngine(revisions.candidate, join(temp, 'candidate'), true) };
if (typeof (arms.candidate as { isFrameworkTemplate?: unknown }).isFrameworkTemplate !== 'function') throw new Error('The candidate does not export isFrameworkTemplate.');
const isTemplate = (arms.candidate as unknown as { isFrameworkTemplate: (path: string) => boolean }).isFrameworkTemplate;

type Finding = Result['findings'][number]; type Edge = Result['traceability'][number]; type Mark = Result['decisions'][number];
// Unlike replay.ts, a finding is keyed by every evidence location, so a cross-document finding that loses a template line counts as changed.
const findingKey = (f: Finding) => `${f.practiceId}|${f.evidence.map(e => `${e.path}:${e.line}`).join(',')}|${f.message}`;
const markKey = (e: Mark) => `${e.path}:${e.line}|${e.text}`;
const edgeKey = (t: Edge) => `${t.from}>${t.to}|${t.resolved}|${markKey(t.evidence)}`;
const comparable = (r: Result) => JSON.stringify({ ...r, id: undefined, createdAt: undefined, engineVersion: undefined });
const overLimit = (set: Selection) => set.artifacts.length > LIMIT || set.artifacts.some(a => a.content.length > 1_000_000);
const hasSpec = (set: Selection) => set.artifacts.some(a => a.role === 'spec' && !a.archived && !isTemplate(a.path));

function diff<T>(before: T[], after: T[], key: (item: T) => string) {
  const [b, a] = [new Map(before.map(i => [key(i), i])), new Map(after.map(i => [key(i), i]))];
  return { removed: [...b].filter(([k]) => !a.has(k)).map(([, i]) => i), added: [...a].filter(([k]) => !b.has(k)).map(([, i]) => i) };
}

/**
 * H92a prediction 5. Items citing a template may go. Otherwise, in a *kept* scope (a non-template spec remains)
 * nothing is removed, except a resolved edge to a template-defined ID that comes back unresolved, and only an
 * undefined-reference finding or unresolved edge for a template-defined ID may be added. In an *emptied* scope
 * a finding may go only when its practice is `unknown` in the candidate, an edge only when its target is
 * template-defined, and nothing is added. Returns every item that breaks the prediction.
 */
function scopeDiff(before: Result, after: Result, selected: { baseline: Selection; candidate: Selection }) {
  const statuses: Record<string, number> = {};
  for (const id of new Set([...before.practices, ...after.practices].map(p => p.id))) {
    const [b, a] = [before.practices.find(q => q.id === id)?.status ?? 'absent', after.practices.find(q => q.id === id)?.status ?? 'absent'];
    if (b !== a) statuses[`${id}:${b}->${a}`] = (statuses[`${id}:${b}->${a}`] ?? 0) + 1;
  }
  const kind = hasSpec(selected.candidate) ? 'kept' : 'emptied';
  const templateText = selected.baseline.artifacts.filter(a => isTemplate(a.path)).map(a => a.content).join('\n');
  const specText = selected.baseline.artifacts.filter(a => a.role === 'spec' && !isTemplate(a.path)).map(a => a.content).join('\n');
  const word = (id: string) => new RegExp(`(?<![\\w-])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`);
  const templateDefined = (id: string) => word(id).test(templateText) && !word(id).test(specText);
  const undefinedRef = (f: Finding) => /^Reference (\S+) has no definition/.exec(f.message)?.[1];
  const status = (id: string) => after.practices.find(p => p.id === id)?.status;
  const cites = (paths: string[]) => paths.some(isTemplate);
  const findings = diff(before.findings, after.findings, findingKey);
  const decisions = diff(before.decisions, after.decisions, markKey);
  const edges = diff(before.traceability, after.traceability, edgeKey);
  const addedEdge = new Set(edges.added.map(t => `${t.from}>${t.to}|${markKey(t.evidence)}`));
  const breaks: string[] = [];
  for (const f of findings.removed) if (!cites(f.evidence.map(e => e.path)) && !(kind === 'emptied' && status(f.practiceId) === 'unknown')) breaks.push(`finding-removed ${findingKey(f)}`);
  for (const f of findings.added) if (!cites(f.evidence.map(e => e.path))) {
    const id = undefinedRef(f);
    if (!(kind === 'kept' && f.practiceId === 'I2.3' && id && templateDefined(id))) breaks.push(`finding-added ${findingKey(f)}`);
  }
  for (const e of decisions.removed) if (!cites([e.path])) breaks.push(`decision-removed ${markKey(e)}`);
  for (const e of decisions.added) if (!cites([e.path])) breaks.push(`decision-added ${markKey(e)}`);
  for (const t of edges.removed) if (!cites([t.evidence.path])) {
    const back = t.resolved && addedEdge.has(`${t.from}>${t.to}|${markKey(t.evidence)}`);
    if (!(templateDefined(t.to) && (kind === 'emptied' || back))) breaks.push(`edge-removed ${edgeKey(t)}`);
  }
  for (const t of edges.added) if (!cites([t.evidence.path]) && !(kind === 'kept' && !t.resolved && templateDefined(t.to))) breaks.push(`edge-added ${edgeKey(t)}`);
  const count = <T>(d: { removed: T[]; added: T[] }) => ({ removed: d.removed.length, added: d.added.length });
  return { kind, findings: count(findings), decisions: count(decisions), traceability: count(edges), breaks, statuses, score: [before.summary.score, after.summary.score] as const };
}

/** Evidence is valid when its line exists at its path and the line starts with the cited text. */
const linesOf = new Map<string, string[]>();
function invalidEvidence(result: Result, files: Map<string, string>) {
  let invalid = 0;
  const all = [...result.findings.flatMap(f => f.evidence), ...result.decisions, ...result.practices.flatMap(p => p.evidence)];
  for (const e of all) {
    if (!linesOf.has(e.path)) linesOf.set(e.path, (files.get(e.path) ?? '').replace(/^\uFEFF/, '').split(/\r?\n/));
    const line = linesOf.get(e.path)![e.line - 1];
    if (line === undefined || !e.text.trim() || !line.trim().startsWith(e.text.trim().slice(0, 200))) invalid++;
  }
  return invalid;
}

const roots = rootSchema.parse(JSON.parse((await readFile(values.roots)).toString()));
if (!roots.length) throw new Error('No roots.');
const totals = {
  roots: 0, rootsWithTemplates: 0,
  workspace: { baseline: 0, candidate: 0, removed: 0, removedNotTemplate: 0, added: 0 },
  github: { baseline: 0, candidate: 0, removed: 0, removedNotTemplate: 0, added: 0 },
  features: { baseline: 0, candidate: 0, removed: 0, removedWithNonTemplateFile: 0, added: 0, countChanged: 0, orderChangedRoots: 0 },
  commonFeatures: { analyzed: 0, overLimit: 0, changed: 0 },
  scopes: { analyzed: 0, kept: 0, emptied: 0, overLimit: 0, overLimitScopes: [] as string[], allBeyondHostLimit: [] as string[], changed: 0,
    findings: { removed: 0, added: 0 }, decisions: { removed: 0, added: 0 }, traceability: { removed: 0, added: 0 }, breaks: 0,
    statusChanges: {} as Record<string, number>, scoreUp: 0, scoreDown: 0 },
  // Roots whose index exceeds the read limit in the baseline and fits it in the candidate (hosts read them at once).
  newlyReadable: [] as string[],
  keptTemplateNamed: 0, keptTemplateNamedRoots: 0,
  evidenceInvalid: { baseline: 0, candidate: 0 },
};
const detail: unknown[] = [];
for (const root of roots) {
  if (root.restricted) throw new Error('Restricted roots are not supported: the detail names paths.');
  const { sha, files } = snapshot(root);
  linesOf.clear();
  totals.roots++;
  const md = [...files.keys()];
  const discover = (engine: Engine, basename: boolean) => md.filter(p => engine.isSpecCandidate(p, basename) && !(basename ? excludedPath(p) : githubExcluded(p)));
  const modes = { workspace: { baseline: discover(arms.baseline, true), candidate: discover(arms.candidate, true) }, github: { baseline: discover(arms.baseline, false), candidate: discover(arms.candidate, false) } };
  const removedPaths: string[] = [];
  for (const mode of ['workspace', 'github'] as const) {
    const { baseline, candidate } = modes[mode]; const c = new Set(candidate); const b = new Set(baseline);
    const removed = baseline.filter(p => !c.has(p));
    const t = totals[mode];
    t.baseline += baseline.length; t.candidate += candidate.length; t.removed += removed.length;
    t.removedNotTemplate += removed.filter(p => !isTemplate(p)).length; t.added += candidate.filter(p => !b.has(p)).length;
    if (mode === 'workspace') removedPaths.push(...removed);
  }
  if (removedPaths.length) totals.rootsWithTemplates++;
  if (modes.workspace.baseline.length > LIMIT && modes.workspace.candidate.length <= LIMIT) totals.newlyReadable.push(root.id);
  const kept = modes.workspace.candidate.filter(p => templateNamed.test(p));
  totals.keptTemplateNamed += kept.length; if (kept.length) totals.keptTemplateNamedRoots++;

  const sets = {
    baseline: { name: root.id, artifacts: modes.workspace.baseline.map(p => arms.baseline.classifyArtifact(p, files.get(p)!)) },
    candidate: { name: root.id, artifacts: modes.workspace.candidate.map(p => arms.candidate.classifyArtifact(p, files.get(p)!)) },
  };
  const lists = { baseline: arms.baseline.listFeatures(sets.baseline.artifacts), candidate: arms.candidate.listFeatures(sets.candidate.artifacts) };
  const after = new Map(lists.candidate.map(f => [f.id, f]));
  const removedFeatures = lists.baseline.filter(f => !after.has(f.id));
  const before = new Map(lists.baseline.map(f => [f.id, f]));
  totals.features.baseline += lists.baseline.length; totals.features.candidate += lists.candidate.length;
  totals.features.removed += removedFeatures.length; totals.features.added += lists.candidate.filter(f => !before.has(f.id)).length;
  totals.features.removedWithNonTemplateFile += removedFeatures.filter(f => sets.baseline.artifacts.some(a => a.featureId === f.id && a.role !== 'instructions' && !isTemplate(a.path))).length;
  const common = lists.candidate.filter(f => before.has(f.id));
  totals.features.countChanged += common.filter(f => before.get(f.id)!.artifacts !== f.artifacts).length;
  const orderBefore = lists.baseline.filter(f => after.has(f.id)).map(f => f.id);
  const orderChanged = JSON.stringify(orderBefore) !== JSON.stringify(common.map(f => f.id));
  if (orderChanged) totals.features.orderChangedRoots++;

  const changedFeatures: string[] = [];
  for (const feature of common) {
    const selected = { baseline: arms.baseline.selectFeature(sets.baseline, feature.id), candidate: arms.candidate.selectFeature(sets.candidate, feature.id) };
    if (overLimit(selected.baseline) || overLimit(selected.candidate)) { totals.commonFeatures.overLimit++; continue; }
    totals.commonFeatures.analyzed++;
    const [b, c] = await Promise.all([arms.baseline.analyze(selected.baseline), arms.candidate.analyze(selected.candidate)]);
    totals.evidenceInvalid.baseline += invalidEvidence(b, files); totals.evidenceInvalid.candidate += invalidEvidence(c, files);
    if (comparable(b) !== comparable(c)) { totals.commonFeatures.changed++; changedFeatures.push(feature.id); }
  }

  // "All documents" plus each template folder's framework folder and the project folder above it.
  const prefixes = new Set<string>(['']);
  for (const p of removedPaths) {
    const m = /^(.*?)(?:^|\/)\.(?:specify|kittify)\//i.exec(p);
    if (!m) continue; // Not a template: counted in removedNotTemplate, which fails the gate.
    const framework = p.slice(0, m[0].length - 1);
    prefixes.add(framework); if (m[1]) prefixes.add(m[1]);
  }
  const scopes: unknown[] = [];
  if (removedPaths.length) for (const prefix of [...prefixes].sort()) {
    const pick = (engine: Engine, set: Selection) => prefix === '' ? set : { ...set, artifacts: set.artifacts.filter(a => engine.inPathScope(a, [prefix])) };
    const selected = { baseline: pick(arms.baseline, sets.baseline), candidate: pick(arms.candidate, sets.candidate) };
    // Folder scopes keep the host limit; "All documents" is compared beyond it (prediction 6), within 1 MB per document.
    const hostOver = overLimit(selected.baseline) || overLimit(selected.candidate);
    const tooLarge = [selected.baseline, selected.candidate].some(set => set.artifacts.some(a => a.content.length > 1_000_000));
    if ((hostOver && prefix !== '') || tooLarge) { totals.scopes.overLimit++; totals.scopes.overLimitScopes.push(`${root.id}:${prefix || '(all)'}`); scopes.push({ prefix: prefix || '(all)', overLimit: true }); continue; }
    if (hostOver) totals.scopes.allBeyondHostLimit.push(root.id);
    totals.scopes.analyzed++;
    const [b, c] = await Promise.all([arms.baseline.analyze(selected.baseline), arms.candidate.analyze(selected.candidate)]);
    totals.evidenceInvalid.baseline += invalidEvidence(b, files); totals.evidenceInvalid.candidate += invalidEvidence(c, files);
    const d = scopeDiff(b, c, selected);
    const s = totals.scopes;
    s[d.kind as 'kept' | 'emptied']++;
    if (comparable(b) !== comparable(c)) s.changed++;
    for (const k of ['findings', 'decisions', 'traceability'] as const) { s[k].removed += d[k].removed; s[k].added += d[k].added; }
    s.breaks += d.breaks.length;
    for (const [k, n] of Object.entries(d.statuses)) s.statusChanges[k] = (s.statusChanges[k] ?? 0) + n;
    if ((c.summary.score ?? -1) > (b.summary.score ?? -1)) s.scoreUp++; else if ((c.summary.score ?? -1) < (b.summary.score ?? -1)) s.scoreDown++;
    scopes.push({ prefix: prefix || '(all)', artifacts: [selected.baseline.artifacts.length, selected.candidate.artifacts.length], ...d });
  }
  detail.push({ root: root.id, repository: root.repository, revision: sha, removedPaths, removedFeatures: removedFeatures.map(f => f.id),
    orderChanged, changedFeatures, keptTemplateNamed: kept, scopes });
}
await rm(temp, { recursive: true, force: true });
const report = { revisions, engines: { baseline: arms.baseline.ENGINE_VERSION, candidate: arms.candidate.ENGINE_VERSION }, totals };
if (values.out) await writeFile(values.out, JSON.stringify({ ...report, detail }, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
