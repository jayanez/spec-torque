import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
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

const root = await realpath(resolve(process.argv[2] ?? '/private/tmp/spec58-natural'));
const manifest = z.object({ sources: z.array(sourceSchema.extend({ family: z.string() })) }).parse(JSON.parse(await readFile(new URL('../../fixtures/precision/r52-dev-sources.json', import.meta.url), 'utf8')));
const index = indexSchema.parse(JSON.parse(await readFile(join(root, 'index.json'), 'utf8')));
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
  for (const document of source.documents ?? []) {
    if (!document.local) {
      ledger.skipped.push({ path: document.path, reason: document.error ?? 'missing download' });
      continue;
    }
    let data: Buffer;
    try {
      const file = await realpath(join(root, repo, document.local));
      if (relative(root, file) !== join(repo, document.local)) throw new Error('Unexpected download target');
      data = await readFile(file);
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
    const negatives: { block: Passage; selector: string }[] = [];
    function emit(block: Passage, practice: string | null, cues: string[]) {
      const result = assessment.practices.find(item => item.id === practice);
      for (const cue of cues) counts[cue] = (counts[cue] ?? 0) + 1;
      console.log(JSON.stringify({
        record: practice ? 'lead' : 'negative-sample', practice, cues,
        repository: source.repository, revision: source.commit, manifestLicense: source.license, licenseCheck: source.licenseCheck ?? null,
        path: document.path, documentHash, fragmentHash: hash(normalize(block.text)),
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
      }
      for (const { practice, cues } of hits) emit(block, practice, cues);
      if (!hits.length && block.kind !== 'heading' && /\p{L}{3}/u.test(block.text)) {
        negatives.push({ block, selector: hash(JSON.stringify([source.repository, source.commit, document.path, block.start])) });
      }
    }
    negatives.sort((a, b) => a.selector.localeCompare(b.selector));
    if (negatives.length) emit(negatives[0].block, null, ['uncaught-window-sample']);
  }
}
console.error(JSON.stringify({
  engineVersion: ENGINE_VERSION, rubricVersion: RUBRIC_VERSION, counts, coverage, absent: [...pinned.keys()].filter(repo => !index.some(source => source.repository === repo)),
  crossRepositoryFragments: [...fragments].filter(([, entries]) =>
    new Set(entries.map(entry => entry.repository)).size > 1).map(([fragmentHash, occurrences]) => ({ fragmentHash, occurrences })),
  unassessed: { 'C2.3': 'The authorized download index contains specs only. This check needs a task companion.' },
}, null, 2));
