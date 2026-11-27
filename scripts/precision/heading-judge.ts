/**
 * H52 (#52) judge: whether a candidate assessment differs from the baseline only as the H52
 * predictions (with Amendment H52-1) allow. It finds the requirement headings itself, independently
 * of the engine's rule, so the replay does not trust the rule it measures. `sectionOf` is shared
 * with the packet builder.
 */
import type { Artifact, Assessment, Evidence, Status } from '../../src/core/types.js';

const IDENTIFICATION = ['I1.2', 'I2.2'];
// The H3a defining position, as pre-registered, narrowed by H52-1 to FR, NFR and REQ.
const definingHeading = /^\s*#{1,6}[ \t]+(?:(?:[-*+]|\d+[.)])[ \t]+)?(?:\[[ xX]\][ \t]+)?(?:\*\*|__|`)?[ \t]*(?:FR|NFR|REQ)-\d+(?!\.\d)\b/i;
const anyId = /\b(?:FR|NFR|REQ|R)-\d+\b/gi;
const removal = /(?<!\p{L})(?:removed|deprecated|superseded|withdrawn|obsolete|(?:eliminad|obsolet|retirad|reemplazad)[oa]s?)(?!\p{L})/iu;
const fenceRun = /^\s*(?:```|~~~)/;
const thematic = /^\s*(?:[-*_=][ \t]*){3,}$/;
// Review checklists and the Spec Kit quickstart are not `all`-scope lines (H6a, H7a); same paths as src/core/artifacts.ts.
const contextPath = /(?:^|\/)specs\/\d{3}-[^/]+\/(?:checklists\/[^/]+|quickstart)\.md$/i;
const level = (text: string) => /^\s*(#{1,6})[ \t]/.exec(text)?.[1].length;

/** H52-1 requirement headings of the set's non-archived spec documents, in set order. */
export function definingHeadings(artifacts: Pick<Artifact, 'path' | 'content' | 'role' | 'archived'>[]): Evidence[] {
  const found: Evidence[] = [];
  for (const artifact of artifacts) {
    if (artifact.archived || artifact.role !== 'spec' || contextPath.test(artifact.path.replaceAll('\\', '/'))) continue;
    const lines = artifact.content.split(/\r?\n/);
    let fenced = false;
    // Headings outside fences, with their levels, and whether each line is content.
    const kind = lines.map(text => {
      if (fenceRun.test(text)) { fenced = !fenced; return 'content'; }
      if (fenced) return 'content';
      if (level(text)) return 'heading';
      return text.trim() && !thematic.test(text) ? 'content' : 'blank';
    });
    lines.forEach((text, i) => {
      if (kind[i] !== 'heading' || !definingHeading.test(text) || (text.match(anyId) ?? []).length !== 1 || removal.test(text)) return;
      for (let j = i + 1; j < lines.length; j++) {
        if (kind[j] === 'heading' && level(lines[j])! <= level(text)!) return;
        if (kind[j] === 'content') { found.push({ path: artifact.path, line: i + 1, text: text.slice(0, 300) }); return; }
      }
    });
  }
  return found;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const rises = (before: number | null, after: number | null) => before === null || (after !== null && after >= before);

/**
 * The status prediction 3 requires: headings are identified units, so `unknown` becomes `supported`
 * unless a defining ID is duplicated (the duplicate error is in both engines), and `missing` becomes
 * `partial`. `partial` and `supported` stay.
 */
function expectedStatus(before: Status, duplicated: boolean): Status {
  if (before === 'unknown') return duplicated ? 'partial' : 'supported';
  return before === 'missing' ? 'partial' : before;
}

const reasonFor = (status: Status, evidence: boolean) => status === 'supported' ? 'The deterministic check is satisfied; semantic review may still find gaps.'
  : evidence ? 'Textual signals found. Presence does not establish completeness or correctness.' : 'No evidence found by this check in the supplied artifacts.';

/** Violations of H52 predictions 2 and 3 for one feature; empty when the change is as predicted. */
export function judge(before: Assessment, after: Assessment, headings: Evidence[]): string[] {
  const strip = ({ engineVersion: _v, id: _i, createdAt: _c, ...rest }: Assessment) => rest;
  if (!headings.length) return same(strip(before), strip(after)) ? [] : ['assessment changed without a requirement heading'];
  const ids = (a: Assessment) => [a.practices.map(p => p.id), a.dimensions.map(d => d.id)];
  if (!same(ids(before), ids(after))) return ['practice or dimension set changed'];
  const violations: string[] = [];
  // Everything outside I1.2/I2.2, the I1/I2 dimensions and the summary must be identical.
  const outside = (a: Assessment) => ({ ...strip(a), summary: null,
    practices: a.practices.filter(p => !IDENTIFICATION.includes(p.id)), dimensions: a.dimensions.filter(d => !['I1', 'I2'].includes(d.id)) });
  const [b, c] = [outside(before), outside(after)];
  for (const key of Object.keys(b) as (keyof typeof b)[]) if (!same(b[key], c[key])) violations.push(`${key} changed`);
  const duplicated = before.findings.some(f => f.practiceId === 'I1.2' && f.message.startsWith('Duplicate requirement identifier'));
  for (const id of IDENTIFICATION) {
    const [was, now] = [before.practices.find(p => p.id === id)!, after.practices.find(p => p.id === id)!];
    if (now.status !== expectedStatus(was.status, duplicated)) violations.push(`${id} ${was.status}->${now.status}`);
    // The engine's reason follows the status and whether there is evidence (analyze.ts).
    if (now.reason !== reasonFor(now.status, now.evidence.length > 0)) violations.push(`${id} reason`);
    // Known limit: with four 0.1.19 hits the evidence cannot show the headings, so it must stay as it was.
    if (!same(now.evidence, was.evidence.length >= 4 ? was.evidence : [...was.evidence, ...headings].slice(0, 4))) violations.push(`${id} evidence`);
  }
  for (const id of ['I1', 'I2']) {
    const [was, now] = [before.dimensions.find(d => d.id === id)!, after.dimensions.find(d => d.id === id)!];
    if (!rises(was.score, now.score) || now.applicable !== was.applicable || now.title !== was.title) violations.push(`dimension ${id}`);
  }
  const counted = (status: Status) => after.practices.filter(p => p.status === status).length;
  const s = after.summary;
  if (s.supported !== counted('supported') || s.partial !== counted('partial') || s.missing !== counted('missing') || s.unknown !== counted('unknown') ||
    s.notApplicable !== counted('not_applicable') || s.maximum !== before.summary.maximum || s.assessedDimensions < before.summary.assessedDimensions) violations.push('summary counts');
  if (!rises(before.summary.score, s.score)) violations.push('total score fell');
  return violations;
}

/** The enclosing headings and the section of the heading at 1-based `line` (at most 30 lines), outside fences. */
export function sectionOf(lines: string[], line: number) {
  let fenced = false; const chain: string[] = [];
  for (const text of lines.slice(0, line - 1)) {
    if (fenceRun.test(text)) { fenced = !fenced; continue; }
    const l = !fenced && level(text);
    if (l) { while (chain.length && level(chain[chain.length - 1])! >= l) chain.pop(); chain.push(text); }
  }
  const own = level(lines[line - 1]);
  if (!own) throw new Error(`Line ${line} is not a heading.`);
  const section = [lines[line - 1]];
  fenced = false;
  for (const text of lines.slice(line)) {
    if (fenceRun.test(text)) fenced = !fenced;
    else if (!fenced && (level(text) ?? 7) <= own) break;
    if (section.length === 30) break;
    section.push(text);
  }
  while (section.length > 1 && !section[section.length - 1].trim()) section.pop();
  return { chain, section };
}
