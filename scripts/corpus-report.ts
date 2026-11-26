import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { archiveEngine, commit, git, repository, type Engine } from './precision/engines.js';
import { referenceFor, reviewFile, reviewProvenance, summarize, type Label, type Reviews } from './corpus-metrics.js';

const fixtureRoot = join(repository, 'fixtures', 'calibration');
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const digest = z.string().regex(/^[a-f0-9]{64}$/u);
const path = z.string().regex(/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/u)
  .refine(value => value.split('/').every(part => part !== '.' && part !== '..'));
const framework = z.enum(['spec-kit', 'spec-kitty', 'openspec', 'kiro', 'bmad', 'zeespec', 'generic']);
const fixture = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/u),
  root: path,
  framework,
  language: z.enum(['en', 'es', 'mixed']),
  split: z.enum(['development', 'evaluation', 'external', 'controls']),
  provenance: z.enum(['original', 'published']),
  license: z.enum(['Apache-2.0', 'MIT']),
  reference: z.string().min(1),
  revision: z.string().regex(/^[a-f0-9]{40}$/u).optional(),
  context: z.string().min(1),
  transformations: z.string().min(1),
  notice: path.optional(),
  probe: z.object({ path, lines: z.array(z.number().int().positive()).min(1) }).optional(),
  files: z.array(z.object({ path, sha256: digest, language: z.enum(['en', 'es', 'mixed', 'und']) })).min(1),
}).strict().refine(value => value.provenance !== 'published' ||
  (value.revision && value.notice && value.files.some(file => file.path === value.notice)),
  'Published fixtures require a revision and an included license notice.');
type Fixture = z.infer<typeof fixture>;
type Example = Fixture & { contents: Map<string, string> };

type Rule = 'discovery' | 'framework' | 'role' | 'archive' | 'feature' | 'shared-instructions'
  | 'E1.2' | 'E1.4' | 'I1.2:duplicate' | 'I2.3:resolved';
interface Unit {
  id: string;
  case: string;
  rule: Rule;
  path: string;
  language: Fixture['files'][number]['language'];
  line?: number;
  target?: string;
}

const layoutRoles: Record<string, string> = {
  'spec.md': 'spec', 'requirements.md': 'spec', 'prd.md': 'spec', 'proposal.md': 'spec', 'what.md': 'spec',
  'plan.md': 'plan', 'design.md': 'plan', 'architecture.md': 'plan', 'how.md': 'plan',
  'tasks.md': 'tasks', 'epics.md': 'tasks', 'story.md': 'tasks', 'WP01-intake.md': 'tasks',
  '1-1-first-visit.md': 'tasks', 'data-model.md': 'context',
  'who.md': 'context', 'where.md': 'context', 'when.md': 'context', 'why.md': 'context',
  'upstream.md': 'context', 'downstream.md': 'context', 'AGENTS.md': 'instructions',
};

async function readInventory(directory: string, root = directory): Promise<string[]> {
  const paths: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await readInventory(full, root));
    else if (entry.isFile()) paths.push(relative(root, full).replaceAll('\\', '/'));
    else throw new Error(`Unexpected fixture entry: ${relative(fixtureRoot, full)}`);
  }
  return paths.sort();
}

async function loadExample(entry: Fixture): Promise<Example> {
  const directory = join(fixtureRoot, entry.root);
  const inventory = await readInventory(directory);
  const declared = entry.files.map(file => file.path).sort();
  if (JSON.stringify(inventory) !== JSON.stringify(declared)) throw new Error(`File inventory mismatch: ${entry.id}`);
  const contents = new Map<string, string>();
  for (const file of entry.files) {
    const bytes = await readFile(join(directory, file.path));
    if (sha256(bytes) !== file.sha256) throw new Error(`Hash mismatch: ${entry.id}/${file.path}`);
    contents.set(file.path, new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes));
  }
  return { ...entry, contents };
}

function unitsFor(entry: Example): Unit[] {
  const units: Unit[] = [];
  const languages = new Map(entry.files.map(file => [file.path, file.language]));
  const add = (rule: Rule, path: string, target?: string, line?: number) =>
    units.push({
      id: [entry.id, rule, path, line, target].join('|'), case: entry.id, rule, path,
      language: languages.get(path) ?? 'und', line, target,
    });

  for (const { path } of entry.files) {
    add('discovery', path);
    if (!path.endsWith('.md')) continue;
    const role = layoutRoles[path.split('/').at(-1)!];
    if (role) add('role', path, role);
    add('archive', path);
  }
  const primary = entry.probe?.path ?? entry.files.find(file => file.path.endsWith('/spec.md'))?.path;
  if (primary) {
    add('framework', primary, entry.framework);
    add('framework', primary, entry.framework === 'spec-kit' ? 'generic' : 'spec-kit');
  }
  if (entry.probe) {
    const source = entry.contents.get(entry.probe.path)?.split(/\r?\n/u);
    for (const line of entry.probe.lines) {
      if (!source?.[line - 1]?.trim()) throw new Error(`Missing probe line: ${entry.id}/${entry.probe.path}:${line}`);
      add('E1.2', entry.probe.path, undefined, line);
      add('E1.4', entry.probe.path, undefined, line);
    }
  }
  if (entry.id === 'nested-projects') {
    const east = 'apps/east/specs/intake';
    const west = 'apps/west/specs/intake';
    for (const feature of [east, west]) {
      add('feature', `${feature}/spec.md`, feature);
      add('shared-instructions', 'AGENTS.md', feature);
      add('shared-instructions', 'apps/east/AGENTS.md', feature);
      add('shared-instructions', 'apps/west/AGENTS.md', feature);
      add('shared-instructions', `${west}/archive/AGENTS.md`, feature);
    }
    add('I1.2:duplicate', `${east}/spec.md`, undefined, 5);
    add('I1.2:duplicate', `${west}/spec.md`, undefined, 3);
    add('I2.3:resolved', `${east}/tasks.md`, 'FR-001', 3);
    add('I2.3:resolved', `${east}/tasks.md`, 'FR-002', 4);
    add('I2.3:resolved', `${west}/tasks.md`, 'FR-002', 3);
  }
  if (entry.framework === 'openspec') {
    for (const { path } of entry.files) {
      const historical = /^(openspec\/changes\/archive\/[^/]+)\//u.exec(path);
      if (historical && path.endsWith('/spec.md')) add('feature', path, historical[1]);
    }
  }
  return units;
}

const polarity = (value: boolean): Label => value ? 'positive' : 'negative';
async function evaluate(engine: Engine, entry: Example, units: Unit[]) {
  const set = await engine.discoverWorkspace(join(fixtureRoot, entry.root));
  const report = await engine.analyze(set);
  const files = new Map(set.artifacts.map(artifact => [artifact.path, artifact]));
  const predictions: Record<string, Label> = {};
  for (const unit of units) {
    const artifact = files.get(unit.path);
    let prediction: Label = 'unknown';
    switch (unit.rule) {
      case 'discovery':
        prediction = polarity(Boolean(artifact));
        break;
      case 'framework':
        if (artifact) prediction = polarity(artifact.framework === unit.target);
        break;
      case 'role':
        if (artifact) prediction = polarity(artifact.role === unit.target);
        break;
      case 'archive':
        if (artifact) prediction = polarity(artifact.archived);
        break;
      case 'feature':
        if (artifact) prediction = polarity(artifact.featureId === unit.target);
        break;
      case 'shared-instructions':
        if (artifact && unit.target) prediction = polarity(engine.selectFeature(set, unit.target)
          .artifacts.some(selected => selected.path === unit.path));
        break;
      case 'I1.2:duplicate':
        if (artifact?.role === 'spec') prediction = polarity(report.findings.some(finding =>
          finding.practiceId === 'I1.2' && finding.message.startsWith('Duplicate requirement identifier ') &&
          finding.evidence.some(item => item.path === unit.path && item.line === unit.line)));
        break;
      case 'I2.3:resolved': {
        const edge = report.traceability.find(item => item.from === unit.path && item.to === unit.target &&
          item.evidence.line === unit.line);
        if (edge) prediction = polarity(edge.resolved);
        break;
      }
      case 'E1.2':
      case 'E1.4': {
        if (!artifact || artifact.archived) break;
        // Keep original line numbers and Markdown fences, and isolate the selected line
        // so the public report's evidence limit cannot hide a lexical match.
        const content = artifact.content.split(/\r?\n/u).map((line, index) =>
          index + 1 === unit.line || /^\s*(?:#|```|~~~)/u.test(line) ? line : '').join('\n');
        const probe = await engine.analyze({ ...set, artifacts: [{ ...artifact, content }] });
        const practice = probe.practices.find(item => item.id === unit.rule);
        if (practice && practice.status !== 'unknown') {
          prediction = polarity(practice.evidence.some(item => item.path === unit.path && item.line === unit.line));
        }
        break;
      }
    }
    predictions[unit.id] = prediction;
  }
  return {
    predictions, artifacts: report.artifacts, unknownPractices: report.practices
      .filter(practice => practice.status === 'unknown').map(practice => practice.id),
  };
}

function validateReviews(reviews: Reviews, units: Unit[], packet: string) {
  if (reviews.packet !== packet) throw new Error('Reviews do not match this annotation packet.');
  const ids = new Set(units.map(unit => unit.id));
  for (const reviewer of [...reviews.reviewers, ...(reviews.adjudicator ? [reviews.adjudicator] : [])]) {
    for (const id of Object.keys(reviewer.annotations)) {
      if (!ids.has(id)) throw new Error(`Unknown annotation unit: ${id}`);
      if (reviewer === reviews.adjudicator && referenceFor(id, { ...reviews, adjudicator: undefined }) !== 'disputed') {
        throw new Error(`Adjudication requires a disagreement: ${id}`);
      }
    }
  }
}

async function outputDirectory() {
  const root = join(repository, '.spec-torque', 'corpus');
  await mkdir(root, { recursive: true });
  return mkdtemp(join(root, 'report-'));
}

const { values } = parseArgs({
  options: {
    baseline: { type: 'string' }, labels: { type: 'string' }, packet: { type: 'boolean' },
  },
});
if (values.packet ? values.baseline || values.labels : !values.baseline) {
  throw new Error('Use --packet or --baseline <git-ref> [--labels <reviews.json>].');
}
const bytes = await readFile(join(fixtureRoot, 'manifest.json'));
const manifest = z.object({ version: z.literal(1), cases: z.array(fixture).min(1) }).strict().parse(JSON.parse(bytes.toString()));
for (const key of ['id', 'root'] as const) {
  if (new Set(manifest.cases.map(entry => entry[key])).size !== manifest.cases.length) throw new Error(`Duplicate fixture ${key}.`);
}
const examples = await Promise.all(manifest.cases.map(loadExample));
const byCase = new Map(examples.map(example => [example.id, unitsFor(example)]));
const units = [...byCase.values()].flat();
if (new Set(units.map(unit => unit.id)).size !== units.length) throw new Error('Duplicate annotation unit.');
const manifestHash = sha256(bytes);
const guideHash = sha256(await readFile(join(repository, 'docs', 'corpus-labeling.md')));
const packetId = sha256(JSON.stringify({ manifestHash, guideHash, units }));
const packet = { id: packetId, manifestHash, guideHash, cases: manifest.cases, units };
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
if (values.packet) {
  const output = await outputDirectory();
  await writeFile(join(output, 'annotation-packet.json'), json(packet));
  console.log(output);
} else {
  const reviewBytes = values.labels ? await readFile(values.labels) : undefined;
  const reviews = reviewBytes ? reviewFile.parse(JSON.parse(reviewBytes.toString())) : undefined;
  if (reviews) validateReviews(reviews, units, packetId);
  const referenceProvenance = reviewProvenance(reviews);
  const baseline = commit(values.baseline!);
  const candidate = commit('HEAD');
  if (git('status', '--porcelain', '--', 'src/core', 'src/node')) {
    throw new Error('Commit the candidate engine changes before measuring its revision.');
  }
  const temp = await mkdtemp(join(tmpdir(), 'spectorque-corpus-'));
  try {
    const [before, after] = await Promise.all([
      archiveEngine(baseline, join(temp, 'baseline')), archiveEngine(candidate, join(temp, 'candidate')),
    ]);
    const observations = [];
    for (const entry of examples) {
      const checks = byCase.get(entry.id)!;
      const [base, head] = await Promise.all([evaluate(before, entry, checks), evaluate(after, entry, checks)]);
      observations.push({
        case: entry.id, split: entry.split, language: entry.language, framework: entry.framework,
        baseline: { artifacts: base.artifacts, unknownPractices: base.unknownPractices },
        candidate: { artifacts: head.artifacts, unknownPractices: head.unknownPractices },
        units: checks.map(unit => ({
          ...unit, reference: referenceFor(unit.id, reviews),
          baseline: base.predictions[unit.id], candidate: head.predictions[unit.id],
          sourceLine: unit.line ? entry.contents.get(unit.path)?.split(/\r?\n/u)[unit.line - 1] : undefined,
        })),
      });
    }
    type ObservationUnit = (typeof observations)[number]['units'][number];
    const groups = new Map<string, ObservationUnit[]>();
    for (const observation of observations) {
      for (const unit of observation.units) {
        const key = [observation.split, unit.rule, observation.framework, unit.language].join(' / ');
        const group = groups.get(key) ?? [];
        group.push(unit);
        groups.set(key, group);
      }
    }
    const summarizeSide = (result: ObservationUnit[], side: 'baseline' | 'candidate') =>
      summarize(result.map(row => ({ reference: row.reference, prediction: row[side] })));
    const metrics = [...groups.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, result]) => ({
      group: key, baseline: summarizeSide(result, 'baseline'), candidate: summarizeSide(result, 'candidate'),
    }));
    const paired = units.filter(unit => reviews?.reviewers.every(reviewer => reviewer.annotations[unit.id]));
    const agreed = paired.filter(unit => reviews!.reviewers[0].annotations[unit.id].label ===
      reviews!.reviewers[1].annotations[unit.id].label);
    const disagreements = paired.filter(unit => !agreed.includes(unit)).map(unit => ({
      unit: unit.id,
      roundOne: reviews!.reviewers.map(reviewer => reviewer.annotations[unit.id]),
      adjudication: reviews!.adjudicator?.annotations[unit.id] ?? null,
    }));
    const report = {
      packet: packetId, manifestHash, guideHash, labelsHash: reviewBytes ? sha256(reviewBytes) : null,
      node: process.version, baseline: { commit: baseline, engine: before.ENGINE_VERSION, rubric: before.RUBRIC_VERSION },
      candidate: { commit: candidate, engine: after.ENGINE_VERSION, rubric: after.RUBRIC_VERSION },
      referenceProvenance,
      reviewAgreement: { numerator: agreed.length, denominator: paired.length },
      disagreements, metrics, observations,
    };
    const rate = ({ value, numerator, denominator }: ReturnType<typeof summarize>['coverage']) =>
      value === null ? `N/A (${numerator}/${denominator})` : `${(value * 100).toFixed(1)}% (${numerator}/${denominator})`;
    const cells = (row: ReturnType<typeof summarize>) => [
      row.total, row.tp, row.fp, row.tn, row.fn, row.abstainedPositive, row.abstainedNegative,
      row.referenceUnknown, row.unsupported, row.pending, row.disputed, rate(row.falsePositiveRate),
      rate(row.precision), rate(row.recall), rate(row.coverage),
    ];
    const lines = [
      '# EN/ES corpus comparison', '', `Baseline \`${baseline}\` · engine ${before.ENGINE_VERSION}`,
      `Candidate \`${candidate}\` · engine ${after.ENGINE_VERSION}`, '',
      `Annotation packet \`${packetId}\` · reviewer agreement ${agreed.length}/${paired.length}`, '',
      `Declared reference provenance · ${referenceProvenance.kind}`, '',
      ...(referenceProvenance.kind === 'agent' || referenceProvenance.kind === 'mixed'
        ? ['Agent judgments are provisional and may have correlated errors. No human validity is established here.', '']
        : []),
      'Pending and disputed cases withhold rates for their group. Results apply to this corpus.', '',
      '| Split / rule / framework / language | Engine | Total | TP | FP | TN | FN | Abstain + | Abstain − | Ref. unknown | Unsupported | Pending | Disputed | FP rate | Precision | Decided recall | Coverage |',
      '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|---|',
      ...metrics.flatMap(row => (['baseline', 'candidate'] as const).map(side =>
        `| ${row.group} | ${side} | ${cells(row[side]).join(' | ')} |`)),
    ];
    const output = await outputDirectory();
    await Promise.all([
      writeFile(join(output, 'annotation-packet.json'), json(packet)),
      writeFile(join(output, 'report.json'), json(report)),
      writeFile(join(output, 'report.md'), lines.join('\n') + '\n'),
    ]);
    console.log(output);
  } finally {
    await rm(temp, { force: true, recursive: true });
  }
}
