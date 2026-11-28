import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyze, classifyArtifact } from '../src/core.js';

type Case = { id: string; language: string; files: Record<string, string[]>; expected: Record<string, string> };
const load = async (name: string) => (JSON.parse(await readFile(new URL(`../fixtures/precision/${name}`, import.meta.url), 'utf8')) as { cases: Case[] }).cases;
const suites = { H104: await load('h104-pairs.json'), H104a: await load('h104a-pairs.json') };

for (const [suite, cases] of Object.entries(suites)) {
  for (const entry of cases) {
    test(`${suite} twin ${entry.id}`, async () => {
      const set = { name: 'h104', artifacts: Object.entries(entry.files).map(([path, lines]) => classifyArtifact(path, lines.join('\n') + '\n')) };
      const practices = (await analyze(set)).practices;
      assert.deepEqual(Object.fromEntries(Object.keys(entry.expected).map(id => [id, practices.find(p => p.id === id)?.status])), entry.expected);
    });
  }
  test(`${suite} twins cover positives and negatives in both languages`, () => {
    for (const language of ['en', 'es']) {
      const own = cases.filter(c => c.language === language);
      assert.ok(own.some(c => c.expected['P2.1'] === 'partial') && own.some(c => c.expected['P2.1'] === 'missing'), language);
    }
  });
}
