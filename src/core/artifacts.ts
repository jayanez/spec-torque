import type { Artifact, Framework, Role } from './types.js';
export function classifyArtifact(path: string, content: string): Artifact {
  const p = path.replaceAll('\\', '/');
  const lower = p.toLowerCase();
  const base = lower.split('/').at(-1) ?? '';
  const framework: Framework = /(?:^|\/)\.kiro\/specs\//.test(lower) ? 'kiro'
    : /(?:^|\/)openspec\//.test(lower) ? 'openspec'
    : /(?:^|\/)\.spec\//.test(lower) ? 'zeespec'
    : /(?:^|\/)(?:_bmad|_bmad-output)\//.test(lower) ? 'bmad'
    : /(?:^|\/)\.kittify\//.test(lower) || /spec[- ]kitty/i.test(content.slice(0, 500)) ? 'spec-kitty'
    : /(?:^|\/)specs\/[^/]+\//.test(lower) || lower.includes('.specify/') ? 'spec-kit' : 'generic';
  const role: Role = /^(agents|claude|gemini|copilot-instructions)\.md$/.test(base) ? 'instructions'
    : /task|todo|work.?package/i.test(base) ? 'tasks'
    : /plan|design|architecture/i.test(base) ? 'plan'
    : /spec|requirement|prd|proposal|what|who|when|where|why|how/i.test(base) ? 'spec' : 'context';
  const marker = framework === 'kiro' ? '.kiro/specs/' : framework === 'openspec' ? 'openspec/changes/' : 'specs/';
  const markerAt = lower.indexOf(marker);
  const featureId = markerAt >= 0 ? p.slice(0, markerAt + marker.length) + p.slice(markerAt + marker.length).split('/')[0]
    : p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '(root)';
  return { path: p, content, role, framework, featureId, archived: /(?:^|\/)(archive|archives|archived)(?:\/|$)/i.test(p) };
}
export const isSpecCandidate = (path: string): boolean => /\.md$/i.test(path) && /(?:spec|requirement|prd|plan|design|task|todo|agents|claude|gemini|constitution|architecture|what|where|when|who|why|how)/i.test(path);
export async function contentHash(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}
