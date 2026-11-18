import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { startServer } from '../../src/node/server.js';
import { bindWorkspace } from '../../src/node/scoped-review.js';

const test = base.extend<{ workspace: { root: string; url: string } }>({
  workspace: async ({}, use) => {
    const root = await mkdtemp(join(tmpdir(), 'spectorque-browser-'));
    const { server, url } = await startServer(root, 0);
    try { await use({ root, url }); }
    finally {
      // Assertions have finished. Stop accepting connections before closing any
      // active browser requests, so fixture teardown cannot wait on an open page.
      await new Promise<void>((done, reject) => {
        server.close(e => e ? reject(e) : done());
        server.closeAllConnections();
      });
      await rm(root, { recursive: true, force: true });
    }
  },
});

for (const es of [false, true]) {
  test(`${es ? 'ES' : 'EN'} import, evidence, reject, accept, reanalyze, export and undo`, async ({ page, workspace, browserName }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const external: string[] = [];
    await page.route('**/*', route => {
      if (!route.request().url().startsWith(workspace.url)) { external.push(route.request().url()); return route.abort(); }
      return route.continue();
    });
    const source = es ? '# Reservas\n\nFR-001: El sistema DEBE ser rápido.\n' : '# Booking\n\nFR-001: The system MUST be fast.\n';
    const replacement = es ? 'FR-001: El sistema DEBE ser [NEEDS CLARIFICATION: definir rápido].' : 'FR-001: The system MUST be [NEEDS CLARIFICATION: define fast].';
    await page.goto(workspace.url);
    // WebKit on macOS uses Option+Tab for full keyboard access. See
    // https://github.com/microsoft/playwright/issues/5609
    const tabKey = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
    await expect(page.getByRole('link', { name: /^SpecTorque/ })).toBeVisible();
    await page.keyboard.press(tabKey);
    await expect(page.getByRole('link', { name: /^SpecTorque/ })).toBeFocused();
    await page.keyboard.press(tabKey);
    await expect(page.getByRole('button', { name: 'Español', exact: true })).toBeFocused();
    if (es) await page.getByRole('button', { name: 'Español', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles({ name: 'spec.md', mimeType: 'text/markdown', buffer: Buffer.from(source) });
    const finding = page.getByRole('button').filter({ hasText: 'Unbounded wording:' });
    await expect(finding).toHaveCount(1);
    // Enter activates the finding and moves focus to the exact source line.
    await finding.focus();
    await page.keyboard.press('Enter');
    const editor = page.getByRole('textbox', { name: 'Source text editor' });
    await expect(editor).toBeFocused();
    expect(await editor.evaluate((node: HTMLTextAreaElement) => node.value.slice(node.selectionStart, node.selectionEnd))).toBe(source.trim().split('\n').at(-1));
    const wording = page.getByRole('textbox', { name: es ? 'Texto propuesto' : 'Proposed wording' });
    await wording.fill(replacement);
    await page.getByRole('button', { name: es ? 'Revisar diferencia' : 'Review difference', exact: true }).click();
    await page.getByRole('button', { name: es ? 'Rechazar' : 'Reject', exact: true }).click();
    await expect(editor).toHaveValue(source);
    await page.getByRole('button', { name: es ? 'Revisar diferencia' : 'Review difference', exact: true }).click();
    await page.getByRole('button', { name: es ? 'Aceptar cambio' : 'Accept change', exact: true }).click();
    await expect(editor).toHaveValue(source.replace(source.trim().split('\n').at(-1)!, replacement));
    await expect(finding).toHaveCount(0);
    await page.getByRole('button', { name: es ? 'Decisiones' : 'Decisions', exact: true }).click();
    await expect(page.getByRole('button').filter({ hasText: 'spec.md:3' })).toHaveCount(1);
    const reportDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: '↓ JSON', exact: true }).click();
    const report = JSON.parse(await readFile(await (await reportDownload).path(), 'utf8'));
    expect(report.practices).toHaveLength(40);
    expect(report.summary.score).toBeNull();
    expect(report.decisions[0]).toMatchObject({ path: 'spec.md', line: 3 });
    const archiveDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: es ? '↓ Documentos' : '↓ Artifacts', exact: true }).click();
    const archive = unzipSync(await readFile(await (await archiveDownload).path()));
    expect(strFromU8(archive['spec.md'])).toContain(replacement);
    const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(accessibility.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: es ? 'Deshacer' : 'Undo', exact: true }).click();
    await expect(editor).toHaveValue(source);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
}

test('reviewed disk writes reject stale sources and undo preserves external changes', async ({ page, workspace }) => {
  const dir = join(workspace.root, 'specs', 'booking');
  await mkdir(dir, { recursive: true });
  const path = join(dir, 'spec.md');
  const source = 'FR-001: The system MUST be fast.\n';
  await writeFile(path, source);
  await page.goto(workspace.url);
  await page.getByRole('button', { name: 'Load local workspace', exact: true }).click();
  await page.getByRole('button').filter({ hasText: 'Unbounded wording:' }).click();
  const replacement = 'FR-001: The system MUST be [NEEDS CLARIFICATION: define fast].';
  await page.getByRole('textbox', { name: 'Proposed wording' }).fill(replacement);
  await page.getByRole('button', { name: 'Review difference', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Write this change to the local workspace' }).check();
  await writeFile(path, source + 'External edit.\n');
  await page.getByRole('button', { name: 'Accept change', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Source changed');
  expect(await readFile(path, 'utf8')).toBe(source + 'External edit.\n');
  await page.getByRole('button', { name: 'Load local workspace', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Source text editor' })).toHaveValue(source + 'External edit.\n');
  await page.getByRole('button').filter({ hasText: 'Unbounded wording:' }).click();
  await page.getByRole('textbox', { name: 'Proposed wording' }).fill(replacement);
  await page.getByRole('button', { name: 'Review difference', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Write this change to the local workspace' }).check();
  await page.getByRole('button', { name: 'Accept change', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Source text editor' })).toHaveValue(replacement + '\nExternal edit.\n');
  await writeFile(path, replacement + '\nLater external edit.\n');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('stale');
  expect(await readFile(path, 'utf8')).toBe(replacement + '\nLater external edit.\n');
});

test('connection failure preserves drafts and empty workspace remains unknown', async ({ page, workspace }) => {
  await page.goto(workspace.url);
  await page.getByRole('button', { name: 'Load local workspace', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Source text editor' })).toHaveValue('');
  await expect(page.getByText('0/10 dimensions assessed', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Paste text', exact: true }).click();
  const source = 'FR-001: The system MUST be fast.';
  await page.getByRole('textbox', { name: 'Specification text', exact: true }).fill(source);
  await page.getByRole('button', { name: 'Analyze text', exact: true }).click();
  await page.route('**/api/workspace', route => route.abort('failed'));
  await page.getByRole('button', { name: 'Load local workspace', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Source text editor' })).toHaveValue(source);
});

test('pending application excludes repeated writes and workspace mutations', async ({ page, workspace }) => {
  await writeFile(join(workspace.root, 'spec.md'), 'FR-001: The system MUST be fast.');
  await page.goto(workspace.url);
  await page.getByRole('button', { name: 'Load local workspace', exact: true }).click();
  await page.getByRole('button').filter({ hasText: 'Unbounded wording:' }).click();
  await page.getByRole('textbox', { name: 'Proposed wording' }).fill('FR-001: The system MUST be [NEEDS CLARIFICATION: define fast].');
  await page.getByRole('button', { name: 'Review difference', exact: true }).click();
  await page.getByRole('checkbox').check();
  let releaseLoad!: () => void;
  const loadHold = new Promise<void>(done => { releaseLoad = done; });
  let loadStarted!: () => void;
  const loadEntered = new Promise<void>(done => { loadStarted = done; });
  await page.route('**/api/workspace', async route => { loadStarted(); await loadHold; await route.continue(); });
  await page.getByRole('button', { name: 'Load local workspace', exact: true }).click();
  await loadEntered;
  let release!: () => void;
  const hold = new Promise<void>(done => { release = done; });
  let calls = 0;
  await page.route('**/api/apply', async route => { calls++; await hold; await route.continue(); });
  try {
    await page.getByRole('button', { name: 'Accept change', exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
    await expect(page.getByRole('button', { name: 'Load local workspace', exact: true })).toBeDisabled();
    await expect(page.getByRole('textbox', { name: 'Source text editor' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Accept change', exact: true })).toBeDisabled();
    expect(calls).toBe(1);
    const loaded = page.waitForResponse('**/api/workspace');
    releaseLoad(); await loaded;
    await expect(page.getByRole('button', { name: 'Accept change', exact: true })).toBeDisabled();
  } finally { releaseLoad(); release(); }
  await expect(page.getByRole('textbox', { name: 'Source text editor' })).toHaveValue('FR-001: The system MUST be [NEEDS CLARIFICATION: define fast].');
  await expect(page.getByRole('button', { name: 'Load local workspace', exact: true })).toBeEnabled();
  let releaseUndo!: () => void;
  const undoHold = new Promise<void>(done => { releaseUndo = done; });
  await page.route('**/api/undo', async route => { await undoHold; await route.fulfill({ status: 400, json: { error: 'Source changed: this edit is stale.' } }); });
  try {
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Source text editor' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Load local workspace', exact: true })).toBeDisabled();
  } finally { releaseUndo(); }
  await expect(page.getByRole('alert')).toContainText('stale');
  await expect(page.getByRole('textbox', { name: 'Source text editor' })).toHaveValue('FR-001: The system MUST be [NEEDS CLARIFICATION: define fast].');
  await expect(page.getByRole('button', { name: 'Load local workspace', exact: true })).toBeEnabled();
});

test('late provider response cannot replace the newly selected document', async ({ page, workspace }) => {
  await page.goto(workspace.url);
  await page.getByRole('button', { name: 'Paste text', exact: true }).click();
  await page.getByRole('textbox', { name: 'Specification text', exact: true }).fill('FR-001: The system MUST be fast.');
  await page.getByRole('button', { name: 'Analyze text', exact: true }).click();
  await page.getByRole('button').filter({ hasText: 'Unbounded wording:' }).click();
  await page.getByText('Model assistance', { exact: true }).click();
  await page.getByRole('combobox', { name: /^Model route/ }).selectOption('ollama');
  await page.getByRole('textbox', { name: 'Model', exact: true }).fill('test');
  let release!: () => void;
  const hold = new Promise<void>(done => { release = done; });
  await page.route('**/api/rewrite', async route => {
    await hold;
    await route.fulfill({ json: { id: 'late', path: 'spec.md', line: 1, original: 'FR-001: The system MUST be fast.', replacement: 'LATE RESPONSE', baseHash: '0'.repeat(64), reason: 'test', source: 'provider' } });
  });
  await page.getByRole('button', { name: 'Request proposal', exact: true }).click();
  await page.getByRole('button', { name: 'Paste text', exact: true }).click();
  const next = 'FR-009: The service MUST be scalable.';
  await page.getByRole('textbox', { name: 'Specification text', exact: true }).fill(next);
  await page.getByRole('button', { name: 'Analyze text', exact: true }).click();
  await page.getByRole('button').filter({ hasText: 'Unbounded wording:' }).click();
  const response = page.waitForResponse('**/api/rewrite');
  release(); await response;
  await expect(page.getByRole('textbox', { name: 'Proposed wording' })).toHaveValue(next);
  await expect(page.getByRole('heading', { name: 'Proposed change', exact: true })).toHaveCount(0);
});

for (const es of [false, true]) {
  test(`${es ? 'ES' : 'EN'} Codex handoff verifies, rejects, saves and exports a scoped change`, async ({ page, workspace }) => {
    const dir = join(workspace.root, 'specs', 'booking');
    const other = join(workspace.root, 'specs', 'other');
    await mkdir(dir, { recursive: true });
    await mkdir(other, { recursive: true });
    const original = es ? 'FR-001: El sistema DEBE ser rápido.' : 'FR-001: The system MUST be fast.';
    const word = es ? 'rápido' : 'fast';
    const replacement = original.replace(word, `[NEEDS CLARIFICATION: ${es ? 'definir rápido' : 'define fast'}]`);
    const file = join(dir, 'spec.md');
    const sibling = join(other, 'spec.md');
    const content = '# Booking\r\n\n' + original + '\n';
    await writeFile(file, content);
    const siblingContent = '# Other\nFR-001: The system MUST list bookings.\n';
    await writeFile(sibling, siblingContent);
    const binding = await bindWorkspace(workspace.root);
    const view = await binding.assess('specs/booking');
    const finding = view.assessment.findings.find(item => item.evidence[0]?.text === original);
    expect(finding).toBeDefined();
    const context = { feature: view.feature, revision: view.assessment.id, findingId: finding!.id };
    const proposal = await binding.propose({ ...context, replacement });
    const review = { ...context, root: view.root, proposal };

    await page.goto(workspace.url + '/?review=1');
    if (es) await page.getByRole('button', { name: 'Español', exact: true }).click();
    const approve = page.getByRole('button', { name: es ? 'Aprobar y escribir en disco' : 'Approve and write to disk' });
    async function verify() {
      await page.getByRole('textbox').fill(JSON.stringify(review));
      await page.getByRole('button', { name: es ? 'Verificar revisión' : 'Verify review' }).click();
      await expect(page.getByText(replacement, { exact: true })).toBeVisible();
    }
    await verify();
    await page.getByRole('button', { name: es ? 'Rechazar cambio' : 'Reject change' }).click();
    await expect(approve).toHaveCount(0);
    expect(await readFile(file)).toEqual(Buffer.from(content));
    await verify();
    const external = content + '\nExternal revision\n';
    await writeFile(file, external);
    await approve.click();
    await expect(page.getByRole('status')).toContainText('stale');
    expect(await readFile(file)).toEqual(Buffer.from(external));
    await writeFile(file, content);
    await verify();
    await approve.click();
    await expect(page.getByRole('status')).toContainText(es ? 'Cambio guardado' : 'Change saved');
    expect(await readFile(file)).toEqual(Buffer.from(content.replace(original, () => replacement)));
    expect(await readFile(sibling)).toEqual(Buffer.from(siblingContent));

    const updated = await binding.assess(view.feature);
    expect(updated.assessment.id).not.toBe(view.assessment.id);
    expect(updated.assessment.decisions.some(item => item.path === 'specs/booking/spec.md' && item.line === 3)).toBe(true);
    await page.goto(workspace.url + '/?export=1');
    if (es) await page.getByRole('button', { name: 'Español', exact: true }).click();
    await page.getByRole('textbox').fill(JSON.stringify({ root: view.root, feature: view.feature,
      revision: updated.assessment.id, createdAt: updated.assessment.createdAt }));
    const reportDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: es ? 'Descargar JSON' : 'Download JSON' }).click();
    expect(JSON.parse(await readFile(await (await reportDownload).path(), 'utf8'))).toEqual(updated.assessment);
    const zipDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: es ? 'Descargar ZIP' : 'Download ZIP' }).click();
    const zip = unzipSync(await readFile(await (await zipDownload).path()));
    expect(Object.keys(zip)).toEqual(['specs/booking/spec.md']);
    expect(Buffer.from(zip['specs/booking/spec.md'])).toEqual(await readFile(file));
  });
}
