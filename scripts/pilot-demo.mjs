import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir, release } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';
import { unzipSync } from 'fflate';

const [packagePath, outputPath, ...extra] = process.argv.slice(2);
assert.ok(packagePath && outputPath && !extra.length, 'Usage: npm run pilot:demo -- <release.tgz> <new-output-directory>');
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
execFileSync('git', ['diff', 'HEAD', '--quiet'], { stdio: 'inherit' });
const tgz = resolve(packagePath);
const output = resolve(outputPath);
await mkdir(output);
process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve('.spec-torque/browsers');
const { chromium, expect } = await import('@playwright/test');
const scratch = await mkdtemp(join(tmpdir(), 'spectorque-pilot-'));
const cli = join(scratch, 'install/node_modules/spectorque/dist/cli.js');
const fixtureFile = 'specs/booking/spec.md';
const feature = 'specs/booking';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const styles = {
  en: {
    line: 'FR-001: The system MUST be [NEEDS CLARIFICATION: define the response-time limit and measurement conditions].',
    external: 'External edit retained during stale-source recovery.',
    captions: ['Load the booking workspace and find the source line.', 'Review the exact change and reject it.',
      'Approve a fresh preview and explicitly write it to disk.', 'Inspect the open decision and export the revision.',
      'A concurrent edit makes the old proposal stale. Reload and review again.'],
  },
  es: {
    line: 'FR-001: El sistema DEBE ser [NEEDS CLARIFICATION: definir el límite de tiempo de respuesta y las condiciones de medición].',
    external: 'Edición externa conservada durante la recuperación.',
    captions: ['Carga el proyecto de reservas y abre la línea de evidencia.', 'Revisa el cambio exacto y recházalo.',
      'Aprueba una propuesta fresca y autoriza la escritura en disco.', 'Inspecciona la decisión pendiente y exporta la revisión.',
      'Un cambio concurrente deja obsoleta la propuesta. Recarga y vuelve a revisar.'],
  },
};

async function withWorkbench(browser, root, recordVideo, fn) {
  const child = spawn(process.execPath, [cli, 'serve', '--root', root, '--port', '0'], { cwd: root });
  const closed = once(child, 'close');
  const reader = createInterface({ input: child.stdout });
  const startup = AbortSignal.timeout(10_000);
  const stopReading = () => reader.close();
  startup.addEventListener('abort', stopReading);
  try {
    let url;
    for await (const line of reader) {
      url = /^SpecTorque workbench: (http:\/\/127\.0\.0\.1:\d+)$/.exec(line)?.[1];
      if (url) break;
    }
    assert.ok(url, 'Installed CLI did not start on loopback');
    const viewport = { width: 1280, height: 900 };
    const context = await browser.newContext({ viewport, recordVideo, serviceWorkers: 'block' });
    const external = [];
    const errors = [];
    try {
      await context.route('**/*', route => {
        if (new URL(route.request().url()).origin === url) return route.continue();
        external.push(route.request().url());
        return route.abort();
      });
      const page = await context.newPage();
      page.setDefaultTimeout(10_000);
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url);
      const result = await fn(page);
      assert.deepEqual(external, []);
      assert.deepEqual(errors, []);
      return { ...result, video: page.video() };
    } finally {
      await context.close();
    }
  } finally {
    startup.removeEventListener('abort', stopReading);
    reader.close();
    child.kill();
    await closed;
  }
}

function workflow(page, lang) {
  const label = (en, es) => lang === 'es' ? es : en;
  const button = (en, es) => page.getByRole('button', { name: label(en, es), exact: true });
  const load = () => button('Load local workspace', 'Cargar proyecto local').click();
  return {
    button,
    load,
    async prepare() {
      await page.getByRole('button').filter({ hasText: 'Unbounded wording:' }).filter({ hasText: fixtureFile + ':5' }).click();
      await page.getByRole('textbox', { name: label('Proposed wording', 'Texto propuesto') }).fill(styles[lang].line);
      await button('Review difference', 'Revisar diferencia').click();
      await expect(page.locator('ins')).toHaveText(styles[lang].line);
    },
    async accept() {
      await page.getByRole('checkbox', { name: label('Write this change to the local workspace', 'Escribir este cambio en el proyecto local') }).check();
      await button('Accept change', 'Aceptar cambio').click();
    },
    async loadScoped() {
      if (lang === 'es') await page.getByRole('button', { name: 'Spanish', exact: true }).click();
      await load();
      await expect(page.getByRole('status')).toContainText(label('Artifacts loaded.', 'Documentos cargados.'));
      const scope = page.getByLabel(label('Artifact set', 'Conjunto de documentos'));
      if (await scope.count()) await scope.selectOption(feature);
    },
    async save(name, en, es) {
      const download = page.waitForEvent('download');
      await button(en, es).click();
      await (await download).saveAs(name);
      return readFile(name);
    },
  };
}

function cliReport(root) {
  const text = execFileSync(process.execPath, [cli, 'analyze', root, '--feature', feature, '--json'], { encoding: 'utf8' });
  return JSON.parse(text);
}

function compareReport(ui, root) {
  const { createdAt: _uiTime, ...uiAssessment } = ui;
  const { createdAt: _cliTime, ...cliAssessment } = cliReport(root);
  assert.deepEqual(uiAssessment, cliAssessment);
}

const cueTime = seconds => new Date(seconds * 1000).toISOString().slice(11, 23);
async function capture(browser, lang, manifest) {
  const fixture = resolve(`fixtures/${lang}-draft`);
  const workspace = join(scratch, lang);
  const root = join(output, lang);
  const source = join(workspace, fixtureFile);
  const original = await readFile(join(fixture, fixtureFile), 'utf8');
  const revised = original.split('\n').map((line, index) => index === 4 ? styles[lang].line : line).join('\n');
  await cp(fixture, workspace, { recursive: true });
  await cp(workspace, join(root, 'before'), { recursive: true });

  const cues = ['WEBVTT'];
  const result = await withWorkbench(browser, workspace, { dir: scratch }, async page => {
    const flow = workflow(page, lang);
    const start = Date.now();
    const caption = async index => {
      const from = (Date.now() - start) / 1000;
      await delay(2300);
      cues.push(`${cueTime(from)} --> ${cueTime(from + 2.3)}\n${styles[lang].captions[index]}`);
    };
    await flow.loadScoped();
    const before = JSON.parse(await flow.save(join(root, 'before.json'), '↓ JSON', '↓ JSON'));
    await flow.save(join(root, 'before.md'), '↓ Report', '↓ Informe');
    compareReport(before, workspace);
    await caption(0);
    await flow.prepare();
    await caption(1);
    await flow.button('Reject', 'Rechazar').click();
    assert.equal(await readFile(source, 'utf8'), original);
    await flow.prepare();
    await caption(2);
    await flow.accept();
    await expect.poll(() => readFile(source, 'utf8')).toBe(revised);
    await flow.button('Decisions', 'Decisiones').click();
    await expect(page.getByRole('button').filter({ hasText: fixtureFile + ':5' })).toBeVisible();
    await caption(3);
    await flow.button('40 practices', '40 prácticas').click();
    const unknown = page.locator('summary').filter({ hasText: 'I2.3' });
    await expect(unknown).toContainText('unknown');
    await unknown.scrollIntoViewIfNeeded();
    await delay(1200);
    const after = JSON.parse(await flow.save(join(root, 'after.json'), '↓ JSON', '↓ JSON'));
    await flow.save(join(root, 'after.md'), '↓ Report', '↓ Informe');
    compareReport(after, workspace);
    assert.notEqual(after.id, before.id);
    assert.equal(after.practices.find(practice => practice.id === 'I2.3')?.status, 'unknown');
    assert.equal(after.decisions.find(decision => decision.path === fixtureFile && decision.line === 5)?.text, styles[lang].line);
    const archive = unzipSync(await flow.save(join(root, 'after.zip'), '↓ Artifacts', '↓ Documentos'));
    assert.deepEqual(Object.keys(archive), [fixtureFile]);
    assert.deepEqual(Buffer.from(archive[fixtureFile]), Buffer.from(revised));
    await cp(workspace, join(root, 'after'), { recursive: true });
    return { before, after };
  });
  await result.video.saveAs(join(root, 'walkthrough.webm'));
  await writeFile(join(root, 'captions.vtt'), cues.join('\n\n') + '\n');

  const recovery = join(scratch, lang + '-recovery');
  await cp(fixture, recovery, { recursive: true });
  const recoverySource = join(recovery, fixtureFile);
  const suffix = '\n' + styles[lang].external + '\n';
  const recoveryCapture = await withWorkbench(browser, recovery, { dir: scratch }, async page => {
    const flow = workflow(page, lang);
    await flow.loadScoped();
    await flow.prepare();
    await writeFile(recoverySource, original + suffix);
    await flow.accept();
    await expect(page.getByRole('alert')).toContainText('stale');
    assert.equal(await readFile(recoverySource, 'utf8'), original + suffix);
    await delay(2300);
    page.once('dialog', dialog => dialog.accept());
    await flow.load();
    await expect(page.getByRole('textbox', { name: lang === 'es' ? 'Editor del texto fuente' : 'Source text editor' })).toHaveValue(original + suffix);
    await flow.prepare();
    await flow.accept();
    await expect.poll(() => readFile(recoverySource, 'utf8')).toBe(revised + suffix);
    await delay(1000);
  });
  await recoveryCapture.video.saveAs(join(root, 'recovery.webm'));
  await writeFile(join(root, 'recovery.vtt'), `WEBVTT\n\n00:00:00.000 --> 00:00:04.000\n${styles[lang].captions[4]}\n`);

  manifest.examples[lang] = {
    fixture: `fixtures/${lang}-draft`,
    path: fixtureFile, line: 5, feature,
    before: { revision: result.before.id, sourceSha256: hash(original) },
    after: { revision: result.after.id, sourceSha256: hash(revised) },
    unknownPractice: 'I2.3',
    schemaVersion: result.after.schemaVersion,
    engineVersion: result.after.engineVersion,
    rubricVersion: result.after.rubricVersion,
    staleRecovery: 'passed on a separate disposable copy',
  };
}

let browser;
try {
  const npmArgs = ['install', '--no-audit', '--ignore-scripts', '--prefix', join(scratch, 'install'), tgz];
  if (process.env.SPECTORQUE_PILOT_OFFLINE === '1') npmArgs.push('--offline');
  execFileSync(process.execPath, [process.env.npm_execpath, ...npmArgs], { stdio: 'inherit' });
  browser = await chromium.launch();
  const manifest = {
    evidence: 'synthetic installed-workbench rehearsal',
    sourceCommit: sha,
    installation: { name: basename(tgz), sha256: hash(await readFile(tgz)) },
    toolchain: { node: process.version, os: process.platform, osRelease: release(), arch: process.arch, chromium: browser.version() },
    license: 'Apache-2.0',
    limits: 'Browser requests restricted to the workbench origin. Native, screen-reader and participant acceptance have separate evidence.',
    examples: {},
  };
  for (const lang of ['en', 'es']) await capture(browser, lang, manifest);
  for (const file of ['pilot.md', 'pilot.es.md', 'pilot-feedback.md', 'pilot-operations.md', 'privacy.md', 'common-workbench-qualification.md', 'compatibility.md']) {
    await cp(join('docs', file), join(output, file));
  }
  await mkdir(join(output, 'integrations/codex'), { recursive: true });
  await cp('integrations/codex/README.md', join(output, 'integrations/codex/README.md'));
  const releaseGuide = await readFile('docs/releases.md', 'utf8');
  await writeFile(join(output, 'releases.md'), releaseGuide.replace('../integrations/codex/README.md', 'integrations/codex/README.md'));
  await cp('LICENSE', join(output, 'LICENSE'));
  await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(output);
} finally {
  await browser?.close();
  await rm(scratch, { recursive: true, force: true });
}
