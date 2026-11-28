import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { link, lstat, mkdir, open, rename, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { TextDecoder } from 'node:util';

const serverKey = ['mcp_servers', 'spectorque-workspace'];
const manual = 'Cannot safely merge .codex/config.toml. Merge the printed SpecTorque block manually.';
const sameKey = (left, right) => left.length === right.length && left.every((part, i) => part === right[i]);
const prefix = (left, right) => left.length <= right.length && sameKey(left, right.slice(0, left.length));

export const tomlValue = value => JSON.stringify(value).replaceAll('\u007f', '\\u007f');

function fail() {
  throw new Error(manual);
}

// Locate statement boundaries without rewriting unrelated TOML.
function statements(source) {
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/u.test(source)) fail();
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
    if (value.startsWith("'") && !value.startsWith("'''")) {
      validateString(value);
      return value.slice(1, -1);
    }
    if (value.startsWith('"') && !value.startsWith('"""')) {
      validateString(value);
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

// Validate the layout before reusing any byte spans. Unfamiliar syntax falls
// back to manual setup instead of reporting success on an unusable config.
function validateString(value) {
  const multiline = value.startsWith('"""') || value.startsWith("'''");
  const delimiter = multiline ? 3 : 1;
  const body = value.slice(delimiter, -delimiter);
  const controls = multiline ? /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]|\r(?!\n)/u : /[\x00-\x08\x0a-\x1f\x7f]/u;
  if (controls.test(body)) fail();
  if (value[0] === "'") return;
  const escapes = /\\(?:[btnfr"\\]|u([a-fA-F0-9]{4})|U([a-fA-F0-9]{8})|([ \t]*\r?\n)|([\s\S]|$))/gu;
  for (const [, shortHex, longHex, newline, invalid] of body.matchAll(escapes)) {
    const code = Number.parseInt(shortHex ?? longHex ?? '', 16);
    if (invalid !== undefined || (newline && !multiline) || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) fail();
  }
}

const digits = '[0-9](?:_?[0-9])*';
const decimal = '(?:0|[1-9](?:_?[0-9])*)';
const exponent = '[eE][+-]?' + digits;
const float = new RegExp('^[+-]?' + decimal + '(?:\\.' + digits + '(?:' + exponent + ')?|' + exponent + ')$', 'u');
const integer = new RegExp('^(?:[+-]?' + decimal + '|0x[\\da-fA-F](?:_?[\\da-fA-F])*|0o[0-7](?:_?[0-7])*|0b[01](?:_?[01])*)$', 'u');

function validateScalar(raw) {
  if (/^(?:true|false|[+-]?(?:inf|nan))$/u.test(raw)) return;
  if (float.test(raw) && Number.isFinite(Number(raw.replaceAll('_', '')))) return;
  if (integer.test(raw)) {
    const value = BigInt(raw.replaceAll('_', ''));
    if (value >= -(2n ** 63n) && value < 2n ** 63n) return;
  }
  const dateTime = /^(?:(\d{4})-(\d{2})-(\d{2})(?:([Tt ])|$))?(?:(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:([Zz])|[+-](\d{2}):(\d{2}))?)?$/u.exec(raw);
  if (dateTime) {
    const [, year, month, day, separator, hour, minute, second, utc, offsetHour, offsetMinute] = dateTime;
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const validDate = Number(day) >= 1 && Number(day) <= monthDays[Number(month) - 1];
    const validTime = Number(hour) < 24 && Number(minute) < 60 && Number(second) < 60;
    const validOffset = offsetHour === undefined || (Number(offsetHour) < 24 && Number(offsetMinute) < 60);
    if ((!separator && validDate && !hour) ||
        (validTime && (year ? validDate && validOffset : !utc && offsetHour === undefined))) return;
  }
  fail();
}

// A dotted assignment can extend another dotted assignment, but cannot turn
// a declared table or a terminal value into a dotted key. An array-of-tables
// header always descends into its most recent member.
function define(namespace, path, kind) {
  for (const part of path.slice(0, -1)) {
    let entry = namespace.get(part);
    if (!entry) {
      entry = { kind: kind === 'value' ? 'dotted' : 'implicit', children: new Map() };
      namespace.set(part, entry);
    }
    if (!entry.children || (kind === 'value' && entry.kind !== 'dotted')) fail();
    namespace = entry.children;
  }
  const key = path.at(-1);
  const previous = namespace.get(key);
  if (kind === 'value') {
    if (previous) fail();
    namespace.set(key, { kind });
    return;
  }
  if (previous && (kind === 'array' ? previous.kind !== 'array' : previous.kind !== 'implicit')) fail();
  const children = kind === 'table' && previous ? previous.children : new Map();
  namespace.set(key, { kind, children });
  return children;
}

function validateValue(source, parts) {
  let i = 0;
  const peek = () => parts[i]?.value;
  function expect(token) {
    if (peek() !== token) fail();
    i++;
  }
  function value(depth) {
    const token = peek();
    if (!token || depth > 64) fail();
    if (token.startsWith('"') || token.startsWith("'")) {
      validateString(token);
      i++;
      return;
    }
    if (token === '[') {
      i++;
      while (peek() !== ']') {
        value(depth + 1);
        if (peek() === ']') break;
        expect(',');
      }
      expect(']');
      return;
    }
    if (token === '{') {
      let separator = parts[i++];
      const table = new Map();
      while (peek() !== '}') {
        const start = i;
        while (peek() && !['=', ',', '}'].includes(peek())) i++;
        const key = keys(parts.slice(start, i));
        expect('=');
        if (!parts[i] || source.slice(separator.end, parts[i].start).includes('\n')) fail();
        value(depth + 1);
        define(table, key, 'value');
        if (!parts[i] || source.slice(parts[i - 1].end, parts[i].start).includes('\n')) fail();
        if (peek() === '}') break;
        separator = parts[i];
        expect(',');
        if (peek() === '}') fail();
      }
      if (!table.size && source.slice(separator.end, parts[i].start).includes('\n')) fail();
      expect('}');
      return;
    }
    const start = i;
    while (peek() && ![',', ']', '}'].includes(peek())) i++;
    if (start === i) fail();
    validateScalar(source.slice(parts[start].start, parts[i - 1].end));
  }

  value(0);
  if (i !== parts.length) fail();
}

function patchConfig(source, binding) {
  const found = new Map();
  const tables = new Set();
  let table = [];
  const tablesByKey = new Map();
  let namespace = tablesByKey;
  for (const parts of statements(source)) {
    const first = parts[0].value;
    if (first === '[') {
      const array = parts[1]?.value === '[';
      const brackets = array ? 2 : 1;
      if (parts.slice(-brackets).some(part => part.value !== ']')) fail();
      if (source.slice(parts[0].start, parts.at(-1).end).includes('\n')) fail();
      if (array && (parts[0].end !== parts[1].start || parts.at(-2).end !== parts.at(-1).start)) fail();
      table = keys(parts.slice(brackets, -brackets));
      namespace = define(tablesByKey, table, array ? 'array' : 'table');
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
    const relative = keys(parts.slice(0, equal));
    define(namespace, relative, 'value');
    validateValue(source, parts.slice(equal + 1));
    const path = [...table, ...relative];
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
    next = next.slice(0, start) + tomlValue(binding.fields[key]) + next.slice(end);
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
  if (proposal.status !== 'configured' && patchConfig(proposal.next, binding).status !== 'configured') fail();
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
