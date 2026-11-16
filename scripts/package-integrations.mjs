import { cp, mkdir, writeFile, access, rm } from 'node:fs/promises';
import { build } from 'esbuild';
await Promise.all(['dist/cli.js', 'web-dist/index.html', 'skills/spec-review/SKILL.md'].map(path => access(path)));
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
  if (name !== 'vscode') await cp('README.md', dir + '/README.md');
}
await build({ entryPoints: ['integrations/vscode/src/extension.ts'], bundle: true, platform: 'node', target: 'node22', format: 'cjs', external: ['vscode'], outfile: 'integrations/vscode/extension.cjs' });
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/README.txt', 'Integration runtime files generated. Run npm pack, or package a host directory according to docs/integrations.md.\n');
console.log('Packaged shared runtimes for Claude Code, VS Code, OpenCode and Pi.');

