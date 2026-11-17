import { writeFileSync } from 'node:fs';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { reviewWorkspace, terminalSummary, readWorkspaceArtifact, createProposal, applyWorkspaceProposal } from './runtime/integration.js';
export default function (pi: ExtensionAPI) {
  pi.registerCommand('spectorque', {
    description: 'Review specification quality, evidence and proposed refinements',
    handler: async (_args, ctx) => {
      try {
        let report = await reviewWorkspace(ctx.cwd);
        if (!ctx.hasUI) {
          const summary = terminalSummary(report).join('\n');
          // Pi print mode only renders assistant messages and redirects console output
          // to stderr. Write the report to stdout explicitly; JSON keeps host events.
          if (ctx.mode === 'print') writeFileSync(1, summary + '\n');
          else await pi.sendMessage({ customType: 'spectorque', content: summary, display: true }, { triggerTurn: false });
          return;
        }
        ctx.ui.setWidget('spectorque', terminalSummary(report).slice(0, 13));
        ctx.ui.setStatus('spectorque', report.summary.score === null ? 'Specs: incomplete' : 'Specs: ' + report.summary.score + '/30');
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
          report = await reviewWorkspace(ctx.cwd);
          ctx.ui.setWidget('spectorque', terminalSummary(report).slice(0, 13)); ctx.ui.notify('SpecTorque: change applied and assessment refreshed.', 'info');
        }
      } catch (e) { if (ctx.hasUI) ctx.ui.notify(String((e as Error).message), 'error'); else throw e; }
    },
  });
}
