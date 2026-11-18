import { analyze } from './core/analyze.js';
import { discoverWorkspace } from './node/workspace.js';
import { startServer } from './node/server.js';
import type { Assessment } from './core/types.js';
export async function reviewWorkspace(root: string) { return analyze(await discoverWorkspace(root)); }
export function terminalSummary(a: Assessment): string[] {
  return [`SpecTorque · ${a.name}`, `${a.summary.score === null ? 'Incomplete assessment' : `${a.summary.score}/30`} · ${a.findings.length} findings · ${a.decisions.length} open decisions`, '', ...a.dimensions.map(d => `${d.id.padEnd(3)} ${d.title.padEnd(26)} ${d.score === null ? 'not assessed' : '●'.repeat(d.score) + '○'.repeat(3 - d.score)}`), '', ...a.findings.slice(0, 12).map(f => `${f.severity.toUpperCase()} ${f.evidence[0]?.path}:${f.evidence[0]?.line} ${f.message}`)];
}
export async function openWorkbench(root: string) { return startServer(root, 0); }
export { analyze } from './core/analyze.js';
export { contentHash, selectFeature } from './core/artifacts.js';
export { createProposal } from './core/refine.js';
export { applyWorkspaceProposal, discoverWorkspace, readWorkspaceArtifact } from './node/workspace.js';
