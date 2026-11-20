import { readFile } from 'node:fs/promises';
import { packageArchive } from './package-archive.mjs';

const manifest = JSON.parse(await readFile('integrations/opencode/package.json', 'utf8'));
const { archive } = await packageArchive({
  host: 'opencode',
  version: manifest.version,
  files: ['package.json', 'tui.tsx', 'README.md', 'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES'],
  directories: ['runtime', 'web-dist'],
});
console.log(archive);
