import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { unzipSync, zipSync } from 'fflate';

const repository = resolve(import.meta.dirname, '..');
const probe = join(import.meta.dirname, 'codex-desktop-probe');
const name = 'spectorque-desktop-probe';
const marketplace = 'spectorque-desktop-qualification';
const version = '0.1.0';
const parent = resolve(process.argv[2] ?? join(repository, '.spec-torque'));
if (process.argv.length > 3) throw new Error('Usage: npm run prepare:codex-desktop-probe -- [output-directory]');

await mkdir(parent, { recursive: true });
const run = await mkdtemp(join(await realpath(parent), 'codex-desktop-probe-'));
const project = join(run, 'project-a');
const secondWorktree = join(run, 'project-b');
const directProject = join(run, 'project-direct');
const archive = join(run, name + '-' + version + '.zip');

const json = value => JSON.stringify(value, null, 2) + '\n';
const git = (cwd, ...args) => execFileSync('git', ['-c', 'core.hooksPath=' + join(run, 'no-hooks'), ...args], { cwd, stdio: ['ignore', 'ignore', 'pipe'] });
const buildResult = await build({
  entryPoints: [join(probe, 'server.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  write: false,
});
const manifest = {
  name,
  version,
  description: 'Read-only qualification probe with synthetic data for Codex Desktop.',
  license: 'Apache-2.0',
  author: { name: 'jayanez' },
  repository: 'https://github.com/jayanez/spec-torque',
};
const mcp = {
  mcpServers: {
    [name]: {
      type: 'stdio',
      command: 'node',
      args: ['${PLUGIN_ROOT}/runtime/server.mjs'],
      cwd: '${PLUGIN_ROOT}',
      env: { SPECTORQUE_PROBE_TRACE: '${PLUGIN_DATA}/trace.ndjson' },
    },
  },
};
const entries = {
  'LICENSE': await readFile(join(repository, 'LICENSE')),
  'NOTICE': await readFile(join(repository, 'NOTICE')),
  'THIRD_PARTY_NOTICES': await readFile(join(repository, 'THIRD_PARTY_NOTICES')),
  'assets/probe.html': await readFile(join(probe, 'probe.html')),
  'mcp.json': Buffer.from(json(mcp)),
  'plugin.json': Buffer.from(json(manifest)),
  'runtime/server.mjs': buildResult.outputFiles[0].contents,
};
const bytes = zipSync(entries, { mtime: new Date(2000, 0, 1) });
await writeFile(archive, bytes, { flag: 'wx' });
const sha256 = createHash('sha256').update(bytes).digest('hex');

await mkdir(join(project, '.agents', 'plugins'), { recursive: true });
await mkdir(join(project, '.codex'));
await writeFile(join(project, '.agents', 'plugins', 'marketplace.json'), json({
  name: marketplace,
  plugins: [{
    name,
    source: { source: 'local', path: './plugins/' + name },
    policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
    category: 'Developer Tools',
  }],
}));
await writeFile(join(project, '.codex', 'config.toml'), '# Benchmark trust before enabling. Install from Plugins in the isolated profile.\n');
await writeFile(join(project, 'marker.md'), 'Synthetic project marker A\n');
const plugin = join(project, 'plugins', name);
for (const [entry, contents] of Object.entries(unzipSync(await readFile(archive)))) {
  const target = join(plugin, entry);
  await mkdir(resolve(target, '..'), { recursive: true });
  await writeFile(target, contents, { flag: 'wx' });
}

git(project, 'init', '--quiet', '--template=');
git(project, 'config', '--local', 'core.autocrlf', 'false');
git(project, 'add', '.');
git(project, '-c', 'user.name=jayanez', '-c', 'user.email=7823750+jayanez@users.noreply.github.com',
  'commit', '--quiet', '--no-gpg-sign', '-m', 'Create disposable desktop probe fixture');
git(project, 'worktree', 'add', '--detach', secondWorktree);
await writeFile(join(secondWorktree, 'marker.md'), 'Synthetic project marker B\n');

await mkdir(join(directProject, '.codex'), { recursive: true });
git(directProject, 'init', '--quiet', '--template=');
await writeFile(join(directProject, 'marker.md'), 'Synthetic direct MCP control\n');
const q = JSON.stringify;
await writeFile(join(directProject, '.codex', 'config.toml'), [
  '[mcp_servers.' + name + ']',
  'command = ' + q(process.execPath),
  'args = [' + q(join(plugin, 'runtime', 'server.mjs')) + ']',
  'cwd = ' + q(directProject),
  '[mcp_servers.' + name + '.env]',
  'SPECTORQUE_PROBE_TRACE = ' + q(join(run, 'direct-trace.ndjson')),
  '',
].join('\n'));

const settings = '[plugins."' + name + '@' + marketplace + '"]\nenabled = true';
const manifestPath = join(run, 'probe.json');
const sourceGit = (...args) => execFileSync('git', args, { cwd: repository, encoding: 'utf8' }).trim();
const source = { commit: sourceGit('rev-parse', 'HEAD'), dirty: Boolean(sourceGit('status', '--porcelain')) };
const result = { run, manifestPath, project, secondWorktree, directProject, plugin, archive, sha256, settings, node: process.version, source };
await writeFile(manifestPath, json(result));
console.log(json(result).trim());
