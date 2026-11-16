import { classifyArtifact, isSpecCandidate } from '../core/artifacts.js';
import type { Artifact, ArtifactSet } from '../core/types.js';
interface Repo { default_branch: string; private: boolean }
interface Entry { path: string; type: string; size?: number; sha: string }
async function request<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'SpecTorque/0.1.0' }, redirect: 'error', signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(response.status === 403 || response.status === 429 ? 'GitHub rate limit reached. Try again later or import local files.' : `GitHub request failed (${response.status}). Check the repository and revision.`);
  const text = await response.text();
  if (text.length > 20_000_000) throw new Error('GitHub response too large. Select a smaller source.');
  return JSON.parse(text) as T;
}
export function parseGitHubSource(input: string): { owner: string; repo: string; ref?: string; folder?: string } {
  const text = input.trim();
  let parts: string[];
  if (text.startsWith('https://')) {
    const url = new URL(text);
    if (url.hostname !== 'github.com' || url.username || url.password || url.search || url.hash || url.port) throw new Error('Use a public github.com repository URL.');
    parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  } else parts = text.split('/');
  const [owner, rawRepo, kind, ref, ...folder] = parts;
  const repo = rawRepo?.replace(/\.git$/, '');
  if (!/^[a-z\d][a-z\d-]*$/i.test(owner ?? '') || !/^[\w.-]+$/.test(repo ?? '') || repo === '.' || repo === '..') throw new Error('Use owner/repo or a GitHub folder URL.');
  if (kind && kind !== 'tree') throw new Error('Use a repository or tree URL.');
  if (folder.some(p => p === '..' || p === '.' || p.includes('/'))) throw new Error('Invalid GitHub folder.');
  return { owner, repo, ref, folder: folder.join('/') || undefined };
}
export async function importGitHub(input: string): Promise<ArtifactSet> {
  const { owner, repo, ref, folder } = parseGitHubSource(input);
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const metadata = await request<Repo>(base);
  if (metadata.private) throw new Error('Only public repositories are supported.');
  const commit = await request<{ sha: string }>(`${base}/commits/${encodeURIComponent(ref ?? metadata.default_branch)}`);
  const tree = await request<{ tree: Entry[]; truncated: boolean }>(`${base}/git/trees/${commit.sha}?recursive=1`);
  if (tree.truncated) throw new Error('GitHub returned a truncated tree. Import a local feature folder instead.');
  const entries = tree.tree.filter(e => e.type === 'blob' && isSpecCandidate(e.path) && (!folder || e.path.startsWith(folder + '/')) && !/(?:^|\/)(?:node_modules|vendor|dist|\.git)\//.test(e.path));
  if (entries.length > 100) throw new Error('More than 100 candidate files. Use a feature folder URL.');
  if (entries.some(e => (e.size ?? 0) > 1_000_000)) throw new Error('A candidate file exceeds 1 MB. Import a smaller selection.');
  const artifacts: Artifact[] = [];
  for (let i = 0; i < entries.length; i += 5) {
    artifacts.push(...await Promise.all(entries.slice(i, i + 5).map(async entry => {
      const blob = await request<{ encoding: string; content: string }>(`${base}/git/blobs/${entry.sha}`);
      if (blob.encoding !== 'base64') throw new Error('Unsupported GitHub blob encoding.');
      return classifyArtifact(entry.path, Buffer.from(blob.content, 'base64').toString('utf8'));
    })));
  }
  return { name: `${owner}/${repo}@${commit.sha}`, artifacts };
}
