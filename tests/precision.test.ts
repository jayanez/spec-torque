import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadEngine, repository } from '../scripts/precision/engines.js';
import { suppress } from '../scripts/precision/metrics.js';
import { commentLines, fencedLines, isolate, predictLine, quotedOnlyModal, segments } from '../scripts/precision/probe.js';
import { audit } from '../scripts/precision/audit-denominators.js';
import { clopperPearsonUpper, cohenKappa, score, type Kind, type ScoredItem } from '../scripts/precision/score.js';
import { z } from 'zod';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { headingChain, proseLines, sample, stratify } from '../scripts/precision/prose.js';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Ollama } from '../scripts/precision/ollama.js';
import { asPrediction, classifyItem, decide, parseAnswer, settledByStructure, userMessage, type Decision, type PacketItem } from '../scripts/precision/classify.js';

const label = z.enum(['positive', 'negative', 'unknown']);
const fixture = z.strictObject({ version: z.literal(1), description: z.string(), cases: z.array(z.strictObject({
  id: z.string(), family: z.string(), language: z.enum(['en', 'es']), path: z.string(),
  eol: z.enum(['\n', '\r\n']).optional(), bom: z.boolean().optional(), nfd: z.boolean().optional(),
  lines: z.array(z.string()).min(1),
  targets: z.array(z.strictObject({ line: z.number().int().positive(), admitted: z.boolean().nullable(),
    'E1.4': label, 'E1.2': label, note: z.string().optional(), kind: z.enum(['requirement', 'acceptance', 'other']).optional() })).min(1),
})) });
const cases = fixture.parse(JSON.parse(await readFile(new URL('../fixtures/precision/minimal-pairs.json', import.meta.url), 'utf8'))).cases;
const contentOf = (entry: (typeof cases)[number]) => {
  const text = (entry.bom ? '﻿' : '') + entry.lines.join(entry.eol ?? '\n');
  return entry.nfd ? text.normalize('NFD') : text;
};

test('minimal pairs have unique IDs, in-range targets and both languages per family', () => {
  assert.equal(new Set(cases.map(entry => entry.id)).size, cases.length);
  for (const entry of cases) for (const target of entry.targets) assert.ok(target.line <= entry.lines.length, entry.id);
  for (const family of ['fence-mismatch', 'fence-control', 'quoted-modal', 'comparator', 'requirement-wording', 'section-context', 'acceptance', 'non-requirement']) {
    assert.deepEqual(new Set(cases.filter(entry => entry.family === family).map(entry => entry.language)), new Set(['en', 'es']), family);
  }
});

test('expected kinds agree with expected admission', () => {
  for (const entry of cases) for (const target of entry.targets) {
    if (target.kind) assert.equal(target.admitted, target.kind === 'requirement', `${entry.id}:${target.line}`);
  }
  assert.ok(cases.filter(entry => entry.targets.some(target => target.kind === 'acceptance')).length >= 4);
});

test('the probe keeps separators, BOM and target bytes while blanking other candidates', () => {
  const content = '﻿The app MUST start.\r\n```\r\nFR-002 MUST stop.\r\n```\r\nThe app MUST log.';
  const probe = isolate(content, 5);
  assert.equal(probe, '\r\n```\r\n\r\n```\r\nThe app MUST log.');
  assert.equal(segments(probe).length, segments(content).length);
  assert.equal(isolate(content, 1).startsWith('﻿The app MUST start.\r\n'), true);
});

test('the fence oracle pairs characters and run lengths', () => {
  assert.deepEqual([...fencedLines('~~~\n```\nx\n```\n~~~\ny')], [1, 2, 3, 4, 5]);
  assert.deepEqual([...fencedLines('````\na\n```\nb\n````\nc')], [1, 2, 3, 4, 5]);
  assert.deepEqual([...fencedLines('```json``` x\ny')], []);
  assert.deepEqual([...fencedLines('```\na\n```text\nb\n```\nc')], [1, 2, 3, 4, 5]);
  assert.deepEqual([...commentLines('a\n<!-- b\nc -->\nd')], [2, 3]);
  assert.equal(quotedOnlyModal('Use `MUST` here.'), true);
  assert.equal(quotedOnlyModal('The app MUST use `SHALL`.'), false);
});

test('the current engine meets every control expectation', async () => {
  const engine = await loadEngine(repository);
  // Fence-mismatch (H1) and mentioned-modal families (H2–H2e, none adopted) remain known
  // engine 0.1.4 errors and are measured by the replay, not asserted here.
  for (const entry of cases.filter(item => ['fence-control', 'admission-control'].includes(item.family) || item.id === 'bom-first-line-en')) {
    const content = contentOf(entry);
    for (const target of entry.targets) {
      const prediction = await predictLine(engine, entry.path, content, target.line);
      const where = `${entry.id}:${target.line}`;
      if (target.admitted !== null) assert.equal(prediction.admitted, target.admitted, where);
      if (prediction.admitted) assert.equal(prediction['E1.4'], target['E1.4'], where);
      assert.notEqual(prediction.evidenceValid, false, where);
    }
  }
});

test('the probe takes the kind from classifyLines on the full document and keeps the practice path for older engines', async () => {
  const engine = await loadEngine(repository);
  const legacy = { ...engine, classifyLines: undefined } as unknown as typeof engine;
  const content = ['## Requirements', '- Validate the email address.', '- The service MUST log each login.', '- THEN the account is locked'].join('\n');
  // No modal and no ID: admitted only because the engine classifies lines, and not isolated from line 3.
  assert.deepEqual(await predictLine(engine, 'specs/001/spec.md', content, 2), { admitted: true, kind: 'requirement', 'E1.4': 'negative', 'E1.2': 'negative', evidenceValid: null });
  // A modal line reads the same on the classifyLines path and on the practice path (an engine without classifyLines).
  assert.deepEqual(await predictLine(engine, 'specs/001/spec.md', content, 3), await predictLine(legacy, 'specs/001/spec.md', content, 3));
  // Acceptance is reported as its own kind and is not admitted.
  assert.deepEqual(await predictLine(engine, 'specs/001/spec.md', content, 4), { admitted: false, kind: 'acceptance', 'E1.4': 'unknown', 'E1.2': 'unknown', evidenceValid: null });
});

test('the audit derives every denominator from fixture labels', () => {
  // 12 positive, 8 negative and 4 unknown references, as in the second synthetic calibration.
  const fixtures = [
    ...Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, label: 'positive', targetLine: `Line ${i} MUST log.` })),
    ...Array.from({ length: 8 }, (_, i) => ({ id: `n${i}`, label: 'negative', targetLine: `Note ${i}.` })),
    ...Array.from({ length: 4 }, (_, i) => ({ id: `u${i}`, label: 'unknown', targetLine: `Maybe ${i}.` })),
  ];
  const results = [
    ...fixtures.slice(0, 10).map((row, i) => ({ id: row.id, label: 'yes', evidence: i < 6 ? 'MUST log' : 'invented span' })),
    { id: 'p10', label: 'no' }, { id: 'p11', label: 'no' },
    ...fixtures.slice(12, 20).map(row => ({ id: row.id, label: 'no' })),
    ...fixtures.slice(20).map(row => ({ id: row.id, label: 'yes', evidence: 'Maybe' })),
  ];
  const report = audit(fixtures, results);
  assert.deepEqual(report.perClass, {
    positive: { correct: 10, denominator: 12 }, negative: { correct: 8, denominator: 8 }, unknown: { correct: 0, denominator: 4 },
  });
  assert.deepEqual([report.exactEvidence.numerator, report.exactEvidence.denominator], [6, 20]);
  assert.deepEqual([report.strictCorrect.numerator, report.strictCorrect.denominator], [14, 24]);
  assert.equal(report.confusion.referenceUnknown, 4);
  assert.equal(report.confusion.unknownDecided, 4);
  const missing = audit(fixtures, results.slice(1));
  assert.equal(missing.unanswered, 1);
  assert.equal(missing.confusion.positiveAbstentions, 1);
});

test('restricted aggregates suppress small line counts but keep recurrence totals exact', () => {
  assert.deepEqual(suppress({ roots: 3, documents: 4, failure: { repositories: 2, lineages: 1, distinctLines: 3 }, adjacent: { E1: { added: 0, removed: 7 } } }),
    { roots: 3, documents: '<5', failure: { repositories: 2, lineages: 1, distinctLines: '<5' }, adjacent: { E1: { added: 0, removed: 7 } } });
});

test('the audit keeps duplicate, missing and unparsable IDs out of the join', () => {
  const report = audit(
    [{ id: 'a', label: 'positive', targetLine: 'x MUST' }, { id: 'a', label: 'negative' }, { label: 'negative' }],
    [{ id: 'a', label: 'yes', evidence: 'MUST' }, { id: 'b', label: 'no' }, { __parseError: true }, { label: 'no' }],
  );
  assert.equal(report.duplicateFixtures, 1);
  assert.equal(report.fixturesWithoutId, 1);
  assert.equal(report.unmatchedResults, 1);
  assert.equal(report.parseErrors, 1);
  assert.equal(report.resultsWithoutId, 1);
  assert.deepEqual(report.perClass.positive, { correct: 1, denominator: 1 });
});

test('Clopper-Pearson bounds match the pre-registered examples', () => {
  assert.ok(Math.abs(clopperPearsonUpper(0, 59) - (1 - 0.05 ** (1 / 59))) < 1e-9);
  assert.ok(clopperPearsonUpper(0, 59) <= 0.05);
  assert.ok(clopperPearsonUpper(1, 100) <= 0.05);
  assert.ok(clopperPearsonUpper(2, 100) > 0.05);
  assert.ok(clopperPearsonUpper(3, 60) > 0.05);
  assert.equal(clopperPearsonUpper(5, 5), 1);
});

test('kappa is 1 for identical labels, 0 for chance agreement, null when degenerate', () => {
  assert.equal(cohenKappa([['a', 'a'], ['b', 'b']]), 1);
  assert.equal(cohenKappa([['a', 'a'], ['a', 'b'], ['b', 'a'], ['b', 'b']]), 0);
  assert.equal(cohenKappa([['a', 'a'], ['a', 'a']]), null);
  assert.equal(cohenKappa([]), null);
});

test('scoring counts by lineage and treats unknown as an error', () => {
  const make = (count: number, lineageOf: (index: number) => string, adjudicated: ScoredItem['adjudicated']): ScoredItem[] =>
    Array.from({ length: count }, (_, index) => ({ id: `${adjudicated}-${index}`, lineages: [lineageOf(index)], reviewerA: adjudicated, reviewerB: adjudicated, adjudicated }));
  // 100 admitted requirement lineages; lineage L0 has two items, one wrong.
  const good = make(100, index => `L${index}`, 'requirement');
  const bad: ScoredItem = { id: 'bad', lineages: ['L0'], reviewerA: 'other', reviewerB: 'other', adjudicated: 'other' };
  const acceptance = make(100, index => `A${index}`, 'acceptance');
  const predictions = (items: ScoredItem[], kind: Kind) => Object.fromEntries(items.map(item => [item.id, kind]));
  const base = { ...predictions(good, 'requirement'), ...predictions(acceptance, 'acceptance') };
  const clean = score([...good, ...acceptance], base);
  assert.equal(clean.pass, true);
  assert.equal(clean.precision.errorLineages, 0);
  const oneBad = score([...good, ...acceptance, bad], { ...base, bad: 'requirement' });
  assert.equal(oneBad.precision.lineages, 100);
  assert.equal(oneBad.precision.errorLineages, 1);
  assert.equal(oneBad.precision.pass, true);
  const unknown = score([...good, ...acceptance, { ...bad, id: 'u', adjudicated: 'unknown' }], { ...base, u: 'requirement' });
  assert.equal(unknown.precision.errorLineages, 1);
  // Missed requirements: recall counts every adjudicated requirement the arm does not admit.
  const missed = score([...good, ...acceptance], { ...base, 'requirement-0': 'other', 'requirement-1': 'other' });
  assert.equal(missed.recall.errorLineages, 2);
  assert.equal(missed.recall.pass, false);
  // Fewer than 100 lineages never passes.
  const small = score(good.slice(0, 50), predictions(good.slice(0, 50), 'requirement'));
  assert.equal(small.precision.pass, false);
  assert.match(small.precision.reason ?? '', /fewer than 100/);
  assert.deepEqual(score([bad], {}).missingPredictions, ['bad']);
});

test('heading chains ignore fenced headings and pop deeper levels', () => {
  const lines = ['# A', '## B', '### C', 'x', '## D', '```', '# not a heading', '```', 'y'];
  assert.deepEqual(headingChain(lines, 4), ['A', 'B', 'C']);
  assert.deepEqual(headingChain(lines, 9), ['A', 'D']);
});

test('prose lines skip structure and the seeded sample is reproducible', () => {
  const content = ['# Title', '', '- No schema change.', '> quoted', '```', 'code', '```', '<!-- c', 'hidden', '-->', '| --- | --- |', 'EL SISTEMA guardará el historial.'].join('\n');
  assert.deepEqual(proseLines(content), [3, 12]);
  const pool = Array.from({ length: 50 }, (_, index) => index);
  assert.deepEqual(sample(pool, 10, 42039), sample(pool, 10, 42039));
  assert.equal(new Set(sample(pool, 10, 42039)).size, 10);
  assert.notDeepEqual(sample(pool, 10, 42039), sample(pool, 10, 7));
});

test('stratified sampling caps each group and is reproducible', () => {
  const items = [...Array.from({ length: 30 }, (_, index) => ({ group: 'big', index })), ...Array.from({ length: 3 }, (_, index) => ({ group: 'small', index }))];
  const picked = stratify(items, item => item.group, 5, 42039);
  assert.equal(picked.filter(item => item.group === 'big').length, 5);
  assert.equal(picked.filter(item => item.group === 'small').length, 3);
  assert.deepEqual(picked, stratify(items, item => item.group, 5, 42039));
});

test('the prose packet is blind, reproducible and public-only', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'spectorque-prose-'));
  const repo = join(directory, 'repo');
  await mkdir(join(repo, 'specs/001-demo'), { recursive: true });
  const body = ['# Demo', '## Requirements', ...Array.from({ length: 12 }, (_, index) => `- The note number ${index} is informative.`), 'The system MUST log.'].join('\n');
  await writeFile(join(repo, 'specs/001-demo/spec.md'), body);
  const git = (...args: string[]) => execFileSync('git', ['-C', repo, ...args], { stdio: 'pipe' });
  git('init', '-q'); git('add', '.');
  git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'x');
  const roots = (restricted: boolean) => join(directory, restricted ? 'roots-restricted.json' : 'roots.json');
  for (const restricted of [false, true]) await writeFile(roots(restricted), JSON.stringify([{ id: 'demo', repository: 'demo', path: repo, ref: 'HEAD', restricted }]));
  const build = (out: string, restricted = false) => execFileSync('node', ['--import', 'tsx', 'scripts/precision/adjudication-packet.ts',
    '--population', 'prose', '--roots', roots(restricted), '--out', join(directory, out), '--sample', '8'], { cwd: repository, stdio: 'pipe' });
  build('a'); build('b');
  const read = async (name: string, file: string) => JSON.parse(await readFile(join(directory, name, file), 'utf8'));
  const first = await read('a', 'packet.json');
  assert.deepEqual(first, await read('b', 'packet.json'));
  assert.equal(first.items.length, 8);
  assert.deepEqual(first.items[0].headings, ['Demo', 'Requirements']);
  assert.deepEqual(await read('a', 'key.json'), {});
  assert.doesNotMatch(JSON.stringify(first), /direction|admitted|baseline|candidate/u);
  assert.throws(() => build('c', true));
  execFileSync('node', ['--import', 'tsx', 'scripts/precision/predict.ts', '--packet', join(directory, 'a/packet.json'), '--roots', roots(false),
    '--ref', 'HEAD', '--out', join(directory, 'predictions.json')], { cwd: repository, stdio: 'pipe' });
  const predictions = await read('.', 'predictions.json') as Record<string, string>;
  for (const item of first.items) assert.equal(predictions[item.id], /\bMUST\b/u.test(item.text) ? 'requirement' : 'other', item.text);
});

const packetItem = (text: string, headings: string[] = ['Requirements']): PacketItem => ({ id: 'x', text, headings, context: { before: ['a'], after: ['b'] } });

test('H4 sampling: four of five agree, a split abstains, abstention is scored as other', () => {
  assert.equal(decide(['requirement', 'requirement', 'requirement', 'requirement', 'other']), 'requirement');
  assert.equal(decide(['other', 'other', 'other', 'other', 'other']), 'other');
  assert.equal(decide(['requirement', 'requirement', 'requirement', 'other', 'other']), 'unknown');
  assert.equal(decide(['unknown', 'unknown', 'unknown', 'unknown', 'requirement']), 'unknown');
  assert.equal(asPrediction('unknown'), 'other');
  assert.equal(asPrediction('acceptance'), 'acceptance');
});

test('H4 answers outside the closed enum are unknown', () => {
  assert.equal(parseAnswer('{"kind":"requirement"}'), 'requirement');
  assert.equal(parseAnswer('noise {"kind":"acceptance"} noise'), 'acceptance');
  for (const bad of ['', '{"kind":"obligation"}', '{"kind":["other"]}', '{"other":1}', 'other']) assert.equal(parseAnswer(bad), 'unknown', bad);
});

test('H4 pre-filter: structure, change-log sections and questions get no model call', () => {
  assert.equal(settledByStructure(packetItem('- Is guest access allowed?')), true);
  assert.equal(settledByStructure(packetItem('- Added the audit trail.', ['Spec', 'Change log'])), true);
  assert.equal(settledByStructure(packetItem('> The system MUST log.')), true);
  assert.equal(settledByStructure(packetItem('- Validate the email address.')), false);
  assert.equal(JSON.parse(userMessage(packetItem('- Validate the email address.'))).line, '- Validate the email address.');
});

test('H4 client refuses non-loopback endpoints and classifies against a loopback server', async () => {
  assert.throws(() => new Ollama('http://example.com:11434'), /loopback/u);
  const seen: { seed: number; user: string }[] = [];
  let answer = (_seed: number) => '{"kind":"requirement"}';
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => {
      response.setHeader('content-type', 'application/json');
      if (request.url === '/api/tags') return void response.end(JSON.stringify({ models: [{ name: 'local:1', digest: 'abc' }, { name: 'cloud:1', digest: 'def', remote_host: 'https://x' }] }));
      if (request.url === '/api/version') return void response.end(JSON.stringify({ version: '9.9.9' }));
      const chat = JSON.parse(body) as { options: { seed: number; temperature: number }; messages: { content: string }[] };
      seen.push({ seed: chat.options.seed, user: chat.messages[1].content });
      response.end(JSON.stringify({ message: { content: answer(chat.options.seed) } }));
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const client = new Ollama(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    assert.deepEqual(await client.localModel('local:1'), { name: 'local:1', digest: 'abc', ollama: '9.9.9' });
    await assert.rejects(client.localModel('cloud:1'), /local Ollama model/u);
    await assert.rejects(client.localModel('missing'), /local Ollama model/u);
    const asked = await classifyItem(client, 'local:1', packetItem('- Validate the email address.'), true);
    assert.deepEqual(seen.map(call => call.seed), [42039, 42040, 42041, 42042, 42043]);
    assert.equal(asked.decision, 'requirement');
    seen.length = 0;
    const settled = await classifyItem(client, 'local:1', packetItem('- Is guest access allowed?'), true);
    assert.deepEqual([seen.length, settled.settled, settled.decision], [0, true, 'other']);
    answer = seed => seed === 42039 ? '{"kind":"requirement"}' : seed === 42040 ? 'not json' : '{"kind":"other"}';
    const split = await classifyItem(client, 'local:1', packetItem('- Validate the email address.'), true);
    assert.deepEqual([split.samples as Decision[], split.decision], [['requirement', 'unknown', 'other', 'other', 'other'], 'unknown']);
  } finally {
    server.close();
  }
});
