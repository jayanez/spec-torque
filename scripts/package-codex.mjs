import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { packageArchive } from './package-archive.mjs';

const manifest = JSON.parse(await readFile('integrations/codex/plugin.json', 'utf8'));
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
if (manifest.version !== pkg.version) throw new Error('Codex plugin and package versions differ.');
const { archive, sha256 } = await packageArchive({
  host: 'codex',
  version: manifest.version,
  files: ['plugin.json', 'setup-workspace.mjs', 'workspace-config.mjs', 'README.md', 'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES'],
  directories: ['assets', 'runtime', 'web-dist', 'skills'],
  normalizeText: path => /\.(?:css|html|js|json|md|mjs|txt|yaml)$/u.test(path) ||
    ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES'].includes(path),
});
await writeFile(archive + '.sha256', sha256 + '  ' + basename(archive) + '\n');
console.log(archive + '\nSHA-256 ' + sha256);
