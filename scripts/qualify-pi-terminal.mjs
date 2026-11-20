import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFile, cp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { analyze, discoverWorkspace, selectFeature, terminalSummary } from '../dist/integration.js';

export async function qualifyTerminal(pty, { client, args, env, workspace, language }) {
  const source = join(workspace, 'specs/booking/spec.md');
  const booking = 'specs/booking';
  const other = 'specs/other';
  const initial = await readFile(source, 'utf8');
  const originalLine = initial.split(/\r?\n/)[4];
  const replacement = language === 'es'
    ? 'FR-001: El sistema DEBE responder en [NEEDS CLARIFICATION: ¿Cuál es el límite de respuesta?].'
    : 'FR-001: The system MUST respond within [NEEDS CLARIFICATION: What is the response-time limit?].';
  const terminal = pty.spawn(process.execPath, [client, ...args], {
    cwd: workspace, env, name: 'xterm-256color', cols: 160, rows: 45,
  });
  let output = '';
  let columns = 160;
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

  async function expectWidget(report, scope) {
    // Pi sends incremental redraws. Resize to capture the complete current widget.
    const offset = output.length;
    columns = columns === 160 ? 161 : 160;
    terminal.resize(columns, 45);
    const [title, ...summary] = terminalSummary(report).slice(0, 10);
    await waitFor(`${title} · Scope: ${scope}`, offset);
    for (const line of summary.filter(Boolean)) await waitFor(line, offset);
    return offset;
  }

  async function openScopePicker() {
    const offset = await send('/spectorque\r', 'select scope');
    for (const marker of ['→ All documents', `Feature · ${booking}`, `Feature · ${other}`]) {
      await waitFor(marker, offset);
    }
  }

  async function chooseScope(feature, report) {
    if (feature !== null) await send('\x1b[B', `→ Feature · ${booking}`);
    if (feature === other) await send('\x1b[B', `→ Feature · ${other}`);
    await send('\r', 'select evidence');
    const offset = await expectWidget(report, feature ?? 'All documents');
    for (const [index, finding] of report.findings.entries()) {
      const { path, line } = finding.evidence[0];
      await waitFor(`${index + 1}. ${finding.message} · ${path}:${line}`, offset);
    }
  }

  async function propose(report) {
    await openScopePicker();
    await chooseScope(booking, report);
    await send('\x1b[B', '→ 2.'); // Move past the shared instructions finding.
    const editor = await send('\r', 'specs/booking/spec.md:5');
    await waitFor(originalLine, editor);
    const diff = await send('\u0015' + replacement + '\r', 'Apply reviewed change?');
    for (const marker of ['Before:', originalLine, 'After:', replacement]) await waitFor(marker, diff);
  }

  try {
    await waitFor('spec-author, spec-refine, spec-review');
    await send('/spectorque\r', 'select evidence');
    await expectWidget(await analyze(await discoverWorkspace(workspace)), 'All documents');
    terminal.write('\u0003');

    await cp(resolve('fixtures/en-complete/specs/booking'), join(workspace, other), { recursive: true });
    await writeFile(join(workspace, 'AGENTS.md'), '# Shared instructions\n\nFR-901: The reviewer MUST respond quickly.\n');
    const full = await discoverWorkspace(workspace);
    const reports = new Map();
    for (const feature of [null, booking, other]) {
      reports.set(feature, await analyze(selectFeature(full, feature)));
      assert.ok(reports.get(feature).findings.some(finding => finding.evidence[0].path === 'AGENTS.md'));
    }
    const companion = ['I2.3', 'I2.4', 'I3.2', 'C1.2', 'C1.3', 'C2.3'];
    for (const [feature, status] of [[null, 'unknown'], [other, 'partial']]) {
      const practices = reports.get(feature).practices.filter(practice => companion.includes(practice.id));
      assert.deepEqual(practices.map(practice => practice.status), companion.map(() => status));
    }
    async function expectArtifacts(edit) {
      for (const artifact of full.artifacts) {
        const original = artifact.path === `${booking}/spec.md` ? edit : artifact.content;
        assert.deepEqual(await readFile(join(workspace, artifact.path)), Buffer.from(original));
      }
    }

    await openScopePicker();
    terminal.write('\u0003');
    for (const feature of [null, other]) {
      await openScopePicker();
      await expectArtifacts(initial);
      await chooseScope(feature, reports.get(feature));
      terminal.write('\u0003');
    }

    await propose(reports.get(booking));
    await send('\x1b[B', '→ No');
    await send('\r', '0 open decisions');
    await expectArtifacts(initial);

    await propose(reports.get(booking));
    await send('\r', 'assessment refreshed');
    await expectArtifacts(initial.replace(originalLine, replacement));
    const updated = await analyze(selectFeature(await discoverWorkspace(workspace), booking));
    assert.equal(updated.decisions.length, 1);
    await expectWidget(updated, booking);
    const handoff = spawnSync(process.execPath, ['--import', 'tsx',
      resolve('scripts/qualify-common-handoff.mjs'), workspace, '--feature', booking], {
      encoding: 'utf8', timeout: 90_000,
    });
    assert.ifError(handoff.error);
    assert.equal(handoff.status, 0, handoff.stderr || handoff.stdout);
    console.log(handoff.stdout.trim());

    await writeFile(source, initial);
    await propose(reports.get(booking));
    const concurrent = '\nExternal scratch edit.\n';
    await appendFile(source, concurrent);
    await send('\r', 'proposal is stale');
    await expectArtifacts(initial + concurrent);
    console.log(`${language}/terminal: ${[...reports].map(([feature, report]) =>
      `${feature ?? 'All documents'} (${terminalSummary(report)[1]})`).join(', ')}`);
    console.log(`${language}/terminal: direct flow, scope cancellation, shared-engine widgets and findings, exact bytes on rejection, explicit approval, scoped refresh, JSON/ZIP handoff and stale-source preservation passed`);
  } finally {
    if (!exited) {
      terminal.kill();
      await Promise.race([exit, delay(3_000, undefined, { ref: false })]);
    }
  }
}
