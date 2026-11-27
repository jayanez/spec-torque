/**
 * H9 (#84): requirement references that their own line qualifies by another specification. A
 * hyphen-joined namespace (`VPC-REQ-01`) or `SPEC-<n>` directly before the ID qualifies it, and a
 * prefix that ends in an ID is a range (`FR-001-FR-003`), not a namespace. Shared by the I2.3 rule and
 * the H9 adjudication packet.
 */
// Every qualifier form fits in a short window before the ID; bounding it keeps long lines linear.
const WINDOW = 64;
const namespacePrefix = /(?<![\p{L}\p{N}_-])([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*)-$/u;
const specQualifier = /(?<![\p{L}\p{N}_-])SPEC-(\d+)(?:['’]s)?[ \t]*(?:[/:#§][ \t]*)?$/iu;
const rangeStart = /(?:FR|NFR|REQ|R)-\d+$/i;

/** The text just before an ID that starts at `index`. */
export const textBefore = (text: string, index: number) => text.slice(Math.max(0, index - WINDOW), index);

/** The hyphen-joined namespace directly before an ID (`VPC` in `VPC-REQ-01`), if any. */
export function namespaceOf(prefix: string): string | undefined {
  const namespace = namespacePrefix.exec(prefix)?.[1];
  return namespace && !rangeStart.test(namespace) ? namespace : undefined;
}

/** The namespace or `SPEC-<n>` that directly qualifies an ID, if any. */
export function qualifierOf(prefix: string): string | undefined {
  const namespace = namespaceOf(prefix);
  if (namespace) return namespace;
  const spec = specQualifier.exec(prefix)?.[1];
  return spec === undefined ? undefined : `SPEC-${spec}`;
}

/** Whether `SPEC-<n>` is the feature itself by its folder number (`specs/028-…`). */
export const isOwnSpec = (qualifier: string, featureId: string) => {
  const spec = /^SPEC-(\d+)$/.exec(qualifier)?.[1];
  return spec !== undefined && Number(spec) === Number(/(?:^|\/)(\d+)-[^/]*$/.exec(featureId)?.[1]);
};
