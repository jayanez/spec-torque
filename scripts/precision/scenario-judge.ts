/**
 * H52c (#52) judge: whether a candidate assessment differs from the baseline only as the H52c
 * predictions allow. It finds the entering lines itself (scenario steps with a normative modal),
 * independently of the engine's rule, so the replay does not trust the rule it measures.
 */
import { lineScope } from '../../src/core/artifacts.js';
import type { Artifact, Assessment, Evidence, Finding, Status } from '../../src/core/types.js';

const scenario = /^\s*(?:[-*]\s*)?(?:GIVEN|WHEN|THEN|DADO|CUANDO|ENTONCES)\b/i;
const structure = /^\s*(?:#|>|```|~~~)/;
const fenceRun = /^\s*(?:```|~~~)/;
// The 0.1.20 modal test, including its calendar-May and month-enumeration exclusions.
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
      if (!fenced && !structure.test(text) && scenario.test(text) && hasModal(text)) found.push({ path: artifact.path, line: index + 1, text: text.slice(0, 300), spec: artifact.role === 'spec' });
    });
  }
  return found;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const keyOf = (f: Finding) => `${f.practiceId}|${f.evidence[0]?.path}|${f.evidence[0]?.line}|${f.message}`;
const ADDED = new Set(['E1.2', 'E1.3', 'E2.1', 'I1.2']);
const FREE = ['E1.2', 'E2.1', 'I1.2', 'I2.2'];
const MOVES: Record<string, string[]> = { 'E1.4': ['unknown->supported', 'missing->partial'], 'P2.1': ['missing->partial', 'partial->missing'], 'C1.1': ['missing->partial', 'partial->missing'], 'C1.2': ['missing->partial'] };
const SCORED = new Set(['E1', 'E2', 'I1', 'I2', 'P2', 'C1']);

/** Violations of H52c predictions 2 and 3 for one feature; empty when the change is as predicted. */
export function judge(before: Assessment, after: Assessment, entering: Entering[]): string[] {
  const strip = ({ engineVersion: _v, id: _i, createdAt: _c, ...rest }: Assessment) => rest;
  if (!entering.length) return same(strip(before), strip(after)) ? [] : ['assessment changed without an entering line'];
  const violations: string[] = [];
  const at = new Set(entering.map(e => `${e.path}|${e.line}`));
  const onEntering = (f: Finding) => at.has(`${f.evidence[0]?.path}|${f.evidence[0]?.line}`);
  const enteringIds = new Set(entering.filter(e => e.spec).flatMap(e => [...e.text.matchAll(/\b(?:FR|NFR|REQ|R)-\d+\b/gi)].map(m => m[0].toUpperCase())));
  const enteringNamespaces = new Set(entering.filter(e => e.spec).flatMap(e => [...e.text.matchAll(/([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*)-(?:FR|NFR|REQ|R)-\d+\b/g)].map(m => m[1])));
  const [b, c] = [new Map(before.findings.map(f => [keyOf(f), f])), new Map(after.findings.map(f => [keyOf(f), f]))];
  for (const [key, f] of c) if (!b.has(key)) {
    const lineWarning = ADDED.has(f.practiceId) && (f.practiceId !== 'I1.2' || f.message === 'Requirement has no stable identifier.');
    const conflict = f.practiceId === 'I2.3' && f.message === 'Opposite obligations describe the same behavior.';
    // H52c-a: a qualified reference becomes local when an entering spec line joins its namespace to an ID (H9).
    const reference = /^Reference (\S+) has no definition/.exec(f.message)?.[1];
    const ownedByStep = reference !== undefined && [...(f.evidence[0]?.text ?? '').matchAll(new RegExp(`([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*)-${reference}\\b`, 'g'))]
      .some(m => enteringNamespaces.has(m[1]));
    const allowed = (lineWarning && onEntering(f)) || (conflict && (onEntering(f) || entering.some(e => f.suggestion.includes(`${e.path}:${e.line}.`)))) || (f.practiceId === 'I2.3' && ownedByStep);
    if (!allowed) violations.push(`finding added ${key}`);
  }
  for (const [key, f] of b) if (!c.has(key)) {
    const id = /^Reference (\S+) has no definition/.exec(f.message)?.[1];
    // A removed conflict is allowed when an entering line carries a MUST/SHALL/DEBE obligation (H52c-a; cannot occur, Amendment H52c-a-1).
    const conflictReplaced = f.message === 'Opposite obligations describe the same behavior.' && entering.some(e => /\b(?:MUST|SHALL|DEBE)\b/i.test(e.text));
    if (!(f.practiceId === 'I2.3' && ((id && enteringIds.has(id)) || conflictReplaced))) violations.push(`finding removed ${key}`);
  }
  const ids = (a: Assessment) => [a.practices.map(p => p.id), a.dimensions.map(d => d.id)];
  if (!same(ids(before), ids(after))) return [...violations, 'practice or dimension set changed'];
  for (const was of before.practices) {
    const now = after.practices.find(p => p.id === was.id)!;
    if (same(was, now)) continue;
    const move = `${was.status}->${now.status}`;
    if (FREE.includes(was.id) || (MOVES[was.id] && (was.status === now.status || MOVES[was.id].includes(move)))) continue;
    violations.push(`${was.id} ${move}`);
  }
  for (const was of before.dimensions) {
    const now = after.dimensions.find(d => d.id === was.id)!;
    if (!SCORED.has(was.id) && !same(was, now)) violations.push(`dimension ${was.id}`);
  }
  for (const key of ['artifacts', 'decisions'] as const) if (!same(before[key], after[key])) violations.push(`${key} changed`);
  if (before.traceability.length !== after.traceability.length) violations.push('traceability size changed');
  else before.traceability.forEach((edge, i) => {
    const next = after.traceability[i];
    if (same(edge, next)) return;
    if (!(same({ ...edge, resolved: true }, next) && !edge.resolved && enteringIds.has(edge.to))) violations.push(`edge ${edge.from}->${edge.to}`);
  });
  const counted = (status: Status) => after.practices.filter(p => p.status === status).length;
  const s = after.summary;
  if (s.supported !== counted('supported') || s.partial !== counted('partial') || s.missing !== counted('missing') || s.unknown !== counted('unknown') || s.notApplicable !== counted('not_applicable')) violations.push('summary counts');
  return violations;
}
