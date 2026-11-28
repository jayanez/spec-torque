import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { createInterface } from 'node:readline';
import { unzipSync, strFromU8 } from 'fflate';
import { startServer } from '../../src/node/server.js';
import { bindWorkspace } from '../../src/node/scoped-review.js';
import { badgeSvg, markdownReport } from '../../src/core/report.js';
import { PRODUCT_VERSION } from '../../src/version.js';

const test = base.extend<{ workspace: { root: string; url: string } }>({
  workspace: async ({}, use) => {
    const root = await mkdtemp(join(tmpdir(), 'spectorque-browser-'));
    try {
      const cli = process.env.SPECTORQUE_INSTALLED_CLI;
      if (cli) {
        const child = spawn(process.execPath, [cli, 'serve', '--root', root, '--port', '0'], { cwd: root });
        const closed = once(child, 'close');
        const output = createInterface({ input: child.stdout });
        let stderr = '';
        child.stderr.on('data', chunk => { stderr += String(chunk); });
        try {
          let url: string | undefined;
          for await (const line of output) {
            url = /^SpecTorque workbench: (http:\/\/127\.0\.0\.1:\d+)$/.exec(line)?.[1];
            if (url) break;
          }
          if (!url) throw new Error(`Installed workbench did not start: ${stderr}`);
          await use({ root, url });
        } finally {
          output.close();
          child.kill();
          await closed;
        }
      } else {
        const { server, url } = await startServer(root, 0);
        try { await use({ root, url }); }
        finally {
          await new Promise<void>((done, reject) => {
            server.close(e => e ? reject(e) : done());
            server.closeAllConnections();
          });
        }
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
});

for (const es of [false, true]) {
  test(`${es ? 'ES' : 'EN'} retains guided authoring across views and protects the generated draft`, async ({ page, workspace }) => {
    await page.goto(workspace.url);
    if (es) await page.getByRole('button', { name: 'Switch to Spanish', exact: true }).click();
    const build = page.getByRole('button', { name: es ? 'Crear una spec' : 'Build a spec', exact: true });
    const analyze = page.getByRole('button', { name: es ? 'Analizar' : 'Analyze', exact: true });
    const name = page.getByRole('textbox', { name: es ? 'Nombre del proyecto' : 'Project name' });
    const purpose = page.getByRole('textbox', { name: es ? '¿Qué problema resuelve?' : 'What problem does it solve?' });
    const behavior = page.getByRole('textbox', { name: es ? '¿Qué debe hacer?' : 'What must it do?' });
    const next = page.getByRole('button', { name: es ? 'Siguiente' : 'Continue', exact: true });
    const title = es ? 'Reservas' : 'Bookings';
    const obligation = es ? 'El sistema DEBE registrar la reserva.' : 'The system MUST record the booking.';
    await build.click();
    await name.fill(title);
    await purpose.fill(es ? 'Reservar una sala.' : 'Book a room.');
    await next.click();
    await behavior.fill(obligation);
    await analyze.click();
    await build.click();
    await expect(behavior).toHaveValue(obligation);
    await next.click();
    await next.click();
    await page.getByRole('button', { name: es ? 'Crear y analizar borrador' : 'Create and analyze draft' }).click();
    const editor = page.getByRole('textbox', { name: es ? 'Editor del texto fuente' : 'Source text editor' });
    await expect(editor).toHaveValue(new RegExp(obligation));
    await expect(editor).toHaveValue(/NEEDS CLARIFICATION/);

    const load = page.getByRole('button', { name: es ? 'Recargar proyecto local' : 'Reload local workspace' });
    let confirmed = false;
    page.once('dialog', async dialog => { confirmed = dialog.type() === 'confirm'; await dialog.dismiss(); });
    await load.click();
    await expect.poll(() => confirmed).toBe(true);
    await expect(editor).toHaveValue(new RegExp(obligation));

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: es ? '↓ Documentos' : '↓ Artifacts', exact: true }).click();
    const archive = unzipSync(await readFile(await (await download).path()));
    expect(Object.keys(archive).sort()).toEqual(['plan.md', 'spec.md', 'tasks.md'].map(file => `specs/${title.toLowerCase()}/${file}`));
    for (const bytes of Object.values(archive)) expect(strFromU8(bytes)).toContain('FR-001');
    const target = join(workspace.root, 'specs', title.toLowerCase());
    await mkdir(target, { recursive: true });
    await writeFile(join(target, 'spec.md'), 'Existing file\n');
    await page.getByRole('button', { name: es ? 'Guardar como archivos nuevos' : 'Save as new files' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(editor).toHaveValue(new RegExp(obligation));
    expect(await readFile(join(target, 'spec.md'), 'utf8')).toBe('Existing file\n');

    const other = join(workspace.root, 'specs', 'other');
    await mkdir(other, { recursive: true });
    const otherSource = es ? 'FR-009: El sistema DEBE ser rápido.\n' : 'FR-009: The system MUST be fast.\n';
    await writeFile(join(other, 'spec.md'), otherSource);
    page.once('dialog', dialog => dialog.accept());
    await load.click();
    const scope = page.getByRole('combobox', { name: es ? 'Conjunto de documentos' : 'Artifact set' });
    await expect(scope).toHaveValue('');
    await scope.selectOption('specs/other');
    await expect(editor).toHaveValue(otherSource);
    const finding = page.getByRole('button').filter({ hasText: 'Unbounded wording:' });
    await expect(finding).toContainText('specs/other/spec.md:1');
    const scopedDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: es ? '↓ Documentos' : '↓ Artifacts', exact: true }).click();
    const scopedArchive = unzipSync(await readFile(await (await scopedDownload).path()));
    expect(Object.keys(scopedArchive)).toEqual(['specs/other/spec.md']);
    expect(strFromU8(scopedArchive['specs/other/spec.md'])).toBe(otherSource);
  });

  test(`${es ? 'ES' : 'EN'} E1.2 clarification is read-only and follows the selected source revision`, async ({ page, workspace }) => {
    const source = es
      ? '# Avisos\n\nFR-021: El aviso DEBE desaparecer cuando sea necesario.\nFR-022: El importador DEBE usar el perfil «rápido».\n'
      : '# Notices\n\nFR-021: The notice MUST disappear as needed.\nFR-022: The importer MUST use the preset “fast”.\n';
    const writes: string[] = [];
    page.on('request', request => {
      if (request.method() === 'POST') writes.push(request.url());
    });
    await page.goto(workspace.url);
    if (es) await page.getByRole('button', { name: 'Switch to Spanish', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles({ name: 'spec.md', mimeType: 'text/markdown', buffer: Buffer.from(source) });
    const trigger = page.getByRole('button').filter({ hasText: /Unbounded wording:.*(?:as needed|cuando sea necesario)/ });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const editor = page.getByRole('textbox', { name: es ? 'Editor del texto fuente' : 'Source text editor' });
    const wording = page.getByRole('textbox', { name: es ? 'Texto propuesto' : 'Proposed replacement' });
    const question = page.getByRole('heading', { name: es ? 'Pregunta de aclaración' : 'Clarification question', exact: true });
    await expect(question).toBeVisible();
    await expect(page.getByText(es ? '¿Qué evento o condición debe hacer que desaparezca?'
      : 'What event or condition should make it disappear?', { exact: true })).toBeVisible();
    await expect(editor).toHaveValue(source);
    await expect(wording).toHaveValue(source.split('\n')[2]);

    await page.getByRole('button').filter({ hasText: /Unbounded wording:.*(?:fast|rápido)/ }).click();
    const abstention = page.getByRole('heading', { name: es ? 'Sin pregunta de aclaración' : 'No clarification question', exact: true });
    await expect(abstention).toBeVisible();
    await expect(question).toHaveCount(0);
    await expect(editor).toHaveValue(source);
    await editor.fill(source + '\n' + (es ? 'Comentario.' : 'Comment.'));
    await expect(abstention).toHaveCount(0);
    expect(writes).toEqual([]);
  });

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
    await expect(page.getByRole('button', { name: 'Switch to Spanish', exact: true })).toBeFocused();
    if (es) await page.getByRole('button', { name: 'Switch to Spanish', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles({ name: 'spec.md', mimeType: 'text/markdown', buffer: Buffer.from(source) });
    const finding = page.getByRole('button').filter({ hasText: 'Unbounded wording:' });
    await expect(finding).toHaveCount(1);
    // Enter activates the finding and moves focus to the exact source line.
    await finding.focus();
    await page.keyboard.press('Enter');
    const editor = page.getByRole('textbox', { name: es ? 'Editor del texto fuente' : 'Source text editor' });
    await expect(editor).toBeFocused();
    expect(await editor.evaluate((node: HTMLTextAreaElement) => node.value.slice(node.selectionStart, node.selectionEnd))).toBe(source.trim().split('\n').at(-1));
    const wording = page.getByRole('textbox', { name: es ? 'Texto propuesto' : 'Proposed replacement' });
    await wording.fill(replacement);
    const review = page.getByRole('button', { name: es ? 'Revisar diferencia' : 'Review difference', exact: true });
    const difference = page.getByRole('heading', { name: es ? 'Cambio propuesto' : 'Proposed change' });
    await review.click();
    await expect(difference).toBeFocused();
    await page.getByRole('button', { name: es ? 'Evolución' : 'History', exact: true }).click();
    await page.getByRole('button', { name: es ? 'Analizar' : 'Analyze', exact: true }).click();
    await expect(wording).toHaveValue(replacement);
    await expect(difference).toBeFocused();
    await page.getByRole('button', { name: es ? 'Rechazar' : 'Reject', exact: true }).click();
    await expect(review).toBeFocused();
    await expect(editor).toHaveValue(source);
    await review.click();
    await page.getByRole('button', { name: es ? 'Aceptar cambio' : 'Accept change', exact: true }).click();
    await expect(editor).toHaveValue(source.replace(source.trim().split('\n').at(-1)!, replacement));
    await expect(page.getByRole('heading', { name: es ? 'Texto fuente' : 'Source text', exact: true })).toBeFocused();
    await expect(finding).toHaveCount(0);
    await page.getByRole('button', { name: es ? 'Decisiones' : 'Decisions', exact: true }).click();
    await expect(page.getByRole('button').filter({ hasText: 'spec.md:3' })).toHaveCount(1);
    const reportDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: '↓ JSON', exact: true }).click();
    const report = JSON.parse(await readFile(await (await reportDownload).path(), 'utf8'));
    expect(report.practices).toHaveLength(40);
    expect(report.summary.score).toBeNull();
    expect(report.decisions[0]).toMatchObject({ path: 'spec.md', line: 3 });
    for (const [name, contents] of [[es ? '↓ Informe' : '↓ Report', markdownReport(report)], [es ? '↓ Insignia' : '↓ Badge', badgeSvg(report)]]) {
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name, exact: true }).click();
      expect(await readFile(await (await download).path(), 'utf8')).toBe(contents);
    }
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
  // The workbench loads the served work tree on connect.
  await expect(page.getByRole('textbox', { name: 'Source text editor' })).toHaveValue(source);
  await page.getByRole('button').filter({ hasText: 'Unbounded wording:' }).click();
  const replacement = 'FR-001: The system MUST be [NEEDS CLARIFICATION: define fast].';
  await page.getByRole('textbox', { name: 'Proposed replacement' }).fill(replacement);
  await page.getByRole('button', { name: 'Review difference', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Write this change to the local workspace' }).check();
  await writeFile(path, source + 'External edit.\n');
  await page.getByRole('button', { name: 'Accept change', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Source changed');
  expect(await readFile(path, 'utf8')).toBe(source + 'External edit.\n');
  await expect(page.getByRole('textbox', { name: 'Proposed replacement' })).toHaveValue(replacement);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Reload local workspace', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Source text editor' })).toHaveValue(source + 'External edit.\n');
  await page.getByRole('button').filter({ hasText: 'Unbounded wording:' }).click();
  await page.getByRole('textbox', { name: 'Proposed replacement' }).fill(replacement);
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
  const reads: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/workspace')) reads.push(request.url()); });
  const indexed = page.waitForResponse('**/api/features');
  await page.goto(workspace.url);
  await indexed;
  // An empty work tree keeps the sample on connect; a sample cannot be saved as new files.
  await expect(page.getByText('Local workspace connected')).toBeAttached();
  await expect(page.getByTitle('specs/booking/spec.md')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Save as new files' })).toHaveCount(0);
  expect(reads).toEqual([]);
  await page.getByRole('button', { name: 'Reload local workspace', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Source text editor' })).toHaveValue('');
  await expect(page.getByText('0/10 dimensions assessed', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Paste text', exact: true }).click();
  const source = 'FR-001: The system MUST be fast.';
  await page.getByRole('textbox', { name: 'Specification text', exact: true }).fill(source);
  await page.getByRole('button', { name: 'Analyze text', exact: true }).click();
  await page.route('**/api/workspace', route => route.abort('failed'));
  await page.getByRole('button', { name: 'Reload local workspace', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Source text editor' })).toHaveValue(source);
});

test('pending application excludes repeated writes and workspace mutations', async ({ page, workspace }) => {
  await writeFile(join(workspace.root, 'spec.md'), 'FR-001: The system MUST be fast.');
  await page.goto(workspace.url);
  await expect(page.getByRole('textbox', { name: 'Source text editor' })).toHaveValue('FR-001: The system MUST be fast.');
  await page.getByRole('button').filter({ hasText: 'Unbounded wording:' }).click();
  await page.getByRole('textbox', { name: 'Proposed replacement' }).fill('FR-001: The system MUST be [NEEDS CLARIFICATION: define fast].');
  await page.getByRole('button', { name: 'Review difference', exact: true }).click();
  await page.getByRole('checkbox').check();
  let releaseLoad!: () => void;
  const loadHold = new Promise<void>(done => { releaseLoad = done; });
  let loadStarted!: () => void;
  const loadEntered = new Promise<void>(done => { loadStarted = done; });
  await page.route('**/api/workspace', async route => { loadStarted(); await loadHold; await route.continue(); });
  await page.getByRole('button', { name: 'Reload local workspace', exact: true }).click();
  await loadEntered;
  let release!: () => void;
  const hold = new Promise<void>(done => { release = done; });
  let calls = 0;
  await page.route('**/api/apply', async route => { calls++; await hold; await route.continue(); });
  try {
    await page.getByRole('button', { name: 'Accept change', exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
    await expect(page.getByRole('button', { name: 'Reload local workspace', exact: true })).toBeDisabled();
    await expect(page.getByRole('textbox', { name: 'Source text editor' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Accept change', exact: true })).toBeDisabled();
    expect(calls).toBe(1);
    const loaded = page.waitForResponse('**/api/workspace');
    releaseLoad(); await loaded;
    await expect(page.getByRole('button', { name: 'Accept change', exact: true })).toBeDisabled();
  } finally { releaseLoad(); release(); }
  await expect(page.getByRole('textbox', { name: 'Source text editor' })).toHaveValue('FR-001: The system MUST be [NEEDS CLARIFICATION: define fast].');
  await expect(page.getByRole('button', { name: 'Reload local workspace', exact: true })).toBeEnabled();
  let releaseUndo!: () => void;
  const undoHold = new Promise<void>(done => { releaseUndo = done; });
  await page.route('**/api/undo', async route => { await undoHold; await route.fulfill({ status: 400, json: { error: 'Source changed: this edit is stale.' } }); });
  try {
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Source text editor' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Reload local workspace', exact: true })).toBeDisabled();
  } finally { releaseUndo(); }
  await expect(page.getByRole('alert')).toContainText('stale');
  await expect(page.getByRole('textbox', { name: 'Source text editor' })).toHaveValue('FR-001: The system MUST be [NEEDS CLARIFICATION: define fast].');
  await expect(page.getByRole('button', { name: 'Reload local workspace', exact: true })).toBeEnabled();
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
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Analyze text', exact: true }).click();
  await page.getByRole('button').filter({ hasText: 'Unbounded wording:' }).click();
  const response = page.waitForResponse('**/api/rewrite');
  release(); await response;
  await expect(page.getByRole('textbox', { name: 'Proposed replacement' })).toHaveValue(next);
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
    if (es) await page.getByRole('button', { name: 'Switch to Spanish', exact: true }).click();
    const approve = page.getByRole('button', { name: es ? 'Aprobar y escribir en disco' : 'Approve and write to disk' });
    async function verify() {
      await page.getByRole('textbox').fill(JSON.stringify(review));
      await page.getByRole('button', { name: es ? 'Verificar revisión' : 'Verify review' }).click();
      await expect(page.getByText(replacement, { exact: true })).toBeVisible();
    }
    await verify();
    await page.getByRole('button', { name: es ? 'Rechazar cambio' : 'Reject change' }).click();
    await expect(approve).toHaveCount(0);
    await expect(page.getByRole('status')).toHaveText(es ? 'Cambio rechazado. No se escribió ningún archivo.' : 'Change rejected. No file was written.');
    await expect(page.getByRole('textbox')).toBeFocused();
    expect(await readFile(file)).toEqual(Buffer.from(content));
    await verify();
    await page.route('**/api/scoped-apply', route => route.abort('connectionrefused'));
    await approve.click();
    await expect(page.getByRole('status')).toContainText(es ? 'No se puede conectar con el workbench local. Reinícialo' : 'The local workbench is not reachable. Restart it');
    await expect(page.getByRole('status')).toContainText('?review=1');
    await page.unroute('**/api/scoped-apply');
    expect(await readFile(file)).toEqual(Buffer.from(content));
    await page.route('**/api/**', route => route.abort('connectionrefused'));
    await page.getByRole('textbox').fill(JSON.stringify(review));
    await page.getByRole('button', { name: es ? 'Verificar revisión' : 'Verify review' }).click();
    await expect(page.getByRole('status')).toContainText(es ? 'No se puede conectar con el workbench local' : 'The local workbench is not reachable');
    await page.unroute('**/api/**');
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

    const updated = await binding.assess(view.feature!);
    expect(updated.assessment.id).not.toBe(view.assessment.id);
    expect(updated.assessment.decisions.some(item => item.path === 'specs/booking/spec.md' && item.line === 3)).toBe(true);
    await page.goto(workspace.url + '/?export=1');
    if (es) await page.getByRole('button', { name: 'Switch to Spanish', exact: true }).click();
    const selection = JSON.stringify({ root: view.root, feature: view.feature,
      revision: updated.assessment.id, createdAt: updated.assessment.createdAt });
    for (const pattern of ['**/api/scoped-export', '**/api/**']) {
      await page.getByRole('textbox').fill(selection + ' ');
      await page.getByRole('textbox').fill(selection);
      await expect(page.getByRole('status')).toHaveText('');
      await page.route(pattern, route => route.abort('connectionrefused'));
      await page.getByRole('button', { name: es ? 'Descargar JSON' : 'Download JSON' }).click();
      await expect(page.getByRole('status')).toContainText(es ? 'No se puede conectar con el workbench local' : 'The local workbench is not reachable');
      await expect(page.getByRole('status')).toContainText('?export=1');
      await page.unroute(pattern);
    }
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

test('large local workspaces read nothing on connect and load one feature at a time', async ({ page, workspace }) => {
  for (let i = 1; i <= 102; i++) {
    const folder = join(workspace.root, 'specs', `${String(i).padStart(3, '0')}-feature`);
    await mkdir(folder, { recursive: true });
    for (const name of ['spec.md', 'plan.md', 'tasks.md', 'research-plan.md', 'design.md']) await writeFile(join(folder, name), `# ${name}\n\n- FR-001: The system MUST confirm a booking within 2 seconds.\n`);
  }
  const reads: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/workspace')) reads.push(request.url()); });
  const indexed = page.waitForResponse('**/api/features');
  await page.goto(workspace.url);
  await indexed;
  const picker = page.getByRole('combobox', { name: 'Local workspace feature' });
  await expect(picker).toBeVisible();
  await expect(page.getByText('This work tree has 510 documents, more than 500 read at once. Choose a feature.')).toBeVisible();
  await expect(picker.locator('option', { hasText: 'All documents' })).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(reads).toEqual([]);
  // The picker is a filterable combobox: typing narrows 102 features to one.
  await picker.fill('042');
  await page.getByRole('option', { name: 'specs/042-feature', exact: true }).click();
  await expect(picker).toHaveValue('specs/042-feature');
  await expect(page.getByTitle('specs/042-feature/spec.md')).toBeVisible();
  await expect(page.getByTitle('specs/042-feature/spec.md')).toHaveAttribute('aria-pressed', 'true');
});

async function served(root: string, feature: string | null, run: (url: string) => Promise<void>) {
  const { server, url } = await startServer(root, 0, feature);
  try { await run(url); }
  finally { await new Promise<void>((done, reject) => { server.close(e => e ? reject(e) : done()); server.closeAllConnections(); }); }
}
async function writeFeature(root: string, id: string, text: string) {
  await mkdir(join(root, id), { recursive: true });
  await writeFile(join(root, id, 'spec.md'), text);
}

test('serve --feature opens that feature on connect without a separate artifact set', async ({ page, workspace }) => {
  await writeFile(join(workspace.root, 'AGENTS.md'), '# Agents\n\nFollow the specs.\n');
  await writeFeature(workspace.root, 'specs/001-first', 'FR-001: The first system MUST be fast.\n');
  await writeFeature(workspace.root, 'specs/066-shadow', 'FR-066: The shadow system MUST be fast.\n');
  await served(workspace.root, 'specs/066-shadow', async url => {
    await page.goto(url);
    const editor = page.getByRole('textbox', { name: 'Source text editor' });
    await expect(editor).toHaveValue('FR-066: The shadow system MUST be fast.\n');
    await expect(page.getByTitle('specs/066-shadow/spec.md')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('combobox', { name: 'Local workspace feature' })).toHaveValue('specs/066-shadow');
    await expect(page.getByRole('combobox', { name: 'Artifact set' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save as new files' })).toHaveCount(0);
    await expect(page.getByText(/^Engine \d+\.\d+\.\d+ · Rubric /)).toBeAttached();
  });
});

test('the artifact set selector appears only when the loaded set has several features', async ({ page, workspace }) => {
  await writeFile(join(workspace.root, 'AGENTS.md'), '# Agents\n\nFollow the specs.\n');
  await writeFeature(workspace.root, 'specs/001-first', 'FR-001: The first system MUST be fast.\n');
  await page.goto(workspace.url);
  const editor = page.getByRole('textbox', { name: 'Source text editor' });
  await expect(editor).toHaveValue('FR-001: The first system MUST be fast.\n');
  await expect(page.getByRole('combobox', { name: 'Artifact set' })).toHaveCount(0);
  await writeFeature(workspace.root, 'specs/002-second', 'FR-002: The second system MUST be fast.\n');
  // H92 (#92): a Spec Kit template is never listed; the set opens on the first feature's spec.
  await mkdir(join(workspace.root, '.specify', 'templates'), { recursive: true });
  await writeFile(join(workspace.root, '.specify', 'templates', 'spec-template.md'), '# Feature Specification: [FEATURE NAME]\n');
  await page.getByRole('button', { name: 'Reload local workspace', exact: true }).click();
  const scope = page.getByRole('combobox', { name: 'Artifact set' });
  await expect(scope).toBeVisible();
  await expect(scope.locator('option')).toHaveText(['All documents', 'specs/001-first', 'specs/002-second']);
  await expect(page.getByTitle('specs/001-first/spec.md')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('combobox', { name: 'Local workspace feature' })).toHaveCount(0);
  await scope.selectOption('specs/002-second');
  await expect(editor).toHaveValue('FR-002: The second system MUST be fast.\n');
});

test('a draft written before the workbench connects is not replaced', async ({ page, workspace }) => {
  await writeFeature(workspace.root, 'specs/001-first', 'FR-001: The first system MUST be fast.\n');
  let release!: () => void;
  const held = new Promise<void>(done => { release = done; });
  await page.route('**/api/session', async route => { await held; await route.continue(); });
  const reads: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/workspace')) reads.push(request.url()); });
  await page.goto(workspace.url);
  const editor = page.getByRole('textbox', { name: 'Source text editor' });
  await editor.fill('FR-900: My draft MUST stay.');
  const indexed = page.waitForResponse('**/api/features');
  release();
  await indexed;
  await expect(page.getByText('Local workspace connected')).toBeAttached();
  await expect(editor).toHaveValue('FR-900: My draft MUST stay.');
  expect(reads).toEqual([]);
});

test('pasted text written before the workbench connects is not replaced', async ({ page, workspace }) => {
  await writeFeature(workspace.root, 'specs/001-first', 'FR-001: The first system MUST be fast.\n');
  let release!: () => void;
  const held = new Promise<void>(done => { release = done; });
  await page.route('**/api/session', async route => { await held; await route.continue(); });
  const reads: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/workspace')) reads.push(request.url()); });
  await page.goto(workspace.url);
  await page.getByRole('button', { name: 'Paste text', exact: true }).click();
  const draft = page.getByRole('textbox', { name: 'Specification text', exact: true });
  await draft.fill('FR-901: My pasted draft MUST stay.');
  const indexed = page.waitForResponse('**/api/features');
  release();
  await indexed;
  await expect(page.getByText('Local workspace connected')).toBeAttached();
  await expect(draft).toHaveValue('FR-901: My pasted draft MUST stay.');
  await expect(page.getByTitle('specs/booking/spec.md')).toBeAttached();
  expect(reads).toEqual([]);
});

test('side panels collapse, resize from the keyboard and remember their state', async ({ page, workspace }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await writeFeature(workspace.root, 'specs/001-first', 'FR-001: The first system MUST be fast.\n');
  await page.goto(workspace.url);
  const editor = page.getByRole('textbox', { name: 'Source text editor' });
  await expect(editor).toHaveValue('FR-001: The first system MUST be fast.\n');
  const collapse = page.getByRole('button', { name: 'Collapse Artifacts', exact: true });
  await expect(collapse).toHaveAttribute('aria-expanded', 'true');
  await collapse.click();
  const expand = page.getByRole('button', { name: 'Expand Artifacts', exact: true });
  await expect(expand).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('button', { name: 'Import files', exact: true })).toBeHidden();
  const left = await page.locator('.source-panel').boundingBox();
  expect(left!.width).toBeLessThan(80);
  const resizer = page.getByRole('separator', { name: 'Resize Source text' });
  const before = Number(await resizer.getAttribute('aria-valuenow'));
  await resizer.focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(resizer).toHaveAttribute('aria-valuenow', String(before + 32));
  await page.keyboard.press('End');
  // The widest Source text panel is a share of the window (28vw), so the analysis column keeps its room.
  const widest = String(Math.floor(1400 * 0.28));
  await expect(resizer).toHaveAttribute('aria-valuemax', widest);
  await expect(resizer).toHaveAttribute('aria-valuenow', widest);
  expect(Math.round((await page.locator('.detail-panel').boundingBox())!.width)).toBe(Number(widest));
  await page.reload();
  await expect(page.getByRole('button', { name: 'Expand Artifacts', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('separator', { name: 'Resize Source text' })).toHaveAttribute('aria-valuenow', widest);
  // Dragging the separator toward the analysis column widens Artifacts.
  await page.getByRole('button', { name: 'Expand Artifacts', exact: true }).click();
  const leftResizer = page.getByRole('separator', { name: 'Resize Artifacts' });
  const box = (await leftResizer.boundingBox())!;
  const start = Math.round((await page.locator('.source-panel').boundingBox())!.width);
  await expect(leftResizer).toHaveAttribute('aria-valuenow', String(start));
  await page.mouse.move(box.x + box.width / 2, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + 200, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => Number(await leftResizer.getAttribute('aria-valuenow'))).toBeGreaterThan(start + 40);
  // A narrower window never scrolls sideways, whatever width was saved.
  await page.setViewportSize({ width: 1280, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Collapse Artifacts', exact: true }).click();
  await page.getByRole('button', { name: 'Expand Artifacts', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Import files', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Collapse Source text', exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Source text', exact: true })).toBeVisible();
});

test('the column titles share one style and baseline, and the header names the workspace', async ({ page, workspace }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await writeFeature(workspace.root, 'specs/001-first', 'FR-001: The first system MUST be fast.\n');
  await page.goto(workspace.url);
  await expect(page.getByRole('textbox', { name: 'Source text editor' })).toHaveValue('FR-001: The first system MUST be fast.\n');
  const titles = [page.getByRole('heading', { name: 'Artifacts', exact: true }), page.getByRole('heading', { name: 'Find where your agent would have to guess', exact: true }), page.getByRole('heading', { name: 'Source text', exact: true })];
  const boxes = await Promise.all(titles.map(title => title.evaluate(node => { const box = node.getBoundingClientRect(); const style = getComputedStyle(node); return { bottom: Math.round(box.bottom), size: style.fontSize, weight: style.fontWeight }; })));
  for (const box of boxes) expect({ size: box.size, weight: box.weight }).toEqual({ size: boxes[0].size, weight: boxes[0].weight });
  for (const box of boxes) expect(Math.abs(box.bottom - boxes[0].bottom)).toBeLessThanOrEqual(2);
  await expect(page.locator('.workspace-name strong')).toHaveText(basename(workspace.root));
});

test('the language toggle names the other language in the current one', async ({ page, workspace }) => {
  await page.goto(workspace.url);
  const toSpanish = page.getByRole('button', { name: 'Switch to Spanish', exact: true });
  await expect(toSpanish).toHaveText('Spanish');
  await expect(toSpanish).toHaveAttribute('lang', 'en');
  await toSpanish.click();
  const toEnglish = page.getByRole('button', { name: 'Cambiar a inglés', exact: true });
  await expect(toEnglish).toHaveText('Inglés');
  await expect(toEnglish).toHaveAttribute('lang', 'es');
  for (const query of ['?review=1', '?export=1']) {
    await page.goto(workspace.url + '/' + query);
    await expect(page.getByRole('button', { name: /^(Switch to Spanish|Cambiar a inglés)$/ })).toHaveText(/^(Spanish|Inglés)$/);
  }
});

test('the local feature picker filters by keyboard and loads the chosen feature', async ({ page, workspace }) => {
  for (let i = 1; i <= 90; i++) await writeFeature(workspace.root, `specs/${String(i).padStart(3, '0')}-item`, `FR-${i}: Item ${i} MUST be fast.\n`);
  for (let i = 1; i <= 90; i++) for (const name of ['plan.md', 'tasks.md', 'design.md', 'research-plan.md', 'data-model.md']) await writeFile(join(workspace.root, `specs/${String(i).padStart(3, '0')}-item`, name), '# Notes\n');
  await page.goto(workspace.url);
  const picker = page.getByRole('combobox', { name: 'Local workspace feature' });
  await picker.focus();
  await expect(picker).toHaveAttribute('aria-expanded', 'true');
  const list = page.getByRole('listbox', { name: 'Local workspace feature' }).getByRole('option');
  await expect(list).toHaveCount(90);
  // A press on the list's own padding (or its scrollbar) keeps the input focused and the list open.
  const box = (await page.getByRole('listbox', { name: 'Local workspace feature' }).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 2);
  await page.mouse.down(); await page.mouse.up();
  await expect(picker).toBeFocused();
  await expect(picker).toHaveAttribute('aria-expanded', 'true');
  await picker.pressSequentially('066');
  await expect(list).toHaveText(['specs/066-item']);
  await page.keyboard.press('Enter');
  await expect(picker).toHaveValue('specs/066-item');
  await expect(picker).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTitle('specs/066-item/spec.md')).toHaveAttribute('aria-pressed', 'true');
  await picker.focus();
  await page.keyboard.press('Escape');
  await expect(picker).toHaveValue('specs/066-item');
});

test('a Spec Kit feature opens on spec.md, not its requirements checklist, and the sample stays out of history', async ({ page, workspace }) => {
  await writeFeature(workspace.root, 'specs/066-shadow', 'FR-066: The shadow system MUST be fast.\n');
  await mkdir(join(workspace.root, 'specs/066-shadow/checklists'), { recursive: true });
  await writeFile(join(workspace.root, 'specs/066-shadow/checklists/requirements.md'), '# Requirements checklist\n\n- [ ] CHK001 Requirements are testable.\n');
  await served(workspace.root, 'specs/066-shadow', async url => {
    await page.goto(url);
    await expect(page.getByTitle('specs/066-shadow/spec.md')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('textbox', { name: 'Source text editor' })).toHaveValue('FR-066: The shadow system MUST be fast.\n');
    await page.getByRole('button', { name: 'History', exact: true }).click();
    await expect(page.locator('.history-row')).toHaveCount(1);
    await expect(page.locator('.history-row')).not.toContainText('Booking');
  });
});

test('Connect agents shows the released install commands for each host in both languages', async ({ page, workspace }) => {
  await page.goto(workspace.url);
  await page.getByRole('button', { name: 'Connect agents', exact: true }).click();
  const view = page.locator('main', { has: page.getByRole('heading', { level: 1, name: /^(One engine, in your environment|El mismo motor, en tu entorno)$/ }) });
  const card = (host: string) => view.getByRole('article', { name: host, exact: true });
  await expect(card('Claude Code')).toContainText('claude plugin marketplace add jayanez/spec-torque\nclaude plugin install spectorque@spectorque');
  await expect(card('Codex')).toContainText('codex plugin marketplace add jayanez/spec-torque\ncodex plugin add spectorque@spectorque');
  await expect(card('Codex')).toContainText('Run $spec-setup, then $spec-view in a new local chat');
  await expect(card('OpenCode')).toContainText('{"plugins":["opencode-spectorque@' + PRODUCT_VERSION + '"]}');
  await expect(card('OpenCode')).toContainText('~/.config/opencode/cli.json');
  await expect(card('Pi / ThinkRail')).toContainText('pi install npm:pi-spectorque@' + PRODUCT_VERSION);
  await expect(card('VS Code')).toContainText('code --install-extension jayanez.spectorque --pre-release');
  await expect(page.getByText('"spectorque@' + PRODUCT_VERSION + '"')).toBeAttached();
  await expect(page.getByText('/absolute/path/to/spectorque/dist/mcp.js', { exact: false })).toBeAttached();
  await expect(view).not.toContainText(/integrations\/(claude|vscode|opencode|pi)/);
  expect((await new AxeBuilder({ page }).include('main:not([hidden]) .integration-grid').analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Switch to Spanish', exact: true }).click();
  await expect(view.getByRole('heading', { level: 1 })).toHaveText('El mismo motor, en tu entorno');
  await expect(card('Codex')).toContainText('Ejecuta $spec-setup y luego $spec-view en un chat local nuevo');
  await expect(card('VS Code')).toContainText('Extensión + banco de trabajo');
  await expect(page.getByText('Desde npm, en cualquier cliente MCP:', { exact: true })).toBeVisible();
  for (const text of ['From npm, in any MCP client:', 'Run /spectorque', 'Commands + widgets']) await expect(page.getByText(text, { exact: true })).toHaveCount(0);
});

test('the Spanish view translates the header, dimensions, practices, roles and counts', async ({ page, workspace }) => {
  await writeFile(join(workspace.root, 'AGENTS.md'), '# Agents\n\nFollow the specs.\n');
  await writeFeature(workspace.root, 'specs/001-first', 'FR-001: The first system MUST be fast.\n');
  await page.goto(workspace.url);
  await expect(page.getByRole('textbox', { name: 'Source text editor' })).toHaveValue('FR-001: The first system MUST be fast.\n');
  await page.getByRole('button', { name: 'Switch to Spanish', exact: true }).click();
  await expect(page).toHaveTitle('SpecTorque — Banco de trabajo de especificaciones');
  for (const text of ['Banco de trabajo de especificaciones', 'Proyecto local conectado', 'Sin ambigüedad', 'Planificación de la implementación', 'especificación · spec-kit', 'instrucciones · generic']) {
    await expect(page.getByText(text, { exact: true }).first()).toBeAttached();
  }
  await expect(page.locator('.detail-panel .panel-header .pill')).toHaveText('Proyecto');
  for (const text of ['Unambiguity', 'Specification workbench', 'Local workspace connected']) await expect(page.getByText(text, { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '40 prácticas', exact: true }).click();
  await expect(page.getByText('Requisitos cuantificados y medibles').first()).toBeVisible();
  await expect(page.getByText(/^(supported|partial|missing)$/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Evolución', exact: true }).click();
  await expect(page.locator('.history-row').first()).toContainText(/\d+ hallazgos?/);
  await expect(page.locator('.history-row').first()).not.toContainText('1 hallazgos');
  await page.getByRole('button', { name: 'Conectar agentes', exact: true }).click();
  await expect(page.getByText('Plugin + visor integrado', { exact: true })).toBeVisible();
});

test('the language toggle keeps light-on-dark text on hover', async ({ page, workspace }) => {
  await page.goto(workspace.url);
  const toggle = page.getByRole('button', { name: 'Switch to Spanish', exact: true });
  await toggle.hover();
  const { color, background } = await toggle.evaluate(node => { const style = getComputedStyle(node); return { color: style.color, background: style.backgroundColor }; });
  expect(color).toBe('rgb(255, 255, 255)');
  expect(background).not.toMatch(/^rgb\(2[0-9]{2}, 2[0-9]{2}, 2[0-9]{2}\)$/);
});

test('both panels at their widest never scroll sideways, and picking a finding opens Source text', async ({ page, workspace }) => {
  await writeFeature(workspace.root, 'specs/001-first', 'FR-001: The first system MUST be fast.\n');
  for (const width of [1280, 1600, 1700]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(workspace.url);
    await expect(page.getByRole('textbox', { name: 'Source text editor' })).toHaveValue('FR-001: The first system MUST be fast.\n');
    for (const name of ['Resize Artifacts', 'Resize Source text']) {
      await page.getByRole('separator', { name }).focus();
      await page.keyboard.press('End');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `no sideways scroll at ${width}px`).toBe(true);
  }
  await page.getByRole('button', { name: 'Collapse Source text', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Source text editor' })).toBeHidden();
  await page.getByRole('button').filter({ hasText: 'Unbounded wording:' }).first().click();
  await expect(page.getByRole('button', { name: 'Collapse Source text', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('textbox', { name: 'Proposed replacement' })).toBeVisible();
});

test('the Source text heading shows a focus outline after an accepted change', async ({ page, workspace }) => {
  await writeFeature(workspace.root, 'specs/001-first', 'FR-001: The first system MUST be fast.\n');
  await page.goto(workspace.url);
  await page.getByRole('button').filter({ hasText: 'Unbounded wording:' }).first().click();
  await page.getByRole('textbox', { name: 'Proposed replacement' }).fill('FR-001: The first system MUST be [NEEDS CLARIFICATION: define fast].');
  await page.getByRole('button', { name: 'Review difference', exact: true }).click();
  await page.getByRole('button', { name: 'Accept change', exact: true }).click();
  const heading = page.getByRole('heading', { name: 'Source text', exact: true });
  await expect(heading).toBeFocused();
  expect(await heading.evaluate(node => getComputedStyle(node).outlineStyle)).toBe('solid');
});

test('a sample is named in the view language, and its first edit compares with the unedited sample', async ({ page, workspace }) => {
  await page.goto(workspace.url);
  await expect(page.locator('.workspace-name strong')).toHaveText('Booking · artifact set');
  await page.getByRole('button', { name: 'Switch to Spanish', exact: true }).click();
  await expect(page.locator('.workspace-name strong')).toHaveText('Reservas · conjunto de documentos');
  await page.getByRole('button', { name: 'Cambiar a inglés', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Source text editor' });
  await editor.fill((await editor.inputValue()) + '\nFR-099: The system MUST be fast.\n');
  await expect(page.getByText(/^Previous assessment:/)).toBeVisible();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  // Only the edit is listed: the unedited sample is a baseline, not the user's work.
  await expect(page.locator('.history-row')).toHaveCount(1);
});
