import type { Artifact, LineKind } from './types.js';

// Match complete Unicode words, including accented Spanish and plural forms.
const word = '[\\p{L}\\p{N}\\p{M}_]';
const modal = /(?<![\p{L}\p{N}\p{M}_])(?:MUST|SHALL|SHOULD|MAY|DEBERÍAN|DEBERÍA|DEBERÁN|DEBERÁ|DEBEN|DEBE|PUEDEN|PUEDE)(?![\p{L}\p{N}\p{M}_])/giu;
const calendarMay = /(?<![\p{L}\p{N}\p{M}_])(?:May[ \t]+(?:\d{4}|(?:[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?)(?=[,.]|[ \t]+(?:is|was)\b)|(?:[Ii]n|[Dd]uring|[Ss]ince|[Uu]ntil|[Oo]f)[ \t]+May(?![\p{L}\p{N}\p{M}_]))/gu;
const monthItem = (name: string) => `(?:${name}|\`${name}\`|"${name}"|'${name}'|“${name}”|‘${name}’)`;
const monthEnumerationMay = new RegExp(
  `(?<![\\p{L}\\p{N}\\p{M}_])(${monthItem('Apr(?:il)?')}[ \\t]*,[ \\t]*)${monthItem('May')}([ \\t]*,[ \\t]*${monthItem('Jun(?:e)?')})(?![\\p{L}\\p{N}\\p{M}_])`,
  'giu',
);
const blank = (match: string) => ' '.repeat(match.length);

/** Normative modals as [start, end) offsets in the NFC text, after removing calendar months. */
function modalSpans(nfc: string): [number, number][] {
  const masked = nfc
    .replace(calendarMay, blank)
    .replace(monthEnumerationMay, (match, before: string, after: string) => before + ' '.repeat(match.length - before.length - after.length) + after);
  return [...masked.matchAll(modal)].map(hit => [hit.index!, hit.index! + hit[0].length] as [number, number]);
}

export const hasNormativeModal = (text: string) => modalSpans(text.normalize('NFC')).length > 0;

const keywordWords = new Set(['must', 'shall', 'should', 'may', 'deberían', 'debería', 'deberán', 'deberá', 'deben', 'debe', 'pueden', 'puede']);
const joiners = new Set(['or', 'and', 'o', 'y', 'not', 'no']);
/** A code span is a mention only when every word in it is a modal keyword or a joiner. */
function keywordOnlySpan(content: string): boolean {
  if (/[^\p{L}\p{N}\p{M}_\s/,|.]/u.test(content)) return false;
  const words = content.toLowerCase().split(/[^\p{L}\p{N}\p{M}_]+/u).filter(Boolean);
  return words.length > 0 && words.every(w => keywordWords.has(w) || joiners.has(w)) && words.some(w => keywordWords.has(w));
}

/**
 * Character ranges of mentions: keyword-only code spans on lines with an even number of
 * backticks, straight double quotes bounded by non-word characters, curly double quotes and
 * guillemets. Single quotes are not mentions.
 */
export function mentionRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  const evenBackticks = [...text].filter(char => char === '`').length % 2 === 0;
  const isWord = (char: string | undefined) => char !== undefined && new RegExp(word, 'u').test(char);
  const pairs: Record<string, string> = { '“': '”', '«': '»' };
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (char === '`') {
      let n = 0;
      while (text[i + n] === '`') n++;
      let j = i + n;
      let close = -1;
      while (j < text.length) {
        if (text[j] === '`') {
          let m = 0;
          while (text[j + m] === '`') m++;
          if (m === n) { close = j; break; }
          j += m;
        } else j++;
      }
      if (close > i + n) {
        if (evenBackticks && keywordOnlySpan(text.slice(i + n, close))) ranges.push([i, close + n]);
        i = close + n;
      } else i += n;
      continue;
    }
    if (pairs[char]) {
      const close = text.indexOf(pairs[char], i + 1);
      if (close > 0) { ranges.push([i, close + 1]); i = close + 1; continue; }
    }
    if (char === '"' && !isWord(text[i - 1])) {
      let close = text.indexOf('"', i + 1);
      while (close > 0 && isWord(text[close + 1])) close = text.indexOf('"', close + 1);
      if (close > 0) { ranges.push([i, close + 1]); i = close + 1; continue; }
    }
    i++;
  }
  return ranges;
}

/** A normative modal that is not inside a mention. */
function hasObligationModal(text: string): boolean {
  const nfc = text.normalize('NFC');
  const spans = modalSpans(nfc);
  if (!spans.length) return false;
  const ranges = mentionRanges(nfc);
  return spans.some(([start]) => !ranges.some(([from, to]) => start >= from && start < to));
}

/** Nearest heading per level above each line, outermost first; index i is the chain after the first i lines. */
function chainsOf(lines: string[]): string[][] {
  const chains: string[][] = [[]];
  let chain: string[] = [];
  let fence: { char: string; length: number } | undefined;
  for (const text of lines) {
    const run = /^\s*(`{3,}|~{3,})/u.exec(text);
    if (run) {
      if (!fence) fence = { char: run[1][0], length: run[1].length };
      else if (run[1][0] === fence.char && run[1].length >= fence.length) fence = undefined;
    } else {
      const heading = !fence && /^(#{1,6})\s+(.*\S)\s*#*\s*$/u.exec(text);
      if (heading) { chain = chain.slice(0, heading[1].length - 1); chain[heading[1].length - 1] = heading[2]; }
    }
    chains.push(chain);
  }
  return chains.map(entry => entry.filter(Boolean));
}

/** Nearest heading per level above the line, outermost first. */
export const headingChain = (lines: string[], line: number): string[] => chainsOf(lines.slice(0, line - 1)).at(-1)!;

export interface LineContext { chain: string[]; fenced: boolean; comment: boolean }

const bullet = /^\s*(?:[-*+]|\d+[.)])\s+/u;
const idPrefix = /^(?:\*\*|__)?[A-Za-z]{1,5}-\d+(?:\.\d+)*[:.)]?(?:\*\*|__)?\s*/u;
const changeLog = /change ?log|history|revision|historial|cambios/iu;
const acceptanceSection = /acceptance criteria|success criteria|scenario|criterios de (?:aceptación|éxito)|escenario/iu;
const requirementsSection = /requirements?|requisitos?|constraints|restricciones|functional|funcionales|non-functional|no funcionales/iu;
const stepWords = 'GIVEN|WHEN|THEN|DADO|CUANDO|ENTONCES';
const wordEnd = '(?![\\p{L}\\p{N}\\p{M}_])';
// A step marked as a list item or in bold may use any case; a bare line must use the uppercase keyword.
const listedStep = new RegExp(`^\\s*(?:(?:[-*+]|\\d+[.)])\\s+(?:\\*\\*)?|\\*\\*)(?:${stepWords})${wordEnd}`, 'iu');
const bareStep = new RegExp(`^\\s*(?:${stepWords})${wordEnd}`, 'u');
const scenarioJoin = new RegExp(`^\\s*(?:[-*+]\\s+)?(?:\\*\\*)?(?:AND|And|BUT|But|Y)${wordEnd}`, 'u');
const scenarioStep = { test: (text: string) => listedStep.test(text) || bareStep.test(text) };
const definingId = (names: string) => new RegExp(`^\\s*(?:(?:[-*+]|\\d+[.)])\\s+)?(?:\\[[ xX]\\]\\s*)?(?:\\|\\s*)?(?:\\*\\*|__|\`)?(?:${names})-\\d+\\b`, 'iu');
const requirementId = definingId('FR|NFR|RF|RNF|REQ|R|C|CON');
const criterionId = definingId('SC');
const taskItem = /^\s*(?:[-*+]|\d+[.)])\s+\[[ xX]\]/u;
const negative = /^(?:No|Never|Sin|Nunca|Ningún|Ninguna)(?![\p{L}\p{N}\p{M}_])/iu;
const systemSubject = /(?<![\p{L}\p{N}\p{M}_])(?:(?:the|el|la|los|las)\s+)?(?:system|sistema|app|application|aplicación|api|service|servicio|platform|plataforma|server|servidor)\s+(?:will|can|is able to|es capaz de|permite|[\p{L}]+rán?)(?![\p{L}\p{N}\p{M}_])/iu;
const stopWords = new Set(`the a an this that these those it its they we you i he she there here each every all any some one in on at for to of with by from as if when while where which who what how why and or but so also see note e.g. i.e. el la los las un una unos unas este esta estos estas ese esa eso esto ello se su sus en de del con por para como si cuando donde que quien y o pero también ver nota cada todo todos toda todas algún alguna cualquier mi tu nuestro`.split(/\s+/));
const nominalSuffix = /(?:ing|tion|sion|ment|ness|ity|ción|sión|miento|idad|mente)$/iu;
const spanishWords = new Set('el la los las del de que con para por se un una y en al su sus es'.split(' '));
const englishWords = new Set('the and to of with for is are be a an in on that this'.split(' '));
const infinitive = /(?:ar|er|ir)(?:se)?$/iu;

/** Imperative (English) or infinitive (Spanish) first word, by exclusion of closed-class and nominal openers. */
function startsWithVerb(item: string): boolean {
  const body = item.replace(idPrefix, '').replace(/^(?:\*\*|__)/u, '');
  const first = /^[\p{L}][\p{L}'’-]*/u.exec(body)?.[0];
  if (!first || first.length < 2) return false;
  const lower = first.toLowerCase();
  if (stopWords.has(lower) || nominalSuffix.test(lower)) return false;
  const tokens = body.toLowerCase().match(/[\p{L}]+/gu) ?? [];
  const spanish = tokens.filter(token => spanishWords.has(token)).length > tokens.filter(token => englishWords.has(token)).length;
  return spanish ? infinitive.test(lower) : true;
}

export interface Admission { kind: LineKind; rule: number }
const decide = (kind: LineKind, rule: number): Admission => ({ kind, rule });

/** Classify one spec line from its text, heading chain and fence and comment state; `rule` is the number of the rule that decided. */
export function admitLine(text: string, context: LineContext): Admission {
  const nfc = text.normalize('NFC');
  // 1. Structure.
  if (context.fenced || context.comment || !nfc.trim() || /^\s*(?:#|>|```|~~~)/u.test(nfc)) return decide('other', 1);
  // 2. Change-log section.
  const chain = context.chain.join('\n');
  if (changeLog.test(chain)) return decide('other', 2);
  // 3. Question.
  const item = nfc.replace(bullet, '').replace(idPrefix, '').trim();
  if (/\?[\s*_)"'”»`]*$/u.test(item) || item.startsWith('¿')) return decide('other', 3);
  // 4. Modal obligation outside mentions.
  if (hasObligationModal(nfc)) return decide('requirement', 4);
  const listed = bullet.test(nfc);
  // 5. Acceptance.
  if (scenarioStep.test(nfc) || scenarioJoin.test(nfc) || criterionId.test(nfc) || (listed && acceptanceSection.test(chain))) return decide('acceptance', 5);
  // 6. Defining-position ID.
  if (requirementId.test(nfc)) return decide('requirement', 6);
  // 7. Requirements section.
  if (listed && !taskItem.test(nfc) && requirementsSection.test(context.chain.at(-1) ?? '')) {
    const rest = nfc.replace(bullet, '');
    if (negative.test(rest) || startsWithVerb(rest)) return decide('requirement', 7);
  }
  // 8. System subject with a future or capability verb.
  const subject = systemSubject.exec(nfc);
  if (subject && !mentionRanges(nfc).some(([from, to]) => subject.index >= from && subject.index < to)) return decide('requirement', 8);
  // 9. Otherwise.
  return decide('other', 9);
}

export const classifyLine = (text: string, context: LineContext): LineKind => admitLine(text, context).kind;

/** 0.1.4 rule, kept for plans, tasks and other roles: an ID or a normative modal, outside fences, headings, quotes and scenario steps. */
function legacyKind(text: string, fenced: boolean): LineKind {
  const scenario = /^\s*(?:[-*]\s*)?(?:GIVEN|WHEN|THEN|DADO|CUANDO|ENTONCES)\b/i.test(text);
  return !fenced && !scenario && !/^\s*(?:#|>|```|~~~)/.test(text) && (/\b(?:FR|NFR|REQ)-\d+\b/i.test(text) || hasNormativeModal(text)) ? 'requirement' : 'other';
}

/** The decision for every line of the artifact, in order. Only spec artifacts use the line grammar (rule 0 is the 0.1.4 rule). */
export function admitLines(artifact: Artifact): Admission[] {
  const lines = artifact.content.split(/\r?\n/);
  const chains = artifact.role === 'spec' ? chainsOf(lines) : [];
  let fenced = false;
  let comment = false;
  return lines.map((text, index) => {
    if (/^\s*(?:```|~~~)/.test(text)) fenced = !fenced;
    if (artifact.role !== 'spec') return decide(legacyKind(text, fenced), 0);
    const starts = text.includes('<!--');
    const inComment = comment || starts;
    if (starts) comment = true;
    if (comment && text.includes('-->') && text.lastIndexOf('-->') > text.lastIndexOf('<!--')) comment = false;
    return admitLine(text, { chain: chains[index], fenced, comment: inComment });
  });
}

/** The kind of every line of the artifact, in order. */
export const classifyLines = (artifact: Artifact): LineKind[] => admitLines(artifact).map(entry => entry.kind);
