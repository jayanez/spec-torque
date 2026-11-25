import { cp, mkdir, writeFile, access, rm, readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { generateLicenseNotices } from './license-notices.mjs';
await Promise.all(['dist/cli.js', 'web-dist/index.html', 'skills/spec-review/SKILL.md', 'docs/assets/brand/icon-256.png'].map(path => access(path)));
await generateLicenseNotices();
// Marketplace listings need a square PNG icon inside each package.
async function copyIcon(dir) {
  await mkdir(dir + '/assets', { recursive: true });
  await cp('docs/assets/brand/icon-256.png', dir + '/assets/icon.png');
}
for (const name of ['claude', 'vscode', 'opencode', 'pi']) {
  const dir = 'integrations/' + name;
  const runtime = dir + (name === 'claude' ? '/dist' : '/runtime');
  await rm(runtime, { recursive: true, force: true });
  await mkdir(runtime, { recursive: true });
  await build({ entryPoints: ['src/cli.ts', 'src/mcp.ts', 'src/integration.ts'], bundle: true, platform: 'node', target: 'node22', format: 'esm', outdir: runtime, banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" } });
  await rm(dir + '/web-dist', { recursive: true, force: true });
  await cp('web-dist', dir + '/web-dist', { recursive: true });
  if (['claude', 'pi'].includes(name)) await cp('skills', dir + '/skills', { recursive: true });
  await cp('LICENSE', dir + '/LICENSE');
  await cp('NOTICE', dir + '/NOTICE');
  await cp('THIRD_PARTY_NOTICES', dir + '/THIRD_PARTY_NOTICES');
  await copyIcon(dir);
}
await build({ entryPoints: ['integrations/vscode/src/extension.ts'], bundle: true, platform: 'node', target: 'node22', format: 'cjs', external: ['vscode'], outfile: 'integrations/vscode/extension.cjs' });
const codexRuntime = 'integrations/codex/runtime';
await rm(codexRuntime, { recursive: true, force: true });
await build({
  entryPoints: ['integrations/codex/server.ts'], bundle: true, platform: 'node', target: 'node22',
  format: 'esm', outfile: codexRuntime + '/server.mjs',
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
});
await build({
  entryPoints: ['src/cli.ts'], bundle: true, platform: 'node', target: 'node22',
  format: 'esm', outfile: codexRuntime + '/workbench.mjs',
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
});
const codexRoot = 'integrations/codex';
for (const dir of ['web-dist', 'skills']) {
  await rm(codexRoot + '/' + dir, { recursive: true, force: true });
  await cp(dir, codexRoot + '/' + dir, { recursive: true });
}
for (const filename of ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES']) {
  await cp(filename, codexRoot + '/' + filename);
}
await copyIcon(codexRoot);
const widget = await build({
  entryPoints: ['integrations/codex/viewer.ts'], bundle: true, platform: 'browser', target: 'es2022',
  format: 'iife', write: false,
});
const template = await readFile('integrations/codex/viewer.html', 'utf8');
await writeFile(codexRuntime + '/viewer.html', template.replace('<!-- VIEWER_SCRIPT -->',
  () => '<script>' + widget.outputFiles[0].text + '</script>'));
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/README.txt', 'Integration runtime files generated. Run npm pack, or package a host directory according to docs/integrations.md.\n');
console.log('Packaged shared runtimes for Claude Code, Codex, VS Code, OpenCode and Pi.');
