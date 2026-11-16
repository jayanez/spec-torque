import { build } from 'esbuild';
import { runTests, resolveCliArgsFromVSCodeExecutablePath } from '@vscode/test-electron';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, cp, writeFile } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';
import { createServer } from 'node:net';
const root = resolve(import.meta.dirname, '..');
const restricted = process.argv.includes('--restricted');
await mkdir(join(root, '.spectorque'), { recursive: true });
const run = await mkdtemp(join(root, '.spectorque', 'vscode-run-'));
const workspace = join(run, 'workspace');
await cp(join(root, 'fixtures/en-draft'), workspace, { recursive: true });
await mkdir(join(run, 'user-data/User'), { recursive: true });
await writeFile(join(run, 'user-data/User/settings.json'), JSON.stringify({ 'telemetry.telemetryLevel': 'off', 'update.mode': 'none', 'extensions.autoCheckUpdates': false, 'extensions.autoUpdate': false, 'workbench.startupEditor': 'none', 'chat.disableAIFeatures': true, 'security.workspace.trust.startupPrompt': 'never' }));
const probe = createServer();
await new Promise(done => probe.listen(0, '127.0.0.1', done));
const port = probe.address().port;
await new Promise(done => probe.close(done));
await build({ entryPoints: ['integrations/vscode/tests/host.ts'], bundle: true, platform: 'node', target: 'node22', format: 'cjs', external: ['vscode', 'playwright'], outfile: join(run, 'host.cjs') });
const executable = process.env.VSCODE_EXECUTABLE;
if (!executable) throw new Error('Set VSCODE_EXECUTABLE to an installed VS Code executable; this test does not download or change your editor.');
const [cli, ...cliArgs] = resolveCliArgsFromVSCodeExecutablePath(executable);
const installation = spawnSync(cli, [...cliArgs, '--user-data-dir', join(run, 'user-data'), '--extensions-dir', join(run, 'extensions'), '--install-extension', join(root, 'artifacts/spectorque-0.1.0.vsix')], { stdio: 'inherit', shell: process.platform === 'win32' });
if (installation.error) throw installation.error;
if (installation.status !== 0) throw new Error('VSIX installation failed.');
const harness = join(run, 'harness');
await mkdir(harness);
await writeFile(join(harness, 'package.json'), JSON.stringify({ name: 'spectorque-qualification-harness', publisher: 'local', version: '0.0.0', engines: { vscode: '^1.100.0' } }));
const codexExtension = process.env.CODEX_VSCODE_EXTENSION;
if (codexExtension && !restricted) await cp(codexExtension, join(run, 'extensions', basename(codexExtension)), { recursive: true });
const developmentPaths = [harness, ...(codexExtension && !restricted ? [join(run, 'extensions', basename(codexExtension))] : [])];
await mkdir(join(run, 'codex-home'));
await writeFile(join(run, 'codex-home/config.toml'), 'model_provider = "offline"\nmodel = "offline"\n[model_providers.offline]\nname = "Offline qualification"\nbase_url = "http://127.0.0.1:9/v1"\nwire_api = "responses"\n[analytics]\nenabled = false\n[feedback]\nenabled = false\n');
const extensionTestsEnv = { SPECTORQUE_CDP_PORT: String(port), SPECTORQUE_EVIDENCE_DIR: run, SPECTORQUE_RESTRICTED: restricted ? '1' : '0', SPECTORQUE_WITH_CODEX: codexExtension && !restricted ? '1' : '0', CODEX_HOME: join(run, 'codex-home') };
const launchArgs = [workspace, '--user-data-dir', join(run, 'user-data'), '--extensions-dir', join(run, 'extensions'), '--skip-welcome', '--skip-release-notes', `--remote-debugging-port=${port}`];
if (restricted) {
  // test-electron 3.1.0 unconditionally disables trust. Launch the documented
  // extension-test entrypoint directly so this negative test exercises trust.
  await new Promise((done, reject) => {
    const child = spawn(executable, [...launchArgs, `--extensionDevelopmentPath=${harness}`, `--extensionTestsPath=${join(run, 'host.cjs')}`], { env: { ...process.env, ...extensionTestsEnv }, stdio: 'inherit' });
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Restricted Mode test timed out.')); }, 45_000);
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('exit', code => { clearTimeout(timeout); code === 0 ? done() : reject(new Error(`Restricted Mode test failed: ${code}`)); });
  });
} else await runTests({
  vscodeExecutablePath: executable,
  extensionDevelopmentPath: developmentPaths,
  extensionTestsPath: join(run, 'host.cjs'),
  extensionTestsEnv,
  launchArgs,
});
console.log(`VS Code evidence: ${run}`);
