import { access, cp, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const language = process.argv[2] ?? 'en';
if (!['en', 'es'].includes(language)) throw new Error('Use npm run prepare:codex -- en|es.');
const repository = resolve(import.meta.dirname, '..');
await access(join(repository, 'dist/mcp.js'));
const root = join(repository, '.spec-torque', `codex-${language}`);
// Refuse to reset a qualification workspace containing reviewed user edits.
await mkdir(root, { recursive: false }).catch(async error => {
  if (error.code !== 'ENOENT') throw error;
  await mkdir(join(repository, '.spec-torque'), { recursive: true });
  await mkdir(root);
});
await cp(join(repository, 'fixtures', `${language}-draft`), root, { recursive: true });
await mkdir(join(root, '.agents'), { recursive: true });
await cp(join(repository, 'skills'), join(root, '.agents', 'skills'), { recursive: true });
await mkdir(join(root, '.codex'));
const tomlString = value => JSON.stringify(value);
await writeFile(join(root, '.codex', 'config.toml'), `[mcp_servers.spec-torque]\ncommand = ${tomlString(process.execPath)}\nargs = [${tomlString(join(repository, 'dist', 'mcp.js'))}]\n\n[mcp_servers.spec-torque.env]\nSPECTORQUE_ROOT = ${tomlString(root)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ workspace: root, node: process.version, configuration: '.codex/config.toml', skills: '.agents/skills', removal: 'Remove this generated workspace after exporting any edits.' }, null, 2));
