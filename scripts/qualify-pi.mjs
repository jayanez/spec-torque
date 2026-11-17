import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { access, cp, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { qualifyTerminal } from './qualify-pi-terminal.mjs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { reviewWorkspace, terminalSummary } from '../dist/integration.js';

const [cli, option, packagePath, terminalOption, ptyPath, ...extra] = process.argv.slice(2);
if (!cli || extra.length || (option !== undefined && (option !== '--installed-package' || !packagePath)) ||
  (terminalOption !== undefined && (terminalOption !== '--terminal-driver' || !ptyPath))) {
  throw new Error('Usage: qualify:pi -- <pi-cli.js> [--installed-package <generated-folder> [--terminal-driver <node-pty-folder>]]');
}
const client = resolve(cli);
const pty = ptyPath && createRequire(import.meta.url)(resolve(ptyPath));
const scratch = await mkdtemp(join(tmpdir(), 'spectorque-pi-'));

function isolatedEnv(agent) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    /^(PATH|SYSTEMROOT|WINDIR|COMSPEC|PATHEXT|TEMP|TMP|TMPDIR|TERM|LANG)$/i.test(name)));
  Object.assign(env, {
    HOME: agent, USERPROFILE: agent, XDG_CONFIG_HOME: agent,
    PI_CODING_AGENT_DIR: agent, PI_OFFLINE: '1', PI_TELEMETRY: '0', TERM: 'xterm-256color',
  });
  return env;
}

function runPi(workspace, agent, args, input) {
  const result = spawnSync(process.execPath, [client, ...args], {
    cwd: workspace, env: isolatedEnv(agent), input, encoding: 'utf8', timeout: 60_000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

const common = ['--offline', '--no-session', '--no-context-files', '--no-mcp'];
const skills = ['spec-author', 'spec-refine', 'spec-review'];
const resources = ['spectorque', ...skills.map(name => 'skill:' + name)];

function verifyDiscovery(workspace, agent, trust, installed, artifact) {
  const { stdout } = runPi(workspace, agent, [...common, trust, '--mode', 'rpc'],
    JSON.stringify({ type: 'get_commands' }) + '\n');
  const response = stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
    .find(event => event.type === 'response' && event.command === 'get_commands');
  assert.equal(response?.success, true, stdout);
  const discovered = response.data.commands.filter(command => resources.includes(command.name));
  assert.deepEqual(discovered.map(command => command.name).sort(), installed ? [...resources].sort() : []);
  for (const command of discovered) {
    assert.equal(command.source, command.name === 'spectorque' ? 'extension' : 'skill');
    const path = command.sourceInfo?.path ?? command.path;
    assert.ok(path, 'Pi must report resource provenance');
    const fromArtifact = relative(artifact, path);
    assert.ok(fromArtifact && !isAbsolute(fromArtifact) && !fromArtifact.startsWith('..'), path);
    console.log(`discovered ${command.name} from ${fromArtifact}`);
  }
}

try {
  let artifact;
  if (packagePath) {
    artifact = join(scratch, 'pi-spectorque');
    await cp(resolve(packagePath), artifact, { recursive: true, filter: path => !path.split(/[\\/]/).includes('node_modules') });
    const manifest = JSON.parse(await readFile(join(artifact, 'package.json'), 'utf8'));
    assert.equal(manifest.name, 'pi-spectorque');
    for (const path of ['index.ts', 'runtime/integration.js', 'runtime/cli.js', 'web-dist/index.html',
      'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES', ...skills.map(name => `skills/${name}/SKILL.md`)]) {
      await access(join(artifact, path));
    }
    const digest = createHash('sha256');
    const files = await readdir(artifact, { recursive: true, withFileTypes: true });
    const paths = files.filter(entry => entry.isFile())
      .map(entry => relative(artifact, join(entry.parentPath, entry.name)).split('\\').join('/')).sort();
    for (const path of paths) {
      const hash = createHash('sha256').update(await readFile(join(artifact, path))).digest('hex');
      digest.update(JSON.stringify([path, hash]) + '\n');
    }
    console.log(`Package file digest (SHA-256): ${digest.digest('hex')}`);
    console.log(`Pi ${runPi(scratch, scratch, ['--version']).stdout.trim()} / ${manifest.name}@${manifest.version} / Node ${process.version} / ${process.platform}/${process.arch}`);
  }
  for (const language of ['en', 'es']) {
    const workspace = join(scratch, language);
    const agent = join(scratch, language + '-agent');
    await mkdir(agent);
    await cp(resolve('fixtures/' + language + '-draft'), workspace, { recursive: true });
    const source = join(workspace, 'specs/booking/spec.md');
    const before = await readFile(source);
    const expected = terminalSummary(await reviewWorkspace(workspace)).join('\n');
    if (artifact) {
      runPi(workspace, agent, ['install', artifact, '--local', '--approve']);
      const settings = JSON.parse(await readFile(join(workspace, '.pi', 'settings.json'), 'utf8'));
      assert.equal(settings.packages.length, 1);
      await assert.rejects(access(join(agent, 'settings.json')), { code: 'ENOENT' });
      verifyDiscovery(workspace, agent, '--no-approve', false, artifact);
      verifyDiscovery(workspace, agent, '--approve', true, artifact);
    }
    for (const mode of ['text', 'json']) {
      const load = artifact ? ['--approve'] : [
        '--no-extensions', '--no-skills', '--extension', resolve('integrations/pi/index.ts'),
      ];
      const result = runPi(workspace, agent, [...common, ...load, '--mode', mode, '-p', '/spectorque']);
      assert.equal(result.stderr, '');
      if (mode === 'text') assert.equal(result.stdout, expected + '\n');
      else {
        const events = result.stdout.trim().split('\n').map(line => JSON.parse(line));
        const messages = events.filter(event => event.type === 'message_end').map(event => event.message);
        assert.equal(messages.length, 1);
        assert.equal(messages[0].role, 'custom');
        assert.equal(messages[0].customType, 'spectorque');
        assert.equal(messages[0].content, expected);
        assert.ok(!events.some(event => event.type === 'agent_start'), 'No model turn may start');
      }
      assert.deepEqual(await readFile(source), before);
      console.log(`${language}/${mode}: exact summary, source unchanged, isolated offline client passed`);
    }
    if (artifact) {
      if (pty) await qualifyTerminal(pty, {
        client, args: [...common, '--approve'], env: isolatedEnv(agent), workspace, language,
      });
      runPi(workspace, agent, ['remove', artifact, '--local', '--approve']);
      verifyDiscovery(workspace, agent, '--approve', false, artifact);
    }
  }
} finally {
  await rm(scratch, { recursive: true, force: true });
}
