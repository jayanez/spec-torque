import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFile, chmod, cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { connect } from 'node:net';
import { createInterface } from 'node:readline';
import { release, tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { unzipSync } from 'fflate';
import { analyze, discoverWorkspace, selectFeature } from '../dist/integration.js';

// Opt-in real-client walkthrough of the installed Claude Code ZIP. It drives the
// native pane through a pseudo-terminal and submits no model prompt.
const [binary, zipPath, toolsPath, ...extra] = process.argv.slice(2);
assert.ok(binary && zipPath && toolsPath && !extra.length,
  'Usage: qualify:claude -- <claude executable> <spectorque-claude ZIP> <node_modules with node-pty and @xterm/headless>');
const run = promisify(execFile);
const require = createRequire(import.meta.url);
const pty = require(resolve(toolsPath, 'node-pty'));
const { Terminal } = require(resolve(toolsPath, '@xterm/headless'));
const executable = resolve(binary);
const zip = resolve(zipPath);
const bytes = await readFile(zip);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const files = unzipSync(bytes);
for (const name of ['.claude-plugin/plugin.json', '.mcp.json', 'hooks/hooks.json', 'hooks/register.js', 'dist/cli.js', 'dist/mcp.js', 'web-dist/index.html', 'skills/spec-review/SKILL.md', 'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES']) {
  assert.ok(files[name]?.length, 'Required archive entry: ' + name);
}
assert.ok(!Object.keys(files).some(name => name.startsWith('tests/')), 'Tests must not be packaged.');
// Fail on an unusable client before creating any directory.
const version = (await run(executable, ['--version'])).stdout.trim();
const scratch = await mkdtemp(join(tmpdir(), 'spectorque-claude-'));
await mkdir('.spec-torque', { recursive: true });
const output = await mkdtemp(resolve('.spec-torque/claude-'));
// Child sessions must not inherit this process's own Claude Code session markers.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^CLAUDE_?CODE/.test(key)));
Object.assign(env, { TERM: 'xterm-256color', COLORTERM: 'truecolor' });
const evidence = { zip: relative(process.cwd(), zip), sha256, claude: version, node: process.version, platform: `${process.platform}/${process.arch}`, osRelease: release(), modelPrompts: 0, cases: [] };
const record = (name, details = {}) => { evidence.cases.push({ name, ...details }); console.log('✓ ' + name); };

const cols = 186, rows = 48;
// Pane text wraps at narrow widths, so plain markers are compared without whitespace.
const matches = (view, marker) => typeof marker === 'string' ? view.replace(/\s+/g, '').includes(marker.replace(/\s+/g, '')) : marker.test(view);
async function session(name, workspace, args, exercise, sessionEnv = env) {
  const screen = new Terminal({ cols, rows, scrollback: 0, allowProposedApi: true });
  const client = pty.spawn(executable, args, { cwd: workspace, env: sessionEnv, name: 'xterm-256color', cols, rows });
  let exited = false;
  const exit = new Promise(done => client.onExit(() => { exited = true; done(); }));
  client.onData(data => screen.write(data));
  const frames = [];
  const text = () => Array.from({ length: rows }, (_, row) => screen.buffer.active.getLine(row)?.translateToString(true) ?? '').join('\n');
  // Pane text without the side-pane border, joined so wrapped lines can be matched.
  const pane = () => text().split('\n').map(line => line.includes('│') ? line.slice(line.lastIndexOf('│') + 1).trimEnd() : line.trimEnd()).join('\n');
  async function see(marker, timeout = 20_000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const view = pane();
      if (matches(view, marker)) return view;
      if (exited) break;
      await delay(50);
    }
    throw new Error(`${name}: Claude Code did not show ${marker}\n${text()}`);
  }
  async function absent(marker) {
    await delay(400);
    assert.ok(!matches(pane(), marker), `${name}: unexpected ${marker}`);
  }
  async function key(input, wait = 200) { assert.ok(!exited, name + ': Claude Code exited'); client.write(input); await delay(wait); }
  // A focused Button renders in inverse video; a focused Input shows its submit hint.
  function focused(label) {
    for (let row = 0; row < rows; row++) {
      const line = screen.buffer.active.getLine(row);
      const content = line?.translateToString(true) ?? '';
      const at = content.indexOf('[ ' + label + ' ]');
      if (at >= 0 && line.getCell(at)?.isInverse()) return true;
    }
    return false;
  }
  async function focus(label) {
    for (let i = 0; i < 24; i++) {
      if (label === 'input' ? /⏎ review/.test(text()) : focused(label)) return;
      await key('\t', 250);
    }
    throw new Error(`${name}: could not focus ${label}\n${text()}`);
  }
  async function press(label) { await focus(label); await key('\r', 600); }
  async function propose(original, replacement) {
    await focus('input');
    for (let i = 0; i < [...original].length + 4; i++) client.write('\x7f');
    await delay(300);
    await key(replacement, 400);
    await key('\r', 800);
    await see('After: ' + replacement);
  }
  try {
    await delay(3000);
    for (let i = 0; i < 40 && !/❯|trust this folder/i.test(text()); i++) await delay(250);
    if (/trust this folder/i.test(text())) { await key('\x1b[B'); await key('\r', 2500); }
    return await exercise({ see, absent, key, press, focus, propose, pane, text, frames });
  } finally {
    frames.push(text());
    if (!exited) { client.write('\x03'); await delay(400); client.write('\x03'); await Promise.race([exit, delay(4000)]); }
    if (!exited) { client.kill(); await Promise.race([exit, delay(3000)]); }
    screen.dispose();
    await writeFile(join(output, name + '.txt'), frames.join('\n\n--- frame ---\n\n'));
  }
}
async function openPane(ui) {
  await ui.key('/spectorque', 800);
  await ui.see('/spectorque');
  await ui.key('\r', 1500);
  await ui.see(/open decisions|Analysis failed/);
}
async function snapshot(root) {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const result = {};
  for (const entry of entries.filter(entry => entry.isFile())) {
    const path = join(entry.parentPath, entry.name);
    result[relative(root, path).split(sep).join('/')] = createHash('sha256').update(await readFile(path)).digest('hex');
  }
  return result;
}
const expected = async (root, feature) => analyze(selectFeature(await discoverWorkspace(root), feature));
const counts = report => report.findings.length + ' findings · ' + report.decisions.length + ' open decisions';
// Portable listener check: a loopback TCP connection succeeds only while the server listens.
const listening = port => new Promise(done => {
  const socket = connect({ host: '127.0.0.1', port: Number(port) });
  socket.setTimeout(2000, () => { socket.destroy(); done(false); });
  socket.once('connect', () => { socket.destroy(); done(true); });
  socket.once('error', () => done(false));
});

const wording = {
  en: { word: 'MUST', replacement: 'FR-001: The system MUST respond within [NEEDS CLARIFICATION: maximum response time?].', question: ' [NEEDS CLARIFICATION: which cases?]' },
  es: { word: 'DEBE', replacement: 'FR-001: El sistema DEBE responder en [NEEDS CLARIFICATION: ¿tiempo máximo de respuesta?].', question: ' [NEEDS CLARIFICATION: ¿qué casos?]' },
};

try {
  for (const language of ['en', 'es']) {
    const { word, replacement, question } = wording[language];
    const workspace = join(scratch, language);
    for (const feature of ['booking', 'payments']) await cp(`fixtures/${language}-draft/specs/booking`, join(workspace, 'specs', feature), { recursive: true });
    const scope = 'specs/booking';
    const target = join(workspace, 'specs/booking/spec.md');
    const other = join(workspace, 'specs/payments/spec.md');
    const otherBefore = await readFile(other);
    await session(language + '-walkthrough', workspace, ['--plugin-dir', zip], async ui => {
      await openPane(ui);
      const all = await expected(workspace, null);
      await ui.see('Scope: All documents');
      await ui.see('[ specs/payments ]');
      await ui.see(counts(all));
      record(language + ': pane loads from ZIP with scope picker', { findings: all.findings.length });

      await ui.press(scope);
      const scoped = await expected(workspace, scope);
      await ui.see('Scope: ' + scope);
      await ui.see(counts(scoped));
      const evidenceLine = scoped.findings[0].evidence[0];
      const source = (await readFile(join(workspace, evidenceLine.path), 'utf8')).split(/\r?\n/);
      assert.equal(source[evidenceLine.line - 1], evidenceLine.text);
      await ui.see(evidenceLine.path + ':' + evidenceLine.line);
      await ui.see(evidenceLine.text);
      record(language + ': scope selection and nested evidence', { scope, evidence: evidenceLine });

      const before = await snapshot(workspace);
      await ui.propose(evidenceLine.text, replacement);
      await ui.see('Before: ' + evidenceLine.text);
      await ui.press('Reject proposal');
      await ui.absent('After: ' + replacement);
      assert.deepEqual(await snapshot(workspace), before, 'Rejection must not change any file.');
      record(language + ': review and reject leaves every file byte-identical');

      await ui.propose(evidenceLine.text, replacement);
      await ui.press('Apply reviewed change');
      const applied = await expected(workspace, scope);
      await ui.see(counts(applied));
      const lines = (await readFile(target, 'utf8')).split(/\r?\n/);
      assert.equal(lines[evidenceLine.line - 1], replacement);
      assert.ok(lines[evidenceLine.line - 1].includes('FR-001') && lines[evidenceLine.line - 1].includes(word));
      assert.ok(applied.decisions.some(decision => decision.path === 'specs/booking/spec.md' && decision.line === evidenceLine.line));
      assert.notEqual(applied.id, scoped.id);
      assert.deepEqual(await readFile(other), otherBefore, 'Other features must not change.');
      record(language + ': explicit application keeps FR-001 and ' + word + ' and shows the pending decision', { revision: applied.id, decisions: applied.decisions.length });

      const next = applied.findings[0].evidence[0];
      await ui.propose(next.text, next.text + question);
      const external = '\n<!-- external edit ' + language + ' -->\n';
      await appendFile(join(workspace, next.path), external);
      const raced = await readFile(join(workspace, next.path), 'utf8');
      await ui.press('Apply reviewed change');
      await ui.see('Apply failed: Source changed');
      assert.equal(await readFile(join(workspace, next.path), 'utf8'), raced, 'A stale proposal must not write.');
      record(language + ': stale proposal is rejected and the external edit is preserved');

      await ui.press('Refresh analysis');
      const recovered = await expected(workspace, scope);
      await ui.see(counts(recovered));
      const fresh = recovered.findings[0].evidence[0];
      await ui.propose(fresh.text, fresh.text + question);
      await ui.press('Reject proposal');
      assert.ok((await readFile(join(workspace, next.path), 'utf8')).endsWith(external), 'Recovery keeps the external edit.');
      record(language + ': new analysis permits a fresh proposal and keeps the external edit', { revision: recovered.id });

      await ui.press('Open common workbench');
      const view = await ui.see(/Common workbench \(address copied\): http:\/\/127\.0\.0\.1:\d+/);
      const url = /http:\/\/127\.0\.0\.1:\d+/.exec(view)[0];
      await ui.see('select: ' + scope);
      const { stdout } = await run(process.execPath, ['--import', 'tsx', 'scripts/qualify-common-handoff.mjs', workspace, '--url', url, '--feature', scope], { timeout: 180_000 });
      const handoff = JSON.parse(stdout.slice(stdout.indexOf('{')));
      assert.equal(handoff.jsonExport && handoff.zipExport, true);
      assert.deepEqual(handoff.externalRequests, []);
      assert.deepEqual(handoff.pageErrors, []);
      const port = new URL(url).port;
      assert.ok(await listening(port));
      await ui.key('\x1b', 2500);
      assert.ok(!(await listening(port)), 'Closing the pane must stop the workbench.');
      record(language + ': common-workbench handoff exports match and the server stops with the pane', { url, handoff: handoff.output });
    });
  }

  // MCP and skills from the same ZIP: host discovery, then direct protocol calls.
  const plugin = join(scratch, 'plugin');
  for (const [name, content] of Object.entries(files)) {
    await mkdir(dirname(join(plugin, name)), { recursive: true });
    await writeFile(join(plugin, name), content);
  }
  const mcpWorkspace = join(scratch, 'mcp-host');
  await cp('fixtures/en-draft/specs', join(mcpWorkspace, 'specs'), { recursive: true });
  const hostMcp = (await run(executable, ['--plugin-dir', zip, 'mcp', 'list'], { cwd: mcpWorkspace, env, timeout: 120_000 })).stdout;
  assert.match(hostMcp, /plugin:spectorque:spectorque: .*dist[\\/]mcp\.js.*Connected/);
  const details = (await run(executable, ['--plugin-dir', zip, 'plugin', 'details', 'spectorque@inline'], { cwd: mcpWorkspace, env, timeout: 120_000 })).stdout;
  assert.match(details, /Skills \(3\)\s+spec-author, spec-refine, spec-review/);
  assert.match(details, /MCP servers \(1\)\s+spectorque/);
  record('host discovers and connects the plugin MCP server and lists three skills', { mcp: hostMcp.split('\n').find(line => line.includes('spectorque'))?.trim() });

  for (const language of ['en', 'es']) {
    const workspace = join(scratch, 'mcp-' + language);
    await cp(`fixtures/${language}-draft/specs`, join(workspace, 'specs'), { recursive: true });
    const before = await snapshot(workspace);
    const child = spawn(process.execPath, [join(plugin, 'dist/mcp.js')], { cwd: workspace, env: { ...env, SPECTORQUE_ROOT: workspace }, stdio: ['pipe', 'pipe', 'pipe'] });
    const pending = new Map();
    createInterface({ input: child.stdout }).on('line', line => { const message = JSON.parse(line); pending.get(message.id)?.(message); pending.delete(message.id); });
    let id = 0;
    const request = (method, params) => new Promise((done, fail) => {
      const requestId = ++id;
      const timer = setTimeout(() => fail(new Error('MCP ' + method + ' timed out')), 15_000);
      pending.set(requestId, message => { clearTimeout(timer); done(message); });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params }) + '\n');
    });
    const call = async (name, args) => {
      const response = await request('tools/call', { name, arguments: args });
      assert.ok(!response.result?.isError, name + ' failed: ' + JSON.stringify(response).slice(0, 400));
      const text = response.result.content[0].text;
      try { return JSON.parse(text); } catch { return text; }
    };
    try {
      const init = await request('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'spectorque-qualification', version: '1' } });
      assert.equal(init.result.serverInfo.name, 'spectorque');
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
      const tools = (await request('tools/list', {})).result.tools;
      assert.deepEqual(tools.map(tool => tool.name).sort(), ['analyze_specs', 'create_specs', 'discover_specs', 'export_report', 'propose_refinement', 'refinement_context']);
      assert.ok(tools.every(tool => tool.annotations.readOnlyHint && !tool.annotations.destructiveHint));
      const engine = await expected(workspace, null);
      const discovered = await call('discover_specs', {});
      assert.deepEqual(discovered.artifacts.map(a => a.path), ['specs/booking/spec.md']);
      const analyzed = await call('analyze_specs', {});
      assert.equal(analyzed.id, engine.id);
      assert.deepEqual(analyzed.findings, engine.findings);
      const first = engine.findings[0].evidence[0];
      const context = await call('refinement_context', { path: first.path, line: first.line, language });
      assert.ok(JSON.stringify(context).includes(first.text));
      const proposal = await call('propose_refinement', { path: first.path, line: first.line, replacement: wording[language].replacement, reason: 'qualification' });
      assert.equal(proposal.original, first.text);
      assert.match(proposal.baseHash, /^[a-f0-9]{64}$/);
      const created = await call('create_specs', { name: 'Qualification', purpose: language === 'es' ? 'Validar el borrador.' : 'Validate the draft.', actors: '', behavior: language === 'es' ? 'El sistema DEBE registrar reservas.' : 'The system MUST record bookings.', success: '', exclusions: '', dependencies: '', failures: '', privacy: '', language });
      assert.ok(Array.isArray(created) && created.length > 0);
      const report = await call('export_report', {});
      assert.ok(String(report).includes(first.path));
      const escaped = await request('tools/call', { name: 'refinement_context', arguments: { path: '../outside.md', line: 1 } });
      assert.equal(escaped.result.isError, true);
      assert.deepEqual(await snapshot(workspace), before, 'MCP calls must not write files.');
      record(language + ': all six MCP tools answer from the ZIP runtime without writing files', { revision: analyzed.id, created: created.map(a => a.path) });
    } finally { child.kill(); }
  }

  const empty = join(scratch, 'empty');
  await mkdir(empty);
  await session('empty-workspace', empty, ['--plugin-dir', zip], async ui => {
    await openPane(ui);
    await ui.see('0 findings · 0 open decisions');
    await ui.see('No rule findings in this scope.');
  });
  record('empty workspace reports no findings');

  if (process.platform !== 'win32') {
    const unreadable = join(scratch, 'unreadable');
    await cp('fixtures/en-draft/specs', join(unreadable, 'specs'), { recursive: true });
    await chmod(join(unreadable, 'specs/booking/spec.md'), 0o000);
    try {
      await session('unreadable-file', unreadable, ['--plugin-dir', zip], async ui => {
        await openPane(ui);
        await ui.see(/Analysis failed: EACCES/);
      });
    } finally { await chmod(join(unreadable, 'specs/booking/spec.md'), 0o644); }
    record('unreadable source reports the read failure');
  }

  const noNode = join(scratch, 'no-node');
  await cp('fixtures/en-draft/specs', join(noNode, 'specs'), { recursive: true });
  const bin = dirname(await realpath(executable));
  assert.ok(!(await readdir(bin)).some(name => /^node(\.exe)?$/i.test(name)), 'The Claude Code directory must not contain node for this case.');
  const pathWithoutNode = [bin, ...(process.platform === 'win32' ? [join(process.env.SystemRoot ?? 'C:\\Windows', 'System32')] : ['/usr/bin', '/bin'])].join(process.platform === 'win32' ? ';' : ':');
  await session('missing-node', noNode, ['--plugin-dir', zip], async ui => {
    await openPane(ui);
    await ui.see(/Analysis failed: Node\.js 22\.20 or later is required on PATH/);
  }, { ...env, PATH: pathWithoutNode });
  record('missing Node.js on PATH is reported');

  // Installed through a public marketplace path, scoped to one scratch project.
  const project = join(scratch, 'marketplace-project');
  await cp('fixtures/en-draft/specs', join(project, 'specs'), { recursive: true });
  const market = join(scratch, 'marketplace');
  for (const [name, content] of Object.entries(files)) {
    const path = join(market, 'spectorque', name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }
  await mkdir(join(market, '.claude-plugin'));
  await writeFile(join(market, '.claude-plugin/marketplace.json'), JSON.stringify({ name: 'spectorque-qualification', owner: { name: 'SpecTorque qualification' }, plugins: [{ name: 'spectorque', source: './spectorque', description: 'SpecTorque qualification copy' }] }, null, 2));
  const claude = (args, options = {}) => run(executable, args, { cwd: project, env, timeout: 120_000, ...options });
  // Always unregister the qualification copy, even when a later step fails.
  const removeInstall = async () => {
    await claude(['plugin', 'uninstall', 'spectorque@spectorque-qualification', '--scope', 'project']).catch(() => {});
    await claude(['plugin', 'marketplace', 'remove', 'spectorque-qualification', '--scope', 'project']).catch(() => {});
  };
  // A repository root of its own keeps project-scoped settings inside the scratch project.
  await run('git', ['init', '-q'], { cwd: project });
  await claude(['plugin', 'marketplace', 'add', market, '--scope', 'project']);
  try {
  const declared = JSON.parse(await readFile(join(project, '.claude/settings.json'), 'utf8').catch(() => '{}'));
  assert.ok(declared.extraKnownMarketplaces?.['spectorque-qualification'], 'The marketplace must be declared in the scratch project settings.');
  await claude(['plugin', 'install', 'spectorque@spectorque-qualification', '--scope', 'project']);
  const installed = JSON.parse((await claude(['plugin', 'list', '--json'])).stdout);
  const entry = installed.find(plugin => String(plugin.id ?? plugin.name).startsWith('spectorque@spectorque-qualification'));
  assert.ok(entry, 'Installed plugin is listed.');
  const projectSettings = JSON.parse(await readFile(join(project, '.claude/settings.json'), 'utf8'));
  await session('marketplace-installed', project, [], async ui => {
    await openPane(ui);
    await ui.see('specs/booking/spec.md:');
  });
  const isolated = join(scratch, 'second-profile');
  await mkdir(isolated);
  const secondProfile = JSON.parse((await claude(['plugin', 'list', '--json'], { cwd: isolated, env: { ...env, CLAUDE_CONFIG_DIR: join(scratch, 'second-config') } })).stdout);
  assert.ok(!secondProfile.some(plugin => String(plugin.id ?? plugin.name).startsWith('spectorque')), 'Another profile and directory must not inherit the install.');
  await claude(['plugin', 'uninstall', 'spectorque@spectorque-qualification', '--scope', 'project']);
  // Every marketplace command stays project-scoped so the operator's user marketplaces are untouched.
  await claude(['plugin', 'marketplace', 'remove', 'spectorque-qualification', '--scope', 'project']);
  assert.ok(!(await claude(['plugin', 'marketplace', 'list', '--json'])).stdout.includes('spectorque-qualification'), 'The project marketplace is removed.');
  const after = JSON.parse((await claude(['plugin', 'list', '--json'])).stdout);
  assert.ok(!after.some(plugin => String(plugin.id ?? plugin.name).startsWith('spectorque@spectorque-qualification')), 'Uninstalled plugin is no longer listed.');
  await session('marketplace-removed', project, [], async ui => {
    await ui.key('/spectorque', 1200);
    await ui.see('No commands match "/spectorque"');
  });
  // Observed host behavior: uninstall unregisters the plugin but may keep its cached copy.
  const cacheRetained = await readdir(entry.installPath).then(() => true, () => false);
  record('project-scoped marketplace install loads the pane; another profile does not inherit it; removal unloads it', { installed: entry, enabledPlugins: projectSettings.enabledPlugins, cacheRetainedAfterUninstall: cacheRetained });
  } finally {
    await removeInstall();
  }

  evidence.result = 'passed';
} catch (error) {
  evidence.result = 'failed';
  evidence.error = String(error?.stack || error);
  process.exitCode = 1;
} finally {
  evidence.output = output;
  await writeFile(join(output, 'evidence.json'), JSON.stringify(evidence, null, 2));
  // Evidence and terminal frames stay in the output directory; the scratch copies do not.
  await rm(scratch, { recursive: true, force: true });
  console.log(JSON.stringify({ result: evidence.result, sha256, claude: version, cases: evidence.cases.length, output, error: evidence.error?.split('\n').slice(0, 6).join('\n') }, null, 2));
}
