import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from '@playwright/test';
import { unzipSync, strFromU8 } from 'fflate';
import { startServer } from '../src/node/server.js';
import { reviewWorkspace } from '../src/integration.js';

// An opt-in browser check of an existing scratch workspace, not a native-client driver.
if (!process.argv[2]) throw new Error('Usage: npm run qualify:handoff -- /absolute/scratch-workspace');
const root = resolve(process.argv[2]);
const expected = await reviewWorkspace(root);
const decision = expected.decisions[0];
assert.ok(decision, 'First create a visible pending decision through the client under qualification.');
await mkdir('.spectorque', { recursive: true });
const run = await mkdtemp(resolve('.spectorque/handoff-'));
const { server, url } = await startServer(root, 0);
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
  await page.getByRole('button', { name: 'Decisions', exact: true }).click();
  await page.getByRole('button').filter({ hasText: `${decision.path}:${decision.line}` }).click();
  const selected = await page.getByRole('textbox', { name: 'Source text editor' }).evaluate(node => node.value.slice(node.selectionStart, node.selectionEnd));
  const source = await readFile(join(root, decision.path), 'utf8');
  assert.equal(selected, source.split(/\r?\n/)[decision.line - 1]);
  let download = page.waitForEvent('download');
  await page.getByRole('button', { name: '↓ JSON', exact: true }).click();
  await (await download).saveAs(join(run, 'assessment.json'));
  const exported = JSON.parse(await readFile(join(run, 'assessment.json'), 'utf8'));
  assert.equal(exported.id, expected.id);
  assert.equal(exported.engineVersion, expected.engineVersion);
  assert.deepEqual(exported.decisions, expected.decisions);
  assert.equal(exported.practices.length, 40);
  download = page.waitForEvent('download');
  await page.getByRole('button', { name: '↓ Artifacts', exact: true }).click();
  await (await download).saveAs(join(run, 'artifacts.zip'));
  const zip = unzipSync(await readFile(join(run, 'artifacts.zip')));
  for (const artifact of expected.artifacts) {
    assert.equal(strFromU8(zip[artifact.path]), await readFile(join(root, artifact.path), 'utf8'));
  }
  assert.deepEqual(external, []);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: join(run, 'workbench.png'), fullPage: true });
  const evidence = { root, node: process.version, platform: `${process.platform}/${process.arch}`, engineVersion: expected.engineVersion, reportId: expected.id, decision, jsonExport: true, zipExport: true, externalRequests: external, pageErrors: errors, limits: 'Browser handoff only. Native-client interaction and model-call evidence must be recorded separately.' };
  await writeFile(join(run, 'evidence.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ ...evidence, output: run }, null, 2));
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
}
