import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { startServer } from '../../src/node/server.js';

const test = base.extend<{ workspace: { root: string; url: string } }>({
  workspace: async ({}, use) => {
    const root = await mkdtemp(join(tmpdir(), 'spectorque-browser-'));
    const { server, url } = await startServer(root, 0);
    try { await use({ root, url }); }
    finally { await new Promise<void>((done, reject) => server.close(e => e ? reject(e) : done())); await rm(root, { recursive: true, force: true }); }
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
