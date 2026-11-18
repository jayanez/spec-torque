import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

export async function runTerminal({ pty, Terminal, executable, args, workspace, env, log }, exercise) {
  const cols = 186;
  const rows = 48;
  const screen = new Terminal({ cols, rows, scrollback: 0, allowProposedApi: true });
  const client = pty.spawn(executable, args, { cwd: workspace, env, name: 'xterm-256color', cols, rows });
  const steps = [];
  let exited = false;
  const exit = new Promise(done => client.onExit(() => { exited = true; done(); }));
  client.onData(data => screen.write(data));
  screen.onData(data => { if (!exited) client.write(data); });
  function text() {
    const buffer = screen.buffer.active;
    return Array.from({ length: rows }, (_, row) => buffer.getLine(row)?.translateToString(true) ?? '').join('\n');
  }
  async function wait(marker) {
    const deadline = Date.now() + 20_000;
    while (!exited && Date.now() < deadline) {
      const frame = text();
      if (typeof marker === 'string' ? frame.replace(/\s+/g, ' ').includes(marker) : marker.test(frame)) return frame;
      await delay(40);
    }
    throw new Error('OpenCode did not show ' + marker + '\n' + text());
  }
  async function see(marker) {
    const frame = await wait(marker);
    steps.push('Observed ' + marker + '\n' + frame);
    return frame;
  }
  async function key(input) {
    assert.ok(!exited, 'OpenCode terminal exited');
    client.write(input);
    await delay(180);
  }
  async function slash(command, label) {
    await key('/' + command);
    await wait(label);
    await key('\r');
  }
  try {
    return await exercise({ see, key, slash, text });
  } finally {
    steps.push('Final screen\n' + text());
    if (!exited) {
      client.kill();
      await Promise.race([exit, delay(3000, undefined, { ref: false })]);
    }
    screen.dispose();
    await writeFile(log, steps.join('\n\n'));
  }
}
