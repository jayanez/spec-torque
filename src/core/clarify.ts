import { contentHash } from './artifacts.js';
import type { Artifact, ArtifactSet, Assessment, Evidence, Language } from './types.js';

const reasons = {
  'named-option': ['The highlighted word names an option in this requirement.', 'La palabra resaltada identifica una opción en este requisito.'],
  unsupported: ['The cited wording does not identify a decision precisely enough to ask a grounded question.', 'El texto citado no identifica la decisión con suficiente precisión para formular una pregunta.'],
  'already-specified': ['The cited evidence already specifies this decision.', 'La evidencia citada ya especifica esta decisión.'],
  'conflicting-evidence': ['The cited sources give different values for the same decision. Review them together.', 'Las fuentes citadas dan valores distintos para la misma decisión. Revísalas juntas.'],
  'ambiguous-reference': ['More than one active requirement defines this identifier in the same feature.', 'Más de un requisito vigente define este identificador en la misma funcionalidad.'],
  'owner-unavailable': ['The linked evidence says the decision owner is unavailable or pending.', 'La evidencia vinculada indica que falta designar al responsable o que no está disponible.'],
} as const;

const questions = {
  'bound-and-measurement': ['What maximum elapsed time applies here, and which events start and end its measurement?', '¿Qué tiempo máximo se admite y qué eventos marcan el inicio y el fin de su medición?'],
  bound: ['What maximum elapsed time applies under the cited measurement conditions?', '¿Qué tiempo máximo se admite en las condiciones de medición citadas?'],
  measurement: ['Which events start and end the elapsed-time measurement?', '¿Qué eventos marcan el inicio y el fin de la medición del tiempo transcurrido?'],
  'bound-and-start': ['What maximum elapsed time applies, and which event starts its measurement?', '¿Qué tiempo máximo se admite y qué evento inicia su medición?'],
  'bound-and-end': ['What maximum elapsed time applies, and which event ends its measurement?', '¿Qué tiempo máximo se admite y qué evento pone fin a su medición?'],
  'measurement-start': ['Which event starts the elapsed-time measurement?', '¿Qué evento inicia la medición del tiempo transcurrido?'],
  'measurement-end': ['Which event ends the elapsed-time measurement?', '¿Qué evento pone fin a la medición del tiempo transcurrido?'],
  trigger: ['What event or condition should trigger the removal described here?', '¿Qué evento o condición debe activar la retirada descrita aquí?'],
  behavior: ['What observable behavior would count as adapting under the stated conditions?', '¿Qué comportamiento observable demostraría que se ha producido la adaptación en las condiciones indicadas?'],
  criterion: ['What observable criterion would establish that this action is easy enough?', '¿Qué criterio observable permitiría determinar si esta acción es suficientemente fácil?'],
} as const;

const disappearanceQuestion = ['What event or condition should make it disappear?',
  '¿Qué evento o condición debe hacer que desaparezca?'] as const;

type QuestionFocus = keyof typeof questions;
interface ClarificationContext { revision: string; reason: string; evidence: Evidence[] }
export type Clarification = ClarificationContext & (
  | { kind: 'question'; focus: QuestionFocus; question: string }
  | { kind: 'abstain' | 'review'; focus: keyof typeof reasons }
);

type FactKind = 'bound' | 'start' | 'end' | 'trigger' | 'owner';
interface Fact { kind: FactKind; value: string; evidence: Evidence }

const definition = /^\s*(?:[-*+]\s+)?(?:\*\*)?((?:FR|NFR|REQ|R)-\d+)\b(?:\*\*)?\s*:?\s*/i;
const duration = /^(\d+(?:[.,]\d+)?)\s*(ms|milliseconds?|milisegundos?|s|seconds?|segundos?|minutes?|minutos?)(?![\p{L}\p{N}])/iu;
const inlineBound = /^(?:within|in|en menos de|dentro de|en)\s+/iu;
const measurement = /(?:^|\s)(?:measured from|medid[oa] desde)\s+([^,;]+?)\s+(?:to|until|hasta)\s+([^,;]+)(?=[,;]|$)/iu;
const existingDecision = /\[(?:needs clarification|pendiente de aclarar)\s*:/iu;
const missingOwner = /^(?:tbd|pending|unavailable|unassigned|pendiente|sin asignar|no disponible)[.!]?$/iu;

const factLabels: ReadonlyArray<readonly [FactKind, RegExp]> = [
  ['bound', /^(?:latency limit|límite de latencia)\s*:\s*(.+)$/iu],
  ['start', /^(?:measurement start|inicio de medición)\s*:\s*(.+)$/iu],
  ['end', /^(?:measurement end|fin de medición)\s*:\s*(.+)$/iu],
  ['trigger', /^(?:trigger event|evento disparador)\s*:\s*(.+)$/iu],
  ['owner', /^(?:decision owner|responsable de la decisión)\s*:\s*(.+)$/iu],
];

const removalVerb = /\b(?:disappear|dismiss|remove|clear|hide|close|desaparecer|retirar|cerrar(?:se)?|ocultar|limpiar)\b/u;
const removalCondition = /\b(?:when|if|after|until|upon|cuando|si|después de|hasta|al confirmar)\b/u;

function removalTarget(clause: string): string | undefined {
  const action = removalVerb.exec(clause);
  if (!action) return;
  const subject = clause.slice(0, action.index).trim().replace(definition, '');
  const object = clause.slice(action.index + action[0].length).split(removalCondition)[0];
  const target = (/^(?:disappear|desaparecer)$/u.test(action[0])
    ? subject.replace(/(?:^|\s+)(?:must|shall|debe(?:n|rán?)?)$/u, '')
    : object).trim().replace(/^(?:the|a|an|el|la|los|las|un|una)\s+/u, '');
  return target && !/^(?:it|them|they|lo|la|los|las|esto|eso)$/u.test(target) ? target : undefined;
}

function activeLines(artifact: Artifact): Evidence[] {
  let fence: string | undefined;
  let comment = false;
  return artifact.content.split(/\r?\n/).flatMap((text, index) => {
    if (!fence && (comment || text.includes('<!--'))) {
      comment = text.lastIndexOf('<!--') > text.lastIndexOf('-->') || comment && !text.includes('-->');
      return [];
    }
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(text);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = undefined;
      return [];
    }
    return fence || /^\s*(?:>|#)/.test(text) ? [] : [{ path: artifact.path, line: index + 1, text }];
  });
}

const unresolvedValue = /^(?:tbd|tba|pending|unknown|to be (?:defined|determined)|as needed|when necessary|pendiente|por (?:definir|determinar)|desconocid[oa]|cuando sea necesario)[.!]?$/iu;

function isConcreteValue(value: string): boolean {
  return Boolean(value) && !unresolvedValue.test(value) && !/\[|\?/.test(value);
}

function linkedFact(evidence: Evidence): Fact[] {
  const text = evidence.text.replace(definition, '').normalize('NFC');
  return factLabels.flatMap(([kind, pattern]) => {
    const match = pattern.exec(text);
    if (!match) return [];
    const value = match[1].trim();
    // A marker or a relative/qualitative limit is not a completed measurement.
    if (!value || kind === 'bound' && (!duration.test(value) || !/^[.!]?$/.test(value.replace(duration, '').trim())) ||
        kind !== 'owner' && !isConcreteValue(value)) return [];
    return [{ kind, value, evidence }];
  });
}

function distinctValues(facts: Fact[], kind: FactKind): number {
  return new Set(facts.filter(f => f.kind === kind).map(({ value }) => {
    if (kind === 'bound') {
      const match = duration.exec(value);
      if (match) {
        const unit = match[2].toLowerCase();
        const scale = /^(?:ms|milli|mili)/.test(unit) ? 1 : /^min/.test(unit) ? 60000 : 1000;
        return Number(match[1].replace(',', '.')) * scale;
      }
    }
    return value.normalize('NFC').trim().replace(/[.!]$/, '').replace(/\s+/g, ' ').toLowerCase();
  })).size;
}

/** Read-only, revision-bound guidance for an assessed E1.2 finding. */
export async function clarifyE12(
  set: ArtifactSet, assessment: Assessment, findingId: string, language: Language,
): Promise<Clarification | undefined> {
  const finding = assessment.findings.find(f => f.id === findingId && f.practiceId === 'E1.2');
  const anchor = finding?.evidence[0];
  const artifact = anchor && set.artifacts.find(a => a.path === anchor.path);
  if (!anchor || !artifact || artifact.archived || set.artifacts.length !== assessment.artifacts.length ||
      !set.artifacts.every((a, i) => a.path === assessment.artifacts[i].path)) return;

  const scope = set.artifacts.filter(a => a.featureId === artifact.featureId && !a.archived);
  const snapshot = new Map(assessment.artifacts.map(a => [a.path, a]));
  if (scope.length !== assessment.artifacts.filter(a => a.featureId === artifact.featureId && !a.archived).length) return;
  const verified = await Promise.all(scope.map(async a => {
    const recorded = snapshot.get(a.path);
    return recorded && recorded.featureId === a.featureId && recorded.role === a.role &&
      recorded.framework === a.framework && !recorded.archived && recorded.hash === await contentHash(a.content);
  }));
  if (!verified.every(Boolean)) return;
  const locale = language === 'es' ? 1 : 0;
  const decline = (focus: keyof typeof reasons, evidence: Evidence[] = [anchor]): Clarification => ({
    kind: focus === 'conflicting-evidence' || focus === 'ambiguous-reference' || focus === 'owner-unavailable' ? 'review' : 'abstain',
    focus, revision: assessment.id, reason: reasons[focus][locale], evidence,
  });

  const targetLines = activeLines(artifact);
  const target = targetLines.find(l => l.line === anchor.line);
  if (artifact.content.split(/\r?\n/)[anchor.line - 1]?.slice(0, 300) !== anchor.text) return;
  if (!target || artifact.role !== 'spec' || target.text !== anchor.text || existingDecision.test(target.text)) return decline('unsupported');

  const cue = /^Unbounded wording: “([^”]+)”\.$/.exec(finding.message)?.[1].toLowerCase();
  const text = target.text.normalize('NFC').toLowerCase();
  if (!cue) return decline('unsupported');
  const index = text.indexOf(cue);
  if (index < 0 || text.indexOf(cue, index + cue.length) !== -1) return decline('unsupported');
  const before = text.slice(0, index);
  const after = text.slice(index + cue.length);
  if (/\b(?:(?:profile|preset|mode|option|perfil|modo|opción)(?:\s+(?:named|called|llamado|llamada))?\s+)[`"“'‘«]$/u.test(before) &&
      /^[`"”'’»]/u.test(after)) return decline('named-option');

  // Omit labels from the language cues while keeping the original evidence and offsets.
  const unquoted = text.replace(/"[^"\n]*"|“[^”\n]*”|«[^»\n]*»|‘[^’\n]*’|(`+)[^`\n]+\1/gu,
    span => ' '.repeat(span.length));
  if (unquoted.slice(index, index + cue.length) !== cue) return decline('unsupported');
  const clause = unquoted.slice(0, index).split(/[,;]/).at(-1) ?? '';
  // The last normative phrase governs the cue in a compound requirement.
  const modal = [...clause.matchAll(/\b(?:(?:no|nunca)\s+)?(?:must|shall|may|should|no puede|pueden?|debe(?:n|rán?|rían?)?)(?:\s+(?:not|never|nunca|no))?\b/gu)].at(-1);
  if (!modal || !/^(?:must|shall|debe(?:n|rán?)?)$/u.test(modal[0]) ||
      /(?:[`"'“‘«])$/u.test(before)) return decline('unsupported');
  const timing = /^(?:fast|quickly|rápid[oa]s?)$/u.test(cue) &&
    /\b(?:search|lookup|query|response|acknowledg\w*|load|render|búsqueda|consulta|respuesta|acuse|cargar|mostrar)\b/u.test(clause);
  // A vague cue after a conjunction can qualify a different action.
  const earlierActions = unquoted.slice(0, index).split(/[,;]|\b(?:and|or|but|y|o|pero)\s+/u);
  const actionClause = earlierActions.pop() ?? '';
  const disappearance = /\b(?:disappear|desaparecer)\b/u.test(actionClause);
  const removal = removalVerb.test(actionClause);
  const event = /^(?:as needed|cuando sea necesario)$/u.test(cue) && removal;
  const ease = /^(?:easily|fácilmente)$/u.test(cue) && removal;
  const adaptation = /^(?:fast|quickly|rápid[oa]s?)$/u.test(cue) && /\b(?:adapt|adaptar(?:se)?)\s*$/u.test(clause);
  if (!timing && !event && !ease && !adaptation) return decline('unsupported');
  if (timing && (/\bas\s+$/u.test(before) || /^\s*(?:than|que|como)\b/u.test(after))) return decline('unsupported');
  if (event) {
    const target = removalTarget(actionClause);
    const possiblySameRemoval = earlierActions.some(action => {
      if (!removalCondition.test(action) || !removalVerb.test(action)) return false;
      const priorTarget = removalTarget(action);
      return !target || !priorTarget || target === priorTarget;
    });
    if (removalCondition.test(actionClause + ' ' + after.split(/[,;]/)[0]) || possiblySameRemoval) {
      return decline('unsupported');
    }
  }

  const id = definition.exec(target.text)?.[1].toUpperCase();
  const definitions = id ? scope.filter(a => a.role === 'spec').flatMap(a => a === artifact ? targetLines : activeLines(a))
    .filter(e => definition.exec(e.text)?.[1].toUpperCase() === id) : [];
  if (definitions.length > 1) return decline('ambiguous-reference', definitions);
  const facts: Fact[] = [];
  const tail = after.trimStart();
  const selectedBound = timing && inlineBound.test(tail) && duration.exec(tail.replace(inlineBound, ''));
  if (selectedBound) facts.push({ kind: 'bound', value: selectedBound[0], evidence: target });
  // A more distant duration may belong to another action or to a condition.
  if (timing && !selectedBound && /\d\s*(?:ms|milliseconds?|milisegundos?|seconds?|segundos?|minutes?|minutos?)\b/u.test(clause + ' ' + tail)) {
    return decline('unsupported');
  }
  const inlineMeasurement = timing && measurement.exec(tail);
  if (inlineMeasurement) {
    const start = inlineMeasurement[1].trim();
    const end = inlineMeasurement[2].trim();
    if (isConcreteValue(start)) facts.push({ kind: 'start', value: start, evidence: target });
    if (isConcreteValue(end)) facts.push({ kind: 'end', value: end, evidence: target });
  }
  if (id && definitions.length === 1) {
    const referenced = new Set(assessment.traceability.filter(edge => edge.resolved && edge.to === id)
      .map(edge => JSON.stringify([edge.from, edge.evidence.line, edge.evidence.text])));
    for (const companion of scope.filter(a => a.role === 'plan' || a.role === 'tasks')) {
      for (const line of activeLines(companion)) {
        if (definition.exec(line.text)?.[1].toUpperCase() !== id ||
            !referenced.has(JSON.stringify([line.path, line.line, line.text]))) continue;
        facts.push(...linkedFact(line));
      }
    }
  }
  const kinds: FactKind[] = timing ? ['bound', 'start', 'end'] : event ? ['trigger'] : [];
  const relevant = facts.filter(f => kinds.includes(f.kind) || f.kind === 'owner');
  const evidence = [target, ...new Set(relevant.map(f => f.evidence).filter(e => e !== target))];
  if ([...kinds, 'owner' as const].some(kind => distinctValues(facts, kind) > 1)) return decline('conflicting-evidence', evidence);
  if (facts.some(f => f.kind === 'owner' && missingOwner.test(f.value))) return decline('owner-unavailable', evidence);
  const has = (kind: FactKind) => facts.some(f => f.kind === kind);
  const bounded = has('bound');
  const starts = has('start');
  const ends = has('end');
  if (event && has('trigger') || timing && bounded && starts && ends) return decline('already-specified', evidence);
  const missingMeasurement = starts ? 'measurement-end' : ends ? 'measurement-start' : 'measurement';
  const missingBound = starts ? ends ? 'bound' : 'bound-and-end' : ends ? 'bound-and-start' : 'bound-and-measurement';
  const focus = event ? 'trigger' : ease ? 'criterion' : adaptation ? 'behavior' : bounded ? missingMeasurement : missingBound;
  return {
    kind: 'question', focus, revision: assessment.id, question: (focus === 'trigger' && disappearance ? disappearanceQuestion : questions[focus])[locale], evidence,
    reason: locale === 1 ? 'La evidencia deja esta decisión abierta.' : 'The cited evidence leaves this decision open.',
  };
}
