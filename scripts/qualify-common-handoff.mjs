import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { unzipSync } from 'fflate';
import { startServer } from '../src/node/server.js';
import { analyze, discoverWorkspace, selectFeature } from '../src/integration.js';

// An opt-in browser check of an existing scratch workspace, not a native-client driver.
const [workspace, ...args] = process.argv.slice(2);
if (!workspace) throw new Error('Usage: npm run qualify:handoff -- /scratch-workspace [--url http://127.0.0.1:port] [--feature feature-id]');
const options = new Map();
for (let i = 0; i < args.length; i += 2) {
  const [name, value] = args.slice(i, i + 2);
  assert.ok(['--url', '--feature'].includes(name) && value && !options.has(name), 'Invalid handoff option.');
  options.set(name, value);
}
const attached = options.get('--url');
if (attached) {
  const address = new URL(attached);
  assert.equal(address.href, address.origin + '/', 'Use the root loopback URL from OpenCode.');
  assert.equal(address.hostname, '127.0.0.1');
  assert.equal(address.protocol, 'http:');
  assert.ok(address.port, 'An explicit loopback port is required.');
}
const root = resolve(workspace);
const feature = options.get('--feature') ?? null;
const source = await discoverWorkspace(root);
const expected = await analyze(selectFeature(source, feature));
const decision = expected.decisions[0];
assert.ok(decision, 'First create a visible pending decision through the client under qualification.');
await mkdir('.spec-torque', { recursive: true });
const run = await mkdtemp(resolve('.spec-torque/handoff-'));
const local = attached ? undefined : await startServer(root, 0);
const url = attached ?? local.url;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const external = [], errors = [];
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin !== new URL(url).origin) {
      external.push(route.request().url()); return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.getByRole('button', { name: 'Load local workspace', exact: true }).click();
  // A workbench opened on a feature loads only that feature; otherwise choose it in the artifact set.
  const artifactSet = page.getByLabel('Artifact set');
  if (feature !== null) {
    await artifactSet.or(page.getByLabel('Local workspace feature')).first().waitFor();
    if (await artifactSet.count()) await artifactSet.selectOption(feature);
  }
  await page.getByRole('button', { name: 'Decisions', exact: true }).click();
  await page.getByRole('button').filter({ hasText: `${decision.path}:${decision.line}` }).click();
  const editor = page.getByRole('textbox', { name: 'Source text editor' });
  const source = await readFile(join(root, decision.path), 'utf8');
  await expect.poll(() => editor.evaluate(node => node.value.slice(node.selectionStart, node.selectionEnd)), { message: 'Decision selection must finish before export.' }).toBe(source.split(/\r?\n/)[decision.line - 1]);
  let download = page.waitForEvent('download');
  await page.getByRole('button', { name: '↓ JSON', exact: true }).click();
  await (await download).saveAs(join(run, 'assessment.json'));
  const exported = JSON.parse(await readFile(join(run, 'assessment.json'), 'utf8'));
  const { createdAt: exportedAt, ...exportedAssessment } = exported;
  const { createdAt: expectedAt, ...expectedAssessment } = expected;
  assert.deepEqual(exportedAssessment, expectedAssessment);
  download = page.waitForEvent('download');
  await page.getByRole('button', { name: '↓ Artifacts', exact: true }).click();
  await (await download).saveAs(join(run, 'artifacts.zip'));
  const zip = unzipSync(await readFile(join(run, 'artifacts.zip')));
  assert.deepEqual(Object.keys(zip).sort(), expected.artifacts.map(a => a.path).sort());
  for (const artifact of expected.artifacts) {
    assert.deepEqual(Buffer.from(zip[artifact.path]), await readFile(join(root, artifact.path)));
  }
  assert.deepEqual(external, []);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: join(run, 'workbench.png'), fullPage: true });
  const evidence = { root, feature, attached: Boolean(attached), node: process.version, platform: `${process.platform}/${process.arch}`, engineVersion: expected.engineVersion, reportId: expected.id, decision, jsonExport: true, zipExport: true, externalRequests: external, pageErrors: errors, limits: 'Browser handoff only. Native-client interaction and model-call evidence must be recorded separately.' };
  await writeFile(join(run, 'evidence.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ ...evidence, output: run }, null, 2));
} finally {
  await browser?.close();
  if (local) await new Promise(done => local.server.close(done));
}
