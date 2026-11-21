import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const repository = fileURLToPath(new URL('../..', import.meta.url));
export const git = (...args: string[]) => execFileSync('git', args, { cwd: repository, encoding: 'utf8' }).trim();
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
  const snapshot = execFileSync('git', ['archive', revision, 'package.json', 'src/core', 'src/node'], { cwd: repository });
  execFileSync('tar', ['-xf', '-', '-C', directory], { input: snapshot });
  return loadEngine(directory);
}
