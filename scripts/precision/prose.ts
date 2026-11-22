import { commentLines, fencedLines, segments } from './probe.js';

/** Nearest heading per level above the line, outermost first. */
export function headingChain(lines: string[], line: number): string[] {
  const chain: string[] = [];
  let fence: { char: string; length: number } | undefined;
  for (const text of lines.slice(0, line - 1)) {
    const run = /^\s*(`{3,}|~{3,})/u.exec(text);
    if (run) {
      if (!fence) fence = { char: run[1][0], length: run[1].length };
      else if (run[1][0] === fence.char && run[1].length >= fence.length) fence = undefined;
      continue;
    }
    const heading = !fence && /^(#{1,6})\s+(.*\S)\s*#*\s*$/u.exec(text);
    if (heading) { chain.length = heading[1].length - 1; chain[heading[1].length - 1] = heading[2]; }
  }
  return chain.filter(Boolean);
}

/** Lines a classifier may label: not blank, heading, quote, fence, comment or table rule. */
export function proseLines(content: string): number[] {
  const fenced = fencedLines(content);
  const comments = commentLines(content);
  return segments(content).flatMap((row, index) => {
    const line = index + 1;
    const text = row.text.normalize('NFC').trim();
    const skip = fenced.has(line) || comments.has(line) || text.length < 3 || /^(?:#|>|---|\*\*\*|___)/u.test(text) || /^[\s|:\-+]+$/u.test(text);
    return skip ? [] : [line];
  });
}

/** Seeded sample without replacement (same generator as the replay review samples). */
export function sample<T>(pool: T[], size: number, seed: number): T[] {
  let state = seed;
  const next = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
  const rest = [...pool];
  const picked: T[] = [];
  while (picked.length < size && rest.length) picked.push(rest.splice(Math.floor(next() * rest.length), 1)[0]);
  return picked;
}

/** At most `limit` items per group, drawn with the seeded sample; group order is stable. */
export function stratify<T>(items: T[], groupOf: (item: T) => string, limit: number, seed: number): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(groupOf(item), [...(groups.get(groupOf(item)) ?? []), item]);
  return [...groups.keys()].sort().flatMap(key => sample(groups.get(key)!, limit, seed));
}
