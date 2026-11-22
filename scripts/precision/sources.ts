/**
 * Shared enumeration of scan roots: pinned Git snapshots, target spec artifacts and lineages.
 * Used by the replay scan and by the adjudication packet builder.
 */
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import type { Engine } from './engines.js';

export const rootSchema = z.array(z.strictObject({
  id: z.string().regex(/^[A-Za-z0-9_.-]+$/u),
  /** Repository identity used for independence; clones of one upstream share it. */
  repository: z.string().min(1),
  path: z.string().min(1),
  ref: z.string().default('HEAD'),
  restricted: z.boolean(),
})).min(1);
export type Root = z.infer<typeof rootSchema>[number];

export const openSpecTarget = /(?:^|\/)openspec\/(?:specs\/(?:[^/]+\/)*spec\.md|changes\/(?!archive\/)[^/]+\/specs\/(?:[^/]+\/)*spec\.md)$/iu;

export function lineageOf(path: string, framework: string, featureId: string) {
  if (framework !== 'openspec' && framework !== 'spec-kit') return `${framework}:${featureId.toLowerCase()}`;
  const open = /openspec\/(?:changes\/[^/]+\/)?specs\/(.+)\/spec\.md$/iu.exec(path);
  if (open) return `openspec:${open[1].toLowerCase()}`;
  const kit = /(?:^|\/)specs\/(?:\d+-)?([^/]+)\//iu.exec(path);
  return `spec-kit:${(kit?.[1] ?? path).toLowerCase()}`;
}

/** Committed Markdown files of a root at its pinned ref; the working tree is never read. */
export function snapshot(root: Root) {
  // Capture stderr: git messages can contain restricted paths.
  const run = (...args: string[]) => execFileSync('git', ['-C', root.path, ...args], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });
  const sha = run('rev-parse', '--verify', '--end-of-options', `${root.ref}^{commit}`).toString().trim();
  const paths = run('ls-tree', '-r', '-z', '--name-only', sha).toString().split('\0').filter(path => /\.md$/iu.test(path));
  const files = new Map<string, string>();
  for (const path of paths) {
    const bytes = run('cat-file', 'blob', `${sha}:${path}`);
    if (bytes.length > 1_000_000) continue;
    files.set(path, new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes));
  }
  return { sha, files };
}

export const classifyAll = (engine: Engine, files: Map<string, string>) =>
  [...files].filter(([path]) => engine.isSpecCandidate(path)).map(([path, content]) => engine.classifyArtifact(path, content));

/** Pre-registered primary population (OpenSpec, Spec Kit) plus every other supported family. */
export const targetsOf = (artifacts: ReturnType<typeof classifyAll>) => artifacts.filter(artifact =>
  !artifact.archived && artifact.role === 'spec' && (
    artifact.framework === 'openspec' ? openSpecTarget.test(artifact.path)
      : artifact.framework === 'spec-kit' ? /(?:^|\/)spec\.md$/iu.test(artifact.path) : true));
