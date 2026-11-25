/** @jsxImportSource @opentui/solid */
import { Plugin } from '@opencode/plugin/tui';
import { createEffect, createMemo, createRoot, createSignal, For, Show } from 'solid-js';
import { spawn } from 'node:child_process';
import type { ArtifactSet, Assessment, Evidence, Finding } from '../../src/core/types.js';
import {
  analyze, applyWorkspaceProposal, choiceScope, contentHash, createProposal, defaultScope, fitsReadLimit, hostIndex, openWorkbench,
  parseScopeArgs, readScope, readWorkspaceArtifact, scopeChoices, scopeLabel, scopeRequest, scopeValue, terminalSummary,
  DISCLAIMER, LABELS, PRODUCT_VERSION, findingCard, replacementLabel, titleLine, workbenchLine, workbenchUrl,
  type HostScope, type WorkspaceIndex,
} from './runtime/integration.js';

type Target = { sessionID?: string; directory?: string };
type Snapshot = {
  root: string;
  scope: HostScope;
  index: WorkspaceIndex;
  source: ArtifactSet;
  report: Assessment;
};
const panelName = 'spectorque.review';
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

function openInBrowser(url: string) {
  const [command, ...args] = process.platform === 'darwin' ? ['open', url] : process.platform === 'win32' ? ['explorer.exe', url] : ['xdg-open', url];
  const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.on('error', () => {});
  child.unref();
}

function sourceLine(snapshot: Snapshot, evidence: Evidence) {
  return snapshot.source.artifacts.find(artifact => artifact.path === evidence.path)
    ?.content.split(/\r?\n/)[evidence.line - 1];
}

export default Plugin.define({
  id: 'spectorque',
  setup(context) {
    const [snapshot, setSnapshot] = createSignal<Snapshot>();
    const [status, setStatus] = createSignal('Run /spectorque to analyze the workspace.');
    const [workbenchUrl, setWorkbenchUrl] = createSignal<string>();
    let generation = 0;
    let scope: HostScope | undefined;
    let index: WorkspaceIndex | undefined;
    let disposed = false;
    let workbench: { root: string; feature: string | null; opened: Awaited<ReturnType<typeof openWorkbench>> } | undefined;

    function closeWorkbench() {
      if (!workbench) return;
      workbench.opened.server.close();
      workbench = undefined;
      setWorkbenchUrl(undefined);
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
        scope = undefined;
        index = undefined;
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

    // The shared index lists features without reading content; only the chosen scope is read.
    async function refresh(location: Target, request: number, requested?: HostScope): Promise<Snapshot | undefined> {
      setSnapshot(undefined);
      setStatus('Analyzing workspace…');
      const directory = await rootFor(location);
      const next = await hostIndex(directory);
      if (!current(location, request)) return;
      index = next;
      let chosen = requested ?? scope ?? defaultScope(next);
      if (chosen?.kind === 'feature' && !next.features.some(f => f.id === chosen!.id)) chosen = defaultScope(next);
      if (chosen?.kind === 'all' && !fitsReadLimit(next)) chosen = undefined;
      if (!chosen) {
        chosen = await pickScope(next);
        if (!chosen || !current(location, request)) { setStatus('Choose a feature: run /spectorque <feature | folder | --changed>.'); return; }
      }
      const source: ArtifactSet = await readScope(next, scopeRequest(chosen));
      const report: Assessment = await analyze(source);
      if (!current(location, request)) return;
      const result = { root: next.root, scope: chosen, index: next, source, report };
      scope = chosen;
      setStatus('');
      setSnapshot(result);
      return result;
    }

    function pickScope(workspace: WorkspaceIndex) {
      return context.ui.dialog.select<string>({
        title: 'SpecTorque · ' + LABELS.selectScope + ' (' + workspace.features.length + ' features)',
        current: scopeValue(scope),
        options: scopeChoices(workspace, scope),
        search: (query, options) => options.filter(option => option.title.toLowerCase().includes(query.toLowerCase())),
      }).then(value => value === undefined ? undefined : choiceScope(value));
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
      const findings = view.report.findings.flatMap((finding, at) => finding.evidence.map(evidence => ({ finding, evidence, at })));
      if (!findings.length) {
        return context.ui.dialog.alert({ title: 'SpecTorque', message: 'No rule findings in this scope.' }).then(() => undefined);
      }
      return context.ui.dialog.select<{ finding: Finding; evidence: Evidence; at: number }>({
        title: 'SpecTorque · ' + LABELS.selectFinding,
        options: findings.map(value => ({
          title: value.finding.message,
          description: findingCard(view.report, value.at)[0] + ' · ' + value.evidence.path + ':' + value.evidence.line,
          value,
        })),
      });
    }

    const open = (input?: string) => act(async (location, request) => {
      const panel = context.ui.panel.open(panelName);
      const requested = input?.trim() ? parseScopeArgs(input, index ?? await hostIndex(await rootFor(location))) : undefined;
      const view = await refresh(location, request, requested);
      if (!view || panel) return;
      await context.ui.dialog.alert({ title: 'SpecTorque', message: [...terminalSummary(view.report), '', DISCLAIMER].join('\n') });
    });

    const changeScope = () => act(async (location, request) => {
      const workspace = snapshot()?.index ?? index;
      if (!workspace) return;
      const choice = await pickScope(workspace);
      if (choice === undefined || !current(location, request)) return;
      await refresh(location, request, choice);
    });

    const inspect = () => act(async (location, request) => {
      const view = snapshot();
      if (!view) return;
      const selected = await pickEvidence(view);
      if (!selected || !current(location, request)) return;
      const { evidence, at } = selected;
      const line = sourceLine(view, evidence);
      if (line === undefined) throw new Error('Evidence line is unavailable. Run /spectorque to analyze again.');
      // Evidence excerpts are bounded; Inspect quotes the whole source line.
      const [heading, ...card] = findingCard(view.report, at, { ...evidence, text: line });
      await context.ui.dialog.alert({ title: heading, message: card.join('\n') });
    });

    const review = () => act(async (location, request) => {
      const view = snapshot() ?? await refresh(location, request);
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
        title: replacementLabel(evidence.line) + ' · ' + evidence.path, description: finding.suggestion, value: original,
      });
      if (!replacement || replacement === original || !current(location, request)) return;
      const proposal = await createProposal(evidence.path, content, evidence.line, replacement, finding.suggestion);
      if (!current(location, request)) return;
      const accepted = await context.ui.dialog.confirm({
        title: LABELS.applyChange + '?',
        message: 'Before:\n' + proposal.original + '\n\nAfter:\n' + proposal.replacement,
      });
      if (!accepted || !current(location, request)) return;
      const root = (await hostIndex(await rootFor(location))).root;
      if (!current(location, request)) return;
      if (root !== view.root) throw new Error('OpenCode workspace changed. Run /spectorque to analyze again.');
      await applyWorkspaceProposal(view.root, proposal);
      if (current(location, request)) await refresh(location, request, view.scope);
    });

    const handoff = () => act(async (location, request) => {
      const view = snapshot();
      if (!view) return;
      const root = (await hostIndex(await rootFor(location))).root;
      if (!current(location, request)) return;
      if (root !== view.root) throw new Error('OpenCode workspace changed. Run /spectorque to analyze again.');
      const feature = view.scope.kind === 'feature' ? view.scope.id : null;
      // The workbench opens on the feature it was started for, so a new feature needs a new server.
      if (workbench?.root !== root || workbench.feature !== feature || !workbench.opened.server.listening) {
        closeWorkbench();
        const opened: Awaited<ReturnType<typeof openWorkbench>> = await openWorkbench(root, feature);
        if (!current(location, request)) {
          opened.server.close();
          return;
        }
        workbench = { root, opened, feature };
        setWorkbenchUrl(workbenchUrl(opened.url));
      }
      // A read-only alert: the address is shown, not edited. Press o in the panel to open it.
      await context.ui.dialog.alert({
        title: 'SpecTorque · Common workbench',
        message: workbenchLine(workbench.opened.url, workbench.feature) + '\nPress o in the panel to open it in your browser.',
      });
    });

    function ReviewPanel() {
      context.keymap.layer(() => ({
        commands: [
          { id: 'spectorque.scope', title: 'Select scope', bind: 's', enabled: () => (snapshot()?.index.features.length ?? 0) > 1, run: changeScope },
          { id: 'spectorque.evidence', title: 'Inspect evidence', bind: 'e', enabled: () => Boolean(snapshot()), run: inspect },
          { id: 'spectorque.panel.review', title: 'Review change', bind: 'r', enabled: () => Boolean(snapshot()), run: review },
          { id: 'spectorque.workbench', title: 'Open common workbench', bind: 'w', enabled: () => Boolean(snapshot()), run: handoff },
          { id: 'spectorque.browser', title: 'Open workbench in browser', bind: 'o', enabled: () => Boolean(workbenchUrl()), run: () => { const url = workbenchUrl(); if (url) openInBrowser(url); } },
          { id: 'spectorque.close', title: 'Close SpecTorque', bind: 'q', run: () => context.ui.panel.close() },
        ],
      }));
      // Title with version, scope, summary and dimensions, findings, then the actions and the closing note.
      return <box flexDirection="column" padding={1}>
        <Show when={snapshot()} keyed fallback={<><text>{titleLine(PRODUCT_VERSION)}</text><text>{status()}</text></>}>{view => { const [title, ...summary] = terminalSummary(view.report); return <>
          <text>{title}</text>
          <text>Scope: {scopeLabel(view.scope)} · {view.index.features.length} features · {view.index.mode}</text>
          <For each={summary}>{line => <text>{line}</text>}</For>
          <text>Revision: {view.report.id} · Unknown practices: {view.report.summary.unknown}</text>
          <Show when={!view.report.findings.length}><text>No rule findings in this scope.</text></Show>
          <For each={view.report.decisions}>{evidence =>
            <text>{evidence.path}:{evidence.line} {evidence.text}</text>
          }</For>
          <Show when={view.index.features.length > 1}><text>s Select scope</text></Show>
          <text>e Inspect evidence · r Review change · w Common workbench</text>
          <Show when={workbenchUrl()}>{url => <text>{workbenchLine(url(), workbench?.feature)} · o Open in browser</text>}</Show>
        </>; }}</Show>
        <text>q Close panel</text>
        <text>{DISCLAIMER}</text>
      </box>;
    }

    context.ui.slot({ append: 'session.panel', render: panel => <Show when={panel.name === panelName}><ReviewPanel /></Show> });
    context.keymap.layer(() => ({ mode: 'global', commands: [
      { id: 'spectorque.open', title: 'Open SpecTorque', palette: true, slash: { name: 'spectorque' }, run: () => open() },
      // A separate command keeps /spectorque runnable with Enter; arguments narrow the scope.
      { id: 'spectorque.scope', title: 'Open SpecTorque on a scope', palette: true, slash: { name: 'spectorque-scope', arguments: true }, run: (input?: string) => open(input) },
      { id: 'spectorque.review', title: 'Review SpecTorque evidence', palette: true, slash: { name: 'spectorque-review' }, run: review },
    ] }));
    return () => { disposed = true; stopWatching(); closeWorkbench(); };
  },
});
