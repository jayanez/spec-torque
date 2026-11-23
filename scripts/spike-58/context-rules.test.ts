import assert from 'node:assert/strict';
import { test } from 'node:test';
import { leadsFor, passagesOf } from './context-rules.js';
import { analyze } from '../../src/core/analyze.js';
import { classifyArtifact } from '../../src/core/artifacts.js';

const parse = (text: string) => passagesOf(text.split(/\r?\n/u));
const practices = (text: string) => parse(text).flatMap(passage => leadsFor(passage).map(lead => lead.practice));

test('wrapped EN and ES dependency handling keeps the exact line range', () => {
  for (const text of [
    '- If the upstream stops responding,\n  try twice more.',
    '- Si el servicio externo deja de responder,\r\n  intentar dos veces más.',
  ]) {
    const [passage] = parse(text);
    assert.deepEqual([passage.start, passage.end, passage.kind], [1, 2, 'list']);
    assert.ok(leadsFor(passage).some(lead => lead.practice === 'P1.4'));
  }
});

test('headings, list items, table rows and fences isolate signals', () => {
  assert.deepEqual(practices('The provider\n\n## Other\nTry again.'), []);
  assert.deepEqual(practices('- The provider\n- Try again.'), []);
  assert.deepEqual(practices('Context | Outcome\n--- | ---\nProvider | n/a\nOther | retry'), []);
  assert.deepEqual(practices('~~~md\n```\nThe provider timeout: retry.\n~~~'), []);
  const row = parse('# Rules\nException | Response\n--- | ---\nInvalid | reject').at(-1)!;
  assert.equal(row.tableHeader, 'Exception | Response');
  assert.deepEqual(row.headings, ['Rules']);
  assert.equal(row.start, 4);
  assert.ok(leadsFor(row).some(lead => lead.practice === 'P2.2'));
});

test('a Spanish passage can emit multiple practices and multiple reasons', () => {
  const [passage] = parse('Criterios de aceptación para casos límite: rechazar entrada fuera de rango.');
  assert.deepEqual(leadsFor(passage), [
    { practice: 'P2.2', cues: ['spanish-plural', 'exception-and-response'] },
    { practice: 'E3.1', cues: ['criteria-wording'] },
  ]);
});

test('a Spanish ID can be a lead even when the engine returns unknown', async () => {
  const text = 'RF-1: El servicio guardará el registro.';
  assert.deepEqual(leadsFor(parse(text)[0]), [{ practice: 'I1.2', cues: ['known-spanish-id'] }]);
  const result = await analyze({ name: 'synthetic', artifacts: [classifyArtifact('spec.md', text)] });
  assert.equal(result.practices.find(item => item.id === 'I1.2')?.status, 'unknown');
});

test('CLI reports a missing local download and rejects out-of-scope index entries', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const root = await mkdtemp(join(tmpdir(), 'spike58-context-'));
  const source = {
    repository: 'github.com/kcalvelli/cairn', commit: '712dc76d47efd44f2affc5a07865cd26231ef3e6', license: 'MIT',
  };
  const run = async (path: string) => {
    await writeFile(join(root, 'index.json'), JSON.stringify([{ ...source, matching: 1, documents: [{ path, local: '0.md' }] }]));
    return spawnSync(process.execPath, ['--import', 'tsx', 'scripts/spike-58/scan-context.ts', root], { encoding: 'utf8' });
  };
  try {
    const missing = await run('openspec/specs/synthetic/spec.md');
    assert.equal(missing.status, 0, missing.stderr);
    assert.equal(missing.stdout, '');
    assert.equal(JSON.parse(missing.stderr).coverage[0].skipped.length, 1);
    const excluded = await run('openspec/specs/synthetic/tasks.md');
    assert.notEqual(excluded.status, 0);
    assert.match(excluded.stderr, /unauthorized DEV sources/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('empty-input search requires a condition and an explicit outcome in the same passage', () => {
  for (const text of [
    'What happens when a feed has no content? A placeholder is created.',
    'Si el buzón está vacío, se mostrará un aviso.',
  ]) {
    assert.ok(leadsFor(parse(text)[0]).some(lead =>
      lead.practice === 'P2.2' && lead.cues.includes('empty-condition-and-outcome')));
  }
  for (const text of [
    '## When the inbox is empty, a placeholder is created',
    'When the inbox is empty, decide later.',
    'When the inbox is empty.\n\nA placeholder is created.',
    'When the inbox has messages, a placeholder is created.',
    'The inbox is empty. The docs mention that a placeholder is created.',
    'When diagnostics are enabled, consult `--empty`. See `output create`.',
  ]) assert.ok(!parse(text).some(passage => leadsFor(passage).some(lead =>
    lead.cues.includes('empty-condition-and-outcome'))), text);
});
