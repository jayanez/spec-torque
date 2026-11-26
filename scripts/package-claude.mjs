import { readFile } from 'node:fs/promises';
import { packageArchive } from './package-archive.mjs';

// package:claude runs build and package:integrations first. Tests stay out of the installed plugin.
const manifest = JSON.parse(await readFile('integrations/claude/.claude-plugin/plugin.json', 'utf8'));
const { archive, sha256 } = await packageArchive({
  host: 'claude',
  version: manifest.version,
  files: ['.claude-plugin/plugin.json', '.mcp.json', 'hooks/hooks.json', 'hooks/register.js', 'hooks/text.js',
    'README.md', 'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES'],
  directories: ['assets', 'dist', 'web-dist', 'skills'],
});
console.log(archive + '\nSHA-256 ' + sha256);
