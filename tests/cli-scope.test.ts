import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { analyze, contentHash, discoverWorkspace, selectFeature } from '../src/integration.js';

const exec = promisify(execFile);
const cli = (...args: string[]) => exec(process.execPath, ['--import', 'tsx', 'src/cli.ts', ...args]);
const withoutTime = ({ createdAt, ...rest }: { createdAt: string }) => rest;

test('CLI --feature matches selectFeature and rejects unknown features', async () => {
  const workspace = await discoverWorkspace(resolve('fixtures'));
  const feature = workspace.artifacts.find(a => a.role === 'spec' && a.path.startsWith('es-draft/'))!.featureId;
  const expected = await analyze(selectFeature(workspace, feature));
  const scoped = JSON.parse((await cli('analyze', 'fixtures', '--feature', feature, '--json')).stdout);
  assert.deepEqual(withoutTime(scoped), withoutTime(expected as any));
  assert.ok(scoped.artifacts.every((a: any) => a.featureId === feature || a.role === 'instructions'));
  await assert.rejects(cli('analyze', 'fixtures', '--feature', 'missing/feature', '--json'), (e: any) => e.code === 1 && /Unknown feature: missing\/feature/.test(e.stderr));
});

test('CLI refine --expect-hash rejects a source changed since the assessment', async () => {
  const root = await mkdtemp(join(tmpdir(), 'spectorque-cli-'));
  try {
    await cp('fixtures/en-draft', root, { recursive: true });
    const file = join(root, 'specs/booking/spec.md');
    const hash = await contentHash(await readFile(file, 'utf8'));
    const args = ['refine', file, '--root', root, '--line', '5', '--replacement', 'FR-001: The system MUST respond. [NEEDS CLARIFICATION: response-time limit?]'];
    const ok = JSON.parse((await cli(...args, '--expect-hash', hash)).stdout);
    assert.equal(ok.proposal.baseHash, hash);
    await assert.rejects(cli(...args, '--expect-hash', '0'.repeat(64)), (e: any) => /Source changed since this assessment/.test(e.stderr));
    assert.equal(await contentHash(await readFile(file, 'utf8')), hash);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
