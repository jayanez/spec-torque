import { isAbsolute } from 'node:path';
import { realpath, stat } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { analyze } from '../core/analyze.js';
import { createProposal } from '../core/refine.js';
import { discoverWorkspace, readWorkspaceArtifactBytes } from './workspace.js';
import { changedFeatures, indexWorkspace } from './scope.js';
import { zipArtifactBytes } from '../web/archive.js';
import type { Assessment, PatchProposal } from '../core/types.js';

interface AssessOptions { changed?: boolean; base?: string }
interface AssessmentView<T> { root: string; feature: string | null; features: string[]; total: number; assessment: T }

interface ReviewInput { feature: string | null; revision: string; findingId: string; replacement: string }
interface ScopedExport { root: string; feature: string | null; revision: string; createdAt: string }
interface ScopedReview { root: string; feature: string | null; revision: string; findingId: string; proposal: PatchProposal }

export class StaleAssessmentError extends Error {}
const MAX_UNSCOPED = 500;

export async function bindWorkspace(configuredRoot: string | undefined) {
  if (!configuredRoot || !isAbsolute(configuredRoot)) throw new Error('Configure the trusted worktree with an absolute root.');
  const root = await realpath(configuredRoot);
  if (!(await stat(root)).isDirectory()) throw new Error('The configured worktree is not a directory.');

  async function load(feature: string | null) {
    const index = await indexWorkspace(root);
    const features = index.features.map(item => item.id);
    if (feature !== null && !features.includes(feature)) throw new Error('The selected feature is unavailable. Refresh the workspace.');
    const scope = await discoverWorkspace(root, { feature }, index);
    return { scope, assessment: await analyze(scope), features };
  }

  /**
   * Assesses one feature, or the whole worktree when it fits the read limit. With `changed`,
   * the feature list narrows to features touched on the branch. A worktree too large for an
   * unscoped read returns its features without an assessment, so a viewer can ask for one.
   */
  async function assess(feature: string, options?: AssessOptions): Promise<AssessmentView<Assessment>>;
  async function assess(feature: string | null, options?: AssessOptions): Promise<AssessmentView<Assessment | null>>;
  async function assess(feature: string | null, options: AssessOptions = {}): Promise<AssessmentView<Assessment | null>> {
    const index = await indexWorkspace(root);
    let features = index.features.map(item => item.id);
    if (options.changed) {
      features = await changedFeatures(index, options.base);
      if (feature === null && features.length === 1) feature = features[0];
    }
    if (feature === null && (options.changed || index.entries.length > MAX_UNSCOPED)) return { root, feature, features, total: index.entries.length, assessment: null };
    const { assessment } = await load(feature);
    return { root, feature, features, total: index.entries.length, assessment };
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
    assess,
    async exportScope(selection: ScopedExport, format: 'json' | 'zip') {
      if (selection.root !== root) throw new Error('The export belongs to another worktree.');
      const { scope, assessment } = await load(selection.feature);
      if (assessment.id !== selection.revision) throw new StaleAssessmentError('The assessment is stale. Refresh before exporting.');
      if (format === 'json') return { assessment: { ...assessment, createdAt: selection.createdAt } };

      const files = [];
      let size = 0;
      for (const artifact of scope.artifacts) {
        const bytes = await readWorkspaceArtifactBytes(root, artifact.path);
        const decoded = bytes.toString('utf8');
        if (!bytes.equals(Buffer.from(decoded))) throw new Error('An artifact is not valid UTF-8.');
        if (decoded !== artifact.content) throw new StaleAssessmentError('An artifact changed. Refresh before exporting.');
        size += bytes.length;
        if (size > 20_000_000) throw new Error('Artifact archive exceeds 20 MB. Export one feature at a time.');
        files.push({ path: artifact.path, bytes });
      }
      return { archive: Buffer.from(zipArtifactBytes(files)).toString('base64') };
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
