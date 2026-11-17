import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export async function qualifyTerminal(pty, { client, args, env, workspace, language }) {
  const source = join(workspace, 'specs/booking/spec.md');
  const initial = await readFile(source, 'utf8');
  const originalLine = initial.split(/\r?\n/)[4];
  const replacement = language === 'es'
    ? 'FR-001: El sistema DEBE responder en [NEEDS CLARIFICATION: ¿Cuál es el límite de respuesta?].'
    : 'FR-001: The system MUST respond within [NEEDS CLARIFICATION: What is the response-time limit?].';
  const terminal = pty.spawn(process.execPath, [client, ...args], {
    cwd: workspace, env, name: 'xterm-256color', cols: 160, rows: 45,
  });
  let output = '';
  let exited = false;
  const exit = new Promise(done => terminal.onExit(() => { exited = true; done(); }));
  terminal.onData(data => { output += data; });

  async function waitFor(marker, offset = 0) {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline && !exited) {
      const rendered = output.slice(offset)
        .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
        .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
      if (rendered.includes(marker)) return;
      await delay(50);
    }
    throw new Error(`Pi terminal did not display "${marker}": ${output.slice(-6000)}`);
  }

  async function send(input, marker) {
    const offset = output.length;
    terminal.write(input);
    await waitFor(marker, offset);
    return offset;
  }

  async function propose() {
    await send('/spectorque\r', 'select evidence');
    const editor = await send('\r', 'specs/booking/spec.md:5');
    await waitFor(originalLine, editor);
    const diff = await send('\u0015' + replacement + '\r', 'Apply reviewed change?');
    for (const marker of ['Before:', originalLine, 'After:', replacement]) await waitFor(marker, diff);
  }

  try {
    await waitFor('spec-author, spec-refine, spec-review');
    await propose();
    await send('\x1b[B', '→ No');
    await send('\r', '0 open decisions');
    assert.equal(await readFile(source, 'utf8'), initial);

    await propose();
    const refreshed = await send('\r', 'assessment refreshed');
    await waitFor('1 open decision', refreshed);
    assert.equal(await readFile(source, 'utf8'), initial.replace(originalLine, replacement));
    const handoff = spawnSync(process.execPath, ['--import', 'tsx',
      resolve('scripts/qualify-common-handoff.mjs'), workspace], {
      encoding: 'utf8', timeout: 90_000,
    });
    assert.ifError(handoff.error);
    assert.equal(handoff.status, 0, handoff.stderr || handoff.stdout);
    console.log(handoff.stdout.trim());

    await writeFile(source, initial);
    await propose();
    const concurrent = '\nExternal scratch edit.\n';
    await appendFile(source, concurrent);
    await send('\r', 'proposal is stale');
    assert.equal(await readFile(source, 'utf8'), initial + concurrent);
    console.log(`${language}/terminal: rejection, acceptance, refresh, JSON/ZIP handoff and stale-source preservation passed`);
  } finally {
    if (!exited) {
      terminal.kill();
      await Promise.race([exit, delay(3_000, undefined, { ref: false })]);
    }
  }
}
