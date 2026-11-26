// Builds the VSIX with the official packager so the VS Code Marketplace and
// Open VSX accept it unchanged. package:vscode runs package:integrations first.
// Pass --pre-release for the prerelease channel (the flag is stored in the VSIX).
// vsce is pinned and fetched on demand to keep release tooling out of the product lockfile.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const VSCE = '@vscode/vsce@4.1.1';
const manifest = JSON.parse(await readFile('integrations/vscode/package.json', 'utf8'));
for (const required of ['extension.cjs', 'runtime/cli.js', 'web-dist/index.html', manifest.icon]) {
  await readFile(resolve('integrations/vscode', required)).catch(() => { throw new Error('Missing VSIX payload: ' + required + '. Run npm run package:integrations first.'); });
}
await mkdir('artifacts', { recursive: true });
const output = resolve(`artifacts/${manifest.name}-${manifest.version}.vsix`);
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const preRelease = process.argv.includes('--pre-release') ? ['--pre-release'] : [];
execFileSync(npx, ['--yes', VSCE, 'package', '--no-dependencies', ...preRelease, '--out', output], { cwd: resolve('integrations/vscode'), stdio: ['ignore', 'ignore', 'inherit'], shell: process.platform === 'win32' });
console.log(output);
