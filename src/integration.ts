import { analyze } from './core/analyze.js';
import { discoverWorkspace } from './node/workspace.js';
import { startServer } from './node/server.js';
import { PRODUCT_VERSION } from './version.js';
import { findingChoice, summaryLine, titleLine } from './core/presentation.js';
import type { Assessment } from './core/types.js';
export async function reviewWorkspace(root: string) { return analyze(await discoverWorkspace(root)); }
/** One bar per dimension: "E1  Explicit requirements        ●●○". */
export const dimensionLines = (a: Assessment) => a.dimensions.map(d => `${d.id.padEnd(3)} ${d.title.padEnd(26)} ${d.score === null ? 'not assessed' : '●'.repeat(d.score) + '○'.repeat(3 - d.score)}`);
/** Title, summary, dimension bars and the first findings, for terminal hosts and the CLI. */
export function terminalSummary(a: Assessment): string[] {
  return [titleLine(PRODUCT_VERSION, a.name), summaryLine(a), '', ...dimensionLines(a), '', ...a.findings.slice(0, 12).map((f, i) => `${findingChoice(a, i)} · ${f.message}`)];
}
export async function openWorkbench(root: string, feature: string | null = null) { return startServer(root, 0, feature); }
export { analyze } from './core/analyze.js';
export { contentHash, listFeatures, selectFeature } from './core/artifacts.js';
export { createProposal } from './core/refine.js';
export { applyWorkspaceProposal, discoverWorkspace, readScope, readWorkspaceArtifact } from './node/workspace.js';
export * from './node/host-scope.js';
export * from './core/presentation.js';
export { PRODUCT_VERSION } from './version.js';
export { changedFeatures, indexWorkspace, resolveImplicitRoot, type WorkspaceIndex } from './node/scope.js';
