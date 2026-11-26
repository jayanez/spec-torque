import { scopeChoices, type ScopeSource } from '../../../src/node/host-scope.js';

export interface ScopeItem { label: string; value: string; category: string; description?: string }

/**
 * QuickPick entries from the shared scope choices. A single-select QuickPick ignores `picked`, so
 * the remembered scope (a feature ID, or null for All documents) is listed first and marked.
 */
export function scopeItems(index: ScopeSource, remembered: string | null | undefined): ScopeItem[] {
  const choices = scopeChoices(index);
  const value = remembered === undefined ? undefined : remembered === null ? 'all' : 'f:' + remembered;
  const current = choices.find(choice => choice.value === value);
  return [...(current ? [current] : []), ...choices.filter(choice => choice !== current)].map(choice => ({
    label: choice.title, value: choice.value, category: choice.category,
    description: choice === current ? 'current' : choice.value === 'changed' ? 'Features changed since the default branch' : undefined,
  }));
}
