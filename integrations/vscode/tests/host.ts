import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { connect } from 'node:net';
import { join } from 'node:path';
import { chromium, type Frame } from 'playwright';

export async function run() {
  const extension = vscode.extensions.getExtension('jayanez.spectorque');
  if (process.env.SPECTORQUE_RESTRICTED === '1') {
    assert.equal(vscode.workspace.isTrusted, false);
    assert.ok(!extension?.isActive);
    await assert.rejects(async () => { await vscode.commands.executeCommand('spectorque.review'); });
    assert.equal(vscode.window.tabGroups.all.flatMap(g => g.tabs).some(tab => tab.label.startsWith('SpecTorque')), false);
    await writeFile(join(process.env.SPECTORQUE_EVIDENCE_DIR!, 'evidence.json'), JSON.stringify({ vscode: vscode.version, platform: process.platform, restrictedMode: true, commandBlocked: true, noPanel: true }, null, 2));
    return;
  }
  assert.ok(extension);
  assert.match(extension.extensionPath, /extensions[\\/]jayanez\.spectorque-/);
  await extension.activate();
  assert.equal(vscode.workspace.isTrusted, true);
  let codexVersion: string | undefined;
  if (process.env.SPECTORQUE_WITH_CODEX === '1') {
    const codex = vscode.extensions.getExtension('openai.chatgpt');
    assert.ok(codex);
    await codex.activate();
    await vscode.commands.executeCommand('chatgpt.openSidebar');
    codexVersion = codex.packageJSON.version;
  }
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${process.env.SPECTORQUE_CDP_PORT}`);
  for (const context of browser.contexts()) for (const page of context.pages()) page.setDefaultTimeout(15_000);
  let url = '';
  try {
    await vscode.commands.executeCommand('spectorque.review');
    const deadline = Date.now() + 20_000;
    let frame: Frame | undefined;
    while (!frame && Date.now() < deadline) {
      for (const context of browser.contexts()) for (const page of context.pages()) {
        frame = page.frames().find(f => /^http:\/\/127\.0\.0\.1:\d+\//.test(f.url()));
        if (frame) break;
      }
      if (!frame) await new Promise(done => setTimeout(done, 100));
    }
    await writeFile(join(process.env.SPECTORQUE_EVIDENCE_DIR!, 'frames.json'), JSON.stringify(browser.contexts().flatMap(c => c.pages().flatMap(p => p.frames().map(f => f.url()))), null, 2));
    assert.ok(frame, 'The actual webview must load its loopback workbench (including CSP).');
    url = new URL(frame.url()).origin;
    // The workbench loads the workspace it was started for on connect; no click is needed.
    const finding = frame.getByRole('button').filter({ hasText: 'Unbounded wording: “fast”' });
    await finding.click();
    const editor = frame.getByRole('textbox', { name: 'Source text editor' });
    const original = await editor.inputValue();
    const replacement = 'FR-001: The system MUST be [NEEDS CLARIFICATION: define fast].';
    await frame.getByRole('textbox', { name: 'Proposed replacement' }).fill(replacement);
    await frame.getByRole('button', { name: 'Review difference', exact: true }).click();
    await frame.getByRole('button', { name: 'Reject', exact: true }).click();
    assert.equal(await editor.inputValue(), original);
    await frame.getByRole('button', { name: 'Review difference', exact: true }).click();
    await frame.getByRole('checkbox', { name: 'Write this change to the local workspace' }).check();
    await frame.getByRole('button', { name: 'Accept change', exact: true }).click();
    await frame.getByRole('status').filter({ hasText: 'Change accepted.' }).waitFor({ state: 'attached' });
    const root = vscode.workspace.workspaceFolders![0].uri.fsPath;
    assert.ok((await readFile(join(root, 'specs/booking/spec.md'), 'utf8')).includes(replacement));
    const download = frame.page().waitForEvent('download');
    await frame.getByRole('button', { name: '↓ JSON', exact: true }).click();
    const saved = await download;
    await saved.saveAs(join(process.env.SPECTORQUE_EVIDENCE_DIR!, 'assessment.json'));
    await frame.page().screenshot({ path: join(process.env.SPECTORQUE_EVIDENCE_DIR!, 'webview.png') });
    const countPanels = () => vscode.window.tabGroups.all.flatMap(group => group.tabs).filter(tab => tab.label.startsWith('SpecTorque')).length;
    assert.equal(countPanels(), 1);
    await vscode.commands.executeCommand('spectorque.review');
    assert.equal(countPanels(), 1, 'Repeated commands reuse the existing panel and server.');
    // reveal() crosses the extension-host/UI boundary asynchronously. Close
    // through the actual tab action rather than racing the tab inventory.
    await frame.page().getByRole('tab', { name: /^SpecTorque/ }).getByRole('button', { name: /Close/ }).click();
    const stopDeadline = Date.now() + 5000;
    let stopped = false;
    while (!stopped && Date.now() < stopDeadline) {
      stopped = await new Promise<boolean>(done => {
        const socket = connect(Number(new URL(url).port), '127.0.0.1');
        socket.once('connect', () => { socket.destroy(); done(false); });
        socket.once('error', (error: NodeJS.ErrnoException) => done(error.code === 'ECONNREFUSED'));
        socket.setTimeout(500, () => { socket.destroy(); done(false); });
      });
      if (!stopped) await new Promise(done => setTimeout(done, 50));
    }
    assert.equal(stopped, true, 'Disposing the panel stops the actual loopback server.');
    await writeFile(join(process.env.SPECTORQUE_EVIDENCE_DIR!, 'evidence.json'), JSON.stringify({ vscode: vscode.version, node: process.version, platform: process.platform, installedVsix: extension.extensionPath.includes('extensions'), codexSidebarVersion: codexVersion ?? null, panelRendered: true, rejected: true, applied: true, exported: true, singletonPanel: true, serverStopped: true, limits: 'Installed VSIX in an isolated trusted extension test host. Optional Codex coexistence activates its isolated sidebar without submitting a turn; it establishes no authenticated workflow. Other OS remain unqualified.' }, null, 2));
  } finally { await browser.close(); }
}
