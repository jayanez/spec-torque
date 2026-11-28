/**
 * Shared logic for the E1.2 clarification rehearsal (#57,
 * docs/clarification-actionability.md): fixture loading, the frozen engine
 * check, presentation pages and blind reviewer packets.
 *
 * Nothing here sends data anywhere. Packets are written to local files for the
 * operator, who starts any review run by hand.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { FROZEN_PROTOCOL_SHA256, runOf, RUN2_PROTOCOL_SHA256, RUN3_PROTOCOL_SHA256, type Phase } from './calibration/protocol.mjs';
import { analyze, classifyArtifact, clarifyE12 } from '../../src/core.js';

export const PROTOCOL = 'docs/clarification-actionability.md';
/** Pre-registration of the second calibration run; its frozen SHA-256 seeds the run-2 packets. */
export const RUN2_PROTOCOL = 'docs/clarification-actionability-run2.md';
/** Pre-registration of the third calibration run (#65); its frozen SHA-256 seeds the run-3 packets. */
export const RUN3_PROTOCOL = 'docs/clarification-actionability-run3.md';
/**
 * LF-normalised SHA-256 of the protocol at its freeze commit (6a2dc0f, posted in #57).
 * Seeds and presentation IDs derive from this value, not from the current file, so a
 * dated amendment does not reorder packets or change page IDs (amendment of 2026-11-23).
 */
export { FROZEN_PROTOCOL_SHA256 };
/** SHA-256 of the frozen reviewer prompt, used for the first calibration. */
export const FROZEN_PROMPT_SHA256 = '406cae4c818b43ba725dcdc2d83a098dae3ec8207da4ec94e470e0b34f787f58';
/** SHA-256 of the prompt after the single permitted revision of run 1 (amendment of 2026-11-24), used for the run-1 reserve. */
export const REVISED_PROMPT_SHA256 = '5d2be8faf3a3d0a5940f0b8afb46230857e9595315ee769624144e0564b6e0ab';
/** SHA-256 of the prompt clarified before calibration run 2 (amendment of 2026-11-24); used for run-2 calibration. */
export const RUN2_PROMPT_SHA256 = '2ac88d84b776f336bbfd16f69badea2598663d4717b79c6687369ad81bf97a50';
/** SHA-256 of the prompt after run 2's single format revision; used for the run-2 reserve and the live phase. */
export const RUN2_REVISED_PROMPT_SHA256 = 'c5a28aecbf6fc09ce8b9d50279cd9a23b746cdb3054e6618e167f9a340ed7464';
/** LF SHA-256 of the run-2 pre-registration at its freeze (cc53307); run-2 seeds derive from it, not from the amended file. */
export const RUN2_FROZEN_SHA256 = RUN2_PROTOCOL_SHA256;
/**
 * LF SHA-256 of the run-3 pre-registration at its freeze. Null until the maintainer confirms the freeze in #65;
 * run-3 packets are refused while it is null.
 */
export const RUN3_FROZEN_SHA256: string | null = RUN3_PROTOCOL_SHA256;
const FIXTURES = 'tests/fixtures/e12';

export const sha256 = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');
/** Hash of a checked-out file with line endings normalised to LF, so Windows CRLF checkouts match. */
/** File text with line endings normalised to LF, so Windows CRLF checkouts parse and hash like LF ones. */
export const lf = (bytes: Buffer) => String(bytes).replace(/\r\n/g, '\n');
export const fileSha256 = (bytes: Buffer) => sha256(lf(bytes));

const evidence = z.strictObject({ at: z.string(), text: z.string() });
const armA = z.strictObject({ message: z.string(), suggestion: z.string(), evidence: z.array(evidence) });
const armB = z.strictObject({ kind: z.enum(['question', 'abstain', 'review']), focus: z.string(),
  question: z.string().nullable(), reason: z.string(), evidence: z.array(evidence) });
const caseSchema = z.strictObject({
  id: z.string(), set: z.enum(['study', 'fresh']), lineage: z.string(), language: z.enum(['en', 'es']),
  sourceSha256: z.string(), live: z.boolean(), runtime: z.enum(['question', 'abstain', 'review', 'none']),
  armA: armA.nullable().optional(), armB: armB.nullable().optional(),
  outcome: z.enum(['ask', 'clear', 'abstain', 'review']), openSlot: z.string().nullable(),
  roleBrief: z.string(), acceptableResolutions: z.array(z.string()).min(1),
  invariants: z.array(z.strictObject({ kind: z.string(), assertion: z.string() })),
});
export const responseSchema = z.strictObject({
  action: z.enum(['edit', 'leave', 'escalate']),
  scope: z.enum(['target line', 'requirement', 'scenario']).nullable(),
  text: z.string().nullable(), note: z.string().nullable(),
}).superRefine((r, ctx) => {
  if (r.action === 'edit' && (!r.text || !r.scope)) ctx.addIssue({ code: 'custom', message: 'edit needs scope and text' });
  if (r.action === 'escalate' && !r.note) ctx.addIssue({ code: 'custom', message: 'escalate needs a note' });
});
const keySchema = z.strictObject({ acceptable: z.enum(['yes', 'no']),
  fills_slot: z.enum(['yes', 'no', 'not_applicable']), invented_decision: z.enum(['yes', 'no']) });
const itemSchema = z.strictObject({ id: z.string(), case: z.string(), language: z.enum(['en', 'es']),
  variant: z.string(), response: responseSchema, key: keySchema });
const common = { status: z.string(), protocol: z.literal(PROTOCOL), issue: z.literal(57),
  sources: z.record(z.string(), z.string()), authorship: z.string(), note: z.string() };
export const rehearsalSchema = z.strictObject({ version: z.literal('e12-rehearsal/1'), ...common, cases: z.array(caseSchema).length(24) });
export const calibrationSchema = z.strictObject({ version: z.literal('e12-calibration/1'), ...common,
  rehearsal: z.string(), items: z.array(itemSchema).length(72), reserve: z.array(itemSchema).length(24) });
export const calibrationRun2Schema = z.strictObject({ version: z.literal('e12-calibration-run2/1'), ...common,
  protocol: z.literal(RUN2_PROTOCOL), items: z.array(itemSchema).length(96), reserve: z.array(itemSchema).length(48) });
export const calibrationRun3Schema = z.strictObject({ version: z.literal('e12-calibration-run3/1'), ...common,
  protocol: z.literal(RUN3_PROTOCOL), issue: z.literal(65), items: z.array(itemSchema).length(96), reserve: z.array(itemSchema).length(48) });

export type Case = z.infer<typeof caseSchema>;
export type Response = z.infer<typeof responseSchema>;
export type Rehearsal = z.infer<typeof rehearsalSchema>;
export type Calibration = z.infer<typeof calibrationSchema>;
export type CalibrationRun2 = z.infer<typeof calibrationRun2Schema>;
export type CalibrationRun3 = z.infer<typeof calibrationRun3Schema>;

export interface Material { source: string; path: string; target: number; companions: Record<string, string> }

export interface Loaded {
  /** Frozen protocol SHA-256: the source of seeds and presentation IDs. */
  protocolSha256: string;
  /** SHA-256 of the protocol as checked out, including any amendments. */
  currentProtocolSha256: string;
  prompt: string;
  rehearsal: Rehearsal;
  calibration: Calibration;
  /** Run-2 calibration items and the LF SHA-256 of the run-2 pre-registration, when present. */
  calibrationRun2: CalibrationRun2 | null;
  run2ProtocolSha256: string | null;
  /** Run-3 calibration items and the LF SHA-256 of the run-3 pre-registration, when present. */
  calibrationRun3: CalibrationRun3 | null;
  run3ProtocolSha256: string | null;
  material: Map<string, Material>;
}

/** The reviewer prompt is the first fenced `text` block after the appendix heading. */
export function extractPrompt(protocol: string): string {
  const appendix = protocol.slice(protocol.indexOf('## Appendix: reviewer prompt'));
  const match = /```text\n([\s\S]*?)\n```/.exec(appendix);
  if (!match) throw new Error('Reviewer prompt not found in the protocol appendix.');
  return match[1];
}

export async function load(root: string, phase?: Phase): Promise<Loaded> {
  const read = (path: string) => readFile(join(root, path));
  const protocol = await read(PROTOCOL);
  const studyBytes = await read(`${FIXTURES}/study.json`);
  const freshBytes = await read(`${FIXTURES}/fresh.json`);
  const rehearsal = rehearsalSchema.parse(JSON.parse(lf(await read(`${FIXTURES}/rehearsal.json`))));
  const calibration = calibrationSchema.parse(JSON.parse(lf(await read(`${FIXTURES}/calibration.json`))));
  for (const [path, digest] of Object.entries(rehearsal.sources)) {
    const actual = fileSha256(path.endsWith('study.json') ? studyBytes : freshBytes);
    if (actual !== digest) throw new Error(`${path} changed: ${actual} is not the recorded ${digest}.`);
  }
  const study = new Map<string, any>(JSON.parse(String(studyBytes)).cases.map((c: any) => [c.id, c]));
  const fresh = new Map<string, any>(JSON.parse(String(freshBytes)).map((c: any) => [c.lineage, c]));
  const material = new Map<string, Material>();
  for (const c of rehearsal.cases) {
    const ref = c.id.slice(c.id.indexOf(':') + 1);
    const raw = c.set === 'study' ? study.get(ref) : fresh.get(ref);
    if (!raw) throw new Error(`Case ${c.id} is missing from ${c.set}.json.`);
    if (sha256(raw.source) !== c.sourceSha256) throw new Error(`Source of ${c.id} changed.`);
    const at = c.armA?.evidence[0]?.at;
    const target = c.set === 'study' ? raw.evidence.line : Number(at?.slice(at.lastIndexOf(':') + 1));
    if (!Number.isInteger(target) || target < 1) throw new Error(`No target line for ${c.id}.`);
    material.set(c.id, { source: raw.source, path: raw.path, target, companions: raw.companions ?? {} });
  }
  for (const item of [...calibration.items, ...calibration.reserve])
    if (!material.has(item.case)) throw new Error(`Calibration item ${item.id} names unknown case ${item.case}.`);
  const prompt = extractPrompt(lf(protocol));
  if (sha256(prompt) !== RUN2_REVISED_PROMPT_SHA256) throw new Error('The reviewer prompt differs from the prompt revised in run 2.');
  const optional = async <T extends { items: { id: string; case: string }[]; reserve: { id: string; case: string }[] }>(
    run: number, schema: z.ZodType<T>, doc: string) => {
    const path = join(root, `${FIXTURES}/calibration-run${run}.json`);
    const fixture = existsSync(path) ? schema.parse(JSON.parse(lf(await readFile(path)))) : null;
    for (const item of [...(fixture?.items ?? []), ...(fixture?.reserve ?? [])])
      if (!material.has(item.case)) throw new Error(`Run-${run} item ${item.id} names unknown case ${item.case}.`);
    return { fixture, docSha256: existsSync(join(root, doc)) ? fileSha256(await read(doc)) : null };
  };
  const run2 = await optional(2, calibrationRun2Schema, RUN2_PROTOCOL);
  const run3 = phase !== undefined && runOf(phase) === 3
    ? await optional(3, calibrationRun3Schema, RUN3_PROTOCOL)
    : { fixture: null, docSha256: null };
  return { protocolSha256: FROZEN_PROTOCOL_SHA256, currentProtocolSha256: fileSha256(protocol), prompt, rehearsal, calibration,
    calibrationRun2: run2.fixture, run2ProtocolSha256: run2.docSha256,
    calibrationRun3: run3.fixture, run3ProtocolSha256: run3.docSha256, material };
}

/** Re-renders every case with the engine and lists any field that differs from the frozen record. */
export async function checkRenderings(loaded: Loaded): Promise<string[]> {
  const differences: string[] = [];
  for (const c of loaded.rehearsal.cases) {
    const m = loaded.material.get(c.id)!;
    const set = { name: 'E1.2 clarification', artifacts: [classifyArtifact(m.path, m.source),
      ...Object.entries(m.companions).map(([path, content]) => classifyArtifact(path, content))] };
    const assessment = await analyze(set);
    const finding = assessment.findings.find(f => f.practiceId === 'E1.2' && f.evidence[0]?.path === m.path && f.evidence[0]?.line === m.target);
    const result = finding ? await clarifyE12(set, assessment, finding.id, c.language) : undefined;
    const ev = (list: { path: string; line: number; text: string }[]) => list.map(e => ({ at: `${e.path}:${e.line}`, text: e.text }));
    const actual = {
      runtime: result?.kind ?? 'none',
      armA: finding ? { message: finding.message, suggestion: finding.suggestion, evidence: ev(finding.evidence) } : null,
      armB: result ? { kind: result.kind, focus: result.focus, question: result.kind === 'question' ? result.question : null,
        reason: result.reason, evidence: ev(result.evidence) } : null,
    };
    for (const field of ['runtime', 'armA', 'armB'] as const)
      if (JSON.stringify(actual[field]) !== JSON.stringify(c[field] ?? null)) differences.push(`${c.id}: ${field}`);
    if (c.live !== (actual.runtime !== 'none')) differences.push(`${c.id}: live`);
  }
  return differences;
}

// ---------------------------------------------------------------- pages

const ui = {
  en: { title: 'Requirement review', brief: 'Your role', source: 'Specification', companions: 'Related documents',
    finding: 'Finding', guidance: 'Guidance', evidence: 'Evidence', clarification: 'Clarification question',
    abstain: 'No clarification question', review: 'Review needed', id: 'Presentation ID' },
  es: { title: 'Revisión del requisito', brief: 'Tu rol', source: 'Especificación', companions: 'Documentos relacionados',
    finding: 'Hallazgo', guidance: 'Orientación', evidence: 'Evidencia', clarification: 'Pregunta de aclaración',
    abstain: 'Sin pregunta de aclaración', review: 'Requiere revisión', id: 'ID de presentación' },
} as const;

const escape = (text: string) => text.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
const numbered = (text: string, target?: number) => text.replace(/\n$/, '').split('\n')
  .map((line, i) => `<span class="${i + 1 === target ? 'target' : ''}">${String(i + 1).padStart(3)}  ${escape(line)}</span>`).join('\n');
const evidenceList = (list: { at: string; text: string }[]) =>
  `<ul>${list.map(e => `<li><code>${escape(e.at)}</code> ${escape(e.text)}</li>`).join('')}</ul>`;

export type Arm = 'A' | 'B';
export const presentationId = (protocolSha256: string, caseId: string, arm: Arm) =>
  sha256(`${protocolSha256}:${caseId}:${arm}`).slice(0, 12);

export function page(loaded: Loaded, c: Case, arm: Arm): string {
  if (!c.live || !c.armA) throw new Error(`${c.id} is not a live case.`);
  const t = ui[c.language];
  const m = loaded.material.get(c.id)!;
  const id = presentationId(loaded.protocolSha256, c.id, arm);
  const companions = Object.entries(m.companions).map(([path, content]) =>
    `<h3><code>${escape(path)}</code></h3><pre>${numbered(content)}</pre>`).join('');
  const b = c.armB;
  const clarification = arm === 'B' && b
    ? `<section class="clarification"><h2>${escape(b.kind === 'question' ? t.clarification : t[b.kind])}</h2>` +
      (b.question ? `<p class="question">${escape(b.question)}</p>` : '') +
      `<p>${escape(b.reason)}</p><h3>${t.evidence}</h3>${evidenceList(b.evidence)}</section>`
    : '';
  return `<!doctype html>
<html lang="${c.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t.title} ${id}</title>
<style>body{font:15px/1.5 system-ui,sans-serif;max-width:52rem;margin:2rem auto;padding:0 1rem;color:#1d1d1f;background:#fff}
pre{background:#f5f5f7;padding:.75rem;overflow-x:auto}pre span{display:block}.target{background:#fff3b0;font-weight:600}
section{border:1px solid #d2d2d7;border-radius:6px;padding:.25rem 1rem;margin:1rem 0}.question{font-weight:600}</style></head>
<body><p><small>${t.id}: <code>${id}</code></small></p><h1>${t.title}</h1>
<section><h2>${t.brief}</h2><p>${escape(c.roleBrief)}</p></section>
<h2>${t.source}</h2><h3><code>${escape(m.path)}</code></h3><pre>${numbered(m.source, m.target)}</pre>
${companions ? `<h2>${t.companions}</h2>${companions}` : ''}
<section><h2>${t.finding}</h2><p>${escape(c.armA.message)}</p><h3>${t.guidance}</h3><p>${escape(c.armA.suggestion)}</p>
<h3>${t.evidence}</h3>${evidenceList(c.armA.evidence)}</section>
${clarification}</body></html>
`;
}

// ---------------------------------------------------------------- packets

export { runOf };
export type { Phase } from './calibration/protocol.mjs';
const RUN_DOCS = { 2: { doc: RUN2_PROTOCOL, frozen: RUN2_FROZEN_SHA256 }, 3: { doc: RUN3_PROTOCOL, frozen: RUN3_FROZEN_SHA256 } } as const;
export type Reviewer = 'R1' | 'R2';

export const seed = (protocolSha256: string, phase: Phase, reviewer: Reviewer, run: number) =>
  sha256(`${protocolSha256}:${phase}:${reviewer}:${run}`).slice(0, 16);

export function order<T extends { id: string }>(items: T[], seedValue: string): T[] {
  return items.map(item => ({ item, k: sha256(`${seedValue}:${item.id}`) }))
    .sort((a, b) => a.k < b.k ? -1 : a.k > b.k ? 1 : 0).map(x => x.item);
}

const words = (text: string) => text.toLowerCase().replace(/[\p{P}\p{S}]/gu, ' ').split(/\s+/).filter(Boolean);

/** True when `text` contains five or more consecutive words of `question`. */
export function leaked(question: string, text: string): boolean {
  const q = words(question);
  const hay = ` ${words(text).join(' ')} `;
  for (let i = 0; i + 5 <= q.length; i++) if (hay.includes(` ${q.slice(i, i + 5).join(' ')} `)) return true;
  return false;
}

export interface PacketItem {
  id: string;
  source: { path: string; targetLine: number; text: string };
  companions: { path: string; text: string }[];
  roleBrief: string;
  openSlot: string;
  acceptableResolutions: string[];
  invariants: { kind: string; assertion: string }[];
  response: Response;
}

export function packetItem(loaded: Loaded, id: string, caseId: string, response: Response): PacketItem {
  const c = loaded.rehearsal.cases.find(x => x.id === caseId);
  if (!c) throw new Error(`Unknown case ${caseId}.`);
  const m = loaded.material.get(caseId)!;
  const lines = m.source.replace(/\n$/, '').split('\n')
    .map((line, i) => `${i + 1 === m.target ? '>>' : '  '}${String(i + 1).padStart(3)}  ${line}`).join('\n');
  return {
    id,
    source: { path: m.path, targetLine: m.target, text: lines },
    companions: Object.entries(m.companions).map(([path, text]) => ({ path, text })),
    roleBrief: c.roleBrief,
    openSlot: c.outcome === 'ask' && c.openSlot ? c.openSlot : 'none',
    acceptableResolutions: c.acceptableResolutions,
    invariants: c.invariants,
    response: responseSchema.parse(response),
  };
}

export const attemptSchema = z.strictObject({
  caseId: z.string(), presentationId: z.string().regex(/^[0-9a-f]{12}$/), attempt: z.number().int().positive(),
  arm: z.enum(['A', 'B']), consent: z.boolean(), sanitization: z.enum(['pass', 'withheld']),
  completed: z.boolean(), response: responseSchema.nullable(),
  useful: z.enum(['yes', 'no', 'not useful', 'no answer']).nullable(),
});
export type Attempt = z.infer<typeof attemptSchema>;

export interface Packet {
  phase: Phase; reviewer: Reviewer; run: number; seed: string; protocolSha256: string;
  /** Run 2 only: LF SHA-256 of the run-2 pre-registration, the base of its seeds. */
  runProtocolSha256?: string;
  prompt: string; items: PacketItem[];
}

export interface LiveSplit {
  sent: PacketItem[];
  withheld: { id: string; reason: 'no consent' | 'sanitization' | 'not completed' }[];
  leaks: string[];
}

/** Applies the consent and sanitization boundary and flags leakage. The leak list never enters a packet. */
export function liveItems(loaded: Loaded, attempts: Attempt[]): LiveSplit {
  const split: LiveSplit = { sent: [], withheld: [], leaks: [] };
  const seen = new Set<string>();
  for (const a of attempts.map(x => attemptSchema.parse(x))) {
    const c = loaded.rehearsal.cases.find(x => x.id === a.caseId);
    if (!c?.live) throw new Error(`Attempt on non-live case ${a.caseId}.`);
    if (a.presentationId !== presentationId(loaded.protocolSha256, a.caseId, a.arm))
      throw new Error(`Presentation ID ${a.presentationId} does not match ${a.caseId} arm ${a.arm}.`);
    const id = `live:${a.caseId}:${a.presentationId}:${a.attempt}`;
    if (seen.has(id)) throw new Error(`Duplicate attempt ${id}.`);
    seen.add(id);
    if (!a.consent) { split.withheld.push({ id, reason: 'no consent' }); continue; }
    if (a.sanitization === 'withheld') { split.withheld.push({ id, reason: 'sanitization' }); continue; }
    if (!a.completed || !a.response) { split.withheld.push({ id, reason: 'not completed' }); continue; }
    if (a.arm === 'B' && c.armB?.question &&
      leaked(c.armB.question, `${a.response.text ?? ''} ${a.response.note ?? ''}`)) split.leaks.push(id);
    split.sent.push(packetItem(loaded, id, a.caseId, a.response));
  }
  return split;
}

export function packet(loaded: Loaded, phase: Phase, reviewer: Reviewer, run: number, items: PacketItem[]): Packet {
  if (![1, 2, 3].includes(run)) throw new Error('Run must be 1, 2 or 3.');
  const n = runOf(phase);
  if (n !== 1) {
    const { doc, frozen } = RUN_DOCS[n];
    if (!(n === 2 ? loaded.run2ProtocolSha256 : loaded.run3ProtocolSha256)) throw new Error(`${doc} is missing.`);
    if (!frozen) throw new Error(`Run ${n} is not frozen: its pre-registration hash is not pinned.`);
    const s = seed(frozen, phase, reviewer, run);
    return { phase, reviewer, run, seed: s, protocolSha256: loaded.protocolSha256, runProtocolSha256: frozen,
      prompt: loaded.prompt, items: order(items, s) };
  }
  const s = seed(loaded.protocolSha256, phase, reviewer, run);
  return { phase, reviewer, run, seed: s, protocolSha256: loaded.protocolSha256, prompt: loaded.prompt, items: order(items, s) };
}

export type CalibrationPhase = Exclude<Phase, 'live'>;
export function calibrationList(loaded: Loaded, phase: CalibrationPhase) {
  const n = runOf(phase);
  const fixture = n === 1 ? loaded.calibration : n === 2 ? loaded.calibrationRun2 : loaded.calibrationRun3;
  if (!fixture) throw new Error(`${FIXTURES}/calibration-run${n}.json is missing.`);
  return phase.startsWith('calibration') ? fixture.items : fixture.reserve;
}
export function calibrationItems(loaded: Loaded, phase: CalibrationPhase): PacketItem[] {
  const list = calibrationList(loaded, phase);
  // Items carry an opaque ID so the variant name in the fixture ID never reaches a reviewer.
  return list.map(item => packetItem(loaded, `${phase}:${sha256(`${loaded.protocolSha256}:${item.id}`).slice(0, 12)}`, item.case, item.response));
}
