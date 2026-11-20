import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { zipSync } from 'fflate';

// Deterministic host archive: sorted entries, fixed timestamps, POSIX paths.
export async function packageArchive({ host, version, files, directories, normalizeText = () => false }) {
  const root = resolve('integrations', host);
  const entries = [...files];
  for (const directory of directories) {
    const found = await readdir(join(root, directory), { recursive: true, withFileTypes: true });
    entries.push(...found.filter(entry => entry.isFile()).map(entry =>
      relative(root, join(entry.parentPath, entry.name)).split(sep).join('/')));
  }
  const zip = Object.fromEntries(await Promise.all(entries.sort().map(async path => {
    const bytes = await readFile(join(root, path));
    return [path, normalizeText(path) ? Buffer.from(bytes.toString('utf8').replaceAll('\r\n', '\n')) : bytes];
  })));
  const archive = resolve('artifacts/spectorque-' + host + '-' + version + '.zip');
  const bytes = zipSync(zip, { mtime: new Date(2000, 0, 1) });
  await mkdir(resolve('artifacts'), { recursive: true });
  await writeFile(archive, bytes);
  return { archive, sha256: createHash('sha256').update(bytes).digest('hex') };
}
