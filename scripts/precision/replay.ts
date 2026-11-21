/**
 * Paired detector replay for #39.
 *
 *   synthetic: replay fixtures/precision/minimal-pairs.json on two committed engine revisions.
 *   scan:      replay committed Markdown snapshots of local Git roots on two engine revisions.
 *
 * Scan roots marked `restricted` never print or store source text. Their per-line locators go
 * only to an operator directory, and stdout carries global aggregate counts.
 */
import { execFileSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { platform, release, tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { archiveEngine, commit, repository } from './engines.js';
import { confusion, suppress } from './metrics.js';
import { candidateLines, commentLines, fencedLines, quotedOnlyModal, lineLanguage, predictLine, segments, sha256, type LinePrediction } from './probe.js';

const label = z.enum(['positive', 'negative', 'unknown']);
const caseSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/u),
  family: z.string().min(1),
  language: z.enum(['en', 'es']),
  path: z.string().regex(/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*\.md$/u),
  eol: z.enum(['\n', '\r\n']).optional(),
  bom: z.boolean().optional(),
  nfd: z.boolean().optional(),
  lines: z.array(z.string()).min(1),
  targets: z.array(z.strictObject({
    line: z.number().int().positive(), admitted: z.boolean().nullable(), 'E1.4': label, 'E1.2': label, note: z.string().optional(),
  })).min(1),
});
export const fixtureSchema = z.strictObject({ version: z.literal(1), description: z.string(), cases: z.array(caseSchema).min(1) });
export type SyntheticCase = z.infer<typeof caseSchema>;

export function contentOf(entry: SyntheticCase): string {
  const text = (entry.bom ? '﻿' : '') + entry.lines.join(entry.eol ?? '\n');
  return entry.nfd ? text.normalize('NFD') : text;
}

const rootSchema = z.array(z.strictObject({
  id: z.string().regex(/^[A-Za-z0-9_.-]+$/u),
  /** Repository identity used for independence; clones of one upstream share it. */
  repository: z.string().min(1),
  path: z.string().min(1),
  ref: z.string().default('HEAD'),
  restricted: z.boolean(),
})).min(1);
type Root = z.infer<typeof rootSchema>[number];

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    baseline: { type: 'string' }, candidate: { type: 'string', default: 'HEAD' },
    fixture: { type: 'string', default: 'fixtures/precision/minimal-pairs.json' },
    roots: { type: 'string' }, out: { type: 'string' },
  },
});
const mode = positionals[0];
if (!['synthetic', 'scan'].includes(mode ?? '') || !values.baseline || (mode === 'scan' && !values.roots)) {
  throw new Error('Use: replay.ts synthetic --baseline <ref> [--candidate <ref>] | scan --baseline <ref> --roots <roots.json> [--out <dir>]');
}

const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
async function policyHash(extra: Buffer[]) {
  const files = ['scripts/precision/replay.ts', 'scripts/precision/probe.ts', 'scripts/precision/metrics.ts', 'scripts/precision/engines.ts'];
  const bytes = await Promise.all(files.map(file => readFile(join(repository, file))));
  return sha256(Buffer.concat([...bytes, ...extra]));
}

const temp = await mkdtemp(join(tmpdir(), 'spectorque-precision-'));
const revisions = { baseline: commit(values.baseline), candidate: commit(values.candidate!) };
const arms = {
  baseline: await archiveEngine(revisions.baseline, join(temp, 'baseline')),
  candidate: await archiveEngine(revisions.candidate, join(temp, 'candidate')),
};
const environment = { node: process.version, platform: platform(), release: release() };
const identity = {
  revisions, engines: { baseline: arms.baseline.ENGINE_VERSION, candidate: arms.candidate.ENGINE_VERSION },
  rubric: { baseline: arms.baseline.RUBRIC_VERSION, candidate: arms.candidate.RUBRIC_VERSION },
  repositoryHead: commit('HEAD'), environment,
};

async function synthetic() {
  const bytes = await readFile(join(repository, values.fixture!));
  const fixture = fixtureSchema.parse(JSON.parse(bytes.toString()));
  interface Row {
    caseId: string; family: string; language: 'en' | 'es'; line: number; inputHash: string;
    expected: SyntheticCase['targets'][number]; oracleFenced: boolean;
    baseline: LinePrediction; candidate: LinePrediction; changed: boolean;
  }
  const rows: Row[] = [];
  for (const entry of fixture.cases) {
    const content = contentOf(entry);
    const fenced = fencedLines(content);
    for (const target of entry.targets) {
      const [baseline, candidate] = await Promise.all([
        predictLine(arms.baseline, entry.path, content, target.line),
        predictLine(arms.candidate, entry.path, content, target.line),
      ]);
      rows.push({
        caseId: entry.id, family: entry.family, language: entry.language, line: target.line,
        inputHash: sha256(content), expected: target, oracleFenced: fenced.has(target.line), baseline, candidate,
        changed: JSON.stringify(baseline) !== JSON.stringify(candidate),
      });
    }
  }
  const groups = new Map<string, typeof rows>();
  for (const row of rows) for (const key of [`${row.family} / ${row.language}`, `all / ${row.language}`]) {
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const admission = (subset: typeof rows, side: 'baseline' | 'candidate') => {
    const scored = subset.filter(row => row.expected.admitted !== null);
    return { scored: scored.length, errors: scored.filter(row => row[side].admitted !== row.expected.admitted).length };
  };
  const paired = (subset: Row[], rule: 'E1.4' | 'E1.2') => ({
    baseline: confusion(subset.map(row => ({ reference: row.expected[rule], prediction: row.baseline[rule] }))),
    candidate: confusion(subset.map(row => ({ reference: row.expected[rule], prediction: row.candidate[rule] }))),
  });
  const metrics = [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([group, subset]) => ({
    group,
    admission: { baseline: admission(subset, 'baseline'), candidate: admission(subset, 'candidate') },
    'E1.4': paired(subset, 'E1.4'),
    'E1.2': paired(subset, 'E1.2'),
    evidenceInvalid: { baseline: subset.filter(row => row.baseline.evidenceValid === false).length,
      candidate: subset.filter(row => row.candidate.evidenceValid === false).length },
  }));
  const oracle = rows.filter(row => row.family.startsWith('fence') && row.expected.admitted !== null);
  return {
    kind: 'synthetic', ...identity, fixture: { path: values.fixture, sha256: sha256(bytes) },
    policyHash: await policyHash([bytes]), exclusions: [], metrics,
    oracleCheck: { fenceTargets: oracle.length, disagreements: oracle.filter(row => row.oracleFenced === row.expected.admitted).map(row => `${row.caseId}:${row.line}`) },
    regressions: rows.filter(row => row.expected.admitted !== null && row.baseline.admitted === row.expected.admitted && row.candidate.admitted !== row.expected.admitted).map(row => `${row.caseId}:${row.line}`),
    rows,
  };
}

const openSpecTarget = /(?:^|\/)openspec\/(?:specs\/(?:[^/]+\/)*spec\.md|changes\/(?!archive\/)[^/]+\/specs\/(?:[^/]+\/)*spec\.md)$/iu;
function lineageOf(path: string, framework: string, featureId: string) {
  if (framework !== 'openspec' && framework !== 'spec-kit') return `${framework}:${featureId.toLowerCase()}`;
  const open = /openspec\/(?:changes\/[^/]+\/)?specs\/(.+)\/spec\.md$/iu.exec(path);
  if (open) return `openspec:${open[1].toLowerCase()}`;
  const kit = /(?:^|\/)specs\/(?:\d+-)?([^/]+)\//iu.exec(path);
  return `spec-kit:${(kit?.[1] ?? path).toLowerCase()}`;
}

async function snapshot(root: Root, directory: string) {
  // Capture stderr: git messages can contain restricted paths.
  const run = (...args: string[]) => execFileSync('git', ['-C', root.path, ...args], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });
  const sha = run('rev-parse', '--verify', '--end-of-options', `${root.ref}^{commit}`).toString().trim();
  const paths = run('ls-tree', '-r', '-z', '--name-only', sha).toString().split('\0').filter(path => /\.md$/iu.test(path));
  await mkdir(directory, { recursive: true });
  const files = new Map<string, string>();
  for (const path of paths) {
    const bytes = run('cat-file', 'blob', `${sha}:${path}`);
    if (bytes.length > 1_000_000) continue;
    files.set(path, new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes));
  }
  return { sha, files };
}

type Side = 'baseline' | 'candidate';
const findingKey = (finding: { practiceId: string; message: string; evidence: { path: string; line: number }[] }) =>
  `${finding.practiceId}|${finding.evidence[0]?.path}|${finding.evidence[0]?.line}|${finding.message}`;

async function scan() {
  const rootsBytes = await readFile(values.roots!);
  const roots = rootSchema.parse(JSON.parse(rootsBytes.toString()));
  if (roots.some(root => root.restricted) && !values.out) throw new Error('Restricted roots require --out <operator directory>.');
  const restrictedDetail: unknown[] = [];
  const publicDetail: unknown[] = [];
  const aggregate = {
    roots: 0, restrictedRoots: 0, documents: 0, features: 0, lineages: new Set<string>(),
    candidateLines: { en: 0, es: 0, und: 0 },
    admissionChanges: { excludedNowAdmitted: 0, admittedNowExcluded: 0, agreeWithOracle: 0, disagreeWithOracle: 0 },
    decisionChanges: { 'E1.4': 0, 'E1.2': 0 },
    // Changed lines (admission or any decision) by whether every modal word is mentioned.
    changeScope: { quotedOnlyModal: 0, other: 0 },
    findingChangesOnOtherLines: 0,
    featuresOverLimit: 0,
    // Inherited instruction files repeat a finding in every feature; count each finding once.
    uniqueFindingChanges: new Set<string>(),
    oracleConflicts: { baseline: 0, candidate: 0 },
    failure: { repositories: new Set<string>(), lineages: new Set<string>(), distinctLines: new Set<string>(), byLanguage: { en: 0, es: 0, und: 0 } },
    adjacent: {} as Record<string, { statusChanged: number; findingsAdded: number; findingsRemoved: number; evidenceChanged: number }>,
    evidenceInvalid: { baseline: 0, candidate: 0 },
    // Exploratory signals for future hypotheses; measured on the baseline arm only.
    residual: {
      quotedOnlyModal: { lines: 0, repositories: new Set<string>(), lineages: new Set<string>() },
      htmlComment: { lines: 0, repositories: new Set<string>(), lineages: new Set<string>() },
    },
  };
  const byFramework = new Map<string, { documents: number; candidateLines: number; changed: number; changedOther: number;
    quotedOnlyAdmitted: number; repositories: Set<string>; lineages: Set<string> }>();
  const frameworkRow = (name: string) => {
    if (!byFramework.has(name)) byFramework.set(name, { documents: 0, candidateLines: 0, changed: 0, changedOther: 0,
      quotedOnlyAdmitted: 0, repositories: new Set(), lineages: new Set() });
    return byFramework.get(name)!;
  };
  const adjacent = (id: string) => (aggregate.adjacent[id] ??= { statusChanged: 0, findingsAdded: 0, findingsRemoved: 0, evidenceChanged: 0 });
  const rootRevisions: { id: string; sha: string; restricted: boolean }[] = [];
  for (const root of roots) {
    const { sha, files } = await snapshot(root, join(temp, 'roots', root.id));
    rootRevisions.push({ id: root.id, sha, restricted: root.restricted });
    aggregate.roots++;
    if (root.restricted) aggregate.restrictedRoots++;
    const artifacts = [...files].filter(([path]) => arms.baseline.isSpecCandidate(path))
      .map(([path, content]) => arms.baseline.classifyArtifact(path, content));
    // Pre-registered primary population (OpenSpec, Spec Kit) plus every other supported family.
    const targets = artifacts.filter(artifact => !artifact.archived && artifact.role === 'spec' && (
      artifact.framework === 'openspec' ? openSpecTarget.test(artifact.path)
        : artifact.framework === 'spec-kit' ? /(?:^|\/)spec\.md$/iu.test(artifact.path) : true));
    aggregate.documents += targets.length;
    for (const artifact of targets) {
      const lineage = `${root.repository}|${lineageOf(artifact.path, artifact.framework, artifact.featureId)}`;
      const family = frameworkRow(artifact.framework);
      family.documents++;
      family.repositories.add(root.repository);
      family.lineages.add(lineage);
      aggregate.lineages.add(lineage);
      const fenced = fencedLines(artifact.content);
      const comments = commentLines(artifact.content);
      const rows = segments(artifact.content);
      for (const line of candidateLines(artifact.content)) {
        const text = rows[line - 1].text;
        const language = lineLanguage(text);
        aggregate.candidateLines[language]++;
        family.candidateLines++;
        const [baseline, candidate]: LinePrediction[] = await Promise.all([
          predictLine(arms.baseline, artifact.path, artifact.content, line),
          predictLine(arms.candidate, artifact.path, artifact.content, line),
        ]);
        for (const side of ['baseline', 'candidate'] as Side[]) {
          const prediction = side === 'baseline' ? baseline : candidate;
          if (prediction.evidenceValid === false) aggregate.evidenceInvalid[side]++;
          if (prediction.admitted && fenced.has(line)) aggregate.oracleConflicts[side]++;
        }
        for (const [signal, present] of [['quotedOnlyModal', quotedOnlyModal(text)], ['htmlComment', comments.has(line)]] as const) {
          if (!present || !baseline.admitted) continue;
          const bucket = aggregate.residual[signal];
          bucket.lines++; bucket.repositories.add(root.repository); bucket.lineages.add(lineage);
        }
        if (baseline.admitted && fenced.has(line)) {
          aggregate.failure.repositories.add(root.repository);
          aggregate.failure.lineages.add(lineage);
          aggregate.failure.distinctLines.add(sha256(text.normalize('NFC').trim()));
          aggregate.failure.byLanguage[language]++;
        }
        if (baseline.admitted !== candidate.admitted) {
          aggregate.admissionChanges[candidate.admitted ? 'excludedNowAdmitted' : 'admittedNowExcluded']++;
          aggregate.admissionChanges[candidate.admitted === !fenced.has(line) ? 'agreeWithOracle' : 'disagreeWithOracle']++;
        }
        for (const rule of ['E1.4', 'E1.2'] as const) if (baseline[rule] !== candidate[rule]) aggregate.decisionChanges[rule]++;
        if (JSON.stringify(baseline) !== JSON.stringify(candidate)) {
          const inScope = quotedOnlyModal(text);
          aggregate.changeScope[inScope ? 'quotedOnlyModal' : 'other']++;
          family.changed++;
          if (!inScope) family.changedOther++;
        }
        if (baseline.admitted && quotedOnlyModal(text)) family.quotedOnlyAdmitted++;
        if (baseline.admitted !== candidate.admitted || (baseline.admitted && fenced.has(line))) {
          const row = { root: root.id, framework: artifact.framework, lineage, path: artifact.path, line, language, oracleFenced: fenced.has(line), baseline, candidate };
          if (root.restricted) restrictedDetail.push(row);
          else publicDetail.push({ ...row, revision: sha, text: text.slice(0, 300) });
        }
      }
    }
    // Whole-feature effects on every practice and finding, independent of the primary rule.
    const set = { name: root.id, artifacts };
    for (const feature of new Set(targets.map(artifact => artifact.featureId))) {
      const selected = arms.baseline.selectFeature(set, feature);
      // The engine refuses sets beyond its analysis limit; record the exclusion instead.
      if (selected.artifacts.length > 500 || selected.artifacts.some(artifact => artifact.content.length > 1_000_000)) {
        aggregate.featuresOverLimit++;
        continue;
      }
      aggregate.features++;
      const [before, after] = await Promise.all([arms.baseline.analyze(selected), arms.candidate.analyze(selected)]);
      for (const practice of before.practices) {
        const next = after.practices.find(item => item.id === practice.id)!;
        if (practice.status !== next.status) adjacent(practice.id).statusChanged++;
        if (JSON.stringify(practice.evidence) !== JSON.stringify(next.evidence)) adjacent(practice.id).evidenceChanged++;
      }
      const keys = (side: typeof before) => new Map(side.findings.map(finding => [findingKey(finding), finding.practiceId]));
      const [old, current] = [keys(before), keys(after)];
      const quoted = (key: string) => {
        const [, path, line] = key.split('|');
        const text = segments(files.get(path) ?? '')[Number(line) - 1]?.text ?? '';
        return quotedOnlyModal(text);
      };
      for (const [key, practice] of current) if (!old.has(key)) {
        adjacent(practice).findingsAdded++;
        aggregate.uniqueFindingChanges.add(`${root.repository}|+|${key}`);
        if (!quoted(key)) aggregate.findingChangesOnOtherLines++;
      }
      for (const [key, practice] of old) if (!current.has(key)) {
        adjacent(practice).findingsRemoved++;
        aggregate.uniqueFindingChanges.add(`${root.repository}|-|${key}`);
        if (!quoted(key)) aggregate.findingChangesOnOtherLines++;
      }
    }
  }
  const failure = {
    repositories: aggregate.failure.repositories.size, lineages: aggregate.failure.lineages.size,
    distinctLines: aggregate.failure.distinctLines.size, byLanguage: aggregate.failure.byLanguage,
  };
  return {
    rootRevisions, restrictedDetail, publicDetail, rootsHash: sha256(rootsBytes),
    aggregate: { ...aggregate, lineages: aggregate.lineages.size, failure, uniqueFindingChanges: aggregate.uniqueFindingChanges.size,
      byFramework: Object.fromEntries([...byFramework].sort(([a], [b]) => a.localeCompare(b)).map(([name, row]) =>
        [name, { ...row, repositories: row.repositories.size, lineages: row.lineages.size }])),
      residual: Object.fromEntries(Object.entries(aggregate.residual).map(([key, bucket]) => [key, {
        lines: bucket.lines, repositories: bucket.repositories.size, lineages: bucket.lineages.size }])) },
  };
}

try {
  const output = join(repository, '.spec-torque', 'precision');
  await mkdir(output, { recursive: true });
  if (mode === 'synthetic') {
    const bundle = await synthetic();
    const directory = await mkdtemp(join(output, 'synthetic-'));
    await writeFile(join(directory, 'bundle.json'), json(bundle));
    console.log(json({ directory, ...identity, policyHash: bundle.policyHash, oracleCheck: bundle.oracleCheck, regressions: bundle.regressions,
      changedRows: bundle.rows.filter(row => row.changed).map(row => `${row.caseId}:${row.line}`),
      summary: bundle.metrics.filter(row => row.group.startsWith('all') || row.group.startsWith('fence')).map(row => ({
        group: row.group, admissionErrors: [row.admission.baseline.errors, row.admission.candidate.errors, row.admission.baseline.scored],
        e14: ['baseline', 'candidate'].map(side => { const m = row['E1.4'][side as Side]; return { tp: m.tp, fp: m.fp, tn: m.tn, fn: m.fn, posAbst: m.positiveAbstentions, negAbst: m.negativeAbstentions }; }),
      })) }));
  } else {
    const result = await scan();
    const restricted = result.rootRevisions.some(root => root.restricted);
    const generated = { ...identity, policyHash: await policyHash([]), ...(restricted ? {} : { rootsHash: result.rootsHash }) };
    if (restricted) {
      await mkdir(values.out!, { recursive: true, mode: 0o700 });
      const detail = join(values.out!, `restricted-detail-${Date.now()}.json`);
      await writeFile(detail, json({ ...generated, rootsHash: result.rootsHash, rootRevisions: result.rootRevisions, rows: result.restrictedDetail }), { mode: 0o600 });
      await chmod(detail, 0o600);
    }
    const publicDirectory = await mkdtemp(join(output, 'scan-'));
    await writeFile(join(publicDirectory, 'public-detail.json'), json({
      ...generated, rootRevisions: result.rootRevisions.filter(root => !root.restricted), rows: result.publicDetail,
    }));
    // Restricted runs export only global totals: no paths, text, hashes, identifiers or revisions.
    const exported = restricted ? suppress(result.aggregate) : result.aggregate;
    console.log(json({ publicDirectory, ...(restricted ? { engines: identity.engines, revisions } : generated), aggregate: exported }));
  }
} catch (error) {
  if (!values.out) throw error;
  // Never echo messages that could contain restricted paths or text.
  console.error(`Replay failed: ${error instanceof Error ? error.name : 'Error'}`);
  process.exitCode = 1;
} finally {
  await rm(temp, { recursive: true, force: true });
}
