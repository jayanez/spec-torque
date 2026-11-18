import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { zipSync } from 'fflate';

const root = resolve('integrations/opencode');
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const files = ['package.json', 'tui.tsx', 'README.md', 'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES'];
for (const directory of ['runtime', 'web-dist']) {
  const entries = await readdir(join(root, directory), { recursive: true, withFileTypes: true });
  files.push(...entries.filter(entry => entry.isFile()).map(entry =>
    relative(root, join(entry.parentPath, entry.name)).split(sep).join('/')));
}
const zip = Object.fromEntries(await Promise.all(files.sort().map(async path => [path, await readFile(join(root, path))])));
const archive = resolve('artifacts/spectorque-opencode-' + manifest.version + '.zip');
await mkdir(resolve('artifacts'), { recursive: true });
await writeFile(archive, zipSync(zip, { mtime: new Date(2000, 0, 1) }));
console.log(archive);
