import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { bindWorkspace } from '../integrations/codex/workspace.js';
import { analyze, discoverWorkspace, selectFeature } from '../src/integration.js';

test('Codex scopes the review to its configured root and rejects stale proposals', async () => {
  await assert.rejects(bindWorkspace(undefined), /absolute root/);
  const root = await mkdtemp(join(tmpdir(), 'spectorque-codex-'));
  try {
    await cp('fixtures/en-draft', root, { recursive: true });
    const workspace = await bindWorkspace(root);
    const all = await workspace.assess(null);
    const feature = all.features[0];
    assert.ok(feature);
    const { assessment } = await workspace.assess(feature);
    assert.equal(assessment.id, (await analyze(selectFeature(await discoverWorkspace(root), feature))).id);
    await assert.rejects(workspace.assess('missing-feature'), /unavailable/);
    const finding = assessment.findings.find(item => item.evidence[0]?.text.includes('fast'));
    assert.ok(finding);
    const evidence = finding.evidence[0];
    const file = join(root, evidence.path);
    const original = await readFile(file);
    const input = { feature, revision: assessment.id, findingId: finding.id, replacement: evidence.text.replace('fast', '[NEEDS CLARIFICATION: define fast]') };
    const proposal = await workspace.propose(input);
    assert.equal(proposal.original, evidence.text);
    assert.deepEqual(await readFile(file), original);
    await writeFile(file, Buffer.concat([original, Buffer.from('\nExternal edit\n')]));
    await assert.rejects(workspace.propose(input), /stale/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
