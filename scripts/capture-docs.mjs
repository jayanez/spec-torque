// Regenerates the documentation screenshots in docs/assets from the built product and real hosts.
//
//   npm run package:integrations && npm run pack:hosts
//   npm run docs:capture -- [--tools <dir>] [--only workbench,codex,claude,opencode,pi,vscode]
//
// The workbench and Codex viewer need only Playwright Chromium. Terminal hosts are driven in a
// pseudo-terminal with isolated profiles and no model calls, and their final screen is replayed into
// xterm.js for the image. They need the tools folder (default .spec-torque/capture-tools) with
// node-pty, @xterm/xterm and @earendil-works/pi-coding-agent, `claude` and `opencode` on PATH, and
// VSCODE_EXECUTABLE for VS Code. Desktop captures (Claude Desktop, Codex Desktop, ThinkRail) are
// taken separately; docs/assets/README.md lists the source of every image.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { startServer } from '../src/node/server.js';
import { bindWorkspace } from '../src/node/scoped-review.js';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const tools = resolve(option('--tools') ?? '.spec-torque/capture-tools');
const only = new Set((option('--only') ?? 'workbench,codex,claude,opencode,pi,vscode').split(','));
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const scratch = await mkdtemp(join(tmpdir(), 'spectorque-capture-'));
const browser = await chromium.launch();
const done = [];

// Each capture gets its own copy, named like a real project because hosts show the folder name.
async function fixture(name, source = 'en-draft') {
  const root = join(scratch, name, 'room-booking');
  await cp(resolve('fixtures/' + source), root, { recursive: true });
  return realpath(root);
}

// ---------- Web workbench ----------
async function workbench() {
  const root = await fixture('workbench', 'en-complete');
  const { server, url } = await startServer(root, 0);
  const page = await browser.newPage({ viewport: { width: 1360, height: 930 }, deviceScaleFactor: 1.5 });
  const shot = async (name) => { await delay(400); await page.screenshot({ path: `docs/assets/workbench/${name}.jpg`, type: 'jpeg', quality: 82 }); done.push(`docs/assets/workbench/${name}.jpg`); };
  try {
    await page.goto(url);
    await page.getByText('specs/booking/spec.md').first().waitFor();
    const finding = page.getByRole('button', { name: /Requirement has no stable identifier|Unbounded wording/ }).first();
    if (await finding.count()) await finding.click();
    await page.evaluate(() => document.activeElement?.blur());
    await page.mouse.move(0, 0);
    await shot('analyze');
    await page.getByRole('button', { name: 'Build a spec', exact: true }).click();
    await page.getByRole('textbox', { name: 'Project name' }).fill('Room booking');
    await shot('build');
    await page.getByRole('button', { name: 'History', exact: true }).click();
    await shot('history');
    await page.getByRole('button', { name: 'Connect agents', exact: true }).click();
    await shot('connect');
  } finally {
    await page.close();
    server.closeAllConnections();
    await new Promise(r => server.close(r));
  }
}

// ---------- Codex Desktop inline viewer (MCP Apps host stub) ----------
async function codex() {
  const root = await fixture('codex');
  const binding = await bindWorkspace(root);
  const script = await build({ entryPoints: ['integrations/codex/viewer.ts'], bundle: true, platform: 'browser', target: 'es2022', format: 'iife', write: false });
  const html = (await readFile('integrations/codex/viewer.html', 'utf8')).replace('<!-- VIEWER_SCRIPT -->', () => '<script>' + script.outputFiles[0].text + '</script>');
  const page = await browser.newPage({ viewport: { width: 760, height: 1200 }, deviceScaleFactor: 2 });
  try {
    await page.exposeFunction('assessWorktree', async a => ({ ...await binding.assess(a.feature ?? 'specs/booking'), changed: Boolean(a.changed) }));
    await page.setContent('<body style="margin:0;background:#fff"><iframe id="viewer" style="border:0;width:760px;height:1200px"></iframe></body>');
    await page.evaluate(html => {
      const frame = document.querySelector('iframe');
      addEventListener('message', async event => {
        const m = event.data;
        const reply = result => frame.contentWindow.postMessage({ jsonrpc: '2.0', id: m.id, result }, '*');
        if (m.method === 'ui/initialize') reply({ protocolVersion: '2026-01-26', hostContext: { locale: 'en-US' } });
        if (m.method === 'tools/call' && m.params.name === 'assess_worktree') reply({ _meta: { assessmentView: await window.assessWorktree(m.params.arguments) } });
      });
      frame.srcdoc = html;
    }, html);
    const frame = page.frameLocator('#viewer');
    await frame.getByText('Heuristic evidence').first().waitFor({ timeout: 15_000 });
    await frame.getByText('Preview a change').click();
    await delay(300);
    const last = await frame.getByText('Heuristic evidence').last().boundingBox();
    const height = Math.ceil(last.y + last.height + 14);
    await page.screenshot({ path: 'docs/assets/panels/codex.png', clip: { x: 0, y: 0, width: 760, height } });
    done.push('docs/assets/panels/codex.png');
  } finally { await page.close(); }
}

// ---------- Terminal hosts ----------
const requireTool = createRequire(join(tools, 'package.json'));
const COLS = 150, ROWS = 42;
async function terminalImage(log, path) {
  const xtermJs = await readFile(requireTool.resolve('@xterm/xterm/lib/xterm.js'), 'utf8');
  const xtermCss = await readFile(requireTool.resolve('@xterm/xterm/css/xterm.css'), 'utf8');
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  try {
    await page.setContent(`<style>${xtermCss}body{margin:0;background:#1e1e1e}#t{display:inline-block;padding:14px}</style><div id="t"></div><script>${xtermJs}</script>`);
    await page.evaluate(async ({ log, cols, rows }) => {
      const term = new window.Terminal({ cols, rows, fontFamily: 'Menlo, "SF Mono", monospace', fontSize: 13, lineHeight: 1.15, cursorBlink: false, allowProposedApi: true,
        theme: { background: '#1e1e1e', foreground: '#e6e6e6', cursor: '#1e1e1e' } });
      term.open(document.getElementById('t'));
      await new Promise(r => term.write(log, r));
    }, { log, cols: COLS, rows: ROWS });
    await delay(300);
    await page.locator('#t').screenshot({ path });
    done.push(path);
  } finally { await page.close(); }
}

function drive(executable, argv, { cwd, env }) {
  const pty = requireTool('node-pty');
  const client = pty.spawn(executable, argv, { cwd, env, name: 'xterm-256color', cols: COLS, rows: ROWS });
  let log = '';
  let exited = false;
  client.onData(d => { log += d; });
  client.onExit(() => { exited = true; });
  const plain = () => log.replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\s+/g, '');
  return {
    log: () => log,
    async see(marker, timeout = 30_000) {
      const want = marker.replace(/\s+/g, '');
      const end = Date.now() + timeout;
      while (Date.now() < end && !exited) { if (plain().includes(want)) return; await delay(100); }
      throw new Error(`${executable} did not show "${marker}".\n${plain().slice(-1500)}`);
    },
    async type(text, wait = 500) { client.write(text); await delay(wait); },
    kill() { if (!exited) client.kill(); },
  };
}

function baseEnv(home, extra = {}) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => /^(PATH|TMPDIR|LANG|USER|SHELL|TEMP|TMP|SYSTEMROOT|WINDIR|COMSPEC|PATHEXT)$/i.test(k)));
  return { ...env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: join(home, 'config'), XDG_DATA_HOME: join(home, 'data'), XDG_CACHE_HOME: join(home, 'cache'), XDG_STATE_HOME: join(home, 'state'), TERM: 'xterm-256color', COLORTERM: 'truecolor', ...extra };
}

// Requests to the model endpoint are refused; the captures never call a model.
const trap = createServer((_, res) => res.writeHead(503).end());
await new Promise(r => trap.listen(0, '127.0.0.1', r));
const endpoint = 'http://127.0.0.1:' + trap.address().port;

async function claude() {
  const workspace = await fixture('claude');
  const home = join(scratch, 'claude-home');
  const config = join(home, 'claude-config');
  await mkdir(config, { recursive: true });
  const key = 'sk-ant-api03-spectorque-capture-00000000000000000000000000000000';
  await writeFile(join(config, '.claude.json'), JSON.stringify({ hasCompletedOnboarding: true, theme: 'dark', customApiKeyResponses: { approved: [key.slice(-20)], rejected: [] }, projects: { [workspace]: { hasTrustDialogAccepted: true } } }));
  const env = baseEnv(home, { CLAUDE_CONFIG_DIR: config, ANTHROPIC_API_KEY: key, ANTHROPIC_BASE_URL: endpoint, HTTPS_PROXY: endpoint, HTTP_PROXY: endpoint, NO_PROXY: '127.0.0.1,localhost', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', DISABLE_AUTOUPDATER: '1' });
  const ui = drive('claude', ['--plugin-dir', resolve('integrations/claude')], { cwd: workspace, env });
  try {
    await ui.see('❯', 30_000).catch(() => {});
    await delay(1500);
    await ui.type('/spectorque', 1200);
    await ui.type('\r', 2500);
    await ui.see('open decisions');
    await ui.see('Heuristic evidence');
    await delay(1500);
    await terminalImage(ui.log(), 'docs/assets/panels/claude.png');
  } finally { ui.kill(); }
}

async function extractPackage(tgz, name) {
  const dir = join(scratch, name);
  await mkdir(dir, { recursive: true });
  execFileSync('tar', ['-xzf', resolve('artifacts/npm', tgz), '-C', dir]);
  return join(dir, 'package');
}

async function opencode() {
  const workspace = await fixture('opencode');
  const home = join(scratch, 'opencode-home');
  const plugin = await extractPackage(`opencode-spectorque-${version}.tgz`, 'opencode-plugin');
  const env = baseEnv(home, { OPENCODE_PASSWORD: randomBytes(32).toString('hex'), OPENCODE_DISABLE_MODELS_FETCH: '1', OPENCODE_DISABLE_AUTOUPDATE: '1', OPENCODE_DISABLE_FREE_MODELS: '1', HTTPS_PROXY: endpoint, HTTP_PROXY: endpoint, NO_PROXY: '127.0.0.1,localhost' });
  const configDir = join(home, 'config', 'opencode');
  await mkdir(configDir, { recursive: true });
  await writeFile(join(configDir, 'cli.json'), JSON.stringify({ highlights: false, plugins: [plugin] }));
  await writeFile(join(configDir, 'opencode.json'), JSON.stringify({ autoupdate: false, share: 'disabled' }));
  const service = spawn('opencode', ['serve', '--hostname', '127.0.0.1', '--port', '0'], { cwd: workspace, env, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const url = await new Promise((ok, fail) => {
      let out = '';
      const timer = setTimeout(() => fail(new Error('OpenCode service did not start\n' + out)), 20_000);
      const read = d => { out += d; const m = /server listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(out); if (m) { clearTimeout(timer); ok(m[1]); } };
      service.stdout.on('data', read); service.stderr.on('data', read);
    });
    const session = JSON.parse(execFileSync('opencode', ['api', '--server', url, 'session.create', '--data', JSON.stringify({ title: 'Room booking review', location: { directory: workspace } })], { cwd: workspace, env, encoding: 'utf8' })).data;
    const ui = drive('opencode', ['--server', url, workspace, '--session', session.id], { cwd: workspace, env });
    try {
      await ui.see('Room booking review');
      await ui.type('/spectorque', 800);
      await ui.see('Open SpecTorque');
      await ui.type('\r', 2500);
      await ui.see('q Close panel');
      await ui.see('Heuristic evidence');
      await delay(1000);
      await terminalImage(ui.log(), 'docs/assets/panels/opencode.png');
    } finally { ui.kill(); }
  } finally { service.kill(); }
}

async function pi() {
  const workspace = await fixture('pi');
  const agent = join(scratch, 'pi-agent');
  await mkdir(agent, { recursive: true });
  const cli = join(tools, 'node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js');
  const pkg = await extractPackage(`pi-spectorque-${version}.tgz`, 'pi-package');
  // The Pi package resolves its own dependencies from its folder, as after `pi install npm:pi-spectorque`.
  execFileSync('npm', ['install', '--omit=dev', '--omit=peer', '--no-audit', '--no-fund', '--ignore-scripts'], { cwd: pkg, stdio: 'ignore' });
  // A placeholder key lists a model so Pi starts without its setup warnings; requests go to the refusing trap.
  await writeFile(join(agent, 'settings.json'), JSON.stringify({ quietStartup: 'header' }));
  const env = { ...baseEnv(agent), PI_CODING_AGENT_DIR: agent, PI_OFFLINE: '1', PI_TELEMETRY: '0', ANTHROPIC_API_KEY: 'sk-ant-api03-spectorque-capture-0000', ANTHROPIC_BASE_URL: endpoint, HTTPS_PROXY: endpoint, HTTP_PROXY: endpoint, NO_PROXY: '127.0.0.1,localhost' };
  const common = ['--offline', '--no-session', '--no-context-files', '--no-mcp'];
  const install = spawnSync(process.execPath, [cli, 'install', pkg, '--local', '--approve'], { cwd: workspace, env, encoding: 'utf8' });
  if (install.status !== 0) throw new Error('pi install failed\n' + install.stderr + install.stdout);
  const ui = drive(process.execPath, [cli, ...common, '--approve'], { cwd: workspace, env });
  try {
    await delay(3000);
    await ui.type('/spectorque', 800);
    await ui.type('\r', 3000);
    await ui.see('open decisions');
    await delay(1500);
    await terminalImage(ui.log(), 'docs/assets/panels/pi.png');
  } finally { ui.kill(); }
}

// ---------- VS Code (real extension host; the test saves webview.png) ----------
async function vscode() {
  if (!process.env.VSCODE_EXECUTABLE) throw new Error('Set VSCODE_EXECUTABLE to capture VS Code.');
  const run = spawnSync(process.execPath, ['scripts/test-vscode.mjs'], { encoding: 'utf8', env: process.env });
  const evidence = /VS Code evidence: (.+)/.exec(run.stdout)?.[1];
  if (run.status !== 0 || !evidence) throw new Error('VS Code run failed\n' + run.stdout.slice(-2000) + run.stderr.slice(-2000));
  await cp(join(evidence.trim(), 'webview.png'), 'docs/assets/panels/vscode.png');
  done.push('docs/assets/panels/vscode.png');
}

const steps = { workbench, codex, claude, opencode, pi, vscode };
const failures = [];
try {
  for (const [name, step] of Object.entries(steps)) {
    if (!only.has(name)) continue;
    try { await step(); console.log('✓ ' + name); }
    catch (error) { failures.push(name); console.error('✗ ' + name + ': ' + (error?.stack ?? error)); }
  }
} finally {
  await browser.close();
  trap.close();
  await rm(scratch, { recursive: true, force: true });
}
console.log(done.join('\n'));
if (failures.length) { console.error('Failed: ' + failures.join(', ')); process.exitCode = 1; }
