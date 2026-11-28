import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { changedFeatures, indexWorkspace, loadScopeConfig, resolveImplicitRoot } from '../src/node/scope.js';
import { discoverWorkspace, readScope } from '../src/node/workspace.js';
import { analyze, selectFeature } from '../src/core.js';

const exec = promisify(execFile);
const git = (cwd: string, ...args: string[]) => exec('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'init.defaultBranch=main', '-c', 'protocol.file.allow=always', ...args], { cwd });
const cli = (cwd: string, ...args: string[]) => exec(process.execPath, ['--import', import.meta.resolve('tsx'), resolve('src/cli.ts'), ...args], { cwd });
async function put(root: string, path: string, content: string) { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), content); }
const spec = (id: string) => `# ${id}\n\n- FR-001: The system MUST confirm a booking within 2 seconds.\n`;

/** A git work tree with several features, a shared AGENTS.md and a committed baseline. */
async function repository(features = 3) {
  const root = await mkdtemp(join(tmpdir(), 'spectorque-scope-'));
  await git(root, 'init', '-q');
  await put(root, 'AGENTS.md', '# Agents\nUse specs/.\n');
  for (let i = 1; i <= features; i++) {
    const id = `specs/${String(i).padStart(3, '0')}-feature`;
    await put(root, `${id}/spec.md`, spec(id));
    await put(root, `${id}/plan.md`, '# Plan\nImplements FR-001.\n');
    await put(root, `${id}/tasks.md`, '- [ ] T001 Implement FR-001.\n');
  }
  await git(root, 'add', '-A'); await git(root, 'commit', '-qm', 'baseline');
  return root;
}

test('git boundary skips ignored and nested work trees, keeps unadded drafts and drops files missing from disk', async () => {
  const root = await repository(2);
  try {
    await put(root, '.gitignore', '.claude/worktrees/\n');
    for (const nested of ['.claude/worktrees/copy', 'vendor-tree/copy']) {
      await put(root, `${nested}/specs/900-copy/spec.md`, spec('copy'));
      await git(join(root, nested), 'init', '-q');
    }
    await put(root, 'specs/003-draft/spec.md', spec('draft'));
    await unlink(join(root, 'specs/002-feature/tasks.md'));
    // H92 (#92): framework templates are scaffolding, never indexed; a user `templates` folder is a feature.
    await put(root, '.specify/templates/spec-template.md', '# Feature Specification: [FEATURE NAME]\n');
    await put(root, '.kittify/missions/software-dev/templates/spec-template.md', '# Feature Specification: [FEATURE NAME]\n');
    await put(root, 'templates/spec.md', spec('user templates'));
    const index = await indexWorkspace(root);
    assert.equal(index.mode, 'git');
    assert.deepEqual(index.entries.map(e => e.path), [
      'AGENTS.md', 'specs/001-feature/plan.md', 'specs/001-feature/spec.md', 'specs/001-feature/tasks.md',
      'specs/002-feature/plan.md', 'specs/002-feature/spec.md', 'specs/003-draft/spec.md', 'templates/spec.md',
    ]);
    assert.deepEqual(index.features.map(f => [f.id, f.layout]), [['specs/001-feature', true], ['specs/002-feature', true], ['specs/003-draft', true], ['templates', false]]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the fallback walk stops at nested repositories', async () => {
  const root = await mkdtemp(join(tmpdir(), 'spectorque-walk-'));
  try {
    await put(root, 'specs/001-a/spec.md', spec('a'));
    await put(root, 'copies/other/.git', 'gitdir: elsewhere\n');
    await put(root, 'copies/other/specs/001-a/spec.md', spec('copy'));
    const index = await indexWorkspace(root);
    assert.equal(index.mode, 'walk');
    assert.deepEqual(index.entries.map(e => e.path), ['specs/001-a/spec.md']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('large workspaces index every feature and read one at a time with identical results', async () => {
  const root = await repository(120);
  try {
    const index = await indexWorkspace(root);
    assert.equal(index.entries.length, 361);
    await put(root, 'specs/121-extra/spec.md', spec('x'));
    for (let i = 0; i < 150; i++) await put(root, `specs/121-extra/notes/${i}-spec.md`, spec(String(i)));
    const large = await indexWorkspace(root);
    assert.equal(large.features.length, 121);
    await assert.rejects(discoverWorkspace(root, {}, large), /More than 500 artifacts in this scope/);
    const scoped = await discoverWorkspace(root, { feature: 'specs/007-feature' }, large);
    assert.deepEqual(scoped.artifacts.map(a => a.path), ['AGENTS.md', 'specs/007-feature/plan.md', 'specs/007-feature/spec.md', 'specs/007-feature/tasks.md']);
    const small = await discoverWorkspace(root, {}, index);
    const { createdAt: _a, ...expected } = await analyze(selectFeature(small, 'specs/007-feature'));
    const { createdAt: _b, ...actual } = await analyze(scoped);
    assert.deepEqual(actual, expected);
    const features = JSON.parse((await cli(root, 'features', '--json')).stdout);
    assert.equal(features.mode, 'git');
    assert.equal(features.features.length, 121);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a subfolder cwd keeps the work-tree root for classification and focuses the default read', async () => {
  const root = await repository(2);
  try {
    const implicit = await resolveImplicitRoot(join(root, 'specs/002-feature'));
    assert.equal(implicit.focus, 'specs/002-feature');
    const set = await readScope(await indexWorkspace(implicit.root, implicit.focus));
    assert.deepEqual(set.artifacts.map(a => [a.path, a.framework, a.featureId]), [
      ['AGENTS.md', 'generic', '(root)'],
      ['specs/002-feature/plan.md', 'spec-kit', 'specs/002-feature'],
      ['specs/002-feature/spec.md', 'spec-kit', 'specs/002-feature'],
      ['specs/002-feature/tasks.md', 'spec-kit', 'specs/002-feature'],
    ]);
    const report = JSON.parse((await cli(join(root, 'specs/002-feature'), 'analyze', '--json')).stdout);
    assert.ok(report.artifacts.every((a: { featureId: string; role: string }) => a.featureId === 'specs/002-feature' || a.role === 'instructions'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('configuration only widens inside the boundary and rejects escapes', async () => {
  const root = await repository(1);
  try {
    await put(root, '.gitignore', 'generated/\n');
    await put(root, 'generated/specs/050-gen/spec.md', spec('gen'));
    assert.ok(!(await indexWorkspace(root)).entries.some(e => e.path.startsWith('generated/')));
    await put(root, '.spectorque.json', JSON.stringify({ include: ['generated/specs/**'] }));
    assert.ok((await indexWorkspace(root)).entries.some(e => e.path === 'generated/specs/050-gen/spec.md'));
    for (const hostile of [{ include: ['../outside/**'] }, { include: ['/etc/**'] }, { include: [':(top)**'] }, { root: '/' }, { include: 'x' }]) {
      await put(root, '.spectorque.json', JSON.stringify(hostile));
      await assert.rejects(loadScopeConfig(root), /Invalid \.spectorque\.json/);
      await assert.rejects(indexWorkspace(root), /Invalid \.spectorque\.json/);
    }
    await put(root, '.spectorque.json', '{');
    await assert.rejects(indexWorkspace(root), /not valid JSON/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('submodules stay outside unless configuration includes them', async () => {
  const library = await repository(1);
  const root = await repository(1);
  try {
    await git(root, 'submodule', 'add', '-q', library, 'lib');
    assert.ok(!(await indexWorkspace(root)).entries.some(e => e.path.startsWith('lib/')));
    await put(root, '.spectorque.json', JSON.stringify({ submodules: true }));
    assert.ok((await indexWorkspace(root)).entries.some(e => e.path === 'lib/specs/001-feature/spec.md'));
  } finally { await rm(root, { recursive: true, force: true }); await rm(library, { recursive: true, force: true }); }
});

test('changed narrows to features touched on the branch, including uncommitted edits', async () => {
  const root = await repository(3);
  try {
    await git(root, 'switch', '-qc', 'work');
    await put(root, 'specs/002-feature/plan.md', '# Plan\nImplements FR-001 with a cache.\n');
    await git(root, 'commit', '-qam', 'edit');
    await put(root, 'specs/003-feature/spec.md', spec('edited'));
    await put(root, 'AGENTS.md', '# Agents\nChanged.\n');
    const index = await indexWorkspace(root);
    assert.deepEqual(await changedFeatures(index, 'main'), ['specs/002-feature', 'specs/003-feature']);
    await assert.rejects(changedFeatures(index), /explicit base/);
    await assert.rejects(changedFeatures(index, '--output=x'), /Invalid base/);
    const set = await readScope(index, { changed: true, base: 'main' });
    assert.ok(!set.artifacts.some(a => a.featureId === 'specs/001-feature'));
    await assert.rejects(readScope(index, { feature: 'specs/001-feature', changed: true }), /only one/);
    await assert.rejects(readScope(index, { paths: ['../x'] }), /relative/);
    await assert.rejects(readScope(index, { feature: 'missing' }), /Unknown feature: missing/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the Codex binding offers features without an unscoped read on large worktrees and narrows to changed features', async () => {
  const { bindWorkspace } = await import('../src/node/scoped-review.js');
  const root = await repository(2);
  try {
    for (let i = 0; i < 520; i++) await put(root, `specs/003-big/notes/${i}-spec.md`, spec(String(i)));
    await git(root, 'add', '-A'); await git(root, 'commit', '-qm', 'big');
    const binding = await bindWorkspace(root);
    const unscoped = await binding.assess(null);
    assert.equal(unscoped.assessment, null);
    assert.ok(unscoped.total > 500);
    assert.deepEqual(unscoped.features, ['specs/001-feature', 'specs/002-feature', 'specs/003-big']);
    assert.ok((await binding.assess('specs/001-feature')).assessment.findings);
    await git(root, 'switch', '-qc', 'work');
    await put(root, 'specs/002-feature/plan.md', '# Plan\nChanged FR-001.\n');
    const changed = await binding.assess(null, { changed: true, base: 'main' });
    assert.equal(changed.feature, 'specs/002-feature');
    assert.ok(changed.assessment);
  } finally { await rm(root, { recursive: true, force: true }); }
});
