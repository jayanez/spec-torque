import { writeFileSync } from 'node:fs';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { analyze, terminalSummary, readWorkspaceArtifact, createProposal, applyWorkspaceProposal, hostIndex, parseScopeArgs, defaultScope, fitsReadLimit, readScope, scopeRequest, scopeLabel, type HostScope } from './runtime/integration.js';
export default function (pi: ExtensionAPI) {
  pi.registerCommand('spectorque', {
    description: 'Review specification quality, evidence and proposed refinements. Optional: a feature, a folder or --changed [base].',
    handler: async (args, ctx) => {
      try {
        // The shared index lists the work tree's features without reading content.
        const index = await hostIndex(ctx.cwd);
        const requested = parseScopeArgs(args, index);
        if (!ctx.hasUI) {
          const headless = requested ?? defaultScope(index);
          if (!headless) throw new Error(`This work tree has ${index.entries.length} documents, more than 500 analyzed at once. Run /spectorque <feature | folder | --changed>.`);
          const summary = terminalSummary(await analyze(await readScope(index, scopeRequest(headless)))).join('\n');
          // Pi print mode only renders assistant messages and redirects console output
          // to stderr. Write the report to stdout explicitly; JSON keeps host events.
          if (ctx.mode === 'print') writeFileSync(1, summary + '\n');
          else await pi.sendMessage({ customType: 'spectorque', content: summary, display: true }, { triggerTurn: false });
          return;
        }
        const allDocuments = 'All documents';
        const changedOnBranch = 'Changed on this branch';
        const features = index.features.map(f => f.id);
        let chosen: HostScope | undefined = requested ?? (features.length > 1 && !index.focus ? undefined : defaultScope(index));
        if (!chosen) {
          // All documents is offered only when the work tree fits one read.
          const scopes = [...(fitsReadLimit(index) ? [allDocuments] : []), ...features.map(id => `Feature · ${id}`), changedOnBranch];
          const selectedScope = await ctx.ui.select('SpecTorque · select scope', scopes);
          if (!selectedScope || !scopes.includes(selectedScope)) return;
          chosen = selectedScope === allDocuments ? { kind: 'all' } : selectedScope === changedOnBranch ? { kind: 'changed' }
            : { kind: 'feature', id: selectedScope.slice('Feature · '.length) };
        }
        const selection = chosen;
        const scope = selection.kind === 'all' ? allDocuments : scopeLabel(selection);
        const report = await analyze(await readScope(index, scopeRequest(selection)));
        const showAssessment = (assessment: typeof report) => {
          const [title, ...summary] = terminalSummary(assessment).slice(0, 13);
          ctx.ui.setWidget('spectorque', [`${title} · Scope: ${scope}`, ...summary]);
          ctx.ui.setStatus('spectorque', assessment.summary.score === null ? 'Specs: incomplete' : 'Specs: ' + assessment.summary.score + '/30');
        };
        showAssessment(report);
        const choices = report.findings.map((f, i) => String(i + 1) + '. ' + f.message + ' · ' + f.evidence[0].path + ':' + f.evidence[0].line);
        const selected = await ctx.ui.select('SpecTorque · select evidence', choices.length ? choices : ['No rule findings. Review open decisions and the 40 practices in the workbench.']);
        const at = choices.indexOf(selected ?? ''); if (at < 0) return;
        const f = report.findings[at]; const evidence = f.evidence[0];
        const content = await readWorkspaceArtifact(index.root, evidence.path);
        const replacement = await ctx.ui.editor(evidence.path + ':' + evidence.line + ' — ' + f.suggestion, content.split(/\r?\n/)[evidence.line - 1]);
        if (!replacement) return;
        const proposal = await createProposal(evidence.path, content, evidence.line, replacement, f.suggestion);
        if (proposal.original === replacement) return;
        if (await ctx.ui.confirm('Apply reviewed change?', 'Before:\n' + proposal.original + '\n\nAfter:\n' + proposal.replacement)) {
          await applyWorkspaceProposal(index.root, proposal);
          showAssessment(await analyze(await readScope(await hostIndex(ctx.cwd), scopeRequest(selection))));
          ctx.ui.notify('SpecTorque: change applied and assessment refreshed.', 'info');
        }
      } catch (e) { if (ctx.hasUI) ctx.ui.notify(String((e as Error).message), 'error'); else throw e; }
    },
  });
}
