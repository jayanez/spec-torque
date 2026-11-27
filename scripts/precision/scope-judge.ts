/** H92a (#92) prediction 5: judges one scope's changes after discovery drops framework templates. */
import type { Assessment, Artifact } from '../../src/core/types.js';

type Result = Assessment;
type Selection = { name: string; artifacts: Artifact[] };
type Finding = Result['findings'][number]; type Edge = Result['traceability'][number]; type Mark = Result['decisions'][number];
// Unlike replay.ts, a finding is keyed by every evidence location, so a cross-document finding that loses a template line counts as changed.
export const findingKey = (f: Finding) => `${f.practiceId}|${f.evidence.map(e => `${e.path}:${e.line}`).join(',')}|${f.message}`;
const markKey = (e: Mark) => `${e.path}:${e.line}|${e.text}`;
const edgeKey = (t: Edge) => `${t.from}>${t.to}|${t.resolved}|${markKey(t.evidence)}`;

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
export function scopeDiff(before: Result, after: Result, selected: { baseline: Selection; candidate: Selection }, isTemplate: (path: string) => boolean) {
  const hasSpec = (set: Selection) => set.artifacts.some(a => a.role === 'spec' && !a.archived && !isTemplate(a.path));
  const statuses: Record<string, number> = {};
  for (const id of new Set([...before.practices, ...after.practices].map(p => p.id))) {
    const [b, a] = [before.practices.find(q => q.id === id)?.status ?? 'absent', after.practices.find(q => q.id === id)?.status ?? 'absent'];
    if (b !== a) statuses[`${id}:${b}->${a}`] = (statuses[`${id}:${b}->${a}`] ?? 0) + 1;
  }
  const kind = hasSpec(selected.candidate) ? 'kept' : 'emptied';
  const templateText = selected.baseline.artifacts.filter(a => isTemplate(a.path)).map(a => a.content).join('\n');
  const specText = selected.baseline.artifacts.filter(a => a.role === 'spec' && !isTemplate(a.path)).map(a => a.content).join('\n');
  const word = (id: string) => new RegExp(`(?<![\\w-])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`);
  // Scope-wide, not per feature namespace: an ID defined in another feature's spec only adds breaks (conservative).
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

