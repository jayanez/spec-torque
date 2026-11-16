import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createServer } from 'node:http';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { startServer } from '../src/node/server.ts';

const repository = resolve(import.meta.dirname, '..');
process.env.PLAYWRIGHT_BROWSERS_PATH ??= join(repository, '.spectorque/browsers');
const { chromium } = await import('playwright');
const executable = process.env.CODEX_EXECUTABLE ?? 'codex';
await mkdir(join(repository, '.spectorque'), { recursive: true });
const run = await mkdtemp(join(repository, '.spectorque', 'codex-run-'));
let inferenceRequests = 0;
const provider = createServer((req, res) => { inferenceRequests++; res.writeHead(503); res.end(); });
await new Promise(done => provider.listen(0, '127.0.0.1', done));
const providerUrl = `http://127.0.0.1:${provider.address().port}/v1`;
const results = [];
const browser = await chromium.launch();
try {
  for (const language of ['en', 'es']) {
    const root = join(run, language), home = join(run, `${language}-home`);
    await mkdir(root); await mkdir(home);
    await cp(join(repository, `fixtures/${language}-draft`), root, { recursive: true });
    await mkdir(join(root, '.agents'));
    await cp(join(repository, 'skills'), join(root, '.agents/skills'), { recursive: true });
    await mkdir(join(root, '.codex'));
    await writeFile(join(root, '.codex/config.toml'), `[mcp_servers.spectorque]\ncommand = ${JSON.stringify(process.execPath)}\nargs = [${JSON.stringify(join(repository, 'dist/mcp.js'))}]\n[mcp_servers.spectorque.env]\nSPECTORQUE_ROOT = ${JSON.stringify(root)}\n`);
    await writeFile(join(home, 'config.toml'), `model_provider = "offline"\nmodel = "offline"\n[model_providers.offline]\nname = "Offline qualification"\nbase_url = ${JSON.stringify(providerUrl)}\nwire_api = "responses"\n[analytics]\nenabled = false\n[feedback]\nenabled = false\n[projects.${JSON.stringify(repository)}]\ntrust_level = "trusted"\n[projects.${JSON.stringify(root)}]\ntrust_level = "trusted"\n`);
    const env = { ...process.env, CODEX_HOME: home };
    delete env.OPENAI_API_KEY; delete env.CODEX_API_KEY;
    const child = spawn(executable, ['app-server', '--stdio'], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
    const pending = new Map(); let sequence = 0;
    const lines = createInterface({ input: child.stdout });
    child.stderr.on('data', () => {});
    function rejectPending(error) { for (const p of pending.values()) { clearTimeout(p.timer); p.reject(error); } pending.clear(); }
    child.on('error', rejectPending);
    child.on('exit', () => rejectPending(new Error('Codex app-server exited.')));
    lines.on('line', line => {
      const message = JSON.parse(line), p = pending.get(message.id);
      if (p) { clearTimeout(p.timer); pending.delete(message.id); message.error ? p.reject(new Error(JSON.stringify(message.error))) : p.resolve(message.result); }
      else if (message.id !== undefined) child.stdin.write(JSON.stringify({ id: message.id, error: { code: -32601, message: 'Interactive requests are disabled in qualification.' } }) + '\n');
    });
    const request = (method, params) => new Promise((resolveRequest, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Codex timed out: ${method}`)); }, 30_000);
      pending.set(id, { resolve: resolveRequest, reject, timer });
      child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
    });
    const { server, url } = await startServer(root, 0);
    const context = await browser.newContext();
    try {
      const client = await request('initialize', { clientInfo: { name: 'spectorque_qualification', version: '0.1.0' }, capabilities: { experimentalApi: true } });
      child.stdin.write(JSON.stringify({ method: 'initialized', params: {} }) + '\n');
      const skills = await request('skills/list', { cwds: [root], forceReload: true });
      const projectSkills = skills.data[0].skills.filter(skill => skill.path.startsWith(join(root, '.agents')) && skill.enabled).map(skill => skill.name).sort();
      assert.deepEqual(projectSkills, ['spec-author', 'spec-refine', 'spec-review']);
      const { thread } = await request('thread/start', { cwd: root, ephemeral: true, modelProvider: 'offline', model: 'offline' });
      const inventory = await request('mcpServerStatus/list', { threadId: thread.id });
      const tools = Object.keys(inventory.data.find(s => s.name === 'spectorque').tools);
      assert.equal(tools.length, 6);
      const call = async (tool, args = {}, expectError = false) => {
        const result = await request('mcpServer/tool/call', { threadId: thread.id, server: 'spectorque', tool, arguments: args });
        assert.equal(Boolean(result.isError), expectError, JSON.stringify(result.content));
        return result.structuredContent?.result ?? result.content;
      };
      const discovered = await call('discover_specs');
      const before = await call('analyze_specs');
      assert.equal(before.practices.length, 40);
      assert.equal(before.summary.score, null);
      const finding = before.findings.find(f => f.message.includes(language === 'en' ? 'fast' : 'rápido'));
      assert.ok(finding);
      const evidence = finding.evidence[0];
      const path = join(root, evidence.path), original = await readFile(path, 'utf8');
      const refinement = await call('refinement_context', { path: evidence.path, line: evidence.line, language });
      assert.equal(refinement.original, evidence.text);
      assert.match(refinement.prompt, /UNTRUSTED DATA/);
      const replacement = evidence.text.replace(language === 'en' ? 'fast' : 'rápido', language === 'en' ? '[NEEDS CLARIFICATION: define fast]' : '[NEEDS CLARIFICATION: definir rápido]');
      await call('propose_refinement', { path: evidence.path, line: evidence.line, replacement, reason: 'Expose the undecided acceptance limit.' });
      assert.equal(await readFile(path, 'utf8'), original);
      const page = await context.newPage();
      await context.route('**/*', route => route.request().url().startsWith(url) ? route.continue() : route.abort());
      await page.goto(url);
      await page.getByRole('button', { name: 'Load local workspace', exact: true }).click();
      await page.getByRole('button').filter({ hasText: finding.message }).click();
      assert.equal(await page.getByRole('textbox', { name: 'Source text editor' }).evaluate(node => node.value.slice(node.selectionStart, node.selectionEnd)), evidence.text);
      await page.getByRole('textbox', { name: 'Proposed wording' }).fill(replacement);
      await page.getByRole('button', { name: 'Review difference', exact: true }).click();
      await page.getByRole('button', { name: 'Reject', exact: true }).click();
      assert.equal(await readFile(path, 'utf8'), original);
      await page.getByRole('button', { name: 'Review difference', exact: true }).click();
      await page.getByRole('checkbox', { name: 'Write this change to the local workspace' }).check();
      await page.getByRole('button', { name: 'Accept change', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Change accepted.' }).waitFor({ state: 'attached' });
      const after = await call('analyze_specs');
      assert.notEqual(after.id, before.id);
      assert.ok(after.decisions.some(d => d.path === evidence.path && d.line === evidence.line));
      assert.match(await call('export_report'), /SpecTorque/);
      await call('refinement_context', { path: '../escape.md', line: 1, language }, true);
      await call('create_specs', { name: 'Original booking example', purpose: 'Book a room', actors: 'Visitors', behavior: language === 'en' ? 'The system MUST support booking.' : 'El sistema DEBE permitir reservas.', success: '', exclusions: '', dependencies: '', failures: '', privacy: '', language });
      results.push({ language, client: client.userAgent, skills: projectSkills, tools, evidence: { path: evidence.path, line: evidence.line }, before: before.id, after: after.id, proposalDoesNotWrite: true, rejectionDoesNotWrite: true, workbenchApply: true, exportedReport: true });
    } finally {
      await context.close();
      await new Promise(done => server.close(done));
      rejectPending(new Error('Qualification complete.')); lines.close(); child.kill();
    }
  }
  assert.equal(inferenceRequests, 0);
  const report = { node: process.version, codex: execFileSync(executable, ['--version'], { encoding: 'utf8' }).trim(), platform: `${process.platform}/${process.arch}`, inferenceRequests, results, limits: 'Real Codex app-server + common browser workbench. No desktop UI, agent turn, native VS Code surface or other OS acceptance is established.' };
  await writeFile(join(run, 'evidence.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, evidence: join(run, 'evidence.json') }, null, 2));
} finally { await browser.close(); await new Promise(done => provider.close(done)); }
