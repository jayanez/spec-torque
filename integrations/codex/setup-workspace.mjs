import { access, lstat, realpath, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configureWorkspace } from './workspace-config.mjs';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 20)) throw new Error('SpecTorque requires Node 22.20 or later.');
const operands = process.argv.slice(2);
const mode = operands[0]?.startsWith('--') ? operands.shift() : undefined;
const [input, second, revision, ...extra] = operands;
const feature = mode === '--write' ? undefined : second;
if (!input || input.startsWith('-') || extra.length || ![undefined, '--check', '--write'].includes(mode) ||
    (mode === '--write' ? second !== '--expect' || !/^[a-f0-9]{64}$/u.test(revision ?? '') : revision || feature?.startsWith('-'))) {
  throw new Error('Usage: node setup-workspace.mjs [--check] <trusted-worktree> [feature-id]\n' +
    '       node setup-workspace.mjs --write <trusted-worktree> --expect <revision from --check>');
}
const root = await realpath(resolve(input));
if (!(await stat(root)).isDirectory()) throw new Error('The worktree must be a directory.');
const node = await realpath(process.execPath);
const server = fileURLToPath(new URL('./runtime/server.mjs', import.meta.url));
const workbench = fileURLToPath(new URL('./runtime/workbench.mjs', import.meta.url));
const assets = fileURLToPath(new URL('./web-dist/index.html', import.meta.url));
await Promise.all([server, workbench, assets].map(path => access(path)));
const toml = JSON.stringify;
const fields = { command: node, args: [server], cwd: root, 'env.SPECTORQUE_ROOT': root };
const config = [
  '[mcp_servers.spectorque-workspace]',
  'command = ' + toml(fields.command),
  'args = ' + toml(fields.args),
  'cwd = ' + toml(fields.cwd),
  '',
  '[mcp_servers.spectorque-workspace.env]',
  'SPECTORQUE_ROOT = ' + toml(fields['env.SPECTORQUE_ROOT']),
].join('\n');

if (mode === '--write') {
  const result = await configureWorkspace(root, { fields, block: config }, mode, revision);
  console.log((result.status === 'configured' ? 'Already configured: ' : 'Configured: ') + result.path);
  process.exit(0);
}
const cmd = process.platform === 'win32'
  ? values => '& ' + values.map(value => "'" + value.replaceAll("'", "''") + "'").join(' ')
  : values => values.map(value => "'" + value.replaceAll("'", "'\"'\"'") + "'").join(' ');
const workbenchCommand = cmd([node, workbench, 'serve', '--root', root, '--port', '0', ...(feature ? ['--feature', feature] : [])]);

console.log('Merge this block into the trusted worktree’s .codex/config.toml:');
console.log('\n' + config + '\n');
if (mode === '--check') {
  const result = await configureWorkspace(root, { fields, block: config }, mode);
  console.log('Project configuration: ' + result.status);
  console.log('Config revision: ' + result.revision + '\n');
}
if (process.platform === 'win32') {
  console.log('The Codex Desktop environment action is unavailable on Windows. Use the workbench command below.\n');
} else {
  const environmentPath = '.codex/environments/environment.toml';
  const exists = await lstat(join(root, environmentPath)).then(() => true, error => {
    if (error.code === 'ENOENT') return false;
    throw error;
  });
  const action = [
    '[[actions]]',
    'name = ' + toml('Open SpecTorque workbench'),
    'icon = ' + toml('run'),
    'command = ' + toml(workbenchCommand),
  ].join('\n');
  if (exists) {
    console.log('Merge this block into the worktree’s ' + environmentPath + ' (replace any previous Open SpecTorque workbench action):');
    console.log('\n' + action + '\n');
  } else {
    console.log('Create ' + environmentPath + ' in the worktree with this content:');
    console.log('\nversion = 1\nname = ' + toml('SpecTorque workbench') + '\n\n[setup]\nscript = ""\n\n' + action + '\n');
  }
}
// The workbench loads what it is started for on connect: this feature, or the whole work tree when it fits.
console.log(feature ? 'To open the corresponding local workbench on ' + feature + ', run:' : 'To open the corresponding local workbench, run (add --feature <feature-id> to open it on one feature):');
console.log(workbenchCommand);
