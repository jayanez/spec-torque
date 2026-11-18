import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { unzipSync } from 'fflate';

const [manifestPath, ...rest] = process.argv.slice(2);
if (!manifestPath || rest.length) throw new Error('Usage: npm run qualify:codex-desktop-probe -- <probe.json>');

const executable = process.env.CODEX_EXECUTABLE ?? 'codex';
const repository = resolve(import.meta.dirname, '..');
process.env.PLAYWRIGHT_BROWSERS_PATH ??= join(repository, '.spec-torque', 'browsers');
const { chromium, expect } = await import('@playwright/test');
const probe = JSON.parse(await readFile(await realpath(manifestPath), 'utf8'));
const bytes = await readFile(probe.archive);
assert.equal(createHash('sha256').update(bytes).digest('hex'), probe.sha256);
for (const [entry, content] of Object.entries(unzipSync(bytes))) {
  assert.deepEqual(await readFile(join(probe.plugin, entry)), Buffer.from(content), 'Fixture differs from package: ' + entry);
}
const evidenceDir = await mkdtemp(join(probe.run, 'control-'));
const uri = 'ui://spectorque-desktop-probe/probe.html';
const mimeType = 'text/html;profile=mcp-app';
const serverName = 'spectorque-desktop-probe';
let inferenceRequests = 0;
const provider = createServer((req, res) => { inferenceRequests++; res.writeHead(503).end(); });
await new Promise(done => provider.listen(0, '127.0.0.1', done));
const providerUrl = 'http://127.0.0.1:' + provider.address().port + '/v1';

async function withCodex(project, trusted, run) {
  const home = await mkdtemp(join(evidenceDir, 'home-'));
  const q = JSON.stringify;
  await writeFile(join(home, 'config.toml'), [
    'model_provider = "offline"', 'model = "offline"',
    '[model_providers.offline]', 'name = "Offline qualification"', 'base_url = ' + q(providerUrl), 'wire_api = "responses"',
    '[analytics]', 'enabled = false', '[feedback]', 'enabled = false',
    '[projects.' + q(project) + ']', 'trust_level = ' + q(trusted ? 'trusted' : 'untrusted'), '',
  ].join('\n'));
  const env = { ...process.env, CODEX_HOME: home };
  delete env.OPENAI_API_KEY;
  delete env.CODEX_API_KEY;
  const child = spawn(executable, ['app-server', '--stdio'], { cwd: project, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const lines = createInterface({ input: child.stdout });
  let sequence = 0;
  const pending = new Map();
  child.stderr.resume();
  const rejectAll = error => {
    for (const { timer, reject } of pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    pending.clear();
  };
  child.on('error', rejectAll);
  child.on('exit', () => rejectAll(new Error('Codex app-server exited.')));
  const closed = once(child, 'close').catch(() => {});
  child.stdin.on('error', rejectAll);
  const send = message => child.stdin.write(JSON.stringify(message) + '\n');
  lines.on('line', line => {
    let message;
    try { message = JSON.parse(line); } catch (error) { rejectAll(error); return; }
    const request = pending.get(message.id);
    if (request) {
      clearTimeout(request.timer);
      pending.delete(message.id);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
    } else if (message.id !== undefined && message.method) {
      send({ id: message.id, error: { code: -32601, message: 'Interactive requests are disabled in the protocol control.' } });
    }
  });
  const request = (method, params) => new Promise((resolveRequest, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('App-server timed out: ' + method)); }, 30_000);
    pending.set(id, { resolve: resolveRequest, reject, timer });
    send({ id, method, params });
  });

  try {
    const client = await request('initialize', {
      clientInfo: { name: 'spectorque_desktop_probe_control', version: '0.1.0' },
      capabilities: { experimentalApi: true },
    });
    send({ method: 'initialized', params: {} });
    const { thread } = await request('thread/start', { cwd: project, ephemeral: true, modelProvider: 'offline', model: 'offline' });
    return await run({ request, threadId: thread.id, userAgent: client.userAgent });
  } finally {
    lines.close();
    child.kill();
    await closed;
  }
}

async function exerciseSyntheticBridge(html, call) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const externalRequests = [];
    await page.route('**/*', route => {
      externalRequests.push(route.request().url());
      return route.abort();
    });
    await page.exposeFunction('readFromAppServer', () => call('read_probe'));
    await page.setContent('<iframe title="Synthetic MCP Apps host" sandbox="allow-scripts"></iframe>');
    await page.evaluate(resource => {
      const frame = document.querySelector('iframe');
      const steps = [];
      window.probeBridgeSteps = steps;
      addEventListener('message', async event => {
        if (event.source !== frame.contentWindow || event.data?.jsonrpc !== '2.0') return;
        const { id, method, params } = event.data;
        const respond = result => frame.contentWindow.postMessage({ jsonrpc: '2.0', id, result }, '*');
        if (method === 'ui/initialize' && params.protocolVersion === '2026-01-26') {
          steps.push(method);
          respond({ protocolVersion: params.protocolVersion, hostInfo: { name: 'Synthetic test host', version: '1' }, hostCapabilities: {}, hostContext: { displayMode: 'inline' } });
        } else if (method === 'ui/notifications/initialized') {
          steps.push(method);
        } else if (method === 'tools/call' && params.name === 'read_probe') {
          steps.push(method);
          try { respond(await window.readFromAppServer()); } catch {
            frame.contentWindow.postMessage({ jsonrpc: '2.0', id, error: { code: -32603, message: 'Probe read failed.' } }, '*');
          }
        }
      });
      frame.srcdoc = resource;
    }, html);
    const frame = page.frameLocator('iframe');
    await expect(frame.getByRole('status').first()).toHaveText('Bridge ready · 2026-01-26 · inline');
    await frame.getByRole('button', { name: 'Read probe marker' }).click();
    await expect(frame.getByRole('status').last()).toHaveText(/^probe-second-read · cwd: project-direct · roots: /);
    const steps = await page.evaluate(() => window.probeBridgeSteps);
    assert.deepEqual(steps, ['ui/initialize', 'ui/notifications/initialized', 'tools/call']);
    assert.deepEqual(externalRequests, []);
    return steps;
  } finally {
    await browser.close();
  }
}

try {
  await withCodex(probe.directProject, false, async ({ request, threadId }) => {
    const inventory = await request('mcpServerStatus/list', { threadId });
    assert.ok(!inventory.data.some(entry => entry.name === serverName), 'Untrusted project exposed the probe server.');
  });
  const result = await withCodex(probe.directProject, true, async ({ request, threadId, userAgent }) => {
    const inventory = await request('mcpServerStatus/list', { threadId });
    const server = inventory.data.find(entry => entry.name === serverName);
    assert.ok(server, 'Trusted direct MCP server was absent.');
    assert.equal(server.tools.open_probe._meta.ui.resourceUri, uri);
    assert.deepEqual(server.tools.open_probe._meta['openai/ui'].entrypoints, [{ type: 'thread' }]);
    const call = async tool => {
      const response = await request('mcpServer/tool/call', { threadId, server: serverName, tool, arguments: {} });
      assert.ok(!response.isError, JSON.stringify(response.content));
      return response;
    };
    assert.equal((await call('open_probe')).structuredContent.marker, 'probe-open');
    const resource = await request('mcpServer/resource/read', { threadId, server: serverName, uri });
    const content = resource.contents.find(entry => entry.uri === uri);
    assert.equal(content?.mimeType, mimeType);
    assert.deepEqual(content._meta['openai/ui'].availableDisplayModes, ['inline', 'fullscreen']);
    assert.equal(content.text, await readFile(join(probe.plugin, 'assets', 'probe.html'), 'utf8'));
    const bridge = await exerciseSyntheticBridge(content.text, call);
    const trace = (await readFile(join(probe.run, 'direct-trace.ndjson'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.deepEqual(trace.slice(-4).map(entry => entry.event), ['server-start', 'open-probe', 'resource-read', 'read-probe']);
    return { userAgent, trustDenial: true, tools: ['open_probe', 'read_probe'], uri, mimeType, bridge, uiAdvertised: trace.at(-1).uiAdvertised, roots: trace.at(-1).roots };
  });
  assert.equal(inferenceRequests, 0);
  const report = {
    ...result,
    digest: probe.sha256,
    source: probe.source,
    node: process.version,
    codex: execFileSync(executable, ['--version'], { encoding: 'utf8' }).trim(),
    platform: process.platform + '/' + process.arch,
    inferenceRequests,
    lane: 'Real app-server with direct project MCP and a synthetic Chromium bridge. Desktop installation and rendering pending.',
  };
  const path = join(evidenceDir, 'evidence.json');
  await writeFile(path, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ ...report, evidence: path }, null, 2));
} finally {
  await new Promise(done => provider.close(done));
}
