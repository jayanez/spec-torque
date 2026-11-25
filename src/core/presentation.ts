import type { Assessment, Finding } from './types.js';

/**
 * Host-independent presentation text. Every host builds its title, summary, finding card,
 * scope labels and workbench line from these helpers, so the same assessment reads the same
 * everywhere. Browser-safe: no Node APIs.
 */

export const DISCLAIMER = 'Heuristic evidence, not a correctness certificate.';

/** The fixed vocabulary every host uses for its scope, finding and proposal controls. */
export const LABELS = {
  selectScope: 'Select scope',
  selectFinding: 'Select finding',
  allDocuments: 'All documents',
  changed: 'Changed on this branch',
  folder: 'Folder · ',
  other: 'Other · ',
  reviewChange: 'Review change',
  applyChange: 'Apply reviewed change',
  rejectProposal: 'Reject proposal',
} as const;

export const replacementLabel = (line: number) => `Proposed replacement for line ${line}`;

/** A feature's label in a scope selector: its ID, prefixed with "Other · " when it has no known layout. */
export const featureLabel = (feature: { id: string; layout: boolean }) => (feature.layout ? '' : LABELS.other) + feature.id;

/** "SpecTorque 0.2.2 · <name>": the product version, and the assessed set when there is one. */
export const titleLine = (version: string, name?: string) => `SpecTorque ${version}` + (name ? ` · ${name}` : '');

type Summarized = Pick<Assessment, 'summary' | 'findings' | 'decisions' | 'engineVersion'>;
export const scoreText = (a: Pick<Assessment, 'summary'>) => a.summary.score === null ? 'Incomplete assessment' : `${a.summary.score}/${a.summary.maximum}`;
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "15/30 · 13 findings · 0 open decisions · engine 0.1.9". */
export function summaryLine(a: Summarized): string {
  return [scoreText(a), count(a.findings.length, 'finding', 'findings'), count(a.decisions.length, 'open decision', 'open decisions'), `engine ${a.engineVersion}`].join(' · ');
}

/** One-line dimension scores: "E1 2/3   E2 —   …". */
export const dimensionsLine = (a: Pick<Assessment, 'dimensions'>) => a.dimensions.map(d => d.id + ' ' + (d.score === null ? '—' : d.score + '/3')).join('   ');

/** A finding's card: heading, location, message, quoted evidence and fix, one entry per line. */
export function findingCard(a: { findings: readonly Finding[] }, index: number): string[] {
  const finding = a.findings[index];
  if (!finding) return [];
  const evidence = finding.evidence[0];
  return [
    `Finding ${index + 1} of ${a.findings.length} · ${finding.practiceId} · ${finding.severity}`,
    ...(evidence ? [`${evidence.path}:${evidence.line}`] : []),
    finding.message,
    ...(evidence ? [`Evidence: «${evidence.text}»`] : []),
    `Fix: ${finding.suggestion}`,
  ];
}

/** A finding as one compact list entry: "Finding 2 of 13 · I1.2 · warning · specs/a/spec.md:5". */
export function findingChoice(a: { findings: readonly Finding[] }, index: number): string {
  const [heading, location] = findingCard(a, index);
  const evidence = a.findings[index]?.evidence[0];
  return heading + (evidence ? ' · ' + location : '');
}

/** The workbench address as hosts show and copy it: always `http://localhost:PORT/`. */
export function workbenchUrl(url: string): string {
  const parsed = new URL(url);
  if (parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]') parsed.hostname = 'localhost';
  return parsed.toString();
}

/** "Workbench: http://localhost:PORT/ — opens on <feature>". */
export const workbenchLine = (url: string, feature?: string | null) => `Workbench: ${workbenchUrl(url)}` + (feature ? ` — opens on ${feature}` : '');
