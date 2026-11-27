import { contentHash, lineScope, type LineScope } from './artifacts.js';
import { DIMENSIONS, PRACTICES } from './catalog.js';
import { isOwnSpec, namespaceOf, qualifierOf, textBefore } from './references.js';
import type { AnalyzeOptions, Artifact, ArtifactSet, Assessment, Evidence, Finding, PracticeResult, Status } from './types.js';
export const ENGINE_VERSION = '0.1.20';
export const RUBRIC_VERSION = 'epic-heuristic-1';
const requirementId = /\b(?:FR|NFR|REQ|R)-\d+\b/gi;
// Match complete Unicode words, including accented Spanish and plural forms.
const modal = /(?<![\p{L}\p{N}\p{M}_])(?:MUST|SHALL|SHOULD|MAY|DEBERÍAN|DEBERÍA|DEBERÁN|DEBERÁ|DEBEN|DEBE|PUEDEN|PUEDE)(?![\p{L}\p{N}\p{M}_])/iu;
const calendarMay = /(?<![\p{L}\p{N}\p{M}_])(?:May[ \t]+(?:\d{4}|(?:[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?)(?=[,.]|[ \t]+(?:is|was)\b)|(?:[Ii]n|[Dd]uring|[Ss]ince|[Uu]ntil|[Oo]f)[ \t]+May(?![\p{L}\p{N}\p{M}_]))/gu;
const monthItem = (name: string) => `(?:${name}|\`${name}\`|"${name}"|'${name}'|“${name}”|‘${name}’)`;
const monthEnumerationMay = new RegExp(
  `(?<![\\p{L}\\p{N}\\p{M}_])(${monthItem('Apr(?:il)?')}[ \\t]*,[ \\t]*)${monthItem('May')}([ \\t]*,[ \\t]*${monthItem('Jun(?:e)?')})(?![\\p{L}\\p{N}\\p{M}_])`,
  'giu',
);
const hasNormativeModal = (text: string) => modal.test(
  text.normalize('NFC').replace(calendarMay, ' ').replace(monthEnumerationMay, '$1 $2'),
);
/** H5a (#78): a list item or paragraph with its hard-wrapped continuation lines; `defined` when its first line has a defining ID. */
interface Unit { defined: boolean }
/** `fenced`: inside a fenced code block or a fence run. `section`: the nearest heading above the line (H104a). */
interface Line extends Evidence { artifact: Artifact; scope: LineScope; requirement: boolean; heading: boolean; continuation: boolean; unit: Unit; fenced: boolean; section: string }
// Lines that start a block (or are a fence run), and lines that cannot be continued.
const blockStart = /^\s*(?:#{1,6}(?:[ \t]|$)|(?:[-*+]|\d+[.)])(?:[ \t]|$)|\||>|<|```|~~~)/;
const closedBlock = /^\s*(?:#{1,6}(?:[ \t]|$)|\||>|<|```|~~~)/;
const thematicBreak = /^\s*(?:[-*_=][ \t]*){3,}$/;
function linesOf(artifact: Artifact): Line[] {
  const scope = lineScope(artifact.path);
  let fenced = false;
  let continuable = false;
  let unit: Unit = { defined: false };
  let section = '';
  return artifact.content.split(/\r?\n/).map((text, index) => {
    const fenceRun = /^\s*(?:```|~~~)/.test(text);
    if (fenceRun) fenced = !fenced;
    const scenario = /^\s*(?:[-*]\s*)?(?:GIVEN|WHEN|THEN|DADO|CUANDO|ENTONCES)\b/i.test(text);
    const requirement = scope === 'all' && !fenced && !scenario && !/^\s*(?:#|>|```|~~~)/.test(text) && (/\b(?:FR|NFR|REQ)-\d+\b/i.test(text) || hasNormativeModal(text));
    const textLine = !fenced && !fenceRun && text.trim() !== '' && !thematicBreak.test(text);
    // An unindented line led by a defining ID starts its own unit (one requirement per line).
    const continuation = continuable && textLine && !blockStart.test(text) && !(/^\S/.test(text) && definedId(text));
    if (!continuation) unit = { defined: Boolean(definedId(text)) };
    continuable = textLine && !closedBlock.test(text);
    const heading = !fenced && /^\s*#{1,6}[ \t]/.test(text);
    if (heading) section = text;
    return { path: artifact.path, line: index + 1, text, artifact, scope, requirement, heading, continuation, unit, fenced: fenced || fenceRun, section };
  });
}
// H3a (#83): an ID defines a requirement only in a defining position: first on the line after an
// optional heading marker, list marker, task checkbox and bold or code markup. Table cells restate
// IDs (traceability), and a dotted sub-ID such as REQ-2.1 does not define its parent REQ-2.
const definingId = /^\s*(?:#{1,6}[ \t]+)?(?:(?:[-*+]|\d+[.)])[ \t]+)?(?:\[[ xX]\][ \t]+)?(?:\*\*|__|`)?[ \t]*((?:FR|NFR|REQ|R)-\d+)(?!\.\d)\b/i;
const definedId = (text: string) => definingId.exec(text)?.[1]?.toUpperCase();
// H52 (#52, Amendment H52-1): a spec heading that defines one FR, NFR or REQ requirement and has content
// under it is an identified requirement unit for I1.2 and I2.2, even when no admitted line follows
// (scenario steps, prose without a modal). R- also numbers risks and releases; a second ID names a
// range or a cross-reference; a removal word marks a requirement that no longer applies.
const removalWord = /(?<!\p{L})(?:removed|deprecated|superseded|withdrawn|obsolete|(?:eliminad|obsolet|retirad|reemplazad)[oa]s?)(?!\p{L})/iu;
const headingLevel = (text: string) => /^\s*(#{1,6})[ \t]/.exec(text)?.[1].length ?? 0;
function requirementHeadings(lines: Line[]): Line[] {
  return lines.filter((line, i) => {
    if (!line.heading || line.artifact.role !== 'spec' || line.scope !== 'all') return false;
    const id = definedId(line.text);
    if (!id || id.startsWith('R-') || (line.text.match(requirementId) ?? []).length !== 1 || removalWord.test(line.text)) return false;
    const level = headingLevel(line.text);
    for (let j = i + 1; j < lines.length && lines[j].path === line.path; j++) {
      const next = lines[j];
      if (next.heading) { if (headingLevel(next.text) <= level) return false; continue; }
      if (next.text.trim() !== '' && !thematicBreak.test(next.text)) return true;
    }
    return false;
  });
}
/** Spec requirement lines without their own ID that inherit one from the nearest preceding defining heading. */
function inheritedLines(lines: Line[]): Set<Line> {
  const inherited = new Set<Line>();
  let path = '';
  let current: string | undefined;
  for (const line of lines) {
    if (line.path !== path) { path = line.path; current = undefined; }
    if (line.artifact.role !== 'spec') continue;
    if (line.heading) { current = definedId(line.text); continue; }
    if (line.requirement && current && !identifiedOnLine(line)) inherited.add(line);
  }
  return inherited;
}
const requirementIdIn = (text: string) => /\b(?:FR|NFR|REQ|R)-\d+\b/i.test(text);
/** A line's own ID, or (H5a) a defining ID on the first line of the item or paragraph it belongs to. */
const identifiedOnLine = (line: Line) => requirementIdIn(line.text) || line.unit.defined;
/** Defining positions per feature-qualified ID, among admitted spec lines and spec headings. */
function definitionsOf(lines: Line[]): Map<string, Line[]> {
  const definitions = new Map<string, Line[]>();
  for (const line of lines) {
    if (line.artifact.role !== 'spec' || !(line.requirement || line.heading) || line.continuation) continue;
    const id = definedId(line.text);
    if (!id) continue;
    const key = line.artifact.featureId + ':' + id;
    definitions.set(key, [...(definitions.get(key) ?? []), line]);
  }
  return definitions;
}
/**
 * Requirement references per plan or tasks line. H8 (#80): a bare R-n is a reference only when the
 * feature's spec documents use the R- family; otherwise it is a label local to that document.
 */
function referencesOf(lines: Line[]): Map<Line, RegExpExecArray[]> {
  const rFamily = new Set(lines.filter(l => l.artifact.role === 'spec' && /\bR-\d+\b/i.test(l.text)).map(l => l.artifact.featureId));
  return new Map(lines.filter(l => ['plan', 'tasks'].includes(l.artifact.role)).map(l => [l,
    [...l.text.matchAll(requirementId)].filter(match => !match[0].toUpperCase().startsWith('R-') || rFamily.has(l.artifact.featureId))]));
}
const evidenceOf = (line: Evidence): Evidence => ({ path: line.path, line: line.line, text: line.text.slice(0, 300) });
const vagueTerms = /\b(fast|quickly|easily|user-friendly|scalable|etc\.?|as needed|rápid[oa]s?|fácilmente|amigable|escalable|etcétera|cuando sea necesario)\b/giu;
const boundedQuantity = /(?:within|at most|at least|less than|more than|maximum|minimum|dentro de|como máximo|como mínimo|menos de|más de)\s+\d|\d+(?:[.,]\d+)?\s*(?:%|(?:ms|seconds?|segundos?|minutes?|minutos?|MB|GB)(?![\p{L}\p{N}\p{M}_]))/iu;
const minimumDuration = /(?<![\p{L}\p{N}\p{M}_])al menos\s+\d+(?:[.,]\d+)?\s+(?:segundos?|minutos?|horas?|días?|semanas?)(?![\p{L}\p{N}\p{M}_])/iu;
const boundedRate = /[≤≥]\s*\d+(?:[.,]\d+)?\s+(?:entr(?:y|ies)|tickets?|requests?|turnos?|lecturas?|solicitudes?)\s+(?:per|por)\s+(?:second|minute|hour|segundo|minuto|hora)(?![\p{L}\p{N}\p{M}_])/iu;
const observableDenial = /(?<![\p{L}\p{N}\p{M}_])(?:(?:MUST|SHALL|SHOULD)\s+(?:reject|deny)|DEBE(?:N|RÁN?|RÍAN?)?\s+(?:rechazar|denegar))(?![\p{L}\p{N}\p{M}_])/iu;
const unboundedWording = new RegExp(vagueTerms.source, 'iu');
// H85 (#85): `this`/`that` lead a noun phrase ("This amendment MUST") unless the next token marks a
// pronoun: punctuation, a contraction, a modal or auxiliary, an adverb, a preposition or conjunction,
// or a verb form. The verb and adverb suffixes err towards keeping the finding.
const subjectLead = /^\s*(?:[-*]\s+)?(?:[A-Z]+-\d+:?\s*)?(?:(it|esto|eso|ello)|this|that)\b/i;
// A word in -s that is not -ss, -us or -is: a present verb form (shared by H85 and H104a).
const verbFormS = String.raw`\w*[^\Wsui]s`;
const pronounCues = [
  'must|shall|should|may|might|can|cannot|could|will|won|would', // modals (H85, H85-2)
  'is|was|are|were|be|been|being|has|had|have|does|did|do', // auxiliaries
  'also|only|never|always|then|now|still|not|alone|itself|\\w+ly', // adverbs
  'and|or|but|in|on|at|for|with|by|of|to|from|as|if|when|because|so', // prepositions and conjunctions (H85-1)
  `made|led|meant|became|took|gave|kept|${verbFormS}|\\w+ed`, // verb forms
].join('|');
// Punctuation or no next word, a contraction ('s, 'll, 'd, H85-1; -n't, H85-3), or a listed word.
const pronounNext = new RegExp(String.raw`^(?:\s*(?:$|[.,;:!?)—–-])|['’](?:s|ll|d)\b|\s+\w+n['’]t\b|\s+(?:${pronounCues})\b)`, 'i');
function pronounSubject(text: string): boolean {
  const lead = subjectLead.exec(text);
  return Boolean(lead && (lead[1] || pronounNext.test(text.slice(lead[0].length))));
}

function hasObservableCue(text: string): boolean {
  const clause = text.normalize('NFC').replace(requirementId, '');
  return !unboundedWording.test(clause) &&
    (boundedQuantity.test(clause) || minimumDuration.test(clause) || boundedRate.test(clause) || observableDenial.test(clause));
}

// H104a (#104): actors named by role. Besides the 0.1.16 words (now whole words), a bounded list
// of human role nouns counts in actor position: a user story, or a clause subject (after a
// determiner, or first on a line that is not a continuation) followed directly by a present verb.
// A role acting on the specification's own process does not count: process sections, dated lines,
// past forms and document objects. No cue is read inside a fenced block.
const genericActor = /(?<![\p{L}\p{N}_])(?:users?|visitors?|actors?|customers?|usuarios?|visitantes?|clientes?)(?![\p{L}\p{N}_])/iu;
const userStory = /\bas\s+an?\s+(?:[\p{L}-]+\s+){0,3}[\p{L}-]+\s*,\s*I\s+(?:want|need|can|would\s+like|should|must)\b|(?<!\p{L})como\s+(?:una?\s+)?(?:[\p{L}-]+\s+){0,3}[\p{L}-]+\s*,\s*(?:quiero|necesito|puedo|deseo|me\s+gustaría)(?!\p{L})/iu;
const lineStart = String.raw`^\s*(?:>\s*)*(?:(?:[-*+]|\d+[.)])\s+)?(?:\[[ xX]\]\s+)?(?:\*\*|__)?\s*`;
const roleSubject = (keywords: string, determiners: string, roles: string, verb: RegExp, pluralNoun: boolean) => ({
  verb, pluralNoun,
  start: new RegExp(String.raw`${lineStart}(?:(?:\*\*|__)?(?:${keywords})(?:\*\*|__)?\s+)?(?:(?:${determiners})\s+)?(?:${roles})\s+([\p{L}'’]+)`, 'iu'),
  inner: new RegExp(String.raw`(?<![\p{L}\p{N}_'’-])(?:${determiners})\s+(?:${roles})\s+([\p{L}'’]+)`, 'giu'),
});
// Present forms only (H104a rule 4); H85's -s fragment, less the preposition "as" (H104-2) and "was" (H104a-2).
const englishVerb = new RegExp(String.raw`^(?:must|shall|should|may|might|can|cannot|could|will|would|is|are|has|have|does|do|\p{L}+n['’]t|(?!(?:as|was)$)${verbFormS})$`, 'iu');
const spanishVerb = /^(?!(?:a|ante|contra|de|desde|durante|entre|hacia|hasta|mediante|para|sobre)$)(?:debe|deben|deberá|deberán|puede|pueden|podrá|podrán|es|son|está|están|tiene|tienen|ha|han|\p{L}*(?:a|e|an|en))$/iu;
const english = roleSubject('given|when|then|and|but', 'the|a|an|each|every|any',
  '(?:developer|operator|maintainer|reviewer|administrator|admin|owner|engineer|author|contributor|approver|auditor|analyst)s?', englishVerb, true);
const spanish = roleSubject('dado(?:\\s+que)?|cuando|entonces|y', 'el|la|los|las|un|una|cada',
  '(?:desarrollador|operador|mantenedor|revisor|administrador|colaborador|aprobador|autor|auditor)(?:a|es|as)?|(?:propietari|dueñ|ingenier)(?:o|a|os|as)|analistas?', spanishVerb, false);
// Rule 7: a word in -s followed by is/are/… is a plural noun ("the operator logs are …").
const nounBefore = /^(?:is|are|was|were|has|have)$/i;
const processSection = /(?<![\p{L}])(?:clarifications?|decisions?|status|risks?|assumptions?|notes|changelog|history|revisions?|reviews?|sign-?off|approvals?|open questions?|aclaraciones|aclaración|decisiones|decisión|estado|riesgos?|supuestos?|notas|historial|revisión|revisiones|aprobación|aprobaciones|preguntas)(?![\p{L}])/iu;
const isoDate = /\b\d{4}-\d{2}-\d{2}\b/;
const documentObject = /^(?:\s+[\p{L}\p{N}'’-]+){0,5}?\s+(?:specs?|specification|plan|tasks|document|proposal|clarification|especificación|tareas|documento|borrador|propuesta|aclaración)(?![\p{L}\p{N}_])/iu;
type Language = ReturnType<typeof roleSubject>;
function subjectAt(text: string, match: RegExpExecArray, language: Language): boolean {
  const rest = text.slice(match.index + match[0].length);
  const after = /^\s+([\p{L}'’]+)/u.exec(rest)?.[1] ?? '';
  const pluralNoun = language.pluralNoun && /s$/i.test(match[1]) && !/^(?:is|has|does)$/i.test(match[1]) && nounBefore.test(after);
  return language.verb.test(match[1]) && !pluralNoun && !documentObject.test(rest);
}
function roleActor(line: Line): boolean {
  if (processSection.test(line.section) || isoDate.test(line.text)) return false;
  return [english, spanish].some(language => {
    const first = line.continuation ? null : language.start.exec(line.text);
    return Boolean(first && subjectAt(line.text, first, language)) || [...line.text.matchAll(language.inner)].some(m => subjectAt(line.text, m, language));
  });
}
/** Whether a spec line names who acts: a generic actor word, a user story or a role noun in actor position. */
function namesActor(line: Line): boolean {
  return !line.fenced && (genericActor.test(line.text) || userStory.test(line.text) || roleActor(line));
}

function evaluateSpecial(id: string, lines: Line[], requirements: Line[], references: Map<Line, RegExpExecArray[]>): { status: Status; hits: Line[] } | undefined {
  const specRequirements = requirements.filter(l => l.artifact.role === 'spec');
  const ratio = (predicate: (l: Line) => boolean) => {
    const hits = specRequirements.filter(predicate);
    return { status: (!specRequirements.length ? 'unknown' : hits.length === specRequirements.length ? 'supported' : hits.length ? 'partial' : 'missing') as Status, hits };
  };
  if (id === 'E1.2') return ratio(line => hasObservableCue(line.text));
  if (id === 'E1.4') return ratio(line => hasNormativeModal(line.text));
  if (id === 'E2.1') return ratio(l => !/;.+\b(?:MUST|SHALL|DEBE)\b|\b(?:and|y)\b.+\b(?:MUST|SHALL|DEBE)\b/i.test(l.text));
  if (id === 'P2.1' || id === 'C1.1') {
    const context = lines.some(l => !l.requirement && !/^\s*#/.test(l.text) && namesActor(l));
    return { status: specRequirements.length && context ? 'partial' : 'missing', hits: specRequirements.length && context ? specRequirements.slice(0, 3) : [] };
  }
  if (id === 'I1.2' || id === 'I2.2') {
    const inherited = inheritedLines(lines);
    const headings = requirementHeadings(lines);
    const identified = specRequirements.filter(l => identifiedOnLine(l) || inherited.has(l)).length + headings.length;
    const units = specRequirements.length + headings.length;
    const unique = ![...definitionsOf(lines).values()].some(entries => entries.length > 1);
    return { status: !units ? 'unknown' : identified === units && unique ? 'supported' : identified ? 'partial' : 'missing', hits: [...specRequirements.filter(l => /\b(?:FR|NFR|REQ|R)-\d+\b/i.test(l.text)), ...headings] };
  }
  if (['I2.3', 'C1.3', 'C2.3'].includes(id)) {
    const hits = lines.filter(l => references.get(l)?.length);
    return { status: hits.length ? 'partial' : 'missing', hits };
  }
  if (id === 'C1.2') {
    const hits = lines.filter(l => l.artifact.role !== 'spec' && !l.text.includes('[NEEDS CLARIFICATION:') && /architecture|component|technical|arquitectura|componente|técnico|^- \[[ x]\]/i.test(l.text));
    return { status: specRequirements.length && hits.length ? 'partial' : 'missing', hits };
  }
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
  const references = referencesOf(lines);
  const roles = new Set(active.map(a => a.role));
  const multipleFeatures = new Set(active.filter(a => a.role === 'spec').map(a => a.featureId)).size > 1;
  const practices: PracticeResult[] = PRACTICES.map(def => {
    const dimension = def.id.split('.')[0];
    const base = { id: def.id, dimension, title: def.title, suggestion: def.fix };
    const reason = options.notApplicable?.[def.id];
    if (reason) return { ...base, status: 'not_applicable', evidence: [], reason };
    if (multipleFeatures && ['I2.3', 'I2.4', 'I3.2', 'C1.2', 'C1.3', 'C2.3'].includes(def.id)) return { ...base, status: 'unknown', evidence: [], reason: 'Select one feature to assess companion-document completeness and cross-artifact consistency.' };
    const missingRoles = def.roles.filter(role => !roles.has(role));
    const roleRequired = def.roles.length === 1 || ['I2.3', 'I2.4', 'I3.2', 'C1.2', 'C1.3', 'C2.3'].includes(def.id);
    if ((roleRequired && missingRoles.length) || !active.length) return { ...base, status: 'unknown', evidence: [], reason: `Not assessed: supply ${missingRoles.join(', ') || 'source'} artifacts.` };
    // H6a (#88): quickstart lines count only as validation-method evidence (E3.2). H7a (#79): checklist lines are
    // never requirements or decisions, but count like any context document.
    const relevant = lines.filter(l => def.roles.includes(l.artifact.role) && (l.scope !== 'validation' || def.id === 'E3.2'));
    const special = evaluateSpecial(def.id, relevant, requirements, references);
    const hits = special?.hits ?? relevant.filter((l, i) => {
      if (!def.pattern?.test(l.text) || l.text.trim().length < 4) return false;
      if (l.text.includes('[NEEDS CLARIFICATION:') && !['E1.1', 'P2.5'].includes(def.id)) return false;
      if (/^\s*#/.test(l.text) && !['I1.1', 'I2.4', 'I3.1'].includes(def.id)) {
        const next = relevant.slice(i + 1).find(n => n.path === l.path && n.text.trim());
        return Boolean(next && !/^\s*#/.test(next.text) && !next.text.includes('[NEEDS CLARIFICATION:'));
      }
      return true;
    });
    const status = special?.status ?? (hits.length ? 'partial' : 'missing');
    return { ...base, status, evidence: hits.slice(0, 4).map(evidenceOf), reason: special?.status === 'supported' ? 'The deterministic check is satisfied; semantic review may still find gaps.' : hits.length ? 'Textual signals found. Presence does not establish completeness or correctness.' : 'No evidence found by this check in the supplied artifacts.' };
  });
  const findings: Finding[] = [];
  const add = (practiceId: string, line: Evidence, message: string, suggestion: string, severity: Finding['severity'] = 'warning') => {
    findings.push({ id: `${practiceId}:${line.path}:${line.line}:${findings.length}`, practiceId, dimension: practiceId.split('.')[0], severity, message, suggestion, evidence: [evidenceOf(line)], source: 'rule' });
  };
  const inherited = inheritedLines(lines);
  for (const line of requirements) {
    for (const match of line.text.replace(/\[NEEDS CLARIFICATION:[^\]]*\]/gi, '').matchAll(vagueTerms)) add('E1.2', line, `Unbounded wording: “${match[0]}”.`, 'Specify observable behavior and its conditions. Ask for any missing limit.');
    if (pronounSubject(line.text)) add('E1.3', line, 'The subject depends on a pronoun.', 'Name the responsible actor or component.');
    if (!identifiedOnLine(line) && !inherited.has(line) && line.artifact.role === 'spec') add('I1.2', line, 'Requirement has no stable identifier.', 'Assign a stable requirement ID and reference it from tasks.');
    if (/\b(?:and|y)\b.+\b(?:MUST|SHALL|DEBE)\b/i.test(line.text.replace(/\[NEEDS CLARIFICATION:[^\]]*\]/gi, ''))) add('E2.1', line, 'This statement may contain independent obligations.', 'Check whether the obligations can fail independently; split them if so.');
  }
  const definitions = definitionsOf(lines);
  for (const entries of definitions.values()) if (entries.length > 1) add('I1.2', entries[1], `Duplicate requirement identifier ${definingId.exec(entries[1].text)?.[1]}.`, 'Give distinct obligations distinct IDs within this feature.', 'error');
  // References resolve against defining positions and, as before, any ID on an admitted spec line.
  const resolvable = new Set(definitions.keys());
  for (const line of requirements.filter(l => l.artifact.role === 'spec')) {
    for (const raw of line.text.match(requirementId) ?? []) resolvable.add(line.artifact.featureId + ':' + raw.toUpperCase());
  }
  // H9: namespaces that the feature's own spec lines join to an ID.
  const ownNamespaces = new Set<string>();
  for (const line of lines.filter(l => l.artifact.role === 'spec' && (l.requirement || l.heading))) {
    for (const match of line.text.matchAll(requirementId)) {
      const namespace = namespaceOf(textBefore(line.text, match.index));
      if (namespace) ownNamespaces.add(line.artifact.featureId + ':' + namespace);
    }
  }
  const external = (featureId: string, prefix: string) => {
    const qualifier = qualifierOf(prefix);
    return qualifier !== undefined && !ownNamespaces.has(featureId + ':' + qualifier) && !isOwnSpec(qualifier, featureId);
  };
  const traceability: Assessment['traceability'] = [];
  for (const [line, matches] of references) {
    for (const match of matches) {
      const id = match[0].toUpperCase(); const resolved = resolvable.has(line.artifact.featureId + ':' + id);
      traceability.push({ from: line.path, to: id, evidence: evidenceOf(line), resolved });
      if (!resolved && roles.has('spec') && !external(line.artifact.featureId, textBefore(line.text, match.index))) add('I2.3', line, `Reference ${id} has no definition in the supplied specs.`, 'Correct the reference or include the defining specification.', 'error');
    }
  }
  // Only report contradictions that have explicit opposite obligations on the same normalized behavior.
  const behaviors = new Map<string, { line: Line; negative: boolean }>();
  for (const line of requirements) {
    const text = line.text.replace(/\b(?:FR|NFR|REQ|R)-\d+\s*:?/gi, '').replace(/^\s*[-*]\s*/, '').normalize('NFC').trim();
    const match = text.match(/^(.*?)(?<![\p{L}\p{N}\p{M}_])(?:(MUST|SHALL)\s+(?:(NOT|never)\s+)?|((?:NO|NUNCA)\s+)?(DEBE|DEBEN|DEBERÁ|DEBERÁN)(?:\s+(nunca))?\s+)(.+)$/iu);
    if (!match) continue;
    const negative = Boolean(match[3] || match[4] || match[6]);
    const key = line.artifact.featureId + ':mandatory:' + (match[1] + match[7]).replace(/\s+/g, ' ').toLowerCase();
    const previous = behaviors.get(key);
    if (previous && negative !== previous.negative) add('I2.3', line, 'Opposite obligations describe the same behavior.', `Resolve the conflict with ${previous.line.path}:${previous.line.line}.`, 'error');
    behaviors.set(key, { line, negative });
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
    decisions: lines.filter(l => l.scope === 'all' && /NEEDS CLARIFICATION|PENDIENTE DE ACLARAR/i.test(l.text)).map(evidenceOf), traceability,
  };
}
