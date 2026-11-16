import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { classifyArtifact, selectFeature } from '../src/core/artifacts.js';
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
