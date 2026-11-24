import * as vscode from 'vscode';
import { execFile, spawn } from 'node:child_process';
import { join } from 'node:path';

let active: { root: string; feature: string | null; panel: vscode.WebviewPanel } | undefined;
interface FeatureList { total: number; features: { id: string; layout: boolean }[] }
const LIMIT = 500;

/** Lists the work tree's features through the shared index, without reading document content. */
function listFeatures(cli: string, root: string, changed: boolean): Promise<FeatureList> {
  return new Promise((done, fail) => execFile(process.execPath, [cli, 'features', root, '--json', ...(changed ? ['--changed'] : [])],
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, windowsHide: true, timeout: 60_000, maxBuffer: 64 * 1024 * 1024 },
    (error, stdout, stderr) => error ? fail(new Error(String(stderr).trim() || error.message)) : done(JSON.parse(stdout))));
}

type Pick = vscode.QuickPickItem & { value: string };
/** Asks for a scope: all documents when they fit, one feature, or a feature changed on this branch. */
async function chooseFeature(context: vscode.ExtensionContext, cli: string, root: string): Promise<string | null | undefined> {
  const index = await listFeatures(cli, root, false);
  if (index.features.length < 2 && index.total <= LIMIT) return null;
  const remembered = context.workspaceState.get<string | null>('spectorque.feature:' + root);
  const items: Pick[] = [
    ...(index.total <= LIMIT ? [{ label: 'All documents', value: '' }] : []),
    { label: "Only this branch's changes", description: 'Features changed since the default branch', value: ':changed' },
    { label: 'Features', kind: vscode.QuickPickItemKind.Separator, value: '' },
    ...index.features.map(f => ({ label: f.id, description: f.layout ? undefined : 'Other documents', value: f.id, picked: f.id === remembered })),
  ];
  let picked = await vscode.window.showQuickPick(items, { title: 'SpecTorque · choose a scope', placeHolder: 'Filter ' + index.features.length + ' features', matchOnDescription: true });
  if (picked?.value === ':changed') {
    const changed = await listFeatures(cli, root, true);
    if (!changed.features.length) { void vscode.window.showInformationMessage('No feature changed on this branch.'); return undefined; }
    picked = changed.features.length === 1 ? { label: changed.features[0].id, value: changed.features[0].id }
      : await vscode.window.showQuickPick(changed.features.map(f => ({ label: f.id, value: f.id })), { title: 'SpecTorque · features changed on this branch' });
  }
  if (!picked) return undefined;
  const feature = picked.value || null;
  await context.workspaceState.update('spectorque.feature:' + root, feature);
  return feature;
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.commands.registerCommand('spectorque.review', async (requestedFeature?: unknown) => {
    if (!vscode.workspace.isTrusted) {
      void vscode.window.showWarningMessage('Trust this workspace before starting the SpecTorque workbench.');
      return;
    }
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder || folder.uri.scheme !== 'file') {
      void vscode.window.showInformationMessage('Open a local workspace to review specifications.');
      return;
    }
    const root = folder.uri.fsPath;
    const cli = join(context.extensionPath, 'runtime', 'cli.js');
    let feature: string | null | undefined;
    try {
      feature = typeof requestedFeature === 'string' && requestedFeature ? requestedFeature : await chooseFeature(context, cli, root);
    } catch (error) {
      void vscode.window.showErrorMessage('SpecTorque could not list features: ' + (error as Error).message);
      return;
    }
    if (feature === undefined) return;
    if (active?.root === root && active.feature === feature) { active.panel.reveal(vscode.ViewColumn.Beside); return; }
    active?.panel.dispose();
    const output = vscode.window.createOutputChannel('SpecTorque');
    const panel = vscode.window.createWebviewPanel('spectorque', 'SpecTorque', vscode.ViewColumn.Beside, { enableScripts: true, retainContextWhenHidden: true });
    active = { root, feature, panel };
    panel.webview.html = '<p role="status">Starting the local specification workbench…</p>';
    const child = spawn(process.execPath, [cli, 'serve', '--root', root, '--port', '0', ...(feature ? ['--feature', feature] : [])], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, shell: false, windowsHide: true });
    function stopChild() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.kill();
      // Bound cleanup time if graceful termination is ignored. Escalate
      // only for this owned child, never for an unrelated server.
      const forceStop = setTimeout(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }, 1500);
      forceStop.unref();
      child.once('exit', () => clearTimeout(forceStop));
    }
    let disposed = false;
    let started = false;
    let text = '';
    const fail = () => {
      if (disposed) return;
      panel.webview.html = '<p role="alert">Could not start SpecTorque. Close this panel and reopen it to retry. Check the SpecTorque output for details.</p>';
      output.show();
    };
    const timeout = setTimeout(() => { if (!started) { fail(); stopChild(); } }, 15_000);
    child.stdout.on('data', chunk => {
      if (disposed || started) return;
      text = (text + String(chunk)).slice(-8192);
      const match = text.match(/SpecTorque workbench: (http:\/\/127\.0\.0\.1:\d+)/);
      if (!match) return;
      started = true;
      clearTimeout(timeout);
      void vscode.env.asExternalUri(vscode.Uri.parse(match[1])).then(uri => {
        if (disposed) return;
        const origin = new URL(uri.toString()).origin;
        const src = uri.toString().replaceAll('&', '&amp;').replaceAll('"', '&quot;');
        // Offer the same loopback workbench outside the editor as a clickable link.
        void vscode.window.showInformationMessage('SpecTorque workbench: ' + uri.toString(), 'Open in browser').then(choice => {
          if (choice === 'Open in browser' && !disposed) void vscode.env.openExternal(uri);
        });
        panel.webview.html = '<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; frame-src ' + origin + '; style-src \'unsafe-inline\'"><style>html,body,iframe{width:100%;height:100%;margin:0;border:0}body{overflow:hidden}</style></head><body><iframe title="SpecTorque workbench" src="' + src + '"></iframe></body></html>';
      }, () => { fail(); stopChild(); });
    });
    child.stderr.on('data', chunk => { if (!disposed) output.append(String(chunk)); });
    child.on('error', () => { clearTimeout(timeout); fail(); });
    child.on('exit', code => {
      clearTimeout(timeout);
      if (!disposed) { output.appendLine('Workbench stopped (exit ' + code + ').'); fail(); }
    });
    panel.onDidDispose(() => {
      disposed = true;
      clearTimeout(timeout);
      stopChild();
      output.dispose();
      if (active?.panel === panel) active = undefined;
    });
    context.subscriptions.push(panel);
  }));
}

export function deactivate() { active?.panel.dispose(); active = undefined; }
