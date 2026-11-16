import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverWorkspace, applyWorkspaceProposal, writeNewArtifacts } from '../src/node/workspace.js';
import { createProposal } from '../src/core/refine.js';
import { classifyArtifact } from '../src/core/artifacts.js';

test('workspace discovery and write boundaries exclude secrets and escaped symlinks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'spectorque-'));
  const outside = await mkdtemp(join(tmpdir(), 'spectorque-outside-'));
  try {
    await mkdir(join(root, 'specs'));
    await writeFile(join(root, 'specs', 'spec.md'), 'FR-001: System MUST run.');
    await writeFile(join(outside, 'secret.md'), 'private');
    await symlink(join(outside, 'secret.md'), join(root, 'specs', 'linked-spec.md'));
    const set = await discoverWorkspace(root);
    assert.deepEqual(set.artifacts.map(a => a.path), ['specs/spec.md']);
    const patch = await createProposal('../secret.md', 'private', 1, 'private', 'test');
    await assert.rejects(applyWorkspaceProposal(root, patch), /outside|path/i);
    await assert.rejects(writeNewArtifacts(root, [classifyArtifact('../escape.md', 'no')]), /outside|path/i);
  } finally { await rm(root, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }); }
});
test('workspace patches preserve newlines, reject stale writes and never overwrite authoring output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'spectorque-'));
  try {
    const content = '# Spec\r\nFR-001: The system MUST respond in 2 seconds.\r\n';
    await writeFile(join(root, 'spec.md'), content);
    const proposal = await createProposal('spec.md', content, 2, 'FR-001: The booking system MUST respond in 2 seconds.', 'name actor');
    await applyWorkspaceProposal(root, proposal);
    assert.ok((await readFile(join(root, 'spec.md'), 'utf8')).includes('\r\n'));
    await assert.rejects(applyWorkspaceProposal(root, proposal), /changed|stale/i);
    await assert.rejects(writeNewArtifacts(root, [classifyArtifact('spec.md', 'overwrite')]), /exist/i);
  } finally { await rm(root, { recursive: true, force: true }); }
});
