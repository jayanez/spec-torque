import assert from 'node:assert/strict';
import { test } from 'node:test';
import { leadsFor, passagesOf, scenarioPairs } from './context-rules.js';
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

test('adjacent exceptional scenario steps retain their source span', () => {
  for (const [heading, when, then] of [
    ['Scenario: Missing option', '- **WHEN** no `--port` is given', '- **THEN** the runner returns an error'],
    ['Escenario: Sin configuración', '- **CUANDO** la clave no tiene valor configurado', '- **ENTONCES** el cliente utiliza el valor predeterminado'],
  ]) {
    const [scenario] = scenarioPairs(parse(['### ' + heading, when, then].join('\n')));
    assert.deepEqual([scenario.start, scenario.end, scenario.text], [2, 3, when + '\n' + then]);
    assert.deepEqual(leadsFor(scenario), [{ practice: 'E3.3', cues: ['missing-setting-scenario'] }]);
    for (const separator of ['### Other scenario', '- AND the session is active', '', '~~~\nomitted text\n~~~']) {
      assert.deepEqual(scenarioPairs(parse(['### ' + heading, when, separator, then].join('\n'))), [], separator);
    }
    assert.deepEqual(scenarioPairs(parse([when, then].join('\n'))), []);
  }
});

test('one-column Markdown table rows keep their own evidence', () => {
  const rows = parse('| Context |\n|:---:|\n| Provider |\n| Retry |');
  assert.deepEqual(rows.map(row => [row.kind, row.start, row.end]), [
    ['table', 1, 1], ['table', 3, 3], ['table', 4, 4],
  ]);
  assert.deepEqual(rows.flatMap(leadsFor), []);
  assert.ok(parse('| Context | Outcome |\n|:---:|\n| Provider | Retry |').every(row => row.kind !== 'table'));
  assert.ok(parse('| Context |\n|---|---|\n| Provider | Retry |').every(row => row.kind !== 'table'));
  assert.ok(parse('| Context |\n---\n| Provider |').every(row => row.kind !== 'table'));
});

test('later empty conditions are evaluated with their own outcome', () => {
  const cue = (text: string) => parse(text).flatMap(leadsFor)
    .some(lead => lead.cues.includes('empty-condition-and-outcome'));
  assert.ok(cue('When diagnostics are on, log the request. When the inbox is empty, show a notice.'));
  assert.ok(cue('Si el servicio está ocupado, espera; si el buzón está vacío, se mostrará un aviso.'));
  assert.ok(cue('When the inbox is empty, record when it became empty and show a notice.'));
  assert.ok(cue('When the inbox is empty, record where and when it was last accessed, then show a notice.'));
  assert.ok(cue('When the inbox is empty, log the server name and when it last synced, then show a notice.'));
  assert.ok(cue('When the inbox is empty, log the server name and when it last synced successfully, then show a notice.'));
  assert.ok(cue('When polling is enabled, log the server name and when it last synced is unknown and the inbox is empty, then show a notice.'));
  assert.ok(cue('When the inbox is empty and when polling is enabled, show a notice.'));
  assert.ok(cue('When polling is enabled, log the request and when the inbox is empty, show a notice.'));
  assert.ok(!cue('When the inbox is empty, wait and when a message arrives, show a notice.'));
  assert.ok(!cue('When the inbox is empty, log the server name and when a message arrives, then show a notice.'));
  assert.ok(!cue('When the inbox is empty, log the server name and when it last tried to show a notice, then wait.'));
  assert.ok(!cue('When polling is enabled, log the server name and when it last reported no results, then show a notice.'));
});

test('cached bytes must be the Git blob at the pinned path, even for an old index', async () => {
  const { createHash } = await import('node:crypto');
  const { mkdir, mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const root = await mkdtemp(join(tmpdir(), 'spike58-blob-'));
  const repository = 'github.com/kcalvelli/cairn';
  const commit = '712dc76d47efd44f2affc5a07865cd26231ef3e6';
  const path = 'openspec/specs/synthetic/spec.md';
  const text = Buffer.from('# Example\n\nWhen the mailbox is empty, show a notice.\n');
  const sha = createHash('sha1').update(`blob ${text.length}\0`).update(text).digest('hex');
  const mock = join(root, 'mock.mjs');
  const tree = [{ type: 'blob', mode: '100644', path, sha }];
  const doc = join(root, 'kcalvelli/cairn/0.md');
  async function run(pathInIndex: string, data: Buffer | string) {
    await writeFile(doc, data);
    await writeFile(join(root, 'index.json'), JSON.stringify([
      { repository, commit, license: 'MIT', documents: [{ path: pathInIndex, local: '0.md' }] },
    ]));
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--import', mock, 'scripts/spike-58/scan-context.ts', root], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return { coverage: JSON.parse(result.stderr).coverage[0], stdout: result.stdout };
  }
  try {
    await mkdir(join(root, 'kcalvelli/cairn'), { recursive: true });
    await writeFile(mock, `globalThis.fetch = async url => {
      if (url !== 'https://api.github.com/repos/kcalvelli/cairn/git/trees/${commit}?recursive=1') throw new Error(url);
      return Response.json(${JSON.stringify({ tree, truncated: false })});
    };`);
    const valid = await run(path, text);
    assert.equal(valid.coverage.scanned, 1);
    assert.match(valid.stdout, /empty-condition-and-outcome/u);
    for (const result of [await run(path, 'altered bytes'), await run('openspec/specs/other/spec.md', text)]) {
      assert.equal(result.stdout, '');
      assert.match(result.coverage.skipped[0].reason, /Git blob mismatch/u);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
