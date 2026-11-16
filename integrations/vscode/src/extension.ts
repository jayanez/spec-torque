import * as vscode from 'vscode';
import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
let child: ChildProcess | undefined;
export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.commands.registerCommand('spectorque.review', async () => {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) { void vscode.window.showInformationMessage('Open a local workspace to review specifications.'); return; }
    child?.kill();
    const output = vscode.window.createOutputChannel('SpecTorque');
    const panel = vscode.window.createWebviewPanel('spectorque', 'SpecTorque', vscode.ViewColumn.Beside, { enableScripts: true, retainContextWhenHidden: true });
    panel.webview.html = '<p>Starting the local specification workbench…</p>';
    const processForPanel = spawn(process.execPath, [join(context.extensionPath, 'runtime', 'cli.js'), 'serve', '--root', root, '--port', '0'], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, shell: false, windowsHide: true });
    child = processForPanel;
    let text = '';
    processForPanel.stdout.on('data', async chunk => {
      text += String(chunk);
      const match = text.match(/SpecTorque workbench: (http:\/\/127\.0\.0\.1:\d+)/);
      if (!match) return;
      text = '';
      const uri = await vscode.env.asExternalUri(vscode.Uri.parse(match[1]));
      const origin = new URL(uri.toString()).origin;
      panel.webview.html = '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; frame-src ' + origin + '; style-src \'unsafe-inline\'"><style>html,body,iframe{width:100%;height:100%;margin:0;border:0}body{overflow:hidden}</style></head><body><iframe title="SpecTorque workbench" src="' + uri.toString().replaceAll('&', '&amp;').replaceAll('"', '&quot;') + '"></iframe></body></html>';
    });
    processForPanel.stderr.on('data', chunk => output.append(String(chunk)));
    processForPanel.on('error', () => { panel.webview.html = '<p>Could not start SpecTorque. Build and package the integration, then try again.</p>'; output.show(); });
    processForPanel.on('exit', code => { if (code) { output.appendLine('Workbench exited with code ' + code); output.show(); } });
    panel.onDidDispose(() => { processForPanel.kill(); output.dispose(); if (child === processForPanel) child = undefined; });
  }));
}
export function deactivate() { child?.kill(); }
