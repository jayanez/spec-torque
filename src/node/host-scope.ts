import { indexWorkspace, resolveImplicitRoot, type WorkspaceIndex } from './scope.js';
import type { ScopeRequest } from './workspace.js';

/** A scope chosen in a host: everything, one feature, a folder, or the features changed on the branch. */
export type HostScope = { kind: 'all' } | { kind: 'feature'; id: string } | { kind: 'path'; path: string } | { kind: 'changed'; base?: string };
export const READ_LIMIT = 500;

/** Indexes the work tree that contains a host's working directory, focused on it when it is a subfolder. */
export async function hostIndex(directory: string): Promise<WorkspaceIndex> {
  const { root, focus } = await resolveImplicitRoot(directory);
  return indexWorkspace(root, focus);
}

export const fitsReadLimit = (index: WorkspaceIndex) => index.entries.length <= READ_LIMIT;

/** Command arguments: a feature ID, a folder, or `--changed [base]`. Empty text selects nothing. */
export function parseScopeArgs(text: string | undefined, index: WorkspaceIndex): HostScope | undefined {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return undefined;
  if (words[0] === '--changed') return { kind: 'changed', ...(words[1] ? { base: words[1] } : {}) };
  const target = words.join(' ').replace(/\/+$/, '');
  return index.features.some(f => f.id === target) ? { kind: 'feature', id: target } : { kind: 'path', path: target };
}

/** A still-valid remembered scope, else the focus folder, everything when it fits, or a single feature. */
export function defaultScope(index: WorkspaceIndex, remembered?: HostScope): HostScope | undefined {
  if (remembered?.kind === 'feature' && index.features.some(f => f.id === remembered.id)) return remembered;
  if (remembered?.kind === 'changed' || remembered?.kind === 'path') return remembered;
  if (remembered?.kind === 'all' && fitsReadLimit(index)) return remembered;
  if (index.focus) return { kind: 'path', path: index.focus };
  if (fitsReadLimit(index)) return { kind: 'all' };
  return index.features.length === 1 ? { kind: 'feature', id: index.features[0].id } : undefined;
}

export function scopeRequest(scope: HostScope): ScopeRequest {
  return scope.kind === 'feature' ? { feature: scope.id } : scope.kind === 'path' ? { paths: [scope.path] }
    : scope.kind === 'changed' ? { changed: true, ...(scope.base ? { base: scope.base } : {}) } : {};
}

export function scopeLabel(scope: HostScope | undefined): string {
  if (!scope) return 'not selected';
  return scope.kind === 'all' ? 'All documents' : scope.kind === 'feature' ? scope.id
    : scope.kind === 'path' ? 'Folder · ' + scope.path : 'Changed on this branch' + (scope.base ? ` (vs ${scope.base})` : '');
}

export interface ScopeChoice { title: string; value: string; category: string }
/** Selector entries: everything when it fits, the branch's changes, then features with known layouts first. */
export function scopeChoices(index: WorkspaceIndex): ScopeChoice[] {
  return [
    ...(fitsReadLimit(index) ? [{ title: 'All documents', value: 'all', category: 'Scope' }] : []),
    { title: 'Changed on this branch', value: 'changed', category: 'Scope' },
    ...index.features.map(f => ({ title: f.id, value: 'f:' + f.id, category: f.layout ? 'Features' : 'Other documents' })),
  ];
}
export function choiceScope(value: string): HostScope {
  return value === 'all' ? { kind: 'all' } : value === 'changed' ? { kind: 'changed' } : { kind: 'feature', id: value.replace(/^f:/, '') };
}
export function scopeValue(scope: HostScope | undefined): string {
  return !scope ? '' : scope.kind === 'feature' ? 'f:' + scope.id : scope.kind;
}
