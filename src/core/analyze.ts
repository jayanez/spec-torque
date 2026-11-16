import { contentHash } from './artifacts.js';
import { DIMENSIONS, PRACTICES } from './catalog.js';
import type { AnalyzeOptions, Artifact, ArtifactSet, Assessment, Evidence, Finding, PracticeResult, Status } from './types.js';
export const ENGINE_VERSION = '0.1.0';
export const RUBRIC_VERSION = 'epic-heuristic-1';
const requirementId = /\b(?:FR|NFR|REQ|R)-\d+\b/gi;
interface Line extends Evidence { artifact: Artifact; requirement: boolean }
function linesOf(artifact: Artifact): Line[] {
  let fenced = false;
  return artifact.content.split(/\r?\n/).map((text, index) => {
    if (/^\s*(?:```|~~~)/.test(text)) fenced = !fenced;
    const requirement = !fenced && !/^\s*(?:#|>|```|~~~)/.test(text) && /\b(?:FR-\d+|NFR-\d+|REQ-\d+|MUST|SHALL|SHOULD|DEBE|DEBERÁ|DEBERÍA)\b/i.test(text);
    return { path: artifact.path, line: index + 1, text, artifact, requirement };
  });
}
const evidenceOf = (line: Evidence): Evidence => ({ path: line.path, line: line.line, text: line.text.slice(0, 300) });
const vagueTerms = /\b(fast|quickly|easily|user-friendly|scalable|etc\.?|as needed|rápid[oa]s?|fácilmente|amigable|escalable|etcétera|cuando sea necesario)\b/giu;
const modal = /\b(MUST(?: NOT)?|SHALL(?: NOT)?|SHOULD(?: NOT)?|MAY|NO DEBE|DEBE(?:RÁ)?|DEBERÍA|PUEDE)\b/iu;
function evaluateSpecial(id: string, lines: Line[], requirements: Line[]): { status: Status; hits: Line[] } | undefined {
  const specRequirements = requirements.filter(l => l.artifact.role === 'spec');
  const ratio = (predicate: (l: Line) => boolean) => {
    const hits = specRequirements.filter(predicate);
    return { status: (!specRequirements.length ? 'unknown' : hits.length === specRequirements.length ? 'supported' : hits.length ? 'partial' : 'missing') as Status, hits };
  };
  if (id === 'E1.2') return ratio(l => /\d|true|false|reject|deny|accept|rechaz|deneg|acept/i.test(l.text) && !new RegExp(vagueTerms.source, 'iu').test(l.text));
  if (id === 'E1.4') return ratio(l => modal.test(l.text));
  if (id === 'E2.1') return ratio(l => !/;.+\b(?:MUST|SHALL|DEBE)\b|\b(?:and|y)\b.+\b(?:MUST|SHALL|DEBE)\b/i.test(l.text));
  if (id === 'P2.1' || id === 'C1.1') return { status: specRequirements.length ? 'partial' : 'missing', hits: specRequirements.slice(0, 3) };
  if (id === 'I1.2' || id === 'I2.2') {
    const ids = specRequirements.flatMap(l => l.text.match(requirementId) ?? []).map(x => x.toUpperCase());
    const unique = new Set(ids);
    return { status: !specRequirements.length ? 'unknown' : ids.length === specRequirements.length && ids.length === unique.size ? 'supported' : ids.length ? 'partial' : 'missing', hits: specRequirements.filter(l => /\b(?:FR|NFR|REQ|R)-\d+\b/i.test(l.text)) };
  }
  if (['I2.3', 'C1.3', 'C2.3'].includes(id)) {
    const hits = lines.filter(l => ['plan', 'tasks'].includes(l.artifact.role) && /\b(?:FR|NFR|REQ|R)-\d+\b/i.test(l.text));
    return { status: hits.length ? 'partial' : 'missing', hits };
  }
  if (id === 'C1.2') return { status: 'partial', hits: lines.filter(l => l.artifact.role !== 'instructions' && /^#\s/.test(l.text)) };
  return undefined;
}
export async function analyze(set: ArtifactSet, options: AnalyzeOptions = {}): Promise<Assessment> {
  if (set.artifacts.length > 500 || set.artifacts.some(a => a.content.length > 1_000_000)) throw new Error('Analysis limit: 500 documents, 1 MB per document.');
  if (new Set(set.artifacts.map(a => a.path)).size !== set.artifacts.length) throw new Error('Artifact paths must be unique.');
  for (const [id, reason] of Object.entries(options.notApplicable ?? {})) {
    if (!PRACTICES.some(p => p.id === id) || reason.trim().length < 10) throw new Error('Non-applicability needs a known practice and a meaningful reason.');
  }
  const active = set.artifacts.filter(a => !a.archived);
  const lines = active.flatMap(linesOf);
  const requirements = lines.filter(l => l.requirement);
  const roles = new Set(active.map(a => a.role));
  const practices: PracticeResult[] = PRACTICES.map(def => {
    const dimension = def.id.split('.')[0];
    const base = { id: def.id, dimension, title: def.title, suggestion: def.fix };
    const reason = options.notApplicable?.[def.id];
    if (reason) return { ...base, status: 'not_applicable', evidence: [], reason };
    const missingRoles = def.roles.filter(role => !roles.has(role));
    const roleRequired = def.roles.length === 1 || ['I2.3', 'I2.4', 'I3.2', 'C1.2', 'C1.3', 'C2.3'].includes(def.id);
    if ((roleRequired && missingRoles.length) || !active.length) return { ...base, status: 'unknown', evidence: [], reason: `Not assessed: supply ${missingRoles.join(', ') || 'source'} artifacts.` };
    const relevant = lines.filter(l => def.roles.includes(l.artifact.role));
    const special = evaluateSpecial(def.id, relevant, requirements);
    const hits = special?.hits ?? relevant.filter(l => def.pattern?.test(l.text) && l.text.trim().length > 3);
    const status = special?.status ?? (hits.length ? 'partial' : 'missing');
    return { ...base, status, evidence: hits.slice(0, 4).map(evidenceOf), reason: special?.status === 'supported' ? 'The deterministic check is satisfied; semantic review may still find gaps.' : hits.length ? 'Textual signals found. Presence does not establish completeness or correctness.' : 'No evidence found by this check in the supplied artifacts.' };
  });
  const findings: Finding[] = [];
  const add = (practiceId: string, line: Evidence, message: string, suggestion: string, severity: Finding['severity'] = 'warning') => {
    findings.push({ id: `${practiceId}:${line.path}:${line.line}:${findings.length}`, practiceId, dimension: practiceId.split('.')[0], severity, message, suggestion, evidence: [evidenceOf(line)], source: 'rule' });
  };
  for (const line of requirements) {
    for (const match of line.text.matchAll(vagueTerms)) add('E1.2', line, `Unbounded wording: “${match[0]}”.`, 'Specify observable behavior and its conditions. Ask for any missing limit.');
    if (/^\s*(?:[-*]\s+)?(?:[A-Z]+-\d+:?\s*)?(?:it|this|that|esto|eso|ello)\b/i.test(line.text)) add('E1.3', line, 'The subject depends on a pronoun.', 'Name the responsible actor or component.');
    if (!/\b(?:FR|NFR|REQ|R)-\d+\b/i.test(line.text) && line.artifact.role === 'spec') add('I1.2', line, 'Requirement has no stable identifier.', 'Assign a stable requirement ID and reference it from tasks.');
    if (/\b(?:and|y)\b.+\b(?:MUST|SHALL|DEBE)\b/i.test(line.text)) add('E2.1', line, 'This statement may contain independent obligations.', 'Check whether the obligations can fail independently; split them if so.');
  }
  const definitions = new Map<string, Line[]>();
  for (const line of requirements.filter(l => l.artifact.role === 'spec')) {
    for (const raw of line.text.match(requirementId) ?? []) { const id = raw.toUpperCase(); definitions.set(id, [...(definitions.get(id) ?? []), line]); }
  }
  for (const [id, entries] of definitions) if (entries.length > 1) add('I1.2', entries[1], `Duplicate requirement identifier ${id}.`, 'Give distinct obligations distinct IDs.', 'error');
  const traceability: Assessment['traceability'] = [];
  for (const line of lines.filter(l => ['plan', 'tasks'].includes(l.artifact.role))) {
    for (const raw of line.text.match(requirementId) ?? []) {
      const id = raw.toUpperCase(); const resolved = definitions.has(id);
      traceability.push({ from: line.path, to: id, evidence: evidenceOf(line), resolved });
      if (!resolved && roles.has('spec')) add('I2.3', line, `Reference ${id} has no definition in the supplied specs.`, 'Correct the reference or include the defining specification.', 'error');
    }
  }
  // Only report contradictions that have explicit opposite obligations on the same normalized behavior.
  const behaviors = new Map<string, Line>();
  for (const line of requirements) {
    const text = line.text.replace(/\b(?:FR|NFR|REQ|R)-\d+\s*:?/gi, '').replace(/^\s*[-*]\s*/, '').trim();
    const polarity = /MUST NOT|SHALL NOT|NO DEBE/i.test(text);
    const key = text.replace(/MUST NOT|SHALL NOT|NO DEBE|MUST|SHALL|DEBE/gi, '').replace(/\s+/g, ' ').toLowerCase();
    const previous = behaviors.get(key);
    if (previous && polarity !== /MUST NOT|SHALL NOT|NO DEBE/i.test(previous.text)) add('I2.3', line, 'Opposite obligations describe the same behavior.', `Resolve the conflict with ${previous.path}:${previous.line}.`, 'error');
    behaviors.set(key, line);
  }
  const dimensions = DIMENSIONS.map(([id, title, category]) => {
    const rows = practices.filter(p => p.dimension === id && p.status !== 'not_applicable');
    const evaluated = rows.filter(p => p.status !== 'unknown');
    const score = !rows.length || evaluated.length !== rows.length ? null : Math.round(3 * rows.reduce((n, p) => n + (p.status === 'supported' ? 1 : p.status === 'partial' ? 0.5 : 0), 0) / rows.length);
    return { id, title, category, score, evaluated: evaluated.length, applicable: rows.length };
  });
  const artifacts = await Promise.all(set.artifacts.map(async ({ content, ...a }) => ({ ...a, hash: await contentHash(content) })));
  const id = await contentHash(JSON.stringify(artifacts.map(a => [a.path, a.hash])) + JSON.stringify(options));
  return {
    schemaVersion: '1.0', engineVersion: ENGINE_VERSION, rubricVersion: RUBRIC_VERSION, id, createdAt: new Date().toISOString(), name: set.name,
    artifacts, practices, findings, dimensions,
    summary: { score: dimensions.every(d => d.score !== null) ? dimensions.reduce((n, d) => n + (d.score ?? 0), 0) : null, maximum: 30, assessedDimensions: dimensions.filter(d => d.score !== null).length, supported: practices.filter(p => p.status === 'supported').length, partial: practices.filter(p => p.status === 'partial').length, missing: practices.filter(p => p.status === 'missing').length, unknown: practices.filter(p => p.status === 'unknown').length, notApplicable: practices.filter(p => p.status === 'not_applicable').length },
    decisions: lines.filter(l => /NEEDS CLARIFICATION|PENDIENTE DE ACLARAR/i.test(l.text)).map(evidenceOf), traceability,
  };
}
