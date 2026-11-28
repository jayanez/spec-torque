import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { link, lstat, mkdir, open, rename, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { TextDecoder } from 'node:util';

const serverKey = ['mcp_servers', 'spectorque-workspace'];
const manual = 'Cannot safely merge .codex/config.toml. Merge the printed SpecTorque block manually.';
const sameKey = (left, right) => left.length === right.length && left.every((part, i) => part === right[i]);
const prefix = (left, right) => left.length <= right.length && sameKey(left, right.slice(0, left.length));

function fail() {
  throw new Error(manual);
}

// Scan statement boundaries and TOML keys. Values outside the managed block
// are opaque; their original bytes are used in the resulting file.
function statements(source) {
  const tokens = /"""(?:\\[\s\S]|"(?!")|""(?!")|[^"\\])*"""{1,3}|'''(?:'(?!')|''(?!')|[^'])*'''{1,3}|"(?:\\[^\r\n]|[^"\\\r\n])*"|'[^'\r\n]*'|#[^\r\n]*|\r?\n|[ \t]+|[.[\]{}=]|[A-Za-z0-9_-]+|[^\r\n]/gy;
  const result = [];
  let parts = [];
  let depth = 0;
  let end = 0;
  for (const match of source.matchAll(tokens)) {
    const value = match[0];
    end = match.index + value.length;
    if (value === '"' || value === "'") fail();
    if (value.startsWith('#') || /^[ \t]/u.test(value)) continue;
    if (value.endsWith('\n') && value.length <= 2) {
      if (depth === 0 && parts.length) {
        result.push(parts);
        parts = [];
      }
      continue;
    }
    if (value === '[' || value === '{') depth++;
    if (value === ']' || value === '}') depth--;
    if (depth < 0) fail();
    parts.push({ value, start: match.index, end });
  }
  if (depth !== 0 || end !== source.length) fail();
  if (parts.length) result.push(parts);
  return result;
}

function keys(parts) {
  if (parts.length === 0 || parts.length % 2 === 0) fail();
  return parts.filter((part, index) => {
    if ((index % 2 === 1) !== (part.value === '.')) fail();
    return index % 2 === 0;
  }).map(({ value }) => {
    if (/^[A-Za-z0-9_-]+$/u.test(value)) return value;
    if (value.startsWith("'") && !value.startsWith("'''")) return value.slice(1, -1);
    if (value.startsWith('"') && !value.startsWith('"""')) {
      try {
        return JSON.parse(value.replace(/\\(?:U([0-9a-fA-F]{8})|.)/gu, (match, hex) =>
          hex ? JSON.stringify(String.fromCodePoint(Number.parseInt(hex, 16))).slice(1, -1) : match));
      } catch {
        fail();
      }
    }
    fail();
  });
}

function patchConfig(source, binding) {
  const found = new Map();
  const tables = new Set();
  let table = [];
  for (const parts of statements(source)) {
    const first = parts[0].value;
    if (first === '[') {
      const array = parts[1]?.value === '[';
      const brackets = array ? 2 : 1;
      if (parts.slice(-brackets).some(part => part.value !== ']')) fail();
      table = keys(parts.slice(brackets, -brackets));
      if (!prefix(serverKey, table)) {
        if (array && prefix(table, serverKey)) fail();
        continue;
      }
      const name = table.slice(serverKey.length).join('.');
      if (array || !['', 'env'].includes(name) || tables.has(name)) fail();
      tables.add(name);
      continue;
    }

    const equal = parts.findIndex(part => part.value === '=');
    if (equal < 1 || equal === parts.length - 1) fail();
    const path = [...table, ...keys(parts.slice(0, equal))];
    if (prefix(path, serverKey)) fail();
    if (!prefix(serverKey, path)) continue;
    const field = path.slice(serverKey.length);
    const name = sameKey(field, ['env', 'SPECTORQUE_ROOT']) ? 'env.SPECTORQUE_ROOT' :
      field.length === 1 && field[0] !== 'env.SPECTORQUE_ROOT' ? field[0] : undefined;
    if (!name || !Object.hasOwn(binding.fields, name) || found.has(name)) fail();
    const start = parts[equal + 1].start;
    const end = parts.at(-1).end;
    let value;
    try {
      value = JSON.parse(source.slice(start, end));
    } catch {
      fail();
    }
    found.set(name, { start, end, value });
  }
  if (tables.size === 0 && found.size === 0) {
    const newline = source.includes('\r\n') ? '\r\n' : '\n';
    const separator = !source ? '' : source.endsWith('\n') ? newline : newline.repeat(2);
    return { status: 'missing', next: source + separator + binding.block.replaceAll('\n', newline) + newline };
  }

  const command = found.get('command')?.value;
  const args = found.get('args')?.value;
  if (typeof command !== 'string' || !isAbsolute(command) ||
      !Array.isArray(args) || args.length !== 1 || typeof args[0] !== 'string' || !isAbsolute(args[0]) ||
      found.get('cwd')?.value !== binding.fields.cwd || found.get('env.SPECTORQUE_ROOT')?.value !== binding.fields['env.SPECTORQUE_ROOT']) fail();
  const changes = [...found].filter(([key, { value }]) => JSON.stringify(value) !== JSON.stringify(binding.fields[key]));
  if (!changes.length) return { status: 'configured', next: source };
  let next = source;
  for (const [key, { start, end }] of changes.sort((a, b) => b[1].start - a[1].start)) {
    next = next.slice(0, start) + JSON.stringify(binding.fields[key]) + next.slice(end);
  }
  return { status: 'stale', next };
}

const statIfPresent = path => lstat(path).catch(error => {
  if (error.code !== 'ENOENT') throw error;
});
const sameEntry = (a, b) => a && b && a.dev === b.dev && a.ino === b.ino;

export async function configureWorkspace(root, binding, mode, expectedRevision) {
  const directory = join(root, '.codex');
  const path = join(directory, 'config.toml');
  async function snapshot() {
    const parent = await statIfPresent(directory);
    if (parent && !parent.isDirectory()) fail();
    const file = parent && await statIfPresent(path);
    if (file && (!file.isFile() || file.nlink !== 1)) fail();
    let bytes;
    if (file) {
      const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      try {
        const current = await handle.stat();
        if (!sameEntry(file, current) || current.nlink !== 1) fail();
        bytes = await handle.readFile();
      } finally {
        await handle.close();
      }
      if (!sameEntry(parent, await statIfPresent(directory)) || !sameEntry(file, await statIfPresent(path))) fail();
    }
    const hash = createHash('sha256').update(JSON.stringify([root, binding.fields, Boolean(file)]));
    if (bytes) hash.update(bytes);
    return { bytes, file, parent, revision: hash.digest('hex') };
  }

  const before = await snapshot();
  if (mode === '--write' && before.revision !== expectedRevision) {
    throw new Error('Project configuration changed. Run --check again and review the new proposal.');
  }
  const source = before.bytes ? new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(before.bytes) : '';
  const proposal = patchConfig(source, binding);
  if (mode === '--check') return { path, status: proposal.status, revision: before.revision };
  if (proposal.status === 'configured') return { path, status: 'configured' };

  await mkdir(directory, { recursive: true, mode: 0o700 });
  const parent = await statIfPresent(directory);
  if (!parent?.isDirectory() || (before.parent && !sameEntry(before.parent, parent))) fail();
  const lock = join(directory, '.spectorque-config.lock');
  const temp = join(directory, '.spectorque-config-' + randomUUID());
  await writeFile(lock, '', { flag: 'wx', mode: 0o600 });
  try {
    await writeFile(temp, proposal.next, { flag: 'wx', mode: before.file ? before.file.mode & 0o777 : 0o600 });
    const current = await snapshot();
    if (!sameEntry(parent, current.parent) || current.revision !== before.revision ||
        (before.file && (!sameEntry(before.file, current.file) || before.file.mode !== current.file.mode))) {
      throw new Error('Project configuration changed. Run --check again and review the new proposal.');
    }
    if (before.file) await rename(temp, path);
    else await link(temp, path);
  } finally {
    try {
      await unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; });
    } finally {
      await unlink(lock);
    }
  }
  return { path, status: 'written' };
}
