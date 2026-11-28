import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open, readFile, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
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

const familyPaths: Record<string, RegExp> = {
  openspec: /(?:^|\/)openspec\/specs\/(?:.*\/)?spec\.md$/iu,
  'spec-kit': /^specs\/(?:.*\/)?spec\.md$/iu,
  'spec-kitty': /(?:^|\/)kitty-specs\/(?:.*\/)?spec\.md$/iu,
  kiro: /(?:^|\/)\.kiro\/specs\/(?:.*\/)?requirements\.md$/iu,
  bmad: /(?:^|\/)_bmad-output\/(?:.*\/)?prd\.md$/iu,
};

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

async function readCacheFile(path: string, limit?: number) {
  if (await realpath(path) !== path) throw new Error('Unexpected cache file target');
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error('Unexpected non-regular cache file');
    if (limit === undefined) return await handle.readFile();
    if (stat.size > limit) throw new Error('Cached document exceeds 1 MB');
    const buffer = Buffer.alloc(stat.size + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
      if (!bytesRead) break;
      offset += bytesRead;
    }
    if (offset !== stat.size) throw new Error('Cached document size changed during read');
    return buffer.subarray(0, offset);
  } finally {
    await handle.close();
  }
}

const root = await realpath(resolve(process.argv[2] ?? '/private/tmp/spec58-natural'));
const manifest = z.object({ sources: z.array(sourceSchema.extend({ family: z.string() })) }).parse(JSON.parse(await readFile(new URL('../../fixtures/precision/r52-dev-sources.json', import.meta.url), 'utf8')));
const index = indexSchema.parse(JSON.parse((await readCacheFile(join(root, 'index.json'))).toString('utf8')));
const pinned = new Map(manifest.sources.map(source => [source.repository, source]));
if (new Set(index.map(source => source.repository)).size !== index.length || index.some(source => {
  const pin = pinned.get(source.repository);
  const docs = source.documents ?? [];
  const downloads = docs.flatMap(doc => doc.local ? [doc.local] : []);
  return !pin || pin.commit !== source.commit || pin.license !== source.license ||
    new Set(docs.map(doc => doc.path)).size !== docs.length || new Set(downloads).size !== downloads.length ||
    docs.some(doc => /[\\]/u.test(doc.path) || doc.path.split('/').some(part => !part || part === '.' || part === '..') ||
      !familyPaths[pin.family]?.test(doc.path));
})) throw new Error('Index contains duplicate or unauthorized DEV sources');

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
      data = await readCacheFile(join(root, repo, document.local), 1_000_000);
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
console.error(JSON.stringify({
  engineVersion: ENGINE_VERSION, rubricVersion: RUBRIC_VERSION, counts, coverage, absent: [...pinned.keys()].filter(repo => !index.some(source => source.repository === repo)),
  crossRepositoryFragments: [...fragments].filter(([, entries]) =>
    new Set(entries.map(entry => entry.repository)).size > 1).map(([fragmentHash, occurrences]) => ({ fragmentHash, occurrences })),
  unassessed: { 'C2.3': 'The authorized download index contains specs only. This check needs a task companion.' },
}, null, 2));
