/**
 * H9 (#84): requirement references that their own line places outside the feature. A hyphen-joined
 * namespace (`VPC-REQ-01`) or `SPEC-<n>` directly before the ID qualifies it, and a prefix that ends in
 * an ID is a range (`FR-001-FR-003`), not a namespace. A non-adoption marker attached to the ID leaves
 * it out as well. Shared by the I2.3 rule and the H9 adjudication packet.
 */
// Every qualifier and marker form fits in a short window around the ID; bounding it keeps long lines linear.
const WINDOW = 64;
const namespacePrefix = /(?<![\p{L}\p{N}_-])([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*)-$/u;
const specQualifier = /(?<![\p{L}\p{N}_-])SPEC-(\d+)(?:['’]s)?[ \t]*(?:[/:#§][ \t]*)?$/iu;
const rangeStart = /(?:FR|NFR|REQ|R)-\d+$/i;
const notAdopted = '(?:not[ -]adopted|no[ \\t]+adoptad[oa]s?)';
const proposed = '(?:proposed|propuest[oa]s?)';
const notAdoptedBefore = new RegExp(`(?<![\\p{L}\\p{N}_])${notAdopted}\\)?[ \\t]+$`, 'iu');
const notAdoptedAfter = new RegExp(`^(?:/\\d+)*[ \\t]*(?:${proposed}[ \\t]*)?\\((?:${proposed}[ \\t]*,?[ \\t]*)?${notAdopted}\\)`, 'iu');

export interface Around { before: string; after: string }
/** The text just before and after an ID that starts at `index`. */
export const around = (text: string, index: number, length: number): Around =>
  ({ before: text.slice(Math.max(0, index - WINDOW), index), after: text.slice(index + length, index + length + WINDOW) });

/** The hyphen-joined namespace directly before an ID (`VPC` in `VPC-REQ-01`), if any. */
export function namespaceOf(before: string): string | undefined {
  const namespace = namespacePrefix.exec(before)?.[1];
  return namespace && !rangeStart.test(namespace) ? namespace : undefined;
}

/** The namespace or `SPEC-<n>` that directly qualifies an ID, if any. */
export function qualifierOf(before: string): string | undefined {
  const namespace = namespaceOf(before);
  if (namespace) return namespace;
  const spec = specQualifier.exec(before)?.[1];
  return spec === undefined ? undefined : `SPEC-${spec}`;
}

/** Whether `SPEC-<n>` is the feature itself by its folder number (`specs/028-…`). */
export const isOwnSpec = (qualifier: string, featureId: string) => {
  const spec = /^SPEC-(\d+)$/.exec(qualifier)?.[1];
  return spec !== undefined && Number(spec) === Number(/(?:^|\/)(\d+)-[^/]*$/.exec(featureId)?.[1]);
};

/** Whether a non-adoption marker is attached to the ID: directly before it, or in a parenthesis after it. */
export const markedNotAdopted = ({ before, after }: Around) => notAdoptedBefore.test(before) || notAdoptedAfter.test(after);
