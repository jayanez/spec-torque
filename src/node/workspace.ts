import { readdir, readFile, realpath, stat, mkdir, writeFile, rename, unlink, open } from 'node:fs/promises';
import { resolve, relative, isAbsolute, dirname, basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { classifyArtifact, isSpecCandidate, contentHash } from '../core/artifacts.js';
import { applyProposal } from '../core/refine.js';
import type { Artifact, ArtifactSet, PatchProposal } from '../core/types.js';
const excluded = new Set(['.git', 'node_modules', 'dist', 'web-dist', 'coverage', '.venv', 'vendor', '.spec-torque', '.spectorque']);
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
export async function discoverWorkspace(root: string): Promise<ArtifactSet> {
  const canonicalRoot = await realpath(root);
  const artifacts: Artifact[] = [];
  let visited = 0;
  async function walk(directory: string, depth: number): Promise<void> {
    if (depth > 12) throw new Error('Directory depth exceeds 12; choose a smaller workspace.');
    const entries = (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (++visited > 25_000) throw new Error('Workspace is too large; select a feature folder.');
      if (entry.isSymbolicLink() || excluded.has(entry.name) || entry.name.startsWith('.env')) continue;
      const full = join(directory, entry.name);
      if (entry.isDirectory()) await walk(full, depth + 1);
      else if (entry.isFile()) {
        const path = relative(canonicalRoot, full).replaceAll('\\', '/');
        if (!isSpecCandidate(path, true)) continue;
        if ((await stat(full)).size > 1_000_000) throw new Error(`Artifact exceeds 1 MB: ${entry.name}`);
        if (artifacts.length >= 500) throw new Error('More than 500 artifacts; select a feature folder.');
        artifacts.push(classifyArtifact(path, await readFile(full, 'utf8')));
      }
    }
  }
  await walk(canonicalRoot, 0);
  return { name: basename(canonicalRoot), artifacts };
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
