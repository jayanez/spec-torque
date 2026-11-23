// Search cues rank leads for review. They are independent of the engine's patterns.
const exception = /\b(edge cases?|boundary|out of range|malformed|invalid|empty|failure|casos? limite|fuera de rango|incorrect[oa]s?|invalid[oa]s?|vaci[oa]s?|fallos?)\b/u;
const conditionAndOutcome = /\b(?:if|when|si|cuando)\s+([^,.?;]+)[,.?;]\s*([^.?;]+)/u;
const emptyCondition = /\b(?:empty|no content|no (?:rows|results|records)|vaci[oa]s?|sin contenido|sin (?:filas|resultados|registros)|no (?:hay|tiene) contenido)\b/u;
const emptyOutcome = /\b(?:is created|are created|creates?|will (?:show|display|return)|(?:shows?|displays?|returns?)\s+|se (?:crea(?:ra)?|muestra(?:ra)?|devuelve|devolvera)|(?:creara|mostrara|devolvera)\s+)\b/u;

function hasEmptyCaseOutcome(body: string): boolean {
  // Treat command names and flags as literals, not condition or outcome words.
  const prose = body.replace(/(`+)[^`]+\1(?!`)/gu, ' ');
  const parts = conditionAndOutcome.exec(prose);
  return parts !== null && emptyCondition.test(parts[1]) && emptyOutcome.test(parts[2]);
}
const interruption = /\b(upstream|provider|dependency|no response|stops? responding|unavailable|timeout|proveedor|dependencia|servicio externo|deja de responder|no responde|no disponible|interrupcion)\b/u;
const response = /\b(reject\w*|retry|retries|try again|try twice more|unchanged|retain\w*|rollback|preserv\w*|return\w* an? error|rechaz\w*|reintent\w*|intentar de nuevo|intentar dos veces mas|sin cambios|no se modific\w*|devolv\w* un error)\b/u;
const pending = /\b(tbd|undecided|pending|to be defined|defined later|por definir|pendiente|sin definir|se definira)\b/u;
const criteria = /\b(acceptance criteria|success criteria|pass condition|passes if|criterios? de (?:aceptacion|exito)|condicion de aprobacion|se acepta si)\b/u;
const method = /\b(verification method|manual check|run the suite|execute the tests|verify by|check by|metodo de verificacion|comprobacion manual|ejecutar las pruebas|comprobar mediante|verificar con|ejecutar la bateria de pruebas)\b/u;
const test = /\b(test\w*|scenario|exercise|prueb\w*|escenario|simular|comprobar)\b/u;
const done = /\b(definition of done|exit criteria|ready when|complete when|finished once|criterios? de salida|terminad[oa] cuando|finalizad[oa] cuando|list[oa] cuando|definicion de terminado)\b/u;

export interface Passage {
  start: number;
  end: number;
  headings: string[];
  kind: 'heading' | 'table' | 'list' | 'prose';
  text: string;
  tableHeader?: string;
}

export const normalize = (text: string) => text.normalize('NFC').toLowerCase().replace(/\s+/gu, ' ').trim();
const fold = (text: string) => normalize(text).normalize('NFD').replace(/\p{M}/gu, '');
const headingLine = /^ {0,3}(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/u;
const fenceLine = /^\s*(`{3,}|~{3,})(.*)$/u;
const listLine = /^(\s*)(?:[-+*]|\d+[.)])[ \t]+/u;
const tableDelimiter = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|?\s*$/u;
const hasPipe = (line: string) => /(?<!\\)\|/u.test(line);

export function passagesOf(lines: readonly string[]): Passage[] {
  const passages: Passage[] = [];
  const headings: { depth: number; text: string }[] = [];
  let fence: string | undefined;
  let tableHeader: string | undefined;
  let flow: Passage | undefined;
  let listIndent = 0;
  function begin(index: number, kind: Passage['kind'], header?: string): Passage {
    const passage = { start: index + 1, end: index + 1, headings: headings.map(item => item.text),
      kind, text: lines[index], ...(header === undefined ? {} : { tableHeader: header }) };
    passages.push(passage);
    return passage;
  }
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const marker = fenceLine.exec(line);
    if (fence || marker) {
      if (fence && marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) {
        fence = undefined;
      } else if (!fence) {
        fence = marker?.[1];
      }
      tableHeader = undefined;
      flow = undefined;
      continue;
    }
    const heading = headingLine.exec(line);
    if (heading) {
      while (headings.length && headings.at(-1)!.depth >= heading[1].length) headings.pop();
      headings.push({ depth: heading[1].length, text: heading[2] });
      begin(index, 'heading');
      flow = undefined;
      tableHeader = undefined;
      continue;
    }
    if (hasPipe(line) && tableDelimiter.test(lines[index + 1] ?? '')) {
      tableHeader = line;
      begin(index, 'table');
      index++;
      flow = undefined;
      continue;
    }
    if (tableHeader && hasPipe(line)) {
      begin(index, 'table', tableHeader);
      continue;
    }
    tableHeader = undefined;
    if (!line.trim() || tableDelimiter.test(line)) {
      flow = undefined;
      continue;
    }
    const list = listLine.exec(line);
    if (list) {
      flow = begin(index, 'list');
      listIndent = list[1].length;
    } else if (flow && (flow.kind === 'prose' || /^\s*/u.exec(line)![0].length > listIndent)) {
      flow.end = index + 1;
      flow.text += '\n' + line;
    } else {
      flow = begin(index, 'prose');
    }
  }
  return passages;
}

type Practice = 'P2.2' | 'P1.4' | 'E3.1' | 'E3.2' | 'E3.3' | 'E3.4' | 'I1.2';
type Rule = (input: { body: string; headings: string; table: string; passage: Passage }) => string[];

const rules = {
  'P2.2': ({ body, headings, table, passage }) => [
    ...(passage.kind === 'heading' && /^(boundary|limites?|casos? limite)$/u.test(fold(passage.headings.at(-1) ?? '')) ? ['boundary-heading'] : []),
    ...(passage.kind !== 'heading' && hasEmptyCaseOutcome(body) ? ['empty-condition-and-outcome'] : []),
    ...(/\bcasos limite\b/u.test(body) ? ['spanish-plural'] : []),
    ...(response.test(body) && (exception.test(body) ||
      (passage.kind === 'table' && (exception.test(headings) || exception.test(table)))) ? ['exception-and-response'] : []),
  ],
  'P1.4': ({ body }) => interruption.test(body) && (response.test(body) || pending.test(body))
    ? ['dependency-and-response-or-pending'] : [],
  'E3.1': ({ body }) => criteria.test(body) ? [pending.test(body) ? 'criteria-pending' : 'criteria-wording'] : [],
  'E3.2': ({ body }) => method.test(body) ? [pending.test(body) ? 'method-pending' : 'method-wording'] : [],
  'E3.3': ({ body, headings }) => test.test(body) && (exception.test(body) || exception.test(headings)) ? ['test-and-exception'] : [],
  'E3.4': ({ body }) => done.test(body) ? [pending.test(body) ? 'completion-pending' : 'completion-wording'] : [],
  'I1.2': ({ body }) => [
    ...(/\b(?:rf|rnf)-\d+\b/u.test(body) ? ['known-spanish-id'] : []),
    ...(new Set(body.match(/\b(?:fr|nfr|req|r)-\d+\b/gu)).size > 1 ? ['multiple-ids'] : []),
  ],
} satisfies Record<Practice, Rule>;

export function leadsFor(passage: Passage) {
  const input = { passage, body: fold(passage.text), headings: fold(passage.headings.join(' ')),
    table: fold(passage.tableHeader ?? '') };
  return (Object.keys(rules) as Practice[]).flatMap(practice => {
    const cues = rules[practice](input);
    return cues.length ? [{ practice, cues }] : [];
  });
}
