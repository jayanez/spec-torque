import { readFile } from 'node:fs/promises';
import { packageArchive } from './package-archive.mjs';

const manifest = JSON.parse(await readFile('integrations/pi/package.json', 'utf8'));
const { archive, sha256 } = await packageArchive({
  host: 'pi',
  version: manifest.version,
  files: ['package.json', 'index.ts', 'README.md', 'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES'],
  directories: ['runtime', 'web-dist', 'skills'],
});
console.log(archive + '\nSHA-256 ' + sha256);
