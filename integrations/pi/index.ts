import { writeFileSync } from 'node:fs';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import {
  analyze, terminalSummary, dimensionsLine, summaryLine, titleLine, PRODUCT_VERSION, readWorkspaceArtifact, createProposal, applyWorkspaceProposal, contentHash, hostIndex, parseScopeArgs,
  defaultScope, readScope, scopeRequest, scopeLabel, scopeChoices, choiceScope, findingCard, findingChoice, replacementLabel,
  scoreText, DISCLAIMER, LABELS, READ_LIMIT, type HostScope,
} from './runtime/integration.js';
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
          if (!headless) throw new Error(`This work tree has ${index.entries.length} documents, more than ${READ_LIMIT} analyzed at once. Run /spectorque <feature | folder | --changed>.`);
          const summary = terminalSummary(await analyze(await readScope(index, scopeRequest(headless)))).join('\n');
          // Pi print mode only renders assistant messages and redirects console output
          // to stderr. Write the report to stdout explicitly; JSON keeps host events.
          if (ctx.mode === 'print') writeFileSync(1, summary + '\n');
          else await pi.sendMessage({ customType: 'spectorque', content: summary, display: true }, { triggerTurn: false });
          return;
        }
        let chosen: HostScope | undefined = requested ?? (index.features.length > 1 && !index.focus ? undefined : defaultScope(index));
        if (!chosen) {
          // The shared choices: All documents only when the work tree fits one read, then the branch's changes and the features.
          const choices = scopeChoices(index);
          const answer = await ctx.ui.select('SpecTorque · ' + LABELS.selectScope, choices.map(choice => choice.title));
          const picked = choices.find(choice => choice.title === answer);
          if (!picked) return;
          chosen = choiceScope(picked.value);
        }
        const selection = chosen;
        const report = await analyze(await readScope(index, scopeRequest(selection)));
        // Title, scope, summary and dimensions, then the selected finding's card and the closing note.
        const showAssessment = (assessment: typeof report, card: string[] = []) => {
          // Compact enough for Pi's widget height: one line of dimensions, as in the Claude pane and Codex.
          ctx.ui.setWidget('spectorque', [titleLine(PRODUCT_VERSION, assessment.name), 'Scope: ' + scopeLabel(selection), summaryLine(assessment),
            dimensionsLine(assessment), ...(card.length ? ['', ...card] : []), DISCLAIMER]);
          ctx.ui.setStatus('spectorque', 'Specs: ' + scoreText(assessment));
        };
        showAssessment(report);
        const choices = report.findings.map((f, i) => findingChoice(report, i) + ' · ' + f.message);
        const selected = await ctx.ui.select('SpecTorque · ' + LABELS.selectFinding, choices.length ? choices : ['No rule findings in this scope.']);
        const at = choices.indexOf(selected ?? ''); if (at < 0) return;
        const f = report.findings[at]; const evidence = f.evidence[0];
        showAssessment(report, findingCard(report, at));
        const content = await readWorkspaceArtifact(index.root, evidence.path);
        // Propose only against the assessed source.
        const source = report.artifacts.find(artifact => artifact.path === evidence.path);
        if (!source || await contentHash(content) !== source.hash) throw new Error('Source changed since this assessment. Run /spectorque to analyze again.');
        const replacement = await ctx.ui.editor(replacementLabel(evidence.line) + ' — ' + f.suggestion, content.split(/\r?\n/)[evidence.line - 1]);
        if (!replacement) return;
        const proposal = await createProposal(evidence.path, content, evidence.line, replacement, f.suggestion);
        if (proposal.original === replacement) return;
        if (await ctx.ui.confirm(LABELS.applyChange + '?', 'Before:\n' + proposal.original + '\n\nAfter:\n' + proposal.replacement)) {
          await applyWorkspaceProposal(index.root, proposal);
          showAssessment(await analyze(await readScope(await hostIndex(ctx.cwd), scopeRequest(selection))));
          ctx.ui.notify('SpecTorque: change applied and assessment refreshed.', 'info');
        }
      } catch (e) { if (ctx.hasUI) ctx.ui.notify(String((e as Error).message), 'error'); else throw e; }
    },
  });
}
