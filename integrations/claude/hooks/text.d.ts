// Types for the pane's text module, so tests can compare it with src/core/presentation.ts.
type Assessment = import('../../../src/core/types.js').Assessment;
type Scope = { kind: 'all' } | { kind: 'feature'; id: string } | { kind: 'path'; path: string } | { kind: 'changed'; base?: string };
export const DISCLAIMER: string;
export const ALL: string;
export const CHANGED: string;
export function titleLine(version?: string, name?: string): string;
export function scoreText(a: Pick<Assessment, 'summary'>): string;
export function summaryLine(a: Pick<Assessment, 'summary' | 'findings' | 'decisions' | 'engineVersion'>): string;
export function dimensionsLine(a: Pick<Assessment, 'dimensions'>): string;
export function findingCard(a: Pick<Assessment, 'findings'>, index: number): string[];
export function featureLabel(feature: { id: string; layout: boolean }): string;
export function scopeLabel(scope: Scope | undefined): string;
export function scopeValue(scope: Scope | undefined): string | undefined;
export function valueScope(value: string): Scope;
export function replacementLabel(line: number): string;
export function workbenchUrl(url: string): string;
export function workbenchLine(url: string, feature?: string | null): string;
