import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { reviewWorkspace, terminalSummary } from '../dist/integration.js';

// Use an existing client; never install a client or load a user's agent profile.
const cli = process.argv[2];
if (!cli) throw new Error('Usage: node scripts/qualify-pi.mjs /absolute/path/to/pi/cli.js');
const client = resolve(cli);
const scratch = await mkdtemp(join(tmpdir(), 'spectorque-pi-'));
try {
  for (const language of ['en', 'es']) {
    const workspace = join(scratch, language);
    await cp(resolve('fixtures/' + language + '-draft'), workspace, { recursive: true });
    const source = join(workspace, 'specs/booking/spec.md');
    const before = await readFile(source, 'utf8');
    const expected = terminalSummary(await reviewWorkspace(workspace)).join('\n');
    for (const mode of ['text', 'json']) {
      const agent = join(scratch, language + '-' + mode);
      await mkdir(agent);
      const result = spawnSync(process.execPath, [client, '--offline', '--no-session',
        '--no-extensions', '--no-skills', '--no-context-files', '--no-mcp',
        '--extension', resolve('integrations/pi/index.ts'), '--mode', mode, '-p', '/spectorque'], {
        cwd: workspace, env: { ...process.env, PI_CODING_AGENT_DIR: agent },
        encoding: 'utf8', timeout: 60_000,
      });
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stderr);
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
      assert.equal(await readFile(source, 'utf8'), before);
      console.log(`${language}/${mode}: exact summary, source unchanged, isolated offline client passed`);
    }
  }
} finally {
  await rm(scratch, { recursive: true, force: true });
}
