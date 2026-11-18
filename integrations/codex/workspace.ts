import { isAbsolute } from 'node:path';
import { realpath, stat } from 'node:fs/promises';
import { analyze, createProposal, discoverWorkspace, selectFeature } from '../../src/integration.js';

export class StaleAssessmentError extends Error {}

export async function bindWorkspace(configuredRoot: string | undefined) {
  if (!configuredRoot || !isAbsolute(configuredRoot)) throw new Error('Configure the trusted worktree with an absolute root.');
  const root = await realpath(configuredRoot);
  if (!(await stat(root)).isDirectory()) throw new Error('The configured worktree is not a directory.');

  async function load(feature: string | null) {
    const workspace = await discoverWorkspace(root);
    const features = [...new Set(workspace.artifacts
      .filter(artifact => !artifact.archived && artifact.role === 'spec')
      .map(artifact => artifact.featureId))].sort();
    if (feature !== null && !features.includes(feature)) throw new Error('The selected feature is unavailable. Refresh the workspace.');
    const scope = selectFeature(workspace, feature);
    return { scope, assessment: await analyze(scope), features };
  }

  return {
    async assess(feature: string | null) {
      const { assessment, features } = await load(feature);
      return { root, feature, features, assessment };
    },
    async propose(input: { feature: string | null; revision: string; findingId: string; replacement: string }) {
      const { scope, assessment } = await load(input.feature);
      if (assessment.id !== input.revision) throw new StaleAssessmentError('The assessment is stale. Refresh and select the finding again.');
      const finding = assessment.findings.find(item => item.id === input.findingId);
      const evidence = finding?.evidence[0];
      const artifact = scope.artifacts.find(item => item.path === evidence?.path);
      if (!finding || !evidence || !artifact) throw new Error('The finding is unavailable in this scope.');
      return createProposal(artifact.path, artifact.content, evidence.line, input.replacement, finding.suggestion);
    },
  };
}
