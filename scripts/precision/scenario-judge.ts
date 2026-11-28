/**
 * H52c (#52) judge: whether a candidate assessment differs from the baseline only as the H52c
 * predictions allow. It finds the entering lines itself (scenario steps with a normative modal),
 * independently of the engine's rule, so the replay does not trust the rule it measures.
 */
import { lineScope } from '../../src/core/artifacts.js';
import type { Artifact, Assessment, Evidence, Finding, Status } from '../../src/core/types.js';

const scenario = /^\s*(?:[-*]\s*)?(?:GIVEN|WHEN|THEN|DADO|CUANDO|ENTONCES)\b/i;
const fenceRun = /^\s*(?:```|~~~)/;
// The 0.1.20 modal test, including its calendar-May and month-enumeration exclusions. Frozen at 0.1.20:
// re-derive it if the engine's modal test ever changes.
const modal = /(?<![\p{L}\p{N}\p{M}_])(?:MUST|SHALL|SHOULD|MAY|DEBERÍAN|DEBERÍA|DEBERÁN|DEBERÁ|DEBEN|DEBE|PUEDEN|PUEDE)(?![\p{L}\p{N}\p{M}_])/iu;
const calendarMay = /(?<![\p{L}\p{N}\p{M}_])(?:May[ \t]+(?:\d{4}|(?:[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?)(?=[,.]|[ \t]+(?:is|was)\b)|(?:[Ii]n|[Dd]uring|[Ss]ince|[Uu]ntil|[Oo]f)[ \t]+May(?![\p{L}\p{N}\p{M}_]))/gu;
const monthItem = (name: string) => `(?:${name}|\`${name}\`|"${name}"|'${name}'|“${name}”|‘${name}’)`;
const monthEnumerationMay = new RegExp(`(?<![\\p{L}\\p{N}\\p{M}_])(${monthItem('Apr(?:il)?')}[ \\t]*,[ \\t]*)${monthItem('May')}([ \\t]*,[ \\t]*${monthItem('Jun(?:e)?')})(?![\\p{L}\\p{N}\\p{M}_])`, 'giu');
const hasModal = (text: string) => modal.test(text.normalize('NFC').replace(calendarMay, ' ').replace(monthEnumerationMay, '$1 $2'));

/** Entering lines of the set's non-archived documents: scenario steps with a modal, scope `all`, outside fences. */
export type Entering = Evidence & { spec: boolean };
export function enteringLines(artifacts: Pick<Artifact, 'path' | 'content' | 'archived' | 'role'>[]): Entering[] {
  const found: Entering[] = [];
  for (const artifact of artifacts) {
    if (artifact.archived || lineScope(artifact.path) !== 'all') continue;
    let fenced = false;
    artifact.content.split(/\r?\n/).forEach((text, index) => {
      if (fenceRun.test(text)) { fenced = !fenced; return; }
      // A scenario line never starts with a heading, quote or fence marker, so no structure test is needed.
      if (!fenced && scenario.test(text) && hasModal(text)) found.push({ path: artifact.path, line: index + 1, text: text.slice(0, 300), spec: artifact.role === 'spec' });
    });
  }
  return found;
}

export const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export const keyOf = (f: Finding) => `${f.practiceId}|${f.evidence[0]?.path}|${f.evidence[0]?.line}|${f.message}`;
const ADDED = new Set(['E1.2', 'E1.3', 'E2.1', 'I1.2']);
const FREE = ['E1.2', 'E2.1', 'I1.2', 'I2.2'];
const MOVES: Record<string, string[]> = { 'E1.4': ['unknown->supported', 'missing->partial'], 'P2.1': ['missing->partial', 'partial->missing'], 'C1.1': ['missing->partial', 'partial->missing'], 'C1.2': ['missing->partial'] };
const SCORED = new Set(['E1', 'E2', 'I1', 'I2', 'P2', 'C1']);

/** Violations of H52c predictions 2 and 3 for one feature; empty when the change is as predicted. */
export function judge(before: Assessment, after: Assessment, entering: Entering[]): string[] {
  // `summary.reachable` (#125) is disclosure only and postdates the frozen comparators, so it is not compared.
  const strip = ({ engineVersion: _v, id: _i, createdAt: _c, ...rest }: Assessment) => ({ ...rest, summary: { ...rest.summary, reachable: undefined } });
  if (!entering.length) return same(strip(before), strip(after)) ? [] : ['assessment changed without an entering line'];
  const violations: string[] = [];
  const at = new Set(entering.map(e => `${e.path}|${e.line}`));
  const onEntering = (f: Finding) => at.has(`${f.evidence[0]?.path}|${f.evidence[0]?.line}`);
  const enteringIds = new Set(entering.filter(e => e.spec).flatMap(e => [...e.text.matchAll(/\b(?:FR|NFR|REQ|R)-\d+\b/gi)].map(m => m[0].toUpperCase())));
  const enteringNamespaces = new Set(entering.filter(e => e.spec).flatMap(e => [...e.text.matchAll(/([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*)-(?:FR|NFR|REQ|R)-\d+\b/g)].map(m => m[1])));
  // Findings are compared whole (all but the positional id), as multisets: a changed severity, suggestion or
  // later evidence is a removal plus an addition, and a duplicated finding is an addition.
  const whole = (f: Finding) => JSON.stringify({ ...f, id: undefined });
  const diff = (from: Finding[], minus: Finding[]) => {
    const left = new Map<string, number>();
    for (const f of minus) left.set(whole(f), (left.get(whole(f)) ?? 0) + 1);
    return from.filter(f => { const n = left.get(whole(f)) ?? 0; if (n) { left.set(whole(f), n - 1); return false; } return true; });
  };
  // A finding the engine reports twice is never predicted, even on an entering line.
  const count = (list: Finding[], f: Finding) => list.filter(g => whole(g) === whole(f)).length;
  for (const f of new Set(after.findings)) if (count(after.findings, f) > 1 && count(after.findings, f) > count(before.findings, f)) violations.push(`finding duplicated ${keyOf(f)}`);
  for (const f of diff(after.findings, before.findings)) {
    const key = keyOf(f);
    const lineWarning = ADDED.has(f.practiceId) && (f.practiceId !== 'I1.2' || f.message === 'Requirement has no stable identifier.');
    const conflict = f.practiceId === 'I2.3' && f.message === 'Opposite obligations describe the same behavior.';
    // H52c-a: a qualified reference becomes local when an entering spec line joins its namespace to an ID (H9).
    const reference = /^Reference (\S+) has no definition/.exec(f.message)?.[1];
    const ownedByStep = reference !== undefined && [...(f.evidence[0]?.text ?? '').matchAll(new RegExp(`([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*)-${reference}\\b`, 'g'))]
      .some(m => enteringNamespaces.has(m[1]));
    // Each predicted finding has its rule's severity: line checks warn, I2.3 reports errors.
    const severity = f.severity === (f.practiceId === 'I2.3' ? 'error' : 'warning');
    const allowed = severity && ((lineWarning && onEntering(f)) || (conflict && (onEntering(f) || entering.some(e => f.suggestion === `Resolve the conflict with ${e.path}:${e.line}.`))) || (f.practiceId === 'I2.3' && ownedByStep));
    if (!allowed) violations.push(`finding added ${key}`);
  }
  for (const f of diff(before.findings, after.findings)) {
    // References resolve by the bare ID (0.1.20). A removed conflict is predicted impossible (Amendment H52c-a-1), so it is a violation.
    const id = /^Reference (\S+) has no definition/.exec(f.message)?.[1];
    if (!(f.practiceId === 'I2.3' && id && enteringIds.has(id))) violations.push(`finding removed ${keyOf(f)}`);
  }
  const ids = (a: Assessment) => [a.practices.map(p => p.id), a.dimensions.map(d => d.id)];
  if (!same(ids(before), ids(after))) return [...violations, 'practice or dimension set changed'];
  for (const was of before.practices) {
    const now = after.practices.find(p => p.id === was.id)!;
    if (same(was, now)) continue;
    const move = `${was.status}->${now.status}`;
    // Spec ratios move only when a spec line enters.
    if ((FREE.includes(was.id) && entering.some(e => e.spec)) || (MOVES[was.id] && (was.status === now.status || MOVES[was.id].includes(move)))) continue;
    violations.push(`${was.id} ${move}`);
  }
  for (const was of before.dimensions) {
    const now = after.dimensions.find(d => d.id === was.id)!;
    if (!SCORED.has(was.id) && !same(was, now)) violations.push(`dimension ${was.id}`);
  }
  for (const key of ['artifacts', 'decisions', 'name', 'schemaVersion', 'rubricVersion'] as const) if (!same(before[key], after[key])) violations.push(`${key} changed`);
  if (before.traceability.length !== after.traceability.length) violations.push('traceability size changed');
  else before.traceability.forEach((edge, i) => {
    const next = after.traceability[i];
    if (same(edge, next)) return;
    if (!(same({ ...edge, resolved: true }, next) && !edge.resolved && enteringIds.has(edge.to))) violations.push(`edge ${edge.from}->${edge.to}`);
  });
  const counted = (status: Status) => after.practices.filter(p => p.status === status).length;
  const s = after.summary;
  if (s.maximum !== before.summary.maximum || s.supported !== counted('supported') || s.partial !== counted('partial') || s.missing !== counted('missing') || s.unknown !== counted('unknown') || s.notApplicable !== counted('not_applicable')) violations.push('summary counts');
  return violations;
}
