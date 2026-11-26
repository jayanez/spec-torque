import { execFileSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const repository = fileURLToPath(new URL('../..', import.meta.url));
export const git = (...args: string[]) => execFileSync('git', args, { cwd: repository, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
export const commit = (ref: string) => git('rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`);

export async function loadEngine(root: string) {
  const load = (path: string) => import(pathToFileURL(join(root, path)).href);
  const [rules, artifacts, workspace] = await Promise.all([
    load('src/core/analyze.ts') as Promise<typeof import('../../src/core/analyze.js')>,
    load('src/core/artifacts.ts') as Promise<typeof import('../../src/core/artifacts.js')>,
    load('src/node/workspace.ts') as Promise<typeof import('../../src/node/workspace.js')>,
  ]);
  return { ...rules, ...artifacts, ...workspace };
}
export type Engine = Awaited<ReturnType<typeof loadEngine>>;

/** Extract the committed engine sources of one revision and import them. */
export async function archiveEngine(revision: string, directory: string): Promise<Engine> {
  await mkdir(directory);
  // Extract from a file, not stdin: bsdtar (macOS) stops reading at the end-of-archive marker,
  // so piping git archive's trailing padding into it can fail with EPIPE.
  const snapshot = join(directory, '.snapshot.tar');
  execFileSync('git', ['archive', '-o', snapshot, revision, 'package.json', 'src/core', 'src/node'], { cwd: repository });
  execFileSync('tar', ['-xf', snapshot, '-C', directory]);
  await rm(snapshot);
  return loadEngine(directory);
}
