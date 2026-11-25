import { indexWorkspace, resolveImplicitRoot, type WorkspaceIndex } from './scope.js';
import type { ScopeRequest } from './workspace.js';
import { featureLabel, LABELS } from '../core/presentation.js';
import { fitsReadLimit } from '../core/artifacts.js';
export { READ_LIMIT, fitsReadLimit } from '../core/artifacts.js';

/** A scope chosen in a host: everything, one feature, a folder, or the features changed on the branch. */
export type HostScope = { kind: 'all' } | { kind: 'feature'; id: string } | { kind: 'path'; path: string } | { kind: 'changed'; base?: string };

/** Indexes the work tree that contains a host's working directory, focused on it when it is a subfolder. */
export async function hostIndex(directory: string): Promise<WorkspaceIndex> {
  const { root, focus } = await resolveImplicitRoot(directory);
  return indexWorkspace(root, focus);
}


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
  return scope.kind === 'all' ? LABELS.allDocuments : scope.kind === 'feature' ? scope.id
    : scope.kind === 'path' ? LABELS.folder + scope.path : LABELS.changed + (scope.base ? ` (vs ${scope.base})` : '');
}

export interface ScopeChoice { title: string; value: string; category: string }
/**
 * Selector entries: everything when it fits, the branch's changes, then features with known
 * layouts first. A current folder or based branch scope is listed too, so a selector can always
 * show the scope in use.
 */
export function scopeChoices(index: WorkspaceIndex, current?: HostScope): ScopeChoice[] {
  return [
    ...(current?.kind === 'path' ? [{ title: scopeLabel(current), value: scopeValue(current), category: 'Scope' }] : []),
    ...(fitsReadLimit(index) ? [{ title: LABELS.allDocuments, value: 'all', category: 'Scope' }] : []),
    { title: LABELS.changed, value: 'changed', category: 'Scope' },
    ...(current?.kind === 'changed' && current.base ? [{ title: scopeLabel(current), value: scopeValue(current), category: 'Scope' }] : []),
    ...index.features.map(f => ({ title: featureLabel(f), value: 'f:' + f.id, category: f.layout ? 'Features' : 'Other documents' })),
  ];
}
export function choiceScope(value: string): HostScope {
  return value === 'all' ? { kind: 'all' } : value === 'changed' ? { kind: 'changed' }
    : value.startsWith('c:') ? { kind: 'changed', base: value.slice(2) }
    : value.startsWith('p:') ? { kind: 'path', path: value.slice(2) } : { kind: 'feature', id: value.replace(/^f:/, '') };
}
export function scopeValue(scope: HostScope | undefined): string {
  return !scope ? '' : scope.kind === 'feature' ? 'f:' + scope.id : scope.kind === 'path' ? 'p:' + scope.path
    : scope.kind === 'changed' && scope.base ? 'c:' + scope.base : scope.kind;
}
