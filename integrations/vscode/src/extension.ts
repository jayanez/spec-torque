import * as vscode from 'vscode';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

let active: { root: string; panel: vscode.WebviewPanel } | undefined;

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.commands.registerCommand('spectorque.review', async () => {
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
    if (active?.root === root) { active.panel.reveal(vscode.ViewColumn.Beside); return; }
    active?.panel.dispose();
    const output = vscode.window.createOutputChannel('SpecTorque');
    const panel = vscode.window.createWebviewPanel('spectorque', 'SpecTorque', vscode.ViewColumn.Beside, { enableScripts: true, retainContextWhenHidden: true });
    active = { root, panel };
    panel.webview.html = '<p role="status">Starting the local specification workbench…</p>';
    const child = spawn(process.execPath, [join(context.extensionPath, 'runtime', 'cli.js'), 'serve', '--root', root, '--port', '0'], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, shell: false, windowsHide: true });
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
