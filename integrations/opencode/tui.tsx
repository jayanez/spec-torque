/** @jsxImportSource @opentui/solid */
import { Plugin } from '@opencode/plugin/tui';
import { createSignal, Show, For } from 'solid-js';
import { reviewWorkspace, terminalSummary, readWorkspaceArtifact, createProposal, applyWorkspaceProposal } from './runtime/integration.js';
export default Plugin.define({
  id: 'spectorque',
  setup(context) {
    const [report, setReport] = createSignal<any>();
    const root = (context.location ?? context.data.location.default())?.directory ?? process.cwd();
    async function inspect() {
      try {
        const a = await reviewWorkspace(root); setReport(a);
        const index = await context.ui.dialog.select({ title: 'SpecTorque · select evidence', options: a.findings.map((f: any, i: number) => ({ title: f.message, value: i, description: f.evidence[0].path + ':' + f.evidence[0].line })) });
        if (index === undefined) return;
        const finding = a.findings[index]; const e = finding.evidence[0];
        const content = await readWorkspaceArtifact(root, e.path);
        const original = content.split(/\r?\n/)[e.line - 1];
        const replacement = await context.ui.dialog.prompt({ title: e.path + ':' + e.line, description: finding.suggestion, value: original });
        if (!replacement || replacement === original) return;
        const proposal = await createProposal(e.path, content, e.line, replacement, finding.suggestion);
        if (await context.ui.dialog.confirm({ title: 'Apply reviewed change?', message: 'Before:\n' + proposal.original + '\n\nAfter:\n' + proposal.replacement })) {
          await applyWorkspaceProposal(root, proposal); setReport(await reviewWorkspace(root));
        }
      } catch (e) { await context.ui.dialog.alert({ title: 'SpecTorque', message: String((e as Error).message) }); }
    }
    context.ui.slot({ append: 'session.panel', render: panel => <Show when={panel.name === 'spectorque'}><box flexDirection="column" padding={1}><text>SpecTorque · specification review</text><For each={report() ? terminalSummary(report()) : ['Run /spectorque to analyze the current workspace.']}>{line => <text>{line}</text>}</For><text>Run /spectorque-review to select evidence and refine.</text></box></Show> });
    context.keymap.layer(() => ({ mode: 'global', commands: [
      { id: 'spectorque.open', title: 'Open SpecTorque', palette: true, slash: { name: 'spectorque' }, run: async () => { try { setReport(await reviewWorkspace(root)); if (!context.ui.panel.open('spectorque')) await context.ui.dialog.alert({ title: 'SpecTorque', message: terminalSummary(report()).join('\n') }); } catch (e) { await context.ui.dialog.alert({ title: 'SpecTorque', message: String((e as Error).message) }); } } },
      { id: 'spectorque.review', title: 'Review SpecTorque evidence', palette: true, slash: { name: 'spectorque-review' }, run: inspect },
    ] }));
  },
});
