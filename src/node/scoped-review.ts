import { isAbsolute } from 'node:path';
import { realpath, stat } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { analyze } from '../core/analyze.js';
import { selectFeature } from '../core/artifacts.js';
import { createProposal } from '../core/refine.js';
import { discoverWorkspace } from './workspace.js';
import type { PatchProposal } from '../core/types.js';

interface ReviewInput { feature: string | null; revision: string; findingId: string; replacement: string }
interface ScopedReview { root: string; feature: string | null; revision: string; findingId: string; proposal: PatchProposal }

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

  async function propose(input: ReviewInput) {
    const { scope, assessment } = await load(input.feature);
    if (assessment.id !== input.revision) throw new StaleAssessmentError('The assessment is stale. Refresh and select the finding again.');
    const finding = assessment.findings.find(item => item.id === input.findingId);
    const evidence = finding?.evidence[0];
    const artifact = scope.artifacts.find(item => item.path === evidence?.path);
    if (!finding || !evidence || !artifact) throw new Error('The finding is unavailable in this scope.');
    return createProposal(artifact.path, artifact.content, evidence.line, input.replacement, finding.suggestion);
  }

  return {
    async assess(feature: string | null) {
      const { assessment, features } = await load(feature);
      return { root, feature, features, assessment };
    },
    propose,
    async validateReview(review: ScopedReview) {
      if (review.root !== root) throw new Error('The proposal belongs to another worktree.');
      const current = await propose({ ...review, replacement: review.proposal.replacement });
      if (!isDeepStrictEqual(current, review.proposal)) throw new Error('The proposal differs from the current worktree review.');
      return current;
    },
  };
}
