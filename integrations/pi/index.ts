import { writeFileSync } from 'node:fs';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { analyze, discoverWorkspace, selectFeature, terminalSummary, readWorkspaceArtifact, createProposal, applyWorkspaceProposal } from './runtime/integration.js';
export default function (pi: ExtensionAPI) {
  pi.registerCommand('spectorque', {
    description: 'Review specification quality, evidence and proposed refinements',
    handler: async (_args, ctx) => {
      try {
        const workspace = await discoverWorkspace(ctx.cwd);
        if (!ctx.hasUI) {
          const summary = terminalSummary(await analyze(workspace)).join('\n');
          // Pi print mode only renders assistant messages and redirects console output
          // to stderr. Write the report to stdout explicitly; JSON keeps host events.
          if (ctx.mode === 'print') writeFileSync(1, summary + '\n');
          else await pi.sendMessage({ customType: 'spectorque', content: summary, display: true }, { triggerTurn: false });
          return;
        }
        const allDocuments = 'All documents';
        const features = [...new Set(workspace.artifacts.filter(a => !a.archived && a.role !== 'instructions').map(a => a.featureId))];
        let feature: string | null = null;
        if (ctx.mode === 'tui' && features.length > 1) {
          const scopes = [allDocuments, ...features.map(id => `Feature · ${id}`)];
          const selectedScope = await ctx.ui.select('SpecTorque · select scope', scopes);
          const scopeIndex = scopes.indexOf(selectedScope ?? '');
          if (scopeIndex < 0) return;
          feature = features[scopeIndex - 1] ?? null;
        }
        const scope = feature ?? allDocuments;
        const report = await analyze(selectFeature(workspace, feature));
        const showAssessment = (assessment: typeof report) => {
          const [title, ...summary] = terminalSummary(assessment).slice(0, 13);
          ctx.ui.setWidget('spectorque', [`${title} · Scope: ${scope}`, ...summary]);
          ctx.ui.setStatus('spectorque', assessment.summary.score === null ? 'Specs: incomplete' : 'Specs: ' + assessment.summary.score + '/30');
        };
        showAssessment(report);
        const choices = report.findings.map((f, i) => String(i + 1) + '. ' + f.message + ' · ' + f.evidence[0].path + ':' + f.evidence[0].line);
        const selected = await ctx.ui.select('SpecTorque · select evidence', choices.length ? choices : ['No rule findings. Review open decisions and the 40 practices in the workbench.']);
        const index = choices.indexOf(selected ?? ''); if (index < 0) return;
        const f = report.findings[index]; const evidence = f.evidence[0];
        const content = await readWorkspaceArtifact(ctx.cwd, evidence.path);
        const replacement = await ctx.ui.editor(evidence.path + ':' + evidence.line + ' — ' + f.suggestion, content.split(/\r?\n/)[evidence.line - 1]);
        if (!replacement) return;
        const proposal = await createProposal(evidence.path, content, evidence.line, replacement, f.suggestion);
        if (proposal.original === replacement) return;
        if (await ctx.ui.confirm('Apply reviewed change?', 'Before:\n' + proposal.original + '\n\nAfter:\n' + proposal.replacement)) {
          await applyWorkspaceProposal(ctx.cwd, proposal);
          showAssessment(await analyze(selectFeature(await discoverWorkspace(ctx.cwd), feature)));
          ctx.ui.notify('SpecTorque: change applied and assessment refreshed.', 'info');
        }
      } catch (e) { if (ctx.hasUI) ctx.ui.notify(String((e as Error).message), 'error'); else throw e; }
    },
  });
}
