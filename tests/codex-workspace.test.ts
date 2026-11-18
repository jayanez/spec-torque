import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { unzipSync } from 'fflate';
import { bindWorkspace } from '../src/node/scoped-review.js';
import { analyze, discoverWorkspace, selectFeature, openWorkbench } from '../src/integration.js';

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
    const review = { root: all.root, feature, revision: assessment.id, findingId: finding.id, proposal };
    const { server, token, url } = await openWorkbench(root);
    const send = (route: string, payload: unknown) => fetch(url + '/api/' + route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-SpecTorque-Token': token },
      body: JSON.stringify(payload),
    });
    try {
      const checked = await send('scoped-review', review);
      assert.equal(checked.status, 200);
      assert.deepEqual((await checked.json()).proposal, proposal);
      const selection = { root: all.root, feature, revision: assessment.id, createdAt: assessment.createdAt };
      const jsonResponse = await send('scoped-export', { selection, format: 'json' });
      assert.equal(jsonResponse.status, 200);
      assert.deepEqual((await jsonResponse.json()).assessment, assessment);
      const zipResponse = await send('scoped-export', { selection, format: 'zip' });
      assert.equal(zipResponse.status, 200);
      const zipped = unzipSync(Buffer.from((await zipResponse.json()).archive, 'base64'));
      assert.deepEqual(Object.keys(zipped).sort(), assessment.artifacts.map(item => item.path).sort());
      for (const [path, bytes] of Object.entries(zipped)) assert.deepEqual(Buffer.from(bytes), await readFile(join(root, path)));
      assert.equal((await send('scoped-export', { selection: { ...selection, root: all.root + '/other' }, format: 'zip' })).status, 400);

      assert.equal((await send('scoped-apply', { review })).status, 400);
      for (const invalid of [{ ...review, root: all.root + '/other' }, { ...review, proposal: { ...proposal, path: 'another.md' } }]) {
        assert.equal((await send('scoped-apply', { review: invalid, approved: true })).status, 400);
      }
      assert.deepEqual(await readFile(file), original);
      const external = Buffer.concat([original, Buffer.from('\nExternal edit\n')]);
      await writeFile(file, external);
      await assert.rejects(workspace.propose(input), /stale/);
      assert.equal((await send('scoped-export', { selection, format: 'zip' })).status, 400);
      assert.equal((await send('scoped-apply', { review, approved: true })).status, 400);
      assert.deepEqual(await readFile(file), external);
      await writeFile(file, original);
      assert.equal((await send('scoped-apply', { review, approved: true })).status, 200);
      assert.deepEqual(await readFile(file), Buffer.from(original.toString('utf8').replace(proposal.original, () => proposal.replacement)));
      assert.equal((await send('scoped-apply', { review, approved: true })).status, 400);
    } finally {
      await new Promise<void>(done => server.close(() => done()));
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
