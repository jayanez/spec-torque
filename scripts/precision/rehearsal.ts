/**
 * Shared logic for the E1.2 clarification rehearsal (#57,
 * docs/clarification-actionability.md): fixture loading, the frozen engine
 * check, presentation pages and blind reviewer packets.
 *
 * Nothing here sends data anywhere. Packets are written to local files for the
 * operator, who starts any review run by hand.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { analyze, classifyArtifact, clarifyE12 } from '../../src/core.js';

export const PROTOCOL = 'docs/clarification-actionability.md';
/**
 * LF-normalised SHA-256 of the protocol at its freeze commit (6a2dc0f, posted in #57).
 * Seeds and presentation IDs derive from this value, not from the current file, so a
 * dated amendment does not reorder packets or change page IDs (amendment of 2026-11-23).
 */
export const FROZEN_PROTOCOL_SHA256 = '16659f6e7f7317f2e10e1b3b6bbb87cb8304732ed17fcb7e9a8a024984525826';
/** SHA-256 of the frozen reviewer prompt; amendments must not change it. */
export const FROZEN_PROMPT_SHA256 = '406cae4c818b43ba725dcdc2d83a098dae3ec8207da4ec94e470e0b34f787f58';
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

export type Case = z.infer<typeof caseSchema>;
export type Response = z.infer<typeof responseSchema>;
export type Rehearsal = z.infer<typeof rehearsalSchema>;
export type Calibration = z.infer<typeof calibrationSchema>;

export interface Material { source: string; path: string; target: number; companions: Record<string, string> }

export interface Loaded {
  /** Frozen protocol SHA-256: the source of seeds and presentation IDs. */
  protocolSha256: string;
  /** SHA-256 of the protocol as checked out, including any amendments. */
  currentProtocolSha256: string;
  prompt: string;
  rehearsal: Rehearsal;
  calibration: Calibration;
  material: Map<string, Material>;
}

/** The reviewer prompt is the first fenced `text` block after the appendix heading. */
export function extractPrompt(protocol: string): string {
  const appendix = protocol.slice(protocol.indexOf('## Appendix: reviewer prompt'));
  const match = /```text\n([\s\S]*?)\n```/.exec(appendix);
  if (!match) throw new Error('Reviewer prompt not found in the protocol appendix.');
  return match[1];
}

export async function load(root: string): Promise<Loaded> {
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
  if (sha256(prompt) !== FROZEN_PROMPT_SHA256) throw new Error('The reviewer prompt differs from the frozen prompt.');
  return { protocolSha256: FROZEN_PROTOCOL_SHA256, currentProtocolSha256: fileSha256(protocol), prompt, rehearsal, calibration, material };
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

export type Phase = 'calibration' | 'reserve' | 'live';
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
  const s = seed(loaded.protocolSha256, phase, reviewer, run);
  return { phase, reviewer, run, seed: s, protocolSha256: loaded.protocolSha256, prompt: loaded.prompt, items: order(items, s) };
}

export function calibrationItems(loaded: Loaded, phase: 'calibration' | 'reserve'): PacketItem[] {
  const list = phase === 'calibration' ? loaded.calibration.items : loaded.calibration.reserve;
  // Items carry an opaque ID so the variant name in the fixture ID never reaches a reviewer.
  return list.map(item => packetItem(loaded, `${phase}:${sha256(`${loaded.protocolSha256}:${item.id}`).slice(0, 12)}`, item.case, item.response));
}
