import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { classifyArtifact, isSpecCandidate, selectFeature } from '../src/core/artifacts.js';
import { analyze } from '../src/core/analyze.js';
import type { Framework, Role } from '../src/core/types.js';
import { discoverWorkspace } from '../src/node/workspace.js';

interface ProbeArtifact { path: string; content: string; role: Role; featureId: string; archived: boolean }
interface Probe { id: string; framework: Framework; language: 'en' | 'es'; artifacts: ProbeArtifact[] }
const corpus: { provenance: string; cases: Probe[] } = JSON.parse(await readFile(new URL('../fixtures/formats/layouts.json', import.meta.url), 'utf8'));
for (const example of corpus.cases) test(`original layout probe: ${example.id}`, async () => {
  const root = await mkdtemp(join(tmpdir(), 'spec-torque-format-'));
  try {
    for (const a of example.artifacts) {
      await mkdir(dirname(join(root, a.path)), { recursive: true });
      await writeFile(join(root, a.path), a.content);
      for (const path of [a.path, a.path.replaceAll('/', '\\')]) {
        const classified = classifyArtifact(path, a.content);
        assert.equal(classified.framework, example.framework);
        assert.equal(classified.role, a.role);
        assert.equal(classified.featureId, a.featureId);
        assert.equal(classified.archived, a.archived);
        assert.equal(classified.path, a.path);
      }
    }
    const discovered = await discoverWorkspace(root);
    assert.deepEqual(discovered.artifacts.map(a => a.path).sort(), example.artifacts.map((a: { path: string }) => a.path).sort());
    const result = await analyze(discovered);
    assert.equal(result.findings.some(f => /Duplicate|Opposite|no definition/.test(f.message)), false);
    assert.equal(result.traceability.length, 2);
    assert.ok(result.traceability.every(t => t.resolved));
    assert.equal(result.practices.find(p => p.id === 'E1.4')?.status, 'supported');
    assert.equal(result.practices.find(p => p.id === 'E1.2')?.status, 'supported');
    assert.ok(result.practices.flatMap(p => p.evidence).every(e => !e.path.includes('/archive/')));
    const incomplete = await analyze({ ...discovered, artifacts: discovered.artifacts.filter(a => a.role === 'spec') });
    assert.equal(incomplete.practices.find(p => p.id === 'C2.2')?.status, 'unknown');
    assert.equal(incomplete.summary.score, null);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('shared IDs across the format/language corpus resolve only within the selected feature', async () => {
  const artifacts = corpus.cases.flatMap((c: { artifacts: { path: string; content: string }[] }) => c.artifacts.map(a => classifyArtifact(a.path, a.content)));
  const set = { name: 'original format corpus', artifacts };
  const result = await analyze(set);
  assert.equal(result.findings.some(f => /Duplicate|Opposite|no definition/.test(f.message)), false);
  assert.equal(result.traceability.length, 28);
  assert.ok(result.traceability.every(t => t.resolved));
  assert.equal(result.practices.find(p => p.id === 'C1.2')?.status, 'unknown');
  for (const a of artifacts.filter((a: { archived: boolean; role: string }) => !a.archived && a.role === 'spec')) {
    const selected = selectFeature(set, a.featureId);
    assert.equal(selected.artifacts.length, corpus.cases.flatMap(c => c.artifacts).filter(entry => entry.featureId === a.featureId).length);
    assert.ok(selected.artifacts.every(entry => entry.featureId === a.featureId));
  }
  const missing = artifacts.filter((a: { path: string }) => a.path !== artifacts[0].path);
  const incomplete = await analyze({ ...set, artifacts: missing });
  assert.equal(incomplete.traceability.filter(t => !t.resolved).length, 2, 'other features must not supply the missing FR-001 definition');
});

const calibrationRoot = new URL('../fixtures/calibration/', import.meta.url);

test('documented producer companions reach the shared classifier through workspace discovery', async () => {
  const cases = [
    {
      root: 'development/spec-kitty-development-es',
      path: 'kitty-specs/wayfinding-01M20JM4/tasks/WP01-intake.md',
      framework: 'spec-kitty', role: 'tasks', feature: 'kitty-specs/wayfinding-01M20JM4',
    },
    {
      root: 'development/spec-kit-development-es',
      path: 'specs/011-availability/data-model.md',
      framework: 'spec-kit', role: 'context', feature: 'specs/011-availability',
    },
    {
      root: 'development/bmad-development-es',
      path: '_bmad-output/implementation-artifacts/1-1-first-visit.md',
      framework: 'bmad', role: 'tasks', feature: '_bmad-output/implementation-artifacts',
    },
    {
      root: 'controls/bmad-structural-controls-en',
      path: '_bmad-output/initiatives/food-pantry/epics.md',
      framework: 'bmad', role: 'tasks', feature: '_bmad-output/initiatives/food-pantry',
    },
    {
      root: 'development/zeespec-development-es',
      path: '.spec/how.md',
      framework: 'zeespec', role: 'plan', feature: '.spec',
    },
    {
      root: 'development/zeespec-development-es',
      path: '.spec/upstream.md',
      framework: 'zeespec', role: 'context', feature: '.spec',
    },
  ];
  for (const { root, path, framework, role, feature } of cases) {
    const set = await discoverWorkspace(fileURLToPath(new URL(root, calibrationRoot)));
    const artifact = set.artifacts.find(item => item.path === path);
    assert.ok(artifact, path);
    assert.deepEqual([artifact.framework, artifact.role, artifact.featureId], [framework, role, feature], path);
    const fromWindows = classifyArtifact(`apps/sample/${path}`.replaceAll('/', '\\'), artifact.content);
    assert.deepEqual([fromWindows.framework, fromWindows.role, fromWindows.featureId], [framework, role, `apps/sample/${feature}`], path);
    assert.equal(isSpecCandidate(path), true, path);
  }
  assert.equal(isSpecCandidate('docs/tasks/WP01-intake.md', true), false);
  assert.equal(isSpecCandidate('kitty-specs/mission/wps.yaml'), false);
  assert.equal(isSpecCandidate('docs/upstream.md'), false);
});

test('documented OpenSpec archive names keep unrelated changes distinct', async () => {
  const directory = new URL('controls/openspec-structural-controls-en', calibrationRoot);
  const set = await discoverWorkspace(fileURLToPath(directory));
  assert.deepEqual(new Set(set.artifacts.filter(item => item.archived).map(item => item.featureId)), new Set([
    'openspec/changes/archive/2026-08-18-legacy-intake',
    'openspec/changes/archive/2026-09-08-legacy-log',
  ]));
  const result = await analyze(set);
  assert.equal(result.findings.some(finding => /Duplicate requirement|Opposite obligations/.test(finding.message)), false);
});

test('scoped discovery inherits root and ancestor instructions without importing siblings or historical instructions', async () => {
  const set = await discoverWorkspace(fileURLToPath(new URL('controls/nested-projects', calibrationRoot)));
  for (const project of ['east', 'west']) {
    const scoped = selectFeature(set, `apps/${project}/specs/intake`);
    assert.deepEqual(scoped.artifacts.filter(artifact => artifact.role === 'instructions').map(artifact => artifact.path).sort(),
      ['AGENTS.md', `apps/${project}/AGENTS.md`]);
  }
  const result = await analyze(set);
  assert.deepEqual(result.traceability.filter(edge => !edge.resolved).map(edge => [edge.from, edge.to]), [
    ['apps/east/specs/intake/tasks.md', 'FR-002'],
  ]);
  assert.equal(result.findings.filter(finding => finding.message.startsWith('Duplicate requirement identifier')).length, 1);
});
