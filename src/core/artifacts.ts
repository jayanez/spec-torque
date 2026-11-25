import type { Artifact, ArtifactSet, Framework, Role } from './types.js';

const kittyMission = /(?:^|\/)kitty-specs\/[^/]+\//i;
const kittyWorkPackage = /(?:^|\/)kitty-specs\/[^/]+\/tasks\/WP\d+(?:-[^/]+)?\.md$/i;
const openSpecArchive = /(?:^|\/)openspec\/changes\/archive\/\d{4}-\d{2}-\d{2}-[^/]+\//i;
const openSpecProposal = /(?:^|\/)openspec\/changes\/(?:archive\/)?[^/]+\/proposal\.md$/i;
const bmadTask = /(?:^|\/)_(?:bmad|bmad-output)\/(?:planning-artifacts\/(?:[^/]+\/)*epics\.md|implementation-artifacts\/\d+-\d+-[^/]+\.md|initiatives\/(?:[^/]+\/)+(?:epics\.md|story-[^/]+\/story\.md))$/i;
const zeeContext = /(?:^|\/)\.spec\/(?:who|where|when|why|upstream|downstream)\.md$/i;
const zeePlan = /(?:^|\/)\.spec\/how\.md$/i;
const specKitDataModel = /(?:^|\/)specs\/\d{3}-[^/]+\/data-model\.md$/i;
// H6 (#88): the Spec Kit quickstart holds the feature's run and test commands.
const specKitQuickstart = /(?:^|\/)specs\/\d{3}-[^/]+\/quickstart\.md$/i;
const byName = /spec|requirement|prd|plan|design|task|todo|agents|claude|gemini|constitution|architecture|what|where|when|who|why|how/i;

/** Path-derived classification. Content can only refine the framework label (Spec Kitty banner). */
export interface PathClassification { path: string; role: Role; framework: Framework; featureId: string; archived: boolean }

export function classifyPath(path: string, content = ''): PathClassification {
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
    : (framework === 'zeespec' && zeeContext.test(p)) || (framework === 'openspec' && openSpecProposal.test(p)) ? 'context'
    : /spec|requirement|prd|proposal|what|who|when|where|why|how/i.test(base) ? 'spec' : 'context';
  const scopedPath = framework === 'spec-kitty' ? mission : framework === 'openspec' ? openSpecArchive.exec(p) : null;
  const marker = framework === 'kiro' ? '.kiro/specs/' : framework === 'openspec' ? 'openspec/changes/' : 'specs/';
  const markerAt = lower.indexOf(marker);
  const featureId = scopedPath ? p.slice(0, scopedPath.index + scopedPath[0].length - 1)
    : markerAt >= 0 ? p.slice(0, markerAt + marker.length) + p.slice(markerAt + marker.length).split('/')[0]
    : p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '(root)';
  return { path: p, role, framework, featureId, archived: /(?:^|\/)(archive|archives|archived)(?:\/|$)/i.test(p) };
}

export function classifyArtifact(path: string, content: string): Artifact {
  const { path: p, role, framework, featureId, archived } = classifyPath(path, content);
  return { path: p, content, role, framework, featureId, archived };
}

export function isSpecCandidate(path: string, basenameOnly = false): boolean {
  const normalized = path.replaceAll('\\', '/');
  const legacyPath = basenameOnly ? normalized.slice(normalized.lastIndexOf('/') + 1) : normalized;
  return /\.md$/i.test(normalized) && (byName.test(legacyPath) || kittyWorkPackage.test(normalized) ||
    openSpecProposal.test(normalized) || bmadTask.test(normalized) || zeeContext.test(normalized) ||
    specKitDataModel.test(normalized) || specKitQuickstart.test(normalized));
}
export async function contentHash(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}

type Scoped = Pick<PathClassification, 'path' | 'role' | 'featureId' | 'archived'>;
const directoryOf = (path: string) => { const p = path.replaceAll('\\', '/'); return p.slice(0, p.lastIndexOf('/') + 1); };

/** Whether an artifact belongs to a feature scope: the feature's own artifacts plus active ancestor instructions. */
export function inFeatureScope(artifact: Scoped, feature: string): boolean {
  if (artifact.role !== 'instructions') return artifact.featureId === feature;
  if (artifact.archived) return false;
  return (feature.replaceAll('\\', '/') + '/').startsWith(directoryOf(artifact.path));
}

/** Whether an artifact lies under one of the path prefixes, or is an active instruction file above one of them. */
export function inPathScope(artifact: Scoped, prefixes: string[]): boolean {
  const path = artifact.path.replaceAll('\\', '/');
  return prefixes.some(prefix => {
    const p = prefix.replaceAll('\\', '/').replace(/\/+$/, '');
    if (p === '' || path === p || path.startsWith(p + '/')) return true;
    return artifact.role === 'instructions' && !artifact.archived && (p + '/').startsWith(directoryOf(path));
  });
}

export function selectFeature(set: ArtifactSet, feature: string | null): ArtifactSet {
  if (feature === null) return set;
  return { ...set, artifacts: set.artifacts.filter(artifact => inFeatureScope(artifact, feature)) };
}

/** Documents read at once. Larger work trees are read one feature (or folder) at a time. */
export const READ_LIMIT = 500;
/** Whether a whole work tree fits one read: an index with its entries, or a host's document total. */
export const fitsReadLimit = (index: { entries: readonly unknown[] } | { total: number }) => ('total' in index ? index.total : index.entries.length) <= READ_LIMIT;

export interface FeatureSummary { id: string; framework: Framework; layout: boolean; artifacts: number }

// Template folders (`.specify/templates`, Spec Kitty mission templates) are scaffolding, not features.
const templateFolder = /(?:^|\/)templates?(?:\/|$)/i;

/**
 * The selectable features: non-archived spec-role feature IDs. Known layouts first, then generic
 * groups. Template folders count as generic so they sort last; this is presentation only.
 */
export function listFeatures(artifacts: Pick<PathClassification, 'role' | 'framework' | 'featureId' | 'archived'>[]): FeatureSummary[] {
  const byId = new Map<string, FeatureSummary>();
  for (const a of artifacts) if (!a.archived && a.role === 'spec' && !byId.has(a.featureId)) byId.set(a.featureId, { id: a.featureId, framework: a.framework, layout: a.framework !== 'generic' && !templateFolder.test(a.featureId), artifacts: 0 });
  for (const a of artifacts) { const f = byId.get(a.featureId); if (f && a.role !== 'instructions') f.artifacts++; }
  // Templates come after every other group, so they never sit between features.
  const template = (f: FeatureSummary) => Number(templateFolder.test(f.id));
  return [...byId.values()].sort((a, b) => Number(b.layout) - Number(a.layout) || template(a) - template(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
