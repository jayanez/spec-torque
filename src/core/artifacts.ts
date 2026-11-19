import type { Artifact, ArtifactSet, Framework, Role } from './types.js';

const kittyMission = /(?:^|\/)kitty-specs\/[^/]+\//i;
const kittyWorkPackage = /(?:^|\/)kitty-specs\/[^/]+\/tasks\/WP\d+(?:-[^/]+)?\.md$/i;
const openSpecArchive = /(?:^|\/)openspec\/changes\/archive\/\d{4}-\d{2}-\d{2}-[^/]+\//i;
const bmadTask = /(?:^|\/)_(?:bmad|bmad-output)\/(?:planning-artifacts\/(?:[^/]+\/)*epics\.md|implementation-artifacts\/\d+-\d+-[^/]+\.md|initiatives\/(?:[^/]+\/)+(?:epics\.md|story-[^/]+\/story\.md))$/i;
const zeeContext = /(?:^|\/)\.spec\/(?:who|where|when|why|upstream|downstream)\.md$/i;
const zeePlan = /(?:^|\/)\.spec\/how\.md$/i;
const specKitDataModel = /(?:^|\/)specs\/\d{3}-[^/]+\/data-model\.md$/i;
const byName = /spec|requirement|prd|plan|design|task|todo|agents|claude|gemini|constitution|architecture|what|where|when|who|why|how/i;

export function classifyArtifact(path: string, content: string): Artifact {
  const p = path.replaceAll('\\', '/');
  const lower = p.toLowerCase();
  const base = lower.split('/').at(-1) ?? '';
  const mission = kittyMission.exec(p);
  const framework: Framework = /(?:^|\/)\.kiro\/specs\//.test(lower) ? 'kiro'
    : /(?:^|\/)openspec\//.test(lower) ? 'openspec'
    : /(?:^|\/)\.spec\//.test(lower) ? 'zeespec'
    : /(?:^|\/)(?:_bmad|_bmad-output)\//.test(lower) ? 'bmad'
    : mission || /(?:^|\/)\.kittify\//.test(lower) || /spec[- ]kitty/i.test(content.slice(0, 500)) ? 'spec-kitty'
    : /(?:^|\/)specs\/[^/]+\//.test(lower) || lower.includes('.specify/') ? 'spec-kit' : 'generic';
  const role: Role = /^(agents|claude|gemini|copilot-instructions)\.md$/.test(base) ? 'instructions'
    : (framework === 'spec-kitty' && kittyWorkPackage.test(p)) || (framework === 'bmad' && bmadTask.test(p)) ||
      /task|todo|work.?package/i.test(base) ? 'tasks'
    : (framework === 'zeespec' && zeePlan.test(p)) || /plan|design|architecture/i.test(base) ? 'plan'
    : framework === 'zeespec' && zeeContext.test(p) ? 'context'
    : /spec|requirement|prd|proposal|what|who|when|where|why|how/i.test(base) ? 'spec' : 'context';
  const scopedPath = framework === 'spec-kitty' ? mission : framework === 'openspec' ? openSpecArchive.exec(p) : null;
  const marker = framework === 'kiro' ? '.kiro/specs/' : framework === 'openspec' ? 'openspec/changes/' : 'specs/';
  const markerAt = lower.indexOf(marker);
  const featureId = scopedPath ? p.slice(0, scopedPath.index + scopedPath[0].length - 1)
    : markerAt >= 0 ? p.slice(0, markerAt + marker.length) + p.slice(markerAt + marker.length).split('/')[0]
    : p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '(root)';
  return { path: p, content, role, framework, featureId, archived: /(?:^|\/)(archive|archives|archived)(?:\/|$)/i.test(p) };
}

export function isSpecCandidate(path: string, basenameOnly = false): boolean {
  const normalized = path.replaceAll('\\', '/');
  const legacyPath = basenameOnly ? normalized.slice(normalized.lastIndexOf('/') + 1) : normalized;
  return /\.md$/i.test(normalized) && (byName.test(legacyPath) || kittyWorkPackage.test(normalized) ||
    bmadTask.test(normalized) || zeeContext.test(normalized) || specKitDataModel.test(normalized));
}
export async function contentHash(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}

export function selectFeature(set: ArtifactSet, feature: string | null): ArtifactSet {
  if (feature === null) return set;
  const selected = feature.replaceAll('\\', '/') + '/';
  return {
    ...set,
    artifacts: set.artifacts.filter(artifact => {
      if (artifact.role !== 'instructions') return artifact.featureId === feature;
      if (artifact.archived) return false;
      const path = artifact.path.replaceAll('\\', '/');
      const directory = path.slice(0, path.lastIndexOf('/') + 1);
      return selected.startsWith(directory);
    }),
  };
}
