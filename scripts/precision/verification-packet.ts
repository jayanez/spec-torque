/**
 * H6 adjudication packet (#88): the first new evidence line of every practice whose status the
 * candidate raises, with context, written as packet.json (for reviewers) and key.json (never shown).
 *
 *   verification-packet.ts --detail <h6-scan.json> --roots <roots.json> --out <dir> [--seed 42039] [--context 4]
 *
 * H7-2 (#79): with --propositions h7, the score-moving changes of reclassified Spec Kit checklists
 * instead: the named template items N1/N2, lost evidence (1a spec-only, 1b all-role practices),
 * removed decisions, and a sanity stratum of removed findings and reclassified files. --detail may
 * be repeated (one scan per fresh set); features are capped at 15 per repository.
 * With --propositions h7a-gains, from arm-B scans: the checklist lines that 0.1.12 admitted as
 * requirements in features where a ratio practice rises (they leave its denominator).
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { isReviewChecklist } from '../../src/core/artifacts.js';
import { PRACTICES } from '../../src/core/catalog.js';
import { rootSchema } from './sources.js';

const { values } = parseArgs({ options: {
  detail: { type: 'string', multiple: true }, roots: { type: 'string' }, out: { type: 'string' },
  seed: { type: 'string', default: '42039' }, context: { type: 'string', default: '4' }, propositions: { type: 'string', default: 'h6' },
} });
if (!values.detail?.length || !values.roots || !values.out || !['h6', 'h7', 'h7a-gains'].includes(values.propositions!)) throw new Error('Use: verification-packet.ts --detail <h6-scan.json> --roots <roots.json> --out <dir> [--propositions h6|h7|h7a-gains]');
const roots = rootSchema.parse(JSON.parse(await readFile(values.roots, 'utf8')));
if (roots.some(root => root.restricted)) throw new Error('Packets are built from public roots only.');
type Evidence = { path: string; line: number; text: string };
type Detail = { root: string; sha: string; feature: string; changes: { id: string; from: string; to: string }[]; evidence: Record<string, Evidence[]>;
  baselineEvidence?: Record<string, Evidence[]>; removedDecisions?: Evidence[]; removedFindings?: string[]; roleChanges?: { path: string }[] };
const scan = { detail: (await Promise.all(values.detail.map(async file => JSON.parse(await readFile(file, 'utf8')).detail as Detail[]))).flat() };

// Same deterministic generator as the H3a and H5 packets.
let state = Number(values.seed);
const random = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
const shuffle = <T>(items: T[]) => { const pool = [...items]; const out: T[] = []; while (pool.length) out.push(pool.splice(Math.floor(random() * pool.length), 1)[0]); return out; };

const PROPOSITIONS: Record<string, string> = {
  'E3.1': 'This line states, or directly introduces, an observable verification criterion (an acceptance criterion or scenario with an expected outcome) for the feature.',
  'E3.2': 'This line states, or directly introduces, a method for checking the feature: an executable test or command, or a described manual check.',
  'E3.4': 'This line states, or directly introduces, what evidence is required to consider the feature\'s verification complete.',
};
const around = Number(values.context);
const git = (root: string, ...args: string[]) => execFileSync('git', ['-C', roots.find(r => r.id === root)!.path, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
const sources = new Map<string, string[]>();
/** Lines of a committed file, read once per packet. */
const source = (root: string, sha: string, path: string) => {
  const k = `${root}:${sha}:${path}`;
  if (!sources.has(k)) sources.set(k, git(root, 'show', `${sha}:${path}`).split(/\r?\n/));
  return sources.get(k)!;
};
const rank: Record<string, number> = { missing: 0, partial: 1, supported: 2 };
const order = (c: { from: string; to: string }) => Math.sign((rank[c.to] ?? -1) - (rank[c.from] ?? -1));
const append = <K, V>(map: Map<K, V[]>, key: K, value: V) => { const list = map.get(key); if (list) list.push(value); else map.set(key, [value]); };
const writePacket = async (guide: string, items: unknown[], key: unknown) => {
  await writeFile(join(values.out!, 'packet.json'), JSON.stringify({ version: 1, labels: ['positive', 'negative', 'unknown'], guide, items }, null, 2) + '\n');
  await writeFile(join(values.out!, 'key.json'), JSON.stringify(key, null, 2) + '\n', { mode: 0o600 });
};
const contextOf = (lines: string[], line: number) => lines.slice(Math.max(0, line - 1 - around), line + around)
  .map((text, index) => `${Math.max(1, line - around) + index}${Math.max(1, line - around) + index === line ? ' >' : '  '} ${text}`);
await mkdir(values.out, { recursive: true, mode: 0o700 });
if (values.propositions === 'h7') await h7Packet();
else if (values.propositions === 'h7a-gains') await gainsPacket();
else await h6Packet();

async function h6Packet() {
  const changes = scan.detail.flatMap(d => d.changes.filter(c => c.from === 'missing' && c.to === 'partial' && PROPOSITIONS[c.id])
    .map(c => ({ root: d.root, sha: d.sha, feature: d.feature, practice: c.id, evidence: d.evidence[c.id]?.[0] })))
    .filter(c => c.evidence);
  const items: unknown[] = []; const key: { id: string; practice: string; root: string; feature: string }[] = [];
  for (const change of shuffle(changes)) {
    const { path, line } = change.evidence!;
    const lines = source(change.root, change.sha, path);
    const id: string = 'V' + String(items.length + 1).padStart(3, '0');
    items.push({
      id, repository: roots.find(r => r.id === change.root)!.repository, revision: change.sha, path, line,
      proposition: PROPOSITIONS[change.practice],
      context: contextOf(lines, line),
    });
    key.push({ id, practice: change.practice, root: change.root, feature: change.feature });
  }
  await writePacket('docs/precision-adjudication.md#h6-verification-evidence-88', items, key);
  console.log(JSON.stringify({ items: items.length, byPractice: Object.fromEntries(Object.keys(PROPOSITIONS).map(p => [p, key.filter(k => k.practice === p).length])), out: values.out }));
}

/** At most 15 features per repository, drawn with the seed (amendment H7-2). */
function capped(details: Detail[]) {
  const byRoot = new Map<string, Detail[]>();
  for (const d of details) append(byRoot, d.root, d);
  return [...byRoot.keys()].sort().flatMap(root => shuffle([...byRoot.get(root)!].sort((a, b) => a.feature < b.feature ? -1 : 1)).slice(0, 15));
}

async function h7Packet() {
  // Named items, variants listed in advance (amendment H7-2).
  const named = (text: string) => {
    const m = /^\s*[-*]\s*\[([ xX])\]\s*(?:No \[NEEDS CLARIFICATION\] markers remain|No quedan marcadores \[NEEDS CLARIFICATION\]|无 \[NEEDS CLARIFICATION\])/u.exec(text);
    return m ? (m[1] === ' ' ? 'N2' : 'N1') : undefined;
  };
  const role = (practice: string) => PRACTICES.find(p => p.id === practice)!.roles.includes('context') ? '1b' : '1a';
  const actor = /user|visitor|actor|customer|usuario|visitante|cliente/i;
  // A rough requirement-line test for picking the actor line. It differs from the gains packet's `admitted`
  // on purpose: both packets were labeled as built, and changing either would change their candidates.
  const modalOrId = /\b(?:FR|NFR|REQ)-\d+\b|(?<![\p{L}\p{N}_])(?:MUST|SHALL|SHOULD|MAY|DEBE\w*|PUEDE\w*)(?![\p{L}\p{N}_])/iu;
  // Cap: at most 15 changed features per repository, drawn with the seed.
  const features = capped(scan.detail.filter(d => d.roleChanges?.length));

  type Candidate = { stratum: string; practice: string; root: string; sha: string; feature: string; path: string; line: number; text: string; named?: string };
  const candidates: Candidate[] = [];
  const push = (c: Omit<Candidate, 'named'>) => candidates.push({ ...c, named: named(c.text) });
  for (const d of features) {
    for (const change of d.changes) {
      if (order(change) >= 0) continue;
      let lost: Evidence[] = [];
      // P2.1/C1.1 cite requirement lines as evidence; what is lost is the actor line that met their context condition.
      if (['P2.1', 'C1.1'].includes(change.id)) {
        for (const path of (d.roleChanges ?? []).map(r => r.path)) {
          const lines = source(d.root, d.sha, path);
          const index = lines.findIndex(t => t.trim() && !/^\s*#/.test(t) && actor.test(t) && !modalOrId.test(t));
          if (index >= 0) { lost = [{ path, line: index + 1, text: lines[index] }]; break; }
        }
      } else lost = (d.baselineEvidence?.[change.id] ?? []).filter(e => isReviewChecklist(e.path));
      for (const e of lost) push({ stratum: role(change.id), practice: change.id, root: d.root, sha: d.sha, feature: d.feature, path: e.path, line: e.line, text: e.text });
    }
    for (const e of d.removedDecisions ?? []) push({ stratum: '2', practice: 'decision', root: d.root, sha: d.sha, feature: d.feature, path: e.path, line: e.line, text: e.text });
    for (const k of d.removedFindings ?? []) {
      const [practice, path, line] = k.split('|');
      const text = source(d.root, d.sha, path)[Number(line) - 1] ?? '';
      push({ stratum: '3f', practice, root: d.root, sha: d.sha, feature: d.feature, path, line: Number(line), text });
    }
    for (const r of d.roleChanges ?? []) push({ stratum: '3d', practice: 'document', root: d.root, sha: d.sha, feature: d.feature, path: r.path, line: 1, text: r.path });
  }
  // N1 and N2 are labeled once per distinct variant; the tail is deduplicated by (stratum, practice, text) and drawn.
  const groups = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const stratum = c.named === 'N1' && c.practice !== 'decision' ? 'N1' : c.named === 'N2' && c.practice === 'decision' ? 'N2' : c.named && c.stratum !== '3f' && c.stratum !== '3d' ? 'named-other' : c.stratum;
    // N1 groups its E1.1 and P2.5 occurrences together; every other stratum keys on its practice.
    const k = [stratum, stratum === 'N1' ? '' : c.practice, c.text.trim()].join('\u0000');
    append(groups, k, { ...c, stratum });
  }
  const distinct = [...groups.values()];
  const caps: Record<string, number> = { N1: Infinity, N2: Infinity, '1a': 30, '1b': 30, '2': 30, '3f': 10, '3d': 10 };
  const selected: Candidate[][] = []; const counts: Record<string, { distinct: number; drawn: number; features: number }> = {};
  // Named variants in the other role (N1 as a decision, N2 as lost evidence) are outside every stratum by design.
  const byStratum = new Map<string, Candidate[][]>();
  for (const g of distinct) append(byStratum, g[0].stratum, g);
  const tally = (pool: Candidate[][], drawn: number) => ({ distinct: pool.length, drawn, features: new Set(pool.flat().map(c => c.root + c.feature)).size });
  counts['named-other'] = tally(byStratum.get('named-other') ?? [], 0);
  for (const stratum of Object.keys(caps)) {
    const pool = byStratum.get(stratum) ?? [];
    const drawn = shuffle(pool).slice(0, caps[stratum]);
    selected.push(...drawn);
    counts[stratum] = tally(pool, drawn.length);
  }
  const practiceProposition: Record<string, string> = {
    'E1.1': 'This line records an unresolved decision about this feature as a specific question, or explicitly states that none remains open.',
    'P2.5': 'This line tracks an unanswered question about this feature until it is decided, or explicitly states that none remains.',
    'E2.3': 'This line records a risk, assumption or edge case of this feature as its own entry.',
    'P1.1': 'This line declares a dependency or assumption of this feature, or explicitly states that there is none.',
    'P1.4': 'This line states how a dependency of this feature is checked or what happens when it fails.',
    'P2.1': 'This line identifies the intended users or actors of this feature.',
    'C1.1': 'This line identifies the intended users or actors of this feature.',
    'P2.2': 'This line describes invalid input, failure, empty state or boundary behavior of this feature.',
    'P2.3': 'This line states an operational or non-functional expectation of this feature (availability, accessibility, observability, performance).',
    'I3.3': 'This line explains the feature\'s purpose or problem, or gives a concrete example of it.',
    'I3.2': 'This line links to a related specification, plan or task document of this feature.',
    'E1.5': 'This line states an explicit exclusion or scope boundary of this feature.',
    'E3.1': 'This line states, or directly introduces, an observable verification criterion for this feature.',
  };
  const proposition = (c: Candidate) => c.stratum === 'N1' ? 'This line explicitly states, for this feature, that no clarification remains open.'
    : c.practice === 'decision' ? 'This line records a decision about this feature that is still open.'
    : c.stratum === '3d' ? 'This document states the feature\'s requirements, rather than reviewing them or citing them.'
    : c.practice === 'I1.2' ? 'This line states a requirement of this feature: either one that lacks a stable identifier, or a second, separate requirement under an ID that the feature already uses.'
    : c.practice === 'E2.1' ? 'This line states two or more independent obligations of this feature that could fail separately.'
    : practiceProposition[c.practice] ?? `This line is genuine evidence of: ${PRACTICES.find(p => p.id === c.practice)?.title}.`;
  const items: unknown[] = []; const key: unknown[] = [];
  for (const group of shuffle(selected)) {
    const c = group[0];
    const lines = source(c.root, c.sha, c.path);
    const id = 'K' + String(items.length + 1).padStart(3, '0');
    items.push({
      id, repository: roots.find(r => r.id === c.root)!.repository, revision: c.sha, path: c.path, line: c.line, proposition: proposition(c),
      ...(c.stratum === '3d' ? { document: lines.slice(0, 40) } : { context: contextOf(lines, c.line) }),
      ...(c.stratum === '1a' || c.stratum === '1b' ? { otherEvidence: 'none: no other document of this feature gives this evidence' } : {}),
    });
    key.push({ id, stratum: c.stratum, practice: c.practice, features: group.length, occurrences: group.map(g => `${g.root}:${g.feature}:${g.path}:${g.line}`) });
  }
  await writePacket('docs/precision-adjudication.md#h7-spec-kit-checklists-79', items, { counts, items: key });
  console.log(JSON.stringify({ items: items.length, counts, out: values.out }));
}

async function gainsPacket() {
  // Approximates the engine's admission rule (no calendar-May or scenario-line exception): an ID or a modal word
  // outside headings, quotes and fences.
  const admitted = /\b(?:FR|NFR|REQ)-\d+\b|(?<![\p{L}\p{N}\p{M}_])(?:MUST|SHALL|SHOULD|MAY|DEBERÍAN|DEBERÍA|DEBERÁN|DEBERÁ|DEBEN|DEBE|PUEDEN|PUEDE)(?![\p{L}\p{N}\p{M}_])/iu;
  const gaining = scan.detail.filter(d => d.changes.some(c => order(c) > 0));
  // The cap draws only when some repository exceeds it, so a packet under the cap keeps its seeded order.
  const perRoot = new Map<string, Detail[]>(); for (const d of gaining) append(perRoot, d.root, d);
  const raised = [...perRoot.values()].some(list => list.length > 15) ? capped(gaining) : gaining;
  const byText = new Map<string, { d: Detail; path: string; line: number; text: string }[]>();
  for (const d of raised) for (const { path } of d.roleChanges ?? []) {
    let fenced = false;
    source(d.root, d.sha, path).forEach((text, index) => {
      if (/^\s*(?:```|~~~)/.test(text)) { fenced = !fenced; return; }
      if (fenced || /^\s*(?:#|>)/.test(text) || !admitted.test(text)) return;
      append(byText, text.trim(), { d, path, line: index + 1, text });
    });
  }
  const pool = [...byText.values()];
  const drawn = shuffle(pool).slice(0, 30);
  const items: unknown[] = []; const key: unknown[] = [];
  for (const group of drawn) {
    const { d, path, line } = group[0];
    const id = 'G' + String(items.length + 1).padStart(3, '0');
    items.push({ id, repository: roots.find(r => r.id === d.root)!.repository, revision: d.sha, path, line,
      proposition: 'This line states a requirement that this feature imposes (rather than reviewing, citing or reporting on one).',
      context: contextOf(source(d.root, d.sha, path), line) });
    key.push({ id, features: new Set(group.map(g => g.d.root + g.d.feature)).size, occurrences: group.map(g => `${g.d.root}:${g.d.feature}:${g.path}:${g.line}`) });
  }
  await writePacket('docs/precision-adjudication.md#h7-spec-kit-checklists-79', items, { distinct: pool.length, features: raised.length, items: key });
  console.log(JSON.stringify({ items: items.length, distinct: pool.length, features: raised.length, out: values.out }));
}
