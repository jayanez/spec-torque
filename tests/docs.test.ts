import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { ENGINE_VERSION, RUBRIC_VERSION } from '../src/core/analyze.js';

const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const markdown = ['README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', ...readdirSync('docs').filter(f => f.endsWith('.md')).map(f => 'docs/' + f),
  'docs/assets/README.md', ...['claude', 'codex', 'opencode', 'pi', 'vscode'].map(h => `integrations/${h}/README.md`)];
// Documents that describe the current release; qualification records are historical and exempt.
const CURRENT = ['README.md', 'docs/releases.md', 'docs/integrations.md', 'docs/es.md', ...['claude', 'codex', 'opencode', 'pi', 'vscode'].map(h => `integrations/${h}/README.md`)];

// GitHub heading anchors: lower case, punctuation dropped, spaces to hyphens.
const slug = (heading: string) => heading.trim().toLowerCase().replace(/[`*_]/gu, '').replace(/[^\p{L}\p{N} -]/gu, '').replace(/ /gu, '-');
const anchors = (path: string) => new Set(readFileSync(path, 'utf8').split('\n').filter(l => /^#{1,6} /u.test(l)).map(l => slug(l.replace(/^#+ /u, ''))));
const withoutCode = (text: string) => text.replace(/```[\s\S]*?```/gu, '').replace(/`[^`\n]*`/gu, '');

test('relative links and images in the documentation resolve', () => {
  const broken: string[] = [];
  for (const file of markdown) {
    const text = withoutCode(readFileSync(file, 'utf8'));
    const targets = [...text.matchAll(/\]\(([^)\s]+)\)/gu), ...text.matchAll(/(?:src|href)="([^"]+)"/gu)].map(m => m[1]);
    for (const target of targets) {
      if (/^(?:[a-z]+:|\/\/)/iu.test(target)) continue;
      const [path, anchor] = target.split('#');
      const resolved = path ? resolve(dirname(file), decodeURIComponent(path)) : resolve(file);
      if (!existsSync(resolved)) { broken.push(`${file}: ${target}`); continue; }
      if (anchor && resolved.endsWith('.md') && !anchors(resolved).has(anchor)) broken.push(`${file}: ${target} (anchor)`);
    }
  }
  assert.deepEqual(broken, []);
});

test('current install documentation names only the current product version', () => {
  const stale: string[] = [];
  for (const file of CURRENT) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/(?:spectorque[\w-]*@|spectorque[\w-]*-)(\d+\.\d+\.\d+)/gu)) if (m[1] !== version) stale.push(`${file}: ${m[0]}`);
  }
  assert.deepEqual(stale, [], `Expected ${version}; update the install docs (historical records belong elsewhere)`);
});

test('README version badges match the product, engine and rubric', () => {
  const readme = readFileSync('README.md', 'utf8');
  assert.ok(readme.includes(`badge/product-${version}-`), 'product badge');
  assert.ok(readme.includes(`badge/engine-${ENGINE_VERSION}-`), 'engine badge');
  assert.ok(readme.includes(`badge/rubric-${RUBRIC_VERSION.replaceAll('-', '--')}-`), 'rubric badge');
  assert.ok(readFileSync('docs/rubric.md', 'utf8').includes(`Rubric \`${RUBRIC_VERSION}\`, used by engine ${ENGINE_VERSION}`), 'rubric reference');
  assert.ok(readFileSync('CHANGELOG.md', 'utf8').includes(`## ${version}`), 'changelog section');
});
