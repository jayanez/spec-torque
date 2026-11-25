// One product version, many copies. The root package.json is the source of truth;
// every file below carries a copy that `npm run version:sync` rewrites and
// tests/manifests.test.ts checks. Engine and rubric versions are independent
// (src/core/analyze.ts) and are never touched here.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const json = (path, get, set) => ({ path, kind: 'json', get, set });

export const VERSION_TARGETS = [
  json('integrations/claude/.claude-plugin/plugin.json', m => m.version, (m, v) => { m.version = v; }),
  json('integrations/claude/package.json', m => m.version, (m, v) => { m.version = v; }),
  json('integrations/codex/plugin.json', m => m.version, (m, v) => { m.version = v; }),
  json('integrations/codex/package.json', m => m.version, (m, v) => { m.version = v; }),
  json('integrations/opencode/package.json', m => m.version, (m, v) => { m.version = v; }),
  json('integrations/pi/package.json', m => m.version, (m, v) => { m.version = v; }),
  json('integrations/vscode/package.json', m => m.version, (m, v) => { m.version = v; }),
  json('.claude-plugin/marketplace.json', m => m.plugins[0].source.version, (m, v) => { m.plugins[0].source.version = v; }),
  json('.agents/plugins/marketplace.json', m => m.plugins[0].source.version, (m, v) => { m.plugins[0].source.version = v; }),
  { path: 'CITATION.cff', kind: 'text', get: t => /^version: (.+)$/mu.exec(t)?.[1], set: (t, v) => t.replace(/^version: .+$/mu, 'version: ' + v) },
];

export async function productVersion() {
  return JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).version;
}

export async function readTarget(target) {
  const text = await readFile(resolve(root, target.path), 'utf8');
  return target.kind === 'json' ? target.get(JSON.parse(text)) : target.get(text);
}

export async function writeTarget(target, version) {
  const file = resolve(root, target.path);
  const text = await readFile(file, 'utf8');
  if (target.kind === 'text') return writeFile(file, target.set(text, version));
  const manifest = JSON.parse(text);
  target.set(manifest, version);
  await writeFile(file, JSON.stringify(manifest, null, 2) + '\n');
}
