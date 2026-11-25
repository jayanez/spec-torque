import { access, realpath, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 20)) throw new Error('SpecTorque requires Node 22.20 or later.');
const [input, feature, ...extra] = process.argv.slice(2);
if (!input || extra.length || feature?.startsWith('-')) throw new Error('Usage: node setup-workspace.mjs <trusted-worktree> [feature-id]');
const root = await realpath(resolve(input));
if (!(await stat(root)).isDirectory()) throw new Error('The worktree must be a directory.');
const node = await realpath(process.execPath);
const server = fileURLToPath(new URL('./runtime/server.mjs', import.meta.url));
const workbench = fileURLToPath(new URL('./runtime/workbench.mjs', import.meta.url));
const assets = fileURLToPath(new URL('./web-dist/index.html', import.meta.url));
await Promise.all([server, workbench, assets].map(path => access(path)));
const toml = JSON.stringify;
const config = [
  '[mcp_servers.spectorque-workspace]',
  'command = ' + toml(node),
  'args = [' + toml(server) + ']',
  'cwd = ' + toml(root),
  '',
  '[mcp_servers.spectorque-workspace.env]',
  'SPECTORQUE_ROOT = ' + toml(root),
].join('\n');
const cmd = process.platform === 'win32'
  ? values => '& ' + values.map(value => "'" + value.replaceAll("'", "''") + "'").join(' ')
  : values => values.map(value => "'" + value.replaceAll("'", "'\"'\"'") + "'").join(' ');

console.log('Merge this block into the trusted worktree’s .codex/config.toml:');
console.log('\n' + config + '\n');
// The workbench loads what it is started for on connect: this feature, or the whole work tree when it fits.
console.log(feature ? 'To open the corresponding local workbench on ' + feature + ', run:' : 'To open the corresponding local workbench, run (add --feature <feature-id> to open it on one feature):');
console.log(cmd([node, workbench, 'serve', '--root', root, '--port', '0', ...(feature ? ['--feature', feature] : [])]));
