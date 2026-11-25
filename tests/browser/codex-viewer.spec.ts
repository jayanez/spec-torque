import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bindWorkspace } from '../../src/node/scoped-review.js';
import { dimensionsLine, findingCard, summaryLine } from '../../src/core/presentation.js';
import { PRODUCT_VERSION } from '../../src/version.js';

// The Codex viewer inside a minimal MCP Apps host: it answers initialize and assess_worktree.
async function viewerHtml() {
  const script = await build({ entryPoints: ['integrations/codex/viewer.ts'], bundle: true, platform: 'browser', target: 'es2022', format: 'iife', write: false });
  return (await readFile('integrations/codex/viewer.html', 'utf8')).replace('<!-- VIEWER_SCRIPT -->', () => '<script>' + script.outputFiles[0].text + '</script>');
}

for (const locale of ['en-US', 'es-ES']) test(`${locale} Codex viewer shows the shared title, summary, dimensions, finding card and disclaimer`, async ({ page }) => {
  const es = locale.startsWith('es');
  const root = await mkdtemp(join(tmpdir(), 'spectorque-viewer-'));
  try {
    for (const [id, text] of [['specs/001-a', '- FR-001: The system MUST be fast.\n'], ['specs/002-b', '- FR-001: The system MUST be fast.\n- FR-002: The system MUST respond as needed.\n']]) {
      await mkdir(join(root, id), { recursive: true });
      await writeFile(join(root, id, 'spec.md'), '# Spec\n\n' + text);
    }
    const binding = await bindWorkspace(root);
    const expected = (await binding.assess('specs/002-b')).assessment;
    await page.exposeFunction('assessWorktree', async (args: { feature: string | null; changed?: boolean }) =>
      ({ ...await binding.assess(args.feature), changed: Boolean(args.changed) }));
    await page.setContent('<iframe id="viewer" style="width:900px;height:900px"></iframe>');
    await page.evaluate(({ html, locale }) => {
      const frame = document.querySelector('iframe')!;
      addEventListener('message', async event => {
        const message = event.data;
        const reply = (result: unknown) => frame.contentWindow!.postMessage({ jsonrpc: '2.0', id: message.id, result }, '*');
        if (message.method === 'ui/initialize') reply({ protocolVersion: '2026-01-26', hostContext: { locale } });
        if (message.method === 'tools/call' && message.params.name === 'assess_worktree') {
          reply({ _meta: { assessmentView: await (window as unknown as { assessWorktree: (args: unknown) => Promise<unknown> }).assessWorktree(message.params.arguments) } });
        }
      });
      frame.srcdoc = html;
    }, { html: await viewerHtml(), locale });
    const viewer = page.frameLocator('#viewer');
    await expect(viewer.getByRole('heading', { level: 1 })).toHaveText('SpecTorque ' + PRODUCT_VERSION);
    const scope = viewer.getByRole('combobox', { name: es ? 'Selecciona el alcance' : 'Select scope' });
    await expect(scope.locator('option')).toHaveText([es ? 'Todos los documentos' : 'All documents', es ? 'Cambiado en esta rama' : 'Changed on this branch', 'specs/001-a', 'specs/002-b']);
    await scope.selectOption('specs/002-b');
    await expect(scope).toHaveValue('specs/002-b');
    // The Spanish view translates the fixed prefixes of the shared English lines.
    const local = (line: string) => es ? line.replace(/^Finding (\d+) of (\d+)/, 'Hallazgo $1 de $2').replace(/^Evidence: /, 'Evidencia: ').replace(/^Fix: /, 'Corrección: ') : line;
    await expect(es ? viewer.getByText(/ · \d+ hallazgos? · \d+ decisi.+ · motor \d/) : viewer.getByText(summaryLine(expected), { exact: true })).toBeVisible();
    await expect(viewer.getByText(dimensionsLine(expected), { exact: true })).toBeVisible();
    const [heading, location, , evidence, fix] = findingCard(expected, 0).map(local);
    await expect(viewer.getByText(heading, { exact: true })).toBeVisible();
    await expect(viewer.getByText(location, { exact: true })).toBeVisible();
    await expect(viewer.getByText(evidence, { exact: true })).toBeVisible();
    await expect(viewer.getByText(fix, { exact: true })).toBeVisible();
    const previous = viewer.getByRole('button', { name: es ? 'Anterior' : 'Previous', exact: true });
    const next = viewer.getByRole('button', { name: es ? 'Siguiente' : 'Next', exact: true });
    await expect(previous).toBeDisabled();
    for (let i = 1; i < expected.findings.length; i++) {
      await next.click();
      await expect(viewer.getByText(local(findingCard(expected, i)[0]), { exact: true })).toBeVisible();
    }
    await expect(next).toBeDisabled();
    await expect(previous).toBeEnabled();
    await expect(viewer.getByText(es ? 'Evidencia heurística, no un certificado de corrección.' : 'Heuristic evidence, not a correctness certificate.', { exact: true })).toBeVisible();
  } finally { await rm(root, { recursive: true, force: true }); }
});
