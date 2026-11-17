/** @jsxImportSource @opentui/solid */
import { Plugin } from '@opencode/plugin/tui';
import { createEffect, createMemo, createRoot, createSignal, For, Show } from 'solid-js';
import type { ArtifactSet, Assessment, Evidence, Finding } from '../../src/core/types.js';
import {
  analyze, applyWorkspaceProposal, contentHash, createProposal, discoverWorkspace, openWorkbench,
  readWorkspaceArtifact, selectFeature, terminalSummary,
} from './runtime/integration.js';

type Target = { sessionID?: string; directory?: string };
type Snapshot = {
  root: string;
  scope: string | null;
  scopes: string[];
  source: ArtifactSet;
  report: Assessment;
};
const panelName = 'spectorque.review';
const allDocuments = 'All documents';
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

function sourceLine(snapshot: Snapshot, evidence: Evidence) {
  return snapshot.source.artifacts.find(artifact => artifact.path === evidence.path)
    ?.content.split(/\r?\n/)[evidence.line - 1];
}

export default Plugin.define({
  id: 'spectorque',
  setup(context) {
    const [snapshot, setSnapshot] = createSignal<Snapshot>();
    const [status, setStatus] = createSignal('Run /spectorque to analyze the workspace.');
    let generation = 0;
    let scope: string | null = null;
    let disposed = false;
    let workbench: { root: string; opened: Awaited<ReturnType<typeof openWorkbench>> } | undefined;

    function closeWorkbench() {
      if (!workbench) return;
      workbench.opened.server.close();
      workbench = undefined;
    }

    function readTarget(): Target {
      const route = context.ui.router.current();
      if (route.type === 'session') {
        return { sessionID: route.sessionID, directory: context.data.session.get(route.sessionID)?.location.directory };
      }
      return { directory: (context.location ?? context.data.location.default())?.directory };
    }

    const { target, stopWatching } = createRoot(dispose => {
      const target = createMemo(readTarget, undefined, {
        equals: (previous, next) => previous.sessionID === next.sessionID && previous.directory === next.directory,
      });
      createEffect(() => {
        if (workbench && target().directory !== workbench.root) closeWorkbench();
        // Track the route even before a workbench is opened.
        target();
        generation++;
        scope = null;
        setSnapshot(undefined);
        setStatus('Run /spectorque to analyze the workspace.');
      });
      return { target, stopWatching: dispose };
    });

    function current(expected: Target, request: number) {
      const actual = target();
      return !disposed && generation === request && actual.sessionID === expected.sessionID &&
        (!expected.directory || actual.directory === expected.directory);
    }

    async function rootFor(location: Target) {
      if (location.sessionID) {
        const session = await context.client.session.get({ sessionID: location.sessionID }, {
          signal: AbortSignal.timeout(5000),
        }).catch((error: unknown) => {
          throw new Error('OpenCode session unavailable. Reconnect and retry /spectorque. ' + errorMessage(error));
        });
        return session.location.directory;
      }
      if (!location.directory) throw new Error('No OpenCode workspace location is available.');
      return location.directory;
    }

    async function refresh(location: Target, request: number, requestedScope: string | null) {
      setSnapshot(undefined);
      setStatus('Analyzing workspace…');
      const root = await rootFor(location);
      const workspace: ArtifactSet = await discoverWorkspace(root);
      const scopes = [...new Set(workspace.artifacts.filter(a => !a.archived && a.role !== 'instructions').map(a => a.featureId))];
      const selected = requestedScope !== null && scopes.includes(requestedScope) ? requestedScope : null;
      const source: ArtifactSet = selectFeature(workspace, selected);
      const report: Assessment = await analyze(source);
      if (!current(location, request)) return;
      const result = { root, scope: selected, scopes, source, report };
      scope = selected;
      setStatus('');
      setSnapshot(result);
      return result;
    }

    async function act(action: (location: Target, request: number) => Promise<void>) {
      const location = target();
      const request = ++generation;
      try {
        await action(location, request);
      } catch (error) {
        if (!current(location, request)) return;
        const message = errorMessage(error);
        setStatus(message);
        await context.ui.dialog.alert({ title: 'SpecTorque', message });
      }
    }

    function pickEvidence(view: Snapshot) {
      const findings = view.report.findings.flatMap(finding => finding.evidence.map(evidence => ({ finding, evidence })));
      if (!findings.length) {
        return context.ui.dialog.alert({ title: 'SpecTorque', message: 'No rule findings in this scope.' }).then(() => undefined);
      }
      return context.ui.dialog.select<{ finding: Finding; evidence: Evidence }>({
        title: 'SpecTorque · select evidence',
        options: findings.map(value => ({
          title: value.finding.message,
          description: value.evidence.path + ':' + value.evidence.line,
          value,
        })),
      });
    }

    const open = () => act(async (location, request) => {
      const panel = context.ui.panel.open(panelName);
      const view = await refresh(location, request, scope);
      if (!view || panel) return;
      await context.ui.dialog.alert({ title: 'SpecTorque', message: terminalSummary(view.report).join('\n') });
    });

    const changeScope = () => act(async (location, request) => {
      const view = snapshot();
      if (!view || view.scopes.length < 2) return;
      const choice = await context.ui.dialog.select({
        title: 'SpecTorque · select scope',
        current: view.scope ?? '',
        options: [{ title: allDocuments, value: '' }, ...view.scopes.map(value => ({ title: value, value }))],
      });
      if (choice === undefined || !current(location, request)) return;
      await refresh(location, request, choice || null);
    });

    const inspect = () => act(async (location, request) => {
      const view = snapshot();
      if (!view) return;
      const selected = await pickEvidence(view);
      if (!selected || !current(location, request)) return;
      const { evidence } = selected;
      const line = sourceLine(view, evidence);
      if (line === undefined) throw new Error('Evidence line is unavailable. Run /spectorque to analyze again.');
      await context.ui.dialog.alert({ title: evidence.path + ':' + evidence.line, message: line });
    });

    const review = () => act(async (location, request) => {
      const view = snapshot() ?? await refresh(location, request, scope);
      if (!view) return;
      const selected = await pickEvidence(view);
      if (!selected || !current(location, request)) return;
      const { finding, evidence } = selected;
      const content: string = await readWorkspaceArtifact(view.root, evidence.path);
      const source = view.report.artifacts.find(artifact => artifact.path === evidence.path);
      if (!source || await contentHash(content) !== source.hash) {
        throw new Error('Source changed since this assessment. Run /spectorque to analyze again.');
      }
      const original = sourceLine(view, evidence);
      if (original === undefined) throw new Error('Evidence line is unavailable. Run /spectorque to analyze again.');
      if (!current(location, request)) return;
      const replacement = await context.ui.dialog.prompt({
        title: evidence.path + ':' + evidence.line, description: finding.suggestion, value: original,
      });
      if (!replacement || replacement === original || !current(location, request)) return;
      const proposal = await createProposal(evidence.path, content, evidence.line, replacement, finding.suggestion);
      if (!current(location, request)) return;
      const accepted = await context.ui.dialog.confirm({
        title: 'Apply reviewed change?',
        message: 'Before:\n' + proposal.original + '\n\nAfter:\n' + proposal.replacement,
      });
      if (!accepted || !current(location, request)) return;
      const root = await rootFor(location);
      if (!current(location, request)) return;
      if (root !== view.root) throw new Error('OpenCode workspace changed. Run /spectorque to analyze again.');
      await applyWorkspaceProposal(view.root, proposal);
      if (current(location, request)) await refresh(location, request, view.scope);
    });

    const handoff = () => act(async (location, request) => {
      const view = snapshot();
      if (!view) return;
      const root = await rootFor(location);
      if (!current(location, request)) return;
      if (root !== view.root) throw new Error('OpenCode workspace changed. Run /spectorque to analyze again.');
      if (workbench?.root !== root || !workbench.opened.server.listening) {
        closeWorkbench();
        const opened: Awaited<ReturnType<typeof openWorkbench>> = await openWorkbench(root);
        if (!current(location, request)) {
          opened.server.close();
          return;
        }
        workbench = { root, opened };
      }
      await context.ui.dialog.prompt({
        title: 'SpecTorque · common workbench',
        description: 'Copy this local URL into your browser. Load the workspace and select: ' + (view.scope ?? allDocuments),
        value: workbench.opened.url,
      });
    });

    function ReviewPanel() {
      context.keymap.layer(() => ({
        commands: [
          { id: 'spectorque.scope', title: 'Select scope', bind: 's', enabled: () => (snapshot()?.scopes.length ?? 0) > 1, run: changeScope },
          { id: 'spectorque.evidence', title: 'Inspect evidence', bind: 'e', enabled: () => Boolean(snapshot()), run: inspect },
          { id: 'spectorque.panel.review', title: 'Review change', bind: 'r', enabled: () => Boolean(snapshot()), run: review },
          { id: 'spectorque.workbench', title: 'Open common workbench', bind: 'w', enabled: () => Boolean(snapshot()), run: handoff },
          { id: 'spectorque.close', title: 'Close SpecTorque', bind: 'q', run: () => context.ui.panel.close() },
        ],
      }));
      return <box flexDirection="column" padding={1}>
        <text>SpecTorque · specification review</text>
        <Show when={snapshot()} keyed fallback={<text>{status()}</text>}>{view => <>
          <text>Scope: {view.scope ?? allDocuments}</text>
          <text>Revision: {view.report.id}</text>
          <text>Unknown practices: {view.report.summary.unknown}</text>
          <For each={terminalSummary(view.report)}>{line => <text>{line}</text>}</For>
          <Show when={!view.report.findings.length}><text>No rule findings in this scope.</text></Show>
          <For each={view.report.decisions}>{evidence =>
            <text>{evidence.path}:{evidence.line} {evidence.text}</text>
          }</For>
          <Show when={view.scopes.length > 1}><text>s Select scope</text></Show>
          <text>e Inspect evidence · r Review change · w Common workbench</text>
        </>}</Show>
        <text>q Close panel</text>
      </box>;
    }

    context.ui.slot({ append: 'session.panel', render: panel => <Show when={panel.name === panelName}><ReviewPanel /></Show> });
    context.keymap.layer(() => ({ mode: 'global', commands: [
      { id: 'spectorque.open', title: 'Open SpecTorque', palette: true, slash: { name: 'spectorque' }, run: open },
      { id: 'spectorque.review', title: 'Review SpecTorque evidence', palette: true, slash: { name: 'spectorque-review' }, run: review },
    ] }));
    return () => { disposed = true; stopWatching(); closeWorkbench(); };
  },
});
