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

/**
 * H52b (#52): requirement IDs in a text, in order. A *qualified* ID joins an uppercase namespace to
 * `FR`, `NFR` or `REQ` (`VP-REQ-01`, `T001-FR-001`); a *group-infixed* ID puts a group with a letter
 * between `FR` or `NFR` and the number (`FR-A-001`, `NFR-SEC-01`); otherwise the ID is bare
 * (`FR`, `NFR`, `REQ` or `R` and a number). The family is matched in any case; a namespace or group
 * in another case is not read. The boundary is ASCII, as `\b` was, and a hyphen may precede an ID,
 * so a range (`FR-001-FR-003`) reads both.
 */
export interface RequirementId {
  /** The upper-cased ID, with its namespace (`VP-REQ-01`). */
  id: string;
  /** The ID as written. */
  raw: string;
  index: number;
  family: 'FR' | 'NFR' | 'REQ' | 'R';
  /** The namespace of a qualified ID (`VP`). */
  namespace?: string;
  /** The family and number without namespace or group (`REQ-01`), the form a short reference uses. */
  base: string;
}
const idToken = /(?<![A-Za-z0-9_])((?:[A-Za-z][A-Za-z0-9]*-)+(?=(?:FR|NFR|REQ)-\d))?(?:(FR|NFR)-((?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]+)-(\d+)|(FR|NFR|REQ|R)-(\d+))(?![A-Za-z0-9_])/gi;
const upper = (text: string) => !/[a-z]/.test(text);

export function requirementIds(text: string): RequirementId[] {
  const found: RequirementId[] = [];
  for (const m of text.matchAll(idToken)) {
    const [whole, prefix = '', infixFamily, group, infixNumber, bareFamily, bareNumber] = m;
    // A group in another case is no group, and the text is no ID (as in 0.1.20).
    if (group !== undefined && !upper(group)) continue;
    const family = (infixFamily ?? bareFamily).toUpperCase() as RequirementId['family'];
    const base = `${family}-${infixNumber ?? bareNumber}`;
    const core = whole.slice(prefix.length);
    // A namespace in another case is not read: the ID is read without it.
    const namespace = prefix && upper(prefix) ? prefix.slice(0, -1) : undefined;
    const raw = namespace ? whole : core;
    found.push({ id: raw.toUpperCase(), raw, index: m.index + whole.length - raw.length, family, namespace, base });
  }
  return found;
}
