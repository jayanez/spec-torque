import { execFile } from 'node:child_process';
import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import { classifyPath, isSpecCandidate, listFeatures, type FeatureSummary, type PathClassification } from '../core/artifacts.js';

/** Directory names never read as project input, in git and walk mode alike. */
export const excludedNames = new Set(['.git', 'node_modules', 'dist', 'web-dist', 'coverage', '.venv', 'vendor', '.spec-torque', '.spectorque']);
const MAX_DEPTH = 12;
const MAX_VISITED = 25_000;
const MAX_INDEXED = 25_000;
const CONFIG_FILE = '.spectorque.json';

export type DiscoveryMode = 'git' | 'walk';
export interface WorkspaceIndex {
  root: string; name: string; mode: DiscoveryMode;
  /** Root-relative folder the caller started in, when it is below the root. */
  focus: string | null;
  entries: PathClassification[];
  features: FeatureSummary[];
}

const byCodePoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// Git runs without a shell, without repository-configured filesystem monitors and without
// inherited repository overrides, so a hostile checkout cannot redirect or execute anything.
function git(cwd: string, args: string[]): Promise<string> {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_CEILING_DIRECTORIES', 'GIT_EXTERNAL_DIFF']) delete env[key];
  return new Promise((done, fail) => execFile('git', ['-c', 'core.fsmonitor=false', '-c', 'diff.external=', ...args], { cwd, env, maxBuffer: 256 * 1024 * 1024, timeout: 60_000, windowsHide: true }, (error, stdout) => error ? fail(error) : done(stdout)));
}
const lines0 = (out: string) => out.split('\0').filter(Boolean);

/** The git work tree containing `directory`, or null outside git (or when git is unavailable). */
export async function gitWorkTree(directory: string): Promise<{ toplevel: string; prefix: string } | null> {
  try {
    const [toplevel = '', prefix = ''] = (await git(directory, ['rev-parse', '--show-toplevel', '--show-prefix'])).split(/\r?\n/);
    if (!toplevel) return null;
    return { toplevel: await realpath(toplevel), prefix: prefix.replace(/\/+$/, '') };
  } catch { return null; }
}

/**
 * Implicit root: the toplevel of the work tree that contains `cwd`, focused on `cwd` when it is
 * a subfolder. Outside git the root is `cwd` itself. Explicit roots never go through here.
 */
export async function resolveImplicitRoot(cwd: string): Promise<{ root: string; focus: string | null }> {
  const tree = await gitWorkTree(cwd);
  if (!tree) return { root: await realpath(cwd), focus: null };
  return { root: tree.toplevel, focus: tree.prefix || null };
}

export interface ScopeConfig { include: string[]; submodules: boolean }

// Validated by hand: discovery stays dependency-free so archived engine revisions can be replayed.
function parseScopeConfig(raw: unknown): ScopeConfig {
  const problems: string[] = [];
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error(`Invalid ${CONFIG_FILE}: root: expected an object`);
  const value = raw as Record<string, unknown>;
  for (const key of Object.keys(value)) if (key !== 'include' && key !== 'submodules') problems.push(`${key}: unrecognized key`);
  const include = value.include ?? [];
  if (!Array.isArray(include) || include.length > 50) problems.push('include: expected at most 50 glob strings');
  else include.forEach((glob, i) => {
    if (typeof glob !== 'string' || !glob || glob.length > 500) problems.push(`include.${i}: expected a non-empty string up to 500 characters`);
    else if (/^[\\/]|^[A-Za-z]:|^:|\\/.test(glob) || glob.split('/').includes('..')) problems.push(`include.${i}: use relative glob patterns inside the work tree (no "..", absolute paths, backslashes or pathspec magic)`);
  });
  const submodules = value.submodules ?? false;
  if (typeof submodules !== 'boolean') problems.push('submodules: expected a boolean');
  if (problems.length) throw new Error(`Invalid ${CONFIG_FILE}: ${problems.join('; ')}`);
  return { include: include as string[], submodules: submodules as boolean };
}

/** Reads `.spectorque.json` at the root. Configuration may only widen discovery inside the work tree. */
export async function loadScopeConfig(root: string): Promise<ScopeConfig> {
  const file = join(root, CONFIG_FILE);
  const info = await lstat(file).catch(() => null);
  if (!info) return { include: [], submodules: false };
  if (!info.isFile()) throw new Error(`${CONFIG_FILE} must be a regular file.`);
  if (info.size > 65_536) throw new Error(`${CONFIG_FILE} exceeds 64 KB.`);
  let raw: unknown;
  try { raw = JSON.parse(await readFile(file, 'utf8')); } catch { throw new Error(`${CONFIG_FILE} is not valid JSON.`); }
  return parseScopeConfig(raw);
}

const excludedPath = (path: string) => path.split('/').some(segment => excludedNames.has(segment) || segment.startsWith('.env'));

async function listWithGit(root: string, config: ScopeConfig): Promise<string[]> {
  const files = new Set<string>();
  // Nested work trees, submodules and embedded repositories appear as one `dir/` entry: never crossed.
  for (const path of lines0(await git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '.']))) files.add(path);
  if (config.submodules) for (const path of lines0(await git(root, ['ls-files', '-z', '--cached', '--recurse-submodules', '--', '.']))) files.add(path);
  if (config.include.length) for (const path of lines0(await git(root, ['ls-files', '-z', '--others', '--ignored', '--exclude-standard', '--', ...config.include.map(glob => `:(glob)${glob}`)]))) files.add(path);
  return [...files].filter(path => !path.endsWith('/'));
}

async function listWithWalk(root: string): Promise<string[]> {
  const files: string[] = [];
  let visited = 0;
  async function walk(directory: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH) throw new Error(`Directory depth exceeds ${MAX_DEPTH}; choose a smaller workspace.`);
    const entries = (await readdir(directory, { withFileTypes: true })).sort((a, b) => byCodePoint(a.name, b.name));
    // A nested repository or work tree has its own boundary.
    if (depth > 0 && entries.some(entry => entry.name === '.git')) return;
    for (const entry of entries) {
      if (++visited > MAX_VISITED) throw new Error('Workspace is too large; open a git work tree or narrow the scope with --feature or --path.');
      if (entry.isSymbolicLink() || excludedNames.has(entry.name) || entry.name.startsWith('.env')) continue;
      const full = join(directory, entry.name);
      if (entry.isDirectory()) await walk(full, depth + 1);
      else if (entry.isFile()) files.push(relative(root, full).replaceAll('\\', '/'));
    }
  }
  await walk(root, 0);
  return files;
}

/** Lists Markdown candidates inside the boundary and classifies them by path, without reading content. */
export async function indexWorkspace(rootInput: string, focus: string | null = null): Promise<WorkspaceIndex> {
  const root = await realpath(resolve(rootInput));
  const config = await loadScopeConfig(root);
  const tree = await gitWorkTree(root);
  // An explicitly chosen folder that its repository ignores is still read, as a plain folder.
  const ignored = tree?.prefix ? await git(tree.toplevel, ['check-ignore', '-q', '--', tree.prefix + '/']).then(() => true, () => false) : false;
  const mode: DiscoveryMode = tree && !ignored ? 'git' : 'walk';
  const listed = mode === 'git' ? await listWithGit(root, config) : await listWithWalk(root);
  const candidates = listed.filter(path => isSpecCandidate(path, true) && !excludedPath(path)).sort(byCodePoint);
  if (candidates.length > MAX_INDEXED) throw new Error('Workspace is too large; narrow the scope with --feature or --path.');
  const entries: PathClassification[] = [];
  for (const path of candidates) {
    if (path.split('/').length - 1 > MAX_DEPTH) throw new Error(`Directory depth exceeds ${MAX_DEPTH}; choose a smaller workspace.`);
    // Sparse checkouts list paths absent from disk; symbolic links are never followed.
    const info = await lstat(join(root, path)).catch(() => null);
    if (!info?.isFile()) continue;
    entries.push(classifyPath(path));
  }
  return { root, name: basename(root), mode, focus, entries, features: listFeatures(entries) };
}

/**
 * Root-relative paths changed on the current branch: committed since the merge-base with `base`,
 * plus uncommitted and untracked changes. `base` defaults to the remote default branch.
 */
export async function changedPaths(root: string, base?: string): Promise<string[]> {
  if (!await gitWorkTree(root)) throw new Error('--changed needs a git work tree.');
  let target = base;
  if (!target) {
    const remoteHead = await git(root, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']).then(s => s.trim(), () => '');
    if (!remoteHead) throw new Error('No default upstream branch found. Pass an explicit base, for example --changed=develop.');
    target = remoteHead;
  }
  if (!/^[\w./@^~-]+$/.test(target) || target.startsWith('-')) throw new Error('Invalid base revision.');
  const mergeBase = (await git(root, ['merge-base', 'HEAD', target]).catch(() => { throw new Error(`Cannot find a merge-base with ${target}. Pass an explicit base.`); })).trim();
  const changed = new Set([
    ...lines0(await git(root, ['diff', '--no-ext-diff', '--no-textconv', '--name-only', '-z', '--relative', mergeBase, '--', '.'])),
    ...lines0(await git(root, ['ls-files', '-z', '--others', '--exclude-standard', '--', '.'])),
  ]);
  return [...changed].sort(byCodePoint);
}

/** Features with at least one changed non-instruction artifact. */
export async function changedFeatures(index: WorkspaceIndex, base?: string): Promise<string[]> {
  const changed = new Set(await changedPaths(index.root, base));
  const touched = new Set(index.entries.filter(e => e.role !== 'instructions' && changed.has(e.path)).map(e => e.featureId));
  return index.features.map(f => f.id).filter(id => touched.has(id));
}
