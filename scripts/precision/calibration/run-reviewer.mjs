#!/usr/bin/env node
/**
 * Runs one reviewer over one packet for the #57 rehearsal (docs/clarification-actionability.md and its
 * dated amendments): one call per item, the packet's prompt + that item's material, in packet order.
 *
 *   node run-reviewer.mjs --reviewer R1|R2 --run 1|2|3 --packet <file> --expect-sha <sha256> --out <dir>
 *   node run-reviewer.mjs --dry-run --reviewer R1|R2 --packet <invented packet> --out <scratch dir>
 *
 * Integrity
 * - The packet must match --expect-sha and the protocol (phase prompt, seed rule, seeded order, counts).
 * - The client version is checked before the run; the model on every call (and R2's effort and sandbox).
 * - An exclusive lock stops two processes writing the same run. Records are appended as whole lines;
 *   a torn final line from an interrupted write is dropped on resume. done.json is written atomically.
 * - Resume continues an item's reviewer attempts where they stopped, so no item gets a third answer.
 * - Dry runs mark every record and refuse any directory holding official records, and vice versa.
 * Isolation
 * - R1: claude -p --setting-sources "" --tools "" ... from an empty temporary directory, subscription
 *   login, minimal environment (no API key, nothing from the launching session).
 * - R2: the pinned docker image; mounts only the item, read-only credentials and an output directory.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { LABELS, packetProblems, sha256 } from './protocol.mjs';

export const PINS = {
  R1: { client: /^2\.1\.311 \(Claude Code\)$/, model: 'claude-sonnet-5-5', effort: 'medium' },
  R2: { client: /^codex-cli 0\.170\.0$/, model: 'gpt-6-luna', effort: 'medium', sandbox: 'read-only' },
};
export const IMAGE = 'spectorque-r2:codex-0.170.0';
/** Exploratory screening of second-reviewer candidates (#57 follow-up). Never used for a gated run. */
export const SCREEN_IMAGE = 'spectorque-screen:codex-0.170.0';
export const SCREEN_CANDIDATES = { 'gpt-6-luna:high': { model: 'gpt-6-luna', effort: 'high' }, 'gpt-6.2-astra:medium': { model: 'gpt-6.2-astra', effort: 'medium' } };

/** Serialises one item with the names and order the prompt uses. */
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

/** Well formed = the whole trimmed output parses as one JSON object (amendment 2). Label validity is the scorer's job. */
export const wellFormed = raw => {
  try { const v = JSON.parse(String(raw).trim()); return v !== null && typeof v === 'object' && !Array.isArray(v); }
  catch { return false; }
};

/** Reads model, effort and sandbox from the `codex exec` header on stderr. */
export function codexHeader(stderr) {
  const field = name => (new RegExp(`^${name}:\\s*(.+)$`, 'm').exec(stderr) ?? [])[1]?.trim() ?? null;
  return { model: field('model'), effort: field('reasoning effort'), sandbox: field('sandbox') };
}

/** Environment for R1: only what the CLI needs to find the user's login. Nothing from the launching session. */
export const minimalEnv = source => Object.fromEntries(
  ['PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'TMPDIR'].filter(k => source[k] !== undefined).map(k => [k, source[k]]));

/** Classifies one client result: pin violations are fatal; no or blank output is a transport failure (amendment 2). */
export function classifyR1(stdout, status) {
  if (status !== 0) return { error: `exit ${status}` };
  let envelope;
  try { envelope = JSON.parse(stdout); } catch { return { error: 'unparseable client envelope' }; }
  if (envelope.is_error) return { error: String(envelope.result).slice(0, 300) };
  const models = Object.keys(envelope.modelUsage ?? {});
  if (models.length !== 1 || models[0] !== PINS.R1.model) return { fatal: `R1 model usage ${models.join(',') || 'empty'}, expected only ${PINS.R1.model}` };
  if (typeof envelope.result !== 'string' || !envelope.result.trim()) return { error: 'blank output' };
  return { raw: envelope.result, model: models[0], meta: { stopReason: envelope.stop_reason ?? null } };
}
export function classifyR2(stderr, status, answer, pins = PINS.R2) {
  const header = codexHeader(stderr);
  if (header.model === null || header.effort === null || header.sandbox === null) return { error: 'codex header incomplete; pins not verifiable' };
  for (const k of ['model', 'effort', 'sandbox']) if (header[k] !== pins[k]) return { fatal: `R2 ran with ${k} ${header[k]}, expected ${pins[k]}` };
  if (status !== 0) return { error: `exit ${status}` };
  if (answer === null || !answer.trim()) return { error: 'blank output' };
  return { raw: answer, model: header.model, meta: header };
}

function imageId() {
  const p = spawnSync('docker', ['image', 'inspect', IMAGE, '--format', '{{.Id}}'], { encoding: 'utf8' });
  return (p.stdout || '').trim();
}
function clientVersion(reviewer) {
  const p = reviewer === 'R1'
    ? spawnSync('claude', ['--version'], { encoding: 'utf8', env: minimalEnv(process.env) })
    : spawnSync('docker', ['run', '--rm', '--entrypoint', 'codex', IMAGE, '--version'], { encoding: 'utf8' });
  return (p.stdout || '').trim();
}

function call(reviewer, input, authPath, screen = null) {
  const work = mkdtempSync(join(tmpdir(), `st57-${reviewer}-`));
  try {
    if (reviewer === 'R1') {
      const p = spawnSync('claude', ['-p', '--setting-sources', '', '--tools', '', '--strict-mcp-config', '--no-session-persistence',
        '--disable-slash-commands', '--model', PINS.R1.model, '--effort', PINS.R1.effort, '--output-format', 'json'],
      { cwd: work, input, encoding: 'utf8', timeout: 600_000, env: minimalEnv(process.env) });
      return classifyR1(p.stdout || '', p.status);
    }
    mkdirSync(join(work, 'out'));
    writeFileSync(join(work, 'item.txt'), input);
    const p = spawnSync('docker', ['run', '--rm', '--network', 'bridge', '--read-only',
      '--tmpfs', '/tmp', '--tmpfs', '/home/reviewer:uid=1001,gid=1001', '-e', 'CODEX_HOME=/home/reviewer/.codex',
      '-v', `${join(work, 'item.txt')}:/in/item.txt:ro`, '-v', `${authPath}:/secrets/auth.json:ro`, '-v', `${join(work, 'out')}:/out`,
      ...(screen ? ['-e', `SCREEN_MODEL=${screen.model}`, '-e', `SCREEN_EFFORT=${screen.effort}`, SCREEN_IMAGE] : [IMAGE])],
    { encoding: 'utf8', timeout: 1_800_000 });
    const answerFile = join(work, 'out', 'answer.txt');
    return classifyR2(p.stderr || '', p.status, existsSync(answerFile) ? readFileSync(answerFile, 'utf8') : null,
      screen ? { ...screen, sandbox: 'read-only' } : PINS.R2);
  } finally { rmSync(work, { recursive: true, force: true }); }
}

/** Loads existing records, dropping a torn final line from an interrupted append. */
export function loadRecords(rawFile) {
  if (!existsSync(rawFile)) return [];
  const text = readFileSync(rawFile, 'utf8');
  const lines = text.split('\n');
  const records = [];
  for (const [i, line] of lines.entries()) {
    if (!line) continue;
    try { records.push(JSON.parse(line)); }
    catch {
      if (i === lines.length - 1) {
        // Torn final line from an interrupted append: drop it; the call it recorded is redone.
        writeFileSync(rawFile, lines.slice(0, i).join('\n') + (i ? '\n' : ''));
        return records;
      }
      throw new Error(`${rawFile}: corrupt record on line ${i + 1}.`);
    }
  }
  if (text && !text.endsWith('\n')) appendFileSync(rawFile, '\n');
  return records;
}

/** Next reviewer attempt for an item from its records: 1, 2, or null when it already has a final record. */
export function nextAttempt(records, id) {
  const mine = records.filter(r => r.id === id);
  if (mine.some(r => r.final)) return null;
  return mine.some(r => r.attempt === 1 && !r.error && !r.wellFormed) ? 2 : 1;
}

function main() {
  const { values } = parseArgs({ options: {
    reviewer: { type: 'string' }, run: { type: 'string' }, packet: { type: 'string' }, 'expect-sha': { type: 'string' },
    out: { type: 'string' }, auth: { type: 'string' }, 'dry-run': { type: 'boolean', default: false }, screen: { type: 'string' },
  } });
  const reviewer = values.reviewer;
  const dry = values['dry-run'];
  const run = values.run ? Number(values.run) : null;
  const screen = values.screen ? SCREEN_CANDIDATES[values.screen] : null;
  if (values.screen && (!screen || reviewer !== 'R2')) throw new Error(`--screen takes one of ${Object.keys(SCREEN_CANDIDATES).join(', ')} and only with --reviewer R2.`);
  if (!PINS[reviewer] || !values.packet || !values.out || (!dry && (!values['expect-sha'] || !run))) {
    console.error('Usage: --reviewer R1|R2 --run 1|2|3 --packet <file> --expect-sha <sha256> --out <dir> | --dry-run --reviewer R1|R2 --packet <file> --out <dir>');
    process.exit(2);
  }
  const packetBytes = readFileSync(values.packet);
  const packetSha = sha256(packetBytes);
  const packet = JSON.parse(packetBytes);
  if (!dry) {
    if (packetSha !== values['expect-sha']) throw new Error(`Packet SHA-256 ${packetSha} is not the expected ${values['expect-sha']}.`);
    const problems = packetProblems(packet, { reviewer, run });
    if (problems.length) throw new Error(`Packet rejected: ${problems.join('; ')}.`);
  } else if (packet.reviewer !== reviewer) throw new Error(`Packet is for ${packet.reviewer}, not ${reviewer}.`);
  const out = resolve(values.out);
  mkdirSync(out, { recursive: true });
  const lockFile = join(out, '.lock');
  let lock;
  try { lock = openSync(lockFile, 'wx'); }
  catch { throw new Error(`${out} is locked by another runner (${lockFile}). Remove the lock only if no runner is active.`); }
  const release = () => { try { closeSync(lock); rmSync(lockFile, { force: true }); } catch { /* already released */ } };
  process.on('exit', release);
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { release(); process.exit(130); });

  const authPath = reviewer === 'R2' ? resolve(values.auth ?? `${process.env.HOME}/.codex/auth.json`) : null;
  if (authPath && !existsSync(authPath)) throw new Error(`No credentials at ${authPath}.`);
  const version = clientVersion(reviewer);
  if (!PINS[reviewer].client.test(version)) throw new Error(`Pinned client not available (got "${version}"). The run waits, per the protocol.`);
  const image = reviewer === 'R2' ? (screen ? spawnSync('docker', ['image', 'inspect', SCREEN_IMAGE, '--format', '{{.Id}}'], { encoding: 'utf8' }).stdout.trim() : imageId()) : null;

  const rawFile = join(out, 'raw.jsonl');
  const doneFile = join(out, 'done.json');
  if (existsSync(doneFile)) throw new Error(`${out} already holds a finished run; it is never overwritten.`);
  const records = loadRecords(rawFile);
  if (records.some(r => Boolean(r.dryRun) !== dry)) throw new Error(`${rawFile} mixes dry and official records; use a separate directory.`);
  if (records.some(r => (r.screen ?? null) !== (values.screen ?? null))) throw new Error(`${rawFile} mixes screening and other records; use a separate directory.`);
  if (records.some(r => r.packetSha256 !== packetSha || r.reviewer !== reviewer)) throw new Error(`${rawFile} belongs to a different packet or reviewer.`);
  const items = dry ? packet.items.slice(0, 2) : packet.items;
  const promptSha = sha256(packet.prompt);
  const done = items.filter(i => nextAttempt(records, i.id) === null).length;
  console.log(`${reviewer}${values.screen ? ' SCREENING ' + values.screen : ''}${run ? ' run ' + run : ''} · ${version}${image ? ' · image ' + image : ''} · packet ${packetSha} · prompt ${promptSha} · ${items.length} items · ${done} already finished${dry ? ' · DRY RUN' : ''}`);

  for (const [index, item] of items.entries()) {
    let attempt = nextAttempt(records, item.id);
    if (attempt === null) continue;
    const input = `${packet.prompt}\n\n${material(item)}\n`;
    // Reviewer retry: once, only for malformed output. Calls with no usable output retry up to 3 times
    // as transport failures (amendment 2) and are not reviewer attempts.
    for (; attempt <= 2; attempt++) {
      let result, transportFailures = 0;
      for (;;) {
        result = call(reviewer, input, authPath, screen);
        if (result.fatal) { console.error(`Stopping: ${result.fatal}. Nothing recorded for ${item.id}.`); process.exit(1); }
        if (!result.error || ++transportFailures >= 3) break;
        spawnSync('sleep', ['15']);
      }
      if (result.error) {
        console.error(`${index + 1}/${items.length} ${item.id} ERROR ${result.error}\nStopping: no output after three transport attempts. Nothing recorded for this attempt; re-run the same command to resume.`);
        process.exit(1);
      }
      const record = { id: item.id, index, attempt, reviewer, run, dryRun: dry || undefined, screen: values.screen ?? undefined, packetSha256: packetSha,
        promptSha256: promptSha, inputSha256: sha256(input), clientVersion: version, image, model: result.model,
        meta: result.meta, transportFailures, raw: result.raw, wellFormed: wellFormed(result.raw), at: new Date().toISOString() };
      record.final = record.wellFormed || attempt === 2;
      appendFileSync(rawFile, JSON.stringify(record) + '\n');
      records.push(record);
      if (record.final) {
        const parsed = record.wellFormed ? JSON.parse(record.raw.trim()) : null;
        const labels = parsed ? LABELS.map(l => String(parsed[l] ?? '-')[0]).join('') : '---';
        console.log(`${index + 1}/${items.length} ${item.id} attempt ${attempt} ${record.wellFormed ? 'ok' : 'malformed'} ${labels}`);
        break;
      }
    }
  }
  if (!dry) {
    const body = readFileSync(rawFile);
    const finals = loadRecords(rawFile).filter(r => r.final);
    const ids = new Set(finals.map(r => r.id));
    if (finals.length !== items.length || ids.size !== items.length || !items.every(i => ids.has(i.id))) throw new Error('Run incomplete or inconsistent: expected exactly one final record per packet item.');
    const summary = { reviewer, screen: values.screen ?? undefined, phase: packet.phase, run, packet: resolve(values.packet), packetSha256: packetSha, promptSha256: promptSha,
      clientVersion: version, image, items: items.length, malformed: finals.filter(r => !r.wellFormed).length,
      retried: finals.filter(r => r.attempt === 2).length, rawSha256: sha256(body), finishedAt: new Date().toISOString() };
    writeFileSync(`${doneFile}.tmp`, JSON.stringify(summary, null, 2) + '\n');
    renameSync(`${doneFile}.tmp`, doneFile);
    console.log(`Done. raw.jsonl sha256 ${summary.rawSha256}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
