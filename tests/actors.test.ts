import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyze, classifyArtifact } from '../src/core.js';

type Case = { id: string; language: string; files: Record<string, string[]>; expected: Record<string, string> };
const { cases } = JSON.parse(await readFile(new URL('../fixtures/precision/h104-pairs.json', import.meta.url), 'utf8')) as { cases: Case[] };

for (const language of ['en', 'es']) {
  test(`H104: role nouns in actor position, ${language} twins`, async () => {
    for (const entry of cases.filter(c => c.language === language)) {
      const set = { name: 'h104', artifacts: Object.entries(entry.files).map(([path, lines]) => classifyArtifact(path, lines.join('\n') + '\n')) };
      const practices = (await analyze(set)).practices;
      const actual = Object.fromEntries(Object.keys(entry.expected).map(id => [id, practices.find(p => p.id === id)?.status]));
      assert.deepEqual(actual, entry.expected, entry.id);
    }
  });
}

test('H104: twins cover positives and negative controls in both languages', () => {
  for (const language of ['en', 'es']) {
    const own = cases.filter(c => c.language === language);
    assert.ok(own.some(c => c.expected['P2.1'] === 'partial') && own.some(c => c.expected['P2.1'] === 'missing'), language);
  }
});
