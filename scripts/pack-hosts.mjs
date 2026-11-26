// Packs the npm packages that the marketplaces install (root CLI plus one per host)
// into artifacts/npm and verifies each tarball from a clean extraction.
// Run after `npm run package:integrations`: npm run pack:hosts
import { execFileSync } from 'node:child_process';
import { access, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const out = resolve('artifacts/npm');
await mkdir(out, { recursive: true });
// Each package must contain these paths; they are what the host loads.
export const PACKAGES = {
  '.': ['dist/cli.js', 'dist/mcp.js', 'web-dist/index.html', 'skills/spec-review/SKILL.md'],
  'integrations/claude': ['.claude-plugin/plugin.json', '.mcp.json', 'hooks/register.js', 'dist/mcp.js', 'dist/cli.js', 'web-dist/index.html', 'skills/spec-review/SKILL.md', 'assets/icon.png'],
  'integrations/codex': ['plugin.json', 'setup-workspace.mjs', 'runtime/server.mjs', 'runtime/workbench.mjs', 'runtime/viewer.html', 'skills/spec-review/SKILL.md', 'assets/icon.png'],
  'integrations/opencode': ['tui.tsx', 'runtime/integration.js', 'web-dist/index.html', 'assets/icon.png'],
  'integrations/pi': ['index.ts', 'runtime/integration.js', 'skills/spec-review/SKILL.md', 'assets/icon.png'],
};
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const tarballs = [];
for (const [dir, required] of Object.entries(PACKAGES)) {
  const [{ filename, files }] = JSON.parse(execFileSync(npm, ['pack', '--json', '--ignore-scripts', '--pack-destination', out], { cwd: resolve(dir), encoding: 'utf8', shell: process.platform === 'win32' }));
  const listed = new Set(files.map(f => f.path));
  const missing = required.filter(path => !listed.has(path));
  if (missing.length) throw new Error(`${filename} is missing ${missing.join(', ')}. Run npm run package:integrations first.`);
  if (dir === '.' && files.some(f => f.path.startsWith('integrations/'))) throw new Error(filename + ' must not bundle host integrations.');
  const scratch = await mkdtemp(join(tmpdir(), 'spectorque-pack-'));
  try {
    execFileSync('tar', ['-xzf', join(out, filename), '-C', scratch]);
    await Promise.all(required.map(path => access(join(scratch, 'package', path))));
  } finally { await rm(scratch, { recursive: true, force: true }); }
  tarballs.push(filename);
  console.log(`${filename}: ${files.length} files`);
}
console.log('Packed ' + tarballs.length + ' packages into ' + out);
