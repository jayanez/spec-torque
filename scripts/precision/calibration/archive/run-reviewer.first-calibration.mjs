#!/usr/bin/env node
/**
 * Runs one reviewer over one packet for the #57 rehearsal (docs/clarification-actionability.md,
 * amendment of 2026-11-23): one call per item, frozen prompt + that item's material, packet order.
 *
 *   node run-reviewer.mjs --reviewer R1|R2 --packet <R?-run?.json> --out <dir> [--auth <codex auth.json>] [--dry-run]
 *
 * Reads only the packet. Never reads keys, operator files or other packets. Refuses to overwrite a
 * finished run; an interrupted run resumes after its last finished item.
 *   R1: claude -p --setting-sources "" --tools "" ... from an empty temporary directory, subscription login.
 *   R2: docker image spectorque-r2:codex-0.170.0; mounts only the item and read-only credentials.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export const sha256 = text => createHash('sha256').update(text).digest('hex');

/** Serialises one item with the names and order the frozen prompt uses. */
export function material(item) {
  const r = item.response;
  const companions = item.companions.length
    ? item.companions.map(c => `--- ${c.path} ---\n${c.text.replace(/\n$/, '')}`).join('\n\n') : 'none';
  return [
    `SOURCE (${item.source.path}; target line ${item.source.targetLine}, marked >>):\n${item.source.text}`,
    `COMPANIONS:\n${companions}`,
    `ROLE BRIEF:\n${item.roleBrief}`,
    `OPEN SLOT:\n${item.openSlot}`,
    `ACCEPTABLE RESOLUTIONS:\n${item.acceptableResolutions.map(a => `- ${a}`).join('\n')}`,
    `INVARIANTS:\n${item.invariants.map(i => `- ${i.kind}: ${i.assertion}`).join('\n')}`,
    `RESPONSE:\naction: ${r.action}\nscope: ${r.scope ?? 'n/a'}\ntext: ${r.text ?? 'n/a'}\nnote: ${r.note ?? 'n/a'}`,
  ].join('\n\n');
}

/** Well-formed = the whole trimmed output parses as one JSON object. Label validity is the scorer's job. */
export const wellFormed = raw => {
  try { const v = JSON.parse(String(raw).trim()); return v !== null && typeof v === 'object' && !Array.isArray(v); }
  catch { return false; }
};

const IMAGE = 'spectorque-r2:codex-0.170.0';

function clientVersion(reviewer) {
  const p = reviewer === 'R1'
    ? spawnSync('claude', ['--version'], { encoding: 'utf8' })
    : spawnSync('docker', ['run', '--rm', '--entrypoint', 'codex', IMAGE, '--version'], { encoding: 'utf8' });
  return (p.stdout || '').trim();
}

function call(reviewer, input, authPath) {
  const work = mkdtempSync(join(tmpdir(), `st57-${reviewer}-`));
  try {
    if (reviewer === 'R1') {
      // Subscription login (amendment 3): no API key, no setting sources, no tools, no MCP.
      const { ANTHROPIC_API_KEY: _drop, ...env } = process.env;
      const p = spawnSync('claude', ['-p', '--setting-sources', '', '--tools', '', '--strict-mcp-config', '--no-session-persistence',
        '--disable-slash-commands', '--model', 'claude-sonnet-5-5', '--effort', 'medium', '--output-format', 'json'],
      { cwd: work, input, encoding: 'utf8', timeout: 600_000, env });
      if (p.status !== 0) return { error: `exit ${p.status}: ${(p.stderr || p.stdout || '').slice(0, 300)}` };
      const envelope = JSON.parse(p.stdout);
      if (envelope.is_error) return { error: String(envelope.result).slice(0, 300) };
      return { raw: envelope.result, model: Object.keys(envelope.modelUsage ?? {}).join(',') || null };
    }
    mkdirSync(join(work, 'out'));
    writeFileSync(join(work, 'item.txt'), input);
    const p = spawnSync('docker', ['run', '--rm', '--network', 'bridge', '--read-only',
      '--tmpfs', '/tmp', '--tmpfs', '/home/reviewer:uid=1001,gid=1001', '-e', 'CODEX_HOME=/home/reviewer/.codex',
      '-v', `${join(work, 'item.txt')}:/in/item.txt:ro`, '-v', `${authPath}:/secrets/auth.json:ro`, '-v', `${join(work, 'out')}:/out`,
      IMAGE], { encoding: 'utf8', timeout: 900_000 });
    const answer = join(work, 'out', 'answer.txt');
    if (p.status !== 0 || !existsSync(answer)) return { error: `exit ${p.status}: ${(p.stderr || '').slice(-300)}` };
    return { raw: readFileSync(answer, 'utf8'), model: 'gpt-6-luna' };
  } finally { rmSync(work, { recursive: true, force: true }); }
}

function main() {
  const { values } = parseArgs({ options: {
    reviewer: { type: 'string' }, packet: { type: 'string' }, out: { type: 'string' }, auth: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  } });
  const reviewer = values.reviewer;
  if (!['R1', 'R2'].includes(reviewer) || !values.packet || !values.out) {
    console.error('Usage: --reviewer R1|R2 --packet <file> --out <dir> [--auth <auth.json>] [--dry-run]');
    process.exit(2);
  }
  const packetBytes = readFileSync(values.packet);
  const packet = JSON.parse(packetBytes);
  if (packet.reviewer !== reviewer) throw new Error(`Packet is for ${packet.reviewer}, not ${reviewer}.`);
  const authPath = reviewer === 'R2' ? resolve(values.auth ?? `${process.env.HOME}/.codex/auth.json`) : null;
  if (authPath && !existsSync(authPath)) throw new Error(`No credentials at ${authPath}.`);
  const version = clientVersion(reviewer);
  const pinned = reviewer === 'R1' ? /^2\.1\.311 \(Claude Code\)$/ : /^codex-cli 0\.170\.0$/;
  if (!pinned.test(version)) throw new Error(`Pinned client not available (got "${version}"). The run waits, per the protocol.`);

  const out = resolve(values.out);
  mkdirSync(out, { recursive: true });
  const rawFile = join(out, 'raw.jsonl');
  const doneFile = join(out, 'done.json');
  if (existsSync(doneFile)) throw new Error(`${out} already holds a finished run; it is never overwritten.`);
  const recorded = existsSync(rawFile) ? readFileSync(rawFile, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
  const finished = new Set(recorded.filter(r => r.final).map(r => r.id));
  const items = values['dry-run'] ? packet.items.slice(0, 2) : packet.items;
  console.log(`${reviewer} · ${version} · packet sha256 ${sha256(packetBytes)} · ${items.length} items · ${finished.size} already finished`);

  for (const [index, item] of items.entries()) {
    if (finished.has(item.id)) continue;
    const input = `${packet.prompt}\n\n${material(item)}\n`;
    let record;
    // Reviewer retry: once, only for malformed output. Transport failures (no output) retry up to
    // 3 times and are recorded; they are not reviewer attempts.
    for (let attempt = 1; attempt <= 2; attempt++) {
      let result, transportFailures = 0;
      for (;;) {
        result = call(reviewer, input, authPath);
        if (!result.error || ++transportFailures >= 3) break;
        spawnSync('sleep', ['10']);
      }
      record = { id: item.id, index, attempt, final: false, inputSha256: sha256(input), clientVersion: version,
        model: result.model ?? null, transportFailures, error: result.error ?? null, raw: result.raw ?? null,
        wellFormed: result.raw != null && wellFormed(result.raw), at: new Date().toISOString() };
      if (record.wellFormed || record.error || attempt === 2) break;
      appendFileSync(rawFile, JSON.stringify(record) + '\n');
    }
    if (record.error) {
      appendFileSync(rawFile, JSON.stringify(record) + '\n');
      console.error(`${index + 1}/${items.length} ${item.id} ERROR ${record.error}\nStopping: transport failed three times. Re-run the same command to resume from this item.`);
      process.exit(1);
    }
    record.final = true;
    appendFileSync(rawFile, JSON.stringify(record) + '\n');
    console.log(`${index + 1}/${items.length} ${item.id} attempt ${record.attempt} ${record.wellFormed ? 'ok' : 'malformed'}`);
  }
  if (!values['dry-run']) {
    const body = readFileSync(rawFile);
    writeFileSync(doneFile, JSON.stringify({ reviewer, packet: resolve(values.packet), packetSha256: sha256(packetBytes),
      clientVersion: version, items: items.length, rawSha256: sha256(body), finishedAt: new Date().toISOString() }, null, 2) + '\n');
    console.log(`Done. raw.jsonl sha256 ${sha256(body)}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
