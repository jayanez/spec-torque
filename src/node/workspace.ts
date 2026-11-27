import { readFile, realpath, stat, mkdir, writeFile, rename, unlink, open } from 'node:fs/promises';
import { resolve, relative, isAbsolute, dirname, basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { classifyArtifact, contentHash, inFeatureScope, inPathScope, isFrameworkTemplate } from '../core/artifacts.js';
import { changedFeatures, indexWorkspace, type WorkspaceIndex } from './scope.js';
import { applyProposal } from '../core/refine.js';
import type { Artifact, ArtifactSet, PatchProposal } from '../core/types.js';
function lexicalPath(root: string, path: string): string {
  if (!path || isAbsolute(path) || path.includes('\0')) throw new Error('Invalid relative artifact path.');
  const target = resolve(root, path);
  const rel = relative(root, target);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Artifact path is outside the workspace.');
  return target;
}
export async function resolveArtifactPath(root: string, path: string): Promise<string> {
  const canonicalRoot = await realpath(root);
  const target = await realpath(lexicalPath(canonicalRoot, path));
  const rel = relative(canonicalRoot, target);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Artifact path resolves outside the workspace.');
  if (!/\.md$/i.test(target)) throw new Error('Only Markdown artifacts may be edited.');
  return target;
}
export interface DiscoveryScope {
  /** One feature ID (its artifacts plus ancestor instructions). */
  feature?: string | null;
  /** Several feature IDs, read together. */
  features?: string[];
  /** Root-relative folder or file prefixes (plus ancestor instructions). */
  paths?: string[];
}
const MAX_ARTIFACTS = 500;

/** Reads the selected scope of a workspace. Discovery of the boundary itself never reads content. */
export async function discoverWorkspace(root: string, scope: DiscoveryScope = {}, index?: WorkspaceIndex): Promise<ArtifactSet> {
  const workspace = index ?? await indexWorkspace(root);
  const { feature = null, features, paths } = scope;
  const selected = workspace.entries.filter(entry =>
    (feature === null || inFeatureScope(entry, feature)) &&
    (!features || features.some(id => inFeatureScope(entry, id))) &&
    (!paths || inPathScope(entry, paths)));
  if (selected.length > MAX_ARTIFACTS) {
    throw new Error(`More than ${MAX_ARTIFACTS} artifacts in this scope (${selected.length}, ${workspace.features.length} features). Select a feature with --feature, or narrow with --path or --changed.`);
  }
  const artifacts: Artifact[] = [];
  for (const entry of selected) {
    const full = join(workspace.root, entry.path);
    if ((await stat(full)).size > 1_000_000) throw new Error(`Artifact exceeds 1 MB: ${basename(entry.path)}`);
    artifacts.push(classifyArtifact(entry.path, await readFile(full, 'utf8')));
  }
  return { name: workspace.name, artifacts };
}
export interface ScopeRequest { feature?: string | null; paths?: string[]; changed?: boolean; base?: string }

/**
 * Turns invocation modifiers into a read. Modifiers only narrow: one of feature, paths or changed;
 * otherwise the index focus (a subfolder cwd) or the whole boundary.
 */
export async function readScope(index: WorkspaceIndex, request: ScopeRequest = {}): Promise<ArtifactSet> {
  const feature = request.feature ?? null;
  const paths = request.paths?.length ? request.paths : undefined;
  if ([feature !== null, Boolean(paths), Boolean(request.changed)].filter(Boolean).length > 1) throw new Error('Use only one of feature, paths or changed.');
  if (request.base !== undefined && !request.changed) throw new Error('A base revision requires changed.');
  if (paths?.some(p => isAbsolute(p) || p.replaceAll('\\', '/').split('/').includes('..'))) throw new Error('Paths must be relative to the workspace.');
  // H92 (#92): an explicit scope inside a framework template folder would read nothing; say why.
  const template = [feature, ...(paths ?? []), request.changed ? null : index.focus].find(p => p && isFrameworkTemplate(p.replace(/[\\/]+$/, '') + '/'));
  if (template) throw new Error(`${template} is a Spec Kit or Spec Kitty template folder; templates are not analyzed.`);
  if (feature !== null) {
    if (!index.entries.some(a => a.featureId === feature && a.role !== 'instructions')) throw new Error(`Unknown feature: ${feature}`);
    return discoverWorkspace(index.root, { feature }, index);
  }
  if (paths) return discoverWorkspace(index.root, { paths }, index);
  if (request.changed) {
    const features = await changedFeatures(index, request.base);
    if (!features.length) throw new Error('No feature changed on this branch.');
    return discoverWorkspace(index.root, { features }, index);
  }
  return discoverWorkspace(index.root, index.focus ? { paths: [index.focus] } : {}, index);
}

export async function readWorkspaceArtifactBytes(root: string, path: string): Promise<Buffer> {
  const target = await resolveArtifactPath(root, path);
  if ((await stat(target)).size > 1_000_000) throw new Error('Artifact exceeds 1 MB.');
  const bytes = await readFile(target);
  if (bytes.length > 1_000_000) throw new Error('Artifact exceeds 1 MB.');
  return bytes;
}
export async function readWorkspaceArtifact(root: string, path: string): Promise<string> {
  return (await readWorkspaceArtifactBytes(root, path)).toString('utf8');
}
export async function applyWorkspaceProposal(root: string, proposal: PatchProposal): Promise<string> {
  const content = await readWorkspaceArtifact(root, proposal.path);
  const updated = await applyProposal(content, proposal);
  await replaceWorkspaceContent(root, proposal.path, proposal.baseHash, updated);
  return updated;
}
export async function replaceWorkspaceContent(root: string, path: string, expectedHash: string, updated: string): Promise<void> {
  const target = await resolveArtifactPath(root, path);
  const lockPath = `${target}.spectorque-lock`;
  const lock = await open(lockPath, 'wx').catch(() => { throw new Error('Another edit is in progress.'); });
  const temp = `${target}.${randomUUID()}.tmp`;
  try {
    const content = await readFile(target, 'utf8');
    if (await contentHash(content) !== expectedHash) throw new Error('Source changed: this edit is stale.');
    const mode = (await stat(target)).mode;
    await writeFile(temp, updated, { flag: 'wx', mode });
    if (await readFile(target, 'utf8') !== content) throw new Error('Source changed during the edit.');
    await rename(temp, target);
  } finally {
    await lock.close();
    await unlink(lockPath).catch(() => {});
    await unlink(temp).catch(() => {});
  }
}
export async function writeNewArtifacts(root: string, artifacts: Artifact[]): Promise<void> {
  const canonicalRoot = await realpath(root);
  const targets = artifacts.map(a => lexicalPath(canonicalRoot, a.path));
  if (new Set(targets).size !== targets.length) throw new Error('Duplicate artifact paths.');
  for (const target of targets) {
    if (!/\.md$/i.test(target)) throw new Error('Only Markdown output is supported.');
    let parent = dirname(target);
    while (parent !== canonicalRoot) {
      try {
        const canonicalParent = await realpath(parent);
        const rel = relative(canonicalRoot, canonicalParent);
        if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Output path resolves outside the workspace.');
        break;
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      parent = dirname(parent);
    }
    if (await stat(target).then(() => true, e => { if (e.code === 'ENOENT') return false; throw e; })) throw new Error('Output already exists; choose another project name.');
  }
  const created: string[] = [];
  try {
    for (let i = 0; i < targets.length; i++) {
      await mkdir(dirname(targets[i]), { recursive: true });
      await writeFile(targets[i], artifacts[i].content, { flag: 'wx' });
      created.push(targets[i]);
    }
  } catch (error) { await Promise.all(created.map(path => unlink(path))); throw error; }
}
