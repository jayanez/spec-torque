import { createHash } from 'node:crypto';
import type { Engine } from './engines.js';

export type Label = 'positive' | 'negative' | 'unknown';
export const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

/** Split into text segments while keeping each original line separator. */
export function segments(content: string): { text: string; eol: string }[] {
  const parts = content.split(/(\r?\n)/u);
  const rows: { text: string; eol: string }[] = [];
  for (let index = 0; index < parts.length; index += 2) rows.push({ text: parts[index], eol: parts[index + 1] ?? '' });
  return rows;
}

// Superset of the tokens that can admit a line in either engine arm.
const token = /(?<![\p{L}\p{N}\p{M}_])(?:MUST|SHALL|SHOULD|MAY|DEBERÍAN|DEBERÍA|DEBERÁN|DEBERÁ|DEBEN|DEBE|PUEDEN|PUEDE)(?![\p{L}\p{N}\p{M}_])|\b(?:FR|NFR|REQ|R)-\d+\b/iu;
// Lines that may carry Markdown structure. They are never blanked by the probe.
const structural = /^\s*(?:#|>|`{3,}|~{3,})/u;

export const candidateLines = (content: string) => segments(content)
  .map((row, index) => ({ line: index + 1, text: row.text.normalize('NFC') }))
  .filter(row => token.test(row.text)).map(row => row.line);

/**
 * Keep the target line and every structural line; blank other lines that contain a
 * candidate token. Separators, line numbers and target bytes are unchanged, so the
 * target is the only possible requirement line in the probe document.
 */
export function isolate(content: string, line: number): string {
  return segments(content).map((row, index) => {
    const keep = index + 1 === line || structural.test(row.text) || !token.test(row.text.normalize('NFC'));
    return (keep ? row.text : '') + row.eol;
  }).join('');
}

export interface LinePrediction { admitted: boolean; 'E1.4': Label; 'E1.2': Label; evidenceValid: boolean | null }

export async function predictLine(engine: Engine, path: string, content: string, line: number): Promise<LinePrediction> {
  const artifact = engine.classifyArtifact(path, isolate(content, line));
  const report = await engine.analyze({ name: 'probe', artifacts: [artifact] });
  const original = segments(content)[line - 1]?.text ?? '';
  const out: LinePrediction = { admitted: false, 'E1.4': 'unknown', 'E1.2': 'unknown', evidenceValid: null };
  for (const rule of ['E1.4', 'E1.2'] as const) {
    const practice = report.practices.find(item => item.id === rule);
    if (!practice || practice.status === 'unknown') continue;
    out.admitted = true;
    const hit = practice.evidence.find(item => item.path === artifact.path && item.line === line);
    out[rule] = hit ? 'positive' : 'negative';
    if (hit) out.evidenceValid = (out.evidenceValid ?? true) && hit.text === original.slice(0, 300);
  }
  return out;
}

/**
 * Independent CommonMark-style fence oracle (lines inside or delimiting a fenced code
 * block). Opener: a run of 3+ backticks or tildes; a backtick info string cannot contain
 * a backtick. Closer: the same character, a run at least as long, followed only by
 * spaces. An unclosed fence runs to the end of the document. Container indentation
 * is not modelled; indentation is accepted as in the frozen engine.
 */
export function fencedLines(content: string): Set<number> {
  const inside = new Set<number>();
  let open: { char: string; length: number } | undefined;
  segments(content).forEach((row, index) => {
    const match = /^\s*(`{3,}|~{3,})(.*)$/u.exec(row.text);
    if (open) {
      inside.add(index + 1);
      if (match && match[1][0] === open.char && match[1].length >= open.length && /^[ \t]*$/u.test(match[2])) open = undefined;
      return;
    }
    if (match && !(match[1][0] === '`' && match[2].includes('`'))) {
      open = { char: match[1][0], length: match[1].length };
      inside.add(index + 1);
    }
  });
  return inside;
}

/** Spanish when the line has a Spanish modal, English when it has an English one. */
export function lineLanguage(text: string): 'en' | 'es' | 'und' {
  const nfc = text.normalize('NFC');
  if (/(?<![\p{L}\p{N}\p{M}_])(?:DEBERÍAN|DEBERÍA|DEBERÁN|DEBERÁ|DEBEN|DEBE|PUEDEN|PUEDE)(?![\p{L}\p{N}\p{M}_])/iu.test(nfc)) return 'es';
  if (/(?<![\p{L}\p{N}\p{M}_])(?:MUST|SHALL|SHOULD|MAY)(?![\p{L}\p{N}\p{M}_])/iu.test(nfc)) return 'en';
  return 'und';
}
