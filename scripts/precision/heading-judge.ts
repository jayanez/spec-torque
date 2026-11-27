/**
 * H52 (#52) judge: whether a candidate assessment differs from the baseline only as the H52
 * predictions allow. It finds the defining headings itself, independently of the engine, so the
 * replay does not trust the rule it measures.
 */
import { lineScope } from '../../src/core/artifacts.js';
import type { Artifact, Assessment, Evidence, Status } from '../../src/core/types.js';

const IDENTIFICATION = ['I1.2', 'I2.2'];
// The H3a defining position, as pre-registered: first after the heading marker and optional markup.
const definingHeading = /^\s*#{1,6}[ \t]+(?:(?:[-*+]|\d+[.)])[ \t]+)?(?:\[[ xX]\][ \t]+)?(?:\*\*|__|`)?[ \t]*(?:FR|NFR|REQ|R)-\d+(?!\.\d)\b/i;

/** Defining headings of the set's non-archived spec documents with line scope `all`, in set order. */
export function definingHeadings(artifacts: Pick<Artifact, 'path' | 'content' | 'role' | 'archived'>[]): Evidence[] {
  const found: Evidence[] = [];
  for (const artifact of artifacts) {
    if (artifact.archived || artifact.role !== 'spec' || lineScope(artifact.path) !== 'all') continue;
    let fenced = false;
    artifact.content.split(/\r?\n/).forEach((text, index) => {
      if (/^\s*(?:```|~~~)/.test(text)) { fenced = !fenced; return; }
      if (!fenced && definingHeading.test(text)) found.push({ path: artifact.path, line: index + 1, text: text.slice(0, 300) });
    });
  }
  return found;
}

const allowed: Record<Status, Status[]> = { unknown: ['supported', 'partial'], missing: ['partial'], partial: ['partial'], supported: ['supported'], not_applicable: ['not_applicable'] };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const rises = (before: number | null, after: number | null) => before === null ? true : after !== null && after >= before;

/** Violations of H52 predictions 2 and 3 for one feature; empty when the change is as predicted. */
export function judge(before: Assessment, after: Assessment, headings: Evidence[]): string[] {
  const violations: string[] = [];
  const strip = ({ engineVersion: _v, id: _i, createdAt: _c, ...rest }: Assessment) => rest;
  if (!headings.length) return same(strip(before), strip(after)) ? [] : ['assessment changed without a defining heading'];
  for (const key of ['artifacts', 'findings', 'decisions', 'traceability'] as const) if (!same(before[key], after[key])) violations.push(`${key} changed`);
  for (const practice of before.practices) {
    const next = after.practices.find(p => p.id === practice.id);
    if (!next) { violations.push(`${practice.id} missing`); continue; }
    if (!IDENTIFICATION.includes(practice.id)) {
      if (!same(practice, next)) violations.push(`${practice.id} changed`);
      continue;
    }
    if (!allowed[practice.status].includes(next.status)) violations.push(`${practice.id} ${practice.status}->${next.status}`);
    // The engine derives the reason from the status, so an unchanged status keeps its reason.
    if (next.status === practice.status && next.reason !== practice.reason) violations.push(`${practice.id} reason`);
    const expected = practice.evidence.length >= 4 ? practice.evidence : [...practice.evidence, ...headings].slice(0, 4);
    if (!same(next.evidence, expected)) violations.push(`${practice.id} evidence`);
  }
  for (const dimension of before.dimensions) {
    const next = after.dimensions.find(d => d.id === dimension.id);
    if (!next) { violations.push(`${dimension.id} missing`); continue; }
    if (['I1', 'I2'].includes(dimension.id) ? !rises(dimension.score, next.score) : !same(dimension, next)) violations.push(`dimension ${dimension.id}`);
  }
  if (!rises(before.summary.score, after.summary.score)) violations.push('total score fell');
  return violations;
}

const level = (text: string) => /^\s*(#{1,6})[ \t]/.exec(text)?.[1].length;
/** The enclosing headings and the section of the heading at 1-based `line`, outside fences. */
export function sectionOf(lines: string[], line: number) {
  let fenced = false; const chain: string[] = [];
  for (const text of lines.slice(0, line - 1)) {
    if (/^\s*(?:```|~~~)/.test(text)) { fenced = !fenced; continue; }
    const l = !fenced && level(text);
    if (l) { while (chain.length && level(chain[chain.length - 1])! >= l) chain.pop(); chain.push(text); }
  }
  const own = level(lines[line - 1]);
  if (!own) throw new Error(`Line ${line} is not a heading.`);
  const section = [lines[line - 1]];
  fenced = false;
  for (const text of lines.slice(line)) {
    if (/^\s*(?:```|~~~)/.test(text)) fenced = !fenced;
    else if (!fenced && (level(text) ?? 7) <= own) break;
    if (section.length === 30) break;
    section.push(text);
  }
  while (section.length > 1 && !section[section.length - 1].trim()) section.pop();
  return { chain, section };
}
