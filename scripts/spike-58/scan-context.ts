import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { analyze, ENGINE_VERSION, RUBRIC_VERSION } from '../../src/core/analyze.js';
import { z } from 'zod';
import { leadsFor, normalize, passagesOf, scenarioPairs, type Passage } from './context-rules.js';
import { classifyArtifact } from '../../src/core/artifacts.js';

const sourceSchema = z.object({ repository: z.string(), commit: z.string(), license: z.string() });
const indexSchema = z.array(sourceSchema.extend({
  matching: z.number().int().nonnegative().optional(),
  tree_truncated: z.boolean().optional(),
  licenseCheck: z.object({ path: z.string().nullable(), status: z.enum(['matched-root-license', 'unverified']) }).optional(),
  error: z.string().optional(),
  documents: z.array(z.object({ path: z.string(), local: z.string().regex(/^\d+\.md$/u).optional(),
    error: z.string().optional() })).optional(),
}));

const hash = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');
const gitBlob = (data: Buffer) => createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
const treeSchema = z.object({ truncated: z.boolean(), tree: z.array(z.object({
  type: z.string(), mode: z.string(), path: z.string(), sha: z.string().regex(/^[a-f0-9]{40}$/u),
})) });

async function pinnedBlobs(repository: string, revision: string) {
  const response = await fetch(`https://api.github.com/repos/${repository}/git/trees/${revision}?recursive=1`, {
    signal: AbortSignal.timeout(25_000), redirect: 'error',
  });
  if (!response.ok) throw new Error(`Cannot verify pinned tree: HTTP ${response.status}`);
  const { tree, truncated } = treeSchema.parse(await response.json());
  if (truncated) throw new Error('Cannot verify paths against a truncated Git tree');
  return new Map(tree.filter(entry => entry.type === 'blob' && /^(100644|100755)$/u.test(entry.mode))
    .map(entry => [entry.path, entry.sha]));
}

// Use the shared POSIX reader to open every cache component relative to an
// already-open directory and validate index paths before sending any bytes.
const root = process.argv[2] ?? '/private/tmp/spec58-natural';
const reader = spawn('python3', ['-B', fileURLToPath(new URL('./dev_cache.py', import.meta.url)), root],
  { stdio: ['ignore', 'pipe', 'inherit'] });
const exit = new Promise<number>(resolve => {
  reader.once('close', code => resolve(code ?? 1));
  reader.once('error', error => {
    console.error(error.message);
    resolve(1);
  });
});
const records = createInterface({ input: reader.stdout, crlfDelay: Infinity })[Symbol.asyncIterator]();
const readRecord = async () => {
  const entry = await records.next();
  if (entry.done) throw new Error(`DEV cache reader ended before completing (exit ${await exit})`);
  return JSON.parse(entry.value) as unknown;
};
const recordSchema = z.union([z.object({ data: z.string() }), z.object({ error: z.string() })]);
const index = indexSchema.parse(await readRecord());
const manifest = z.object({ sources: z.array(sourceSchema) }).parse(JSON.parse(await readFile(
  new URL('../../fixtures/precision/r52-dev-sources.json', import.meta.url), 'utf8')));

const counts: Record<string, number> = {};
const coverage = [];
const fragments = new Map<string, { repository: string; revision: string; path: string; start: number; end: number }[]>();
for (const source of index) {
  const repo = source.repository.replace(/^github\.com\//u, '');
  const ledger = { repository: source.repository, indexed: source.documents?.length ?? 0,
    matching: source.matching ?? null, downloaded: source.documents?.filter(doc => doc.local).length ?? 0, scanned: 0, truncated: source.tree_truncated ?? null,
    sourceError: source.error ?? null, licenseCheck: source.licenseCheck ?? null, skipped: [] as { path: string; reason: string }[] };
  coverage.push(ledger);
  let blobs: ReturnType<typeof pinnedBlobs> | undefined;
  for (const document of source.documents ?? []) {
    if (!document.local) {
      ledger.skipped.push({ path: document.path, reason: document.error ?? 'missing download' });
      continue;
    }
    let data: Buffer;
    try {
      const record = recordSchema.parse(await readRecord());
      if ('error' in record) throw new Error(record.error);
      data = Buffer.from(record.data, 'base64');
      blobs ??= pinnedBlobs(repo, source.commit);
      if ((await blobs).get(document.path) !== gitBlob(data)) throw new Error('Git blob mismatch for pinned path');
    } catch (error) {
      ledger.skipped.push({ path: document.path, reason: String(error) });
      continue;
    }
    const content = data.toString('utf8');
    const artifact = classifyArtifact(document.path, content);
    if (artifact.role !== 'spec' || artifact.archived) {
      ledger.skipped.push({ path: document.path, reason: 'not an active spec' });
      continue;
    }
    ledger.scanned++;
    const lines = content.split(/\r?\n/u);
    const blocks = passagesOf(lines);
    const assessment = await analyze({ name: document.path, artifacts: [artifact] });
    const documentHash = hash(data);
    let negative: { block: Passage; selector: string } | undefined;
    function emit(block: Passage, fragmentHash: string, practice: string | null, cues: string[]) {
      const result = assessment.practices.find(item => item.id === practice);
      for (const cue of cues) counts[cue] = (counts[cue] ?? 0) + 1;
      console.log(JSON.stringify({
        record: practice ? 'lead' : 'negative-sample', practice, cues,
        repository: source.repository, revision: source.commit, manifestLicense: source.license, licenseCheck: source.licenseCheck ?? null,
        path: document.path, documentHash, fragmentHash,
        ...block, contextStart: Math.max(1, block.start - 2),
        context: lines.slice(Math.max(0, block.start - 3), block.end + 2),
        scanScope: 'single-spec',
        observation: result && {
          documentStatus: result.status, reason: result.reason, documentEvidence: result.evidence,
          passageEvidence: result.evidence.filter(e => e.path === document.path && e.line >= block.start && e.line <= block.end),
          findings: assessment.findings.filter(f => f.practiceId === practice &&
            f.evidence.some(e => e.path === document.path && e.line >= block.start && e.line <= block.end)),
        },
      }));
    }
    for (const block of [...blocks, ...scenarioPairs(blocks)]) {
      const hits = leadsFor(block);
      if (hits.length) {
        const fingerprint = hash(normalize(block.text));
        const occurrences = fragments.get(fingerprint) ?? [];
        occurrences.push({ repository: source.repository, revision: source.commit, path: document.path,
          start: block.start, end: block.end });
        fragments.set(fingerprint, occurrences);
        for (const { practice, cues } of hits) emit(block, fingerprint, practice, cues);
      } else if (block.kind !== 'heading' && /\p{L}{3}/u.test(block.text)) {
        const selector = hash(JSON.stringify([source.repository, source.commit, document.path, block.start]));
        if (!negative || selector < negative.selector) negative = { block, selector };
      }
    }
    if (negative) emit(negative.block, hash(normalize(negative.block.text)), null, ['uncaught-window-sample']);
  }
}
if (!(await records.next()).done || await exit !== 0) throw new Error('DEV cache reader failed');
console.error(JSON.stringify({
  engineVersion: ENGINE_VERSION, rubricVersion: RUBRIC_VERSION, counts, coverage,
  absent: manifest.sources.map(source => source.repository).filter(repo => !index.some(source => source.repository === repo)),
  crossRepositoryFragments: [...fragments].filter(([, entries]) =>
    new Set(entries.map(entry => entry.repository)).size > 1).map(([fragmentHash, occurrences]) => ({ fragmentHash, occurrences })),
  unassessed: { 'C2.3': 'The authorized download index contains specs only. This check needs a task companion.' },
}, null, 2));
