import { ALL, CHANGED, DISCLAIMER, dimensionsLine, featureLabel, findingCard, replacementLabel, scopeLabel, scopeValue, summaryLine, titleLine, valueScope, workbenchUrl } from './text.js';

const PANE = 'spectorque';
const SHOWN = 12;
let assessment;
// The workspace index: root, mode, focus, total and the shared feature list.
let index;
// { kind: 'all' } | { kind: 'feature', id } | { kind: 'path', path } | { kind: 'changed', base? }
let scope;
let filter = '';
let selected = 0;
let proposal;
let error = '';
const modulePath = decodeURIComponent(new URL('../dist/cli.js', import.meta.url).pathname);
const cli = /^\/[A-Za-z]:/.test(modulePath) ? modulePath.slice(1) : modulePath;
const message = e => String(e?.message || e);
async function checkNode($) {
  let output;
  try { output = await $.process.run(['node', '--version']); }
  catch { throw new Error('Node.js 22.20 or later is required on PATH.'); }
  const [, major, minor] = /^v(\d+)\.(\d+)/.exec(output.stdout?.trim() ?? '') ?? [];
  if (output.exitCode || !major || Number(major) < 22 || (Number(major) === 22 && Number(minor) < 20)) {
    throw new Error('Node.js 22.20 or later is required on PATH; found ' + (output.stdout?.trim() || 'none') + '.');
  }
}
async function run($, args, cwd) {
  const output = await $.process.run(['node', cli, ...args], cwd ? { cwd } : undefined);
  if (output.exitCode || output.isStdoutTruncated) throw new Error(output.stderr?.trim() || 'Command failed or exceeded the output limit. Select a smaller workspace.');
  return JSON.parse(output.stdout);
}
// Each refresh starts a generation; results from a superseded one are discarded.
let generation = 0;
const scopeArgs = value => value.kind === 'feature' ? ['--feature', value.id] : value.kind === 'path' ? ['--path', value.path]
  : value.kind === 'changed' ? ['--changed', ...(value.base ? ['--base', value.base] : [])] : [];
// The CLI reports the shared read limit with the index.
const fits = () => index && index.total <= index.limit;
const storeKey = () => 'scope:' + index.root;
// `/spectorque specs/001-x`, `/spectorque docs/specs` or `/spectorque --changed [base]` narrow the scope.
function parseArgs(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return undefined;
  if (words[0] === '--changed') return { kind: 'changed', ...(words[1] ? { base: words[1] } : {}) };
  const target = words.join(' ').replace(/\/+$/, '');
  return index.features.some(f => f.id === target) ? { kind: 'feature', id: target } : { kind: 'path', path: target };
}
async function defaultScope($) {
  const saved = await $.store.get(storeKey()).catch(() => undefined);
  if (saved?.kind === 'feature' && index.features.some(f => f.id === saved.id)) return saved;
  if (saved?.kind === 'changed' || saved?.kind === 'path') return saved;
  if (saved?.kind === 'all' && fits()) return saved;
  if (index.focus) return { kind: 'path', path: index.focus };
  if (fits()) return { kind: 'all' };
  return index.features.length === 1 ? { kind: 'feature', id: index.features[0].id } : undefined;
}
async function refresh($, requested) {
  const request = ++generation;
  proposal = undefined;
  try {
    await checkNode($);
    const cwd = await $.session.cwd();
    const next = await run($, ['features', '--json'], cwd);
    if (request !== generation) return;
    index = next;
    let target = requested ?? scope ?? await defaultScope($);
    if (target?.kind === 'feature' && !index.features.some(f => f.id === target.id)) target = await defaultScope($);
    if (target?.kind === 'all' && !fits()) target = undefined;
    scope = target;
    if (!target) { assessment = undefined; error = ''; selected = 0; $.ui.invalidate('ui.render'); return; }
    const result = await run($, ['analyze', index.root, '--json', ...scopeArgs(target)], cwd);
    if (request !== generation) return;
    assessment = result; selected = 0; proposal = undefined; error = '';
    await $.store.set(storeKey(), target).catch(() => {});
  } catch (e) {
    if (request !== generation) return;
    assessment = undefined; proposal = undefined; error = 'Analysis failed: ' + message(e);
  }
  $.ui.invalidate('ui.render');
}
// One loopback common-workbench server per session, owned by this pane.
// `workbench` is set from the first press until close, so a second press cancels
// a pending startup instead of starting another server.
let workbench;
let workbenchNote = '';
function closeWorkbench() {
  const current = workbench;
  workbench = undefined;
  // Do not block the pane while the host stops the server process.
  current?.handle?.return().catch(() => {});
}
async function openWorkbench($) {
  const current = { root: '', url: '' };
  workbench = current;
  $.ui.invalidate('ui.render');
  const root = index?.root ?? await $.session.cwd();
  if (workbench !== current) return;
  const feature = scope?.kind === 'feature' ? scope.id : null;
  const handle = $.process.spawn({ argv: ['node', cli, 'serve', '--root', root, '--port', '0', ...(feature ? ['--feature', feature] : [])], cwd: root });
  Object.assign(current, { handle, root, feature });
  let output = '';
  try {
    for (;;) {
      const chunk = await handle.next();
      if (workbench !== current) { handle.return().catch(() => {}); return; }
      if (chunk.done) throw new Error(output.trim() || 'The common workbench exited before it was ready.');
      output += chunk.value.text;
      const url = /SpecTorque workbench: (http:\/\/127\.0\.0\.1:\d+)/.exec(output)?.[1];
      if (url) { current.url = url; break; }
      if (output.length > 8192) throw new Error('The common workbench did not report its address.');
    }
  } catch (e) {
    if (workbench !== current) return;
    closeWorkbench();
    throw e;
  }
  // Drain later output; report an unexpected exit while this server is current.
  (async () => { for await (const _ of handle); })().catch(() => {}).finally(() => {
    if (workbench !== current) return;
    workbench = undefined;
    workbenchNote = 'The common workbench stopped. Open it again to continue.';
    $.ui.invalidate('ui.render');
  });
  return current;
}
export function register(on) {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: PANE, description: 'Review specification quality and evidence', argumentHint: '[feature | folder | --changed [base]]' });
    return next(e);
  });
  on('session.end', async ($, e, next) => {
    closeWorkbench();
    return next(e);
  });
  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) closeWorkbench();
    return next(e);
  });
  on('command.run', { command: PANE }, async ($, e) => {
    if (e.args?.trim()) {
      // Resolve the arguments against a fresh index of the session's work tree.
      try { await checkNode($); index = await run($, ['features', '--json'], await $.session.cwd()); await refresh($, parseArgs(e.args)); }
      catch (failure) { error = 'Analysis failed: ' + message(failure); }
    } else await refresh($);
    await $.ui.open({ id: PANE, title: 'SpecTorque', focus: true, closeOnEscape: true });
    return {};
  });
  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e);
    const { Box, Text, Button, Input, Select, Link } = $.ui.resolve(e);
    const redraw = () => $.ui.invalidate('ui.render');
    const choose = value => refresh($, value);
    const finding = assessment?.findings[selected];
    const ev = finding?.evidence[0];
    const children = [Text({ children: [titleLine(index?.version, assessment?.name)] })];
    // Scope: the current scope is always an option, so the Select never shows another one.
    if (index) {
      children.push(Text({ children: ['Scope: ' + scopeLabel(scope) + ' · ' + index.features.length + ' features · ' + index.mode] }));
      if (index.features.length > 1 || !scope) {
        const needle = filter.toLowerCase();
        const current = scope?.kind === 'feature' ? scope.id : undefined;
        const matches = index.features.filter(f => f.id.toLowerCase().includes(needle));
        const shown = new Set(matches.slice(0, SHOWN).map(f => f.id));
        const listed = index.features.filter(f => f.id === current || shown.has(f.id));
        const options = [
          ...(scope?.kind === 'path' ? [{ value: scopeValue(scope), label: scopeLabel(scope) }] : []),
          ...(fits() ? [{ value: 'all', label: ALL }] : []),
          { value: 'changed', label: CHANGED },
          ...(scope?.kind === 'changed' && scope.base ? [{ value: scopeValue(scope), label: scopeLabel(scope) }] : []),
          ...listed.map(f => ({ value: 'f:' + f.id, label: featureLabel(f) })),
        ];
        if (index.features.length > SHOWN) children.push(Input({ key: 'scope-filter', label: 'Filter features (' + matches.length + ' of ' + index.features.length + ')', value: filter, submitLabel: 'Filter', onInput: text => { filter = text; redraw(); }, onSubmit: text => { filter = text; redraw(); } }));
        children.push(Select({ key: 'scope', label: 'Select scope', value: scopeValue(scope), options, onSelect: value => choose(valueScope(value)) }));
        if (!scope && !fits()) children.push(Text({ children: ['This work tree has ' + index.total + ' documents, more than ' + index.limit + ' analyzed at once. Choose a feature, or run /spectorque <feature | folder | --changed>.'] }));
      }
    }
    if (error) children.push(Text({ children: [error] }));
    // Summary and dimensions, then the selected finding's card.
    if (assessment) {
      children.push(Text({ children: [summaryLine(assessment)] }));
      children.push(Text({ children: [dimensionsLine(assessment)] }));
      if (!finding) children.push(Text({ children: ['No rule findings in this scope.'] }));
    }
    if (finding && ev) {
      const last = assessment.findings.length - 1;
      const move = to => () => { if (to === selected) return; selected = to; proposal = undefined; redraw(); };
      children.push(Text({ children: [findingCard(assessment, selected).join('\n')] }));
      // Mods Buttons have no disabled state: at either end the button is dimmed and does nothing.
      children.push(Box({ flexDirection: 'row', columnGap: 2, children: [
        Button({ key: 'previous', label: 'Previous', dimColor: selected === 0, onPress: move(Math.max(0, selected - 1)) }),
        Button({ key: 'next', label: 'Next', dimColor: selected === last, onPress: move(Math.min(last, selected + 1)) }),
      ] }));
      children.push(Input({ key: 'replacement-' + selected, label: replacementLabel(ev.line), value: ev.text, submitLabel: 'Review change', onSubmit: async replacement => {
        // Drop a proposal whose assessment or selected finding changed meanwhile.
        const request = generation, at = selected;
        const current = () => request === generation && at === selected;
        let result, failure;
        try {
          const root = index.root;
          const source = assessment.artifacts.find(a => a.path === ev.path);
          if (!source) throw new Error('Evidence source is not in this assessment. Refresh the analysis.');
          result = (await run($, ['refine', root + '/' + ev.path, '--root', root, '--line', String(ev.line), '--replacement', replacement, '--expect-hash', source.hash])).proposal;
        } catch (e) { failure = 'Proposal failed: ' + message(e); }
        if (!current()) return;
        proposal = result; error = failure ?? '';
        redraw();
      } }));
    }
    if (proposal) {
      children.push(Text({ children: ['Before: ' + proposal.original + '\nAfter: ' + proposal.replacement] }));
      children.push(Box({ flexDirection: 'row', columnGap: 2, children: [
        Button({ key: 'apply', label: 'Apply reviewed change', onPress: async () => {
          try { await run($, ['apply', '--root', index.root, '--proposal', JSON.stringify(proposal), '--apply']); await refresh($); }
          catch (e) { error = 'Apply failed: ' + message(e) + ' Refresh the analysis before proposing again.'; proposal = undefined; redraw(); }
        } }),
        Button({ key: 'reject', label: 'Reject proposal', onPress: () => { proposal = undefined; redraw(); } }),
      ] }));
    }
    // Actions: refresh and the common workbench in one row, then its address.
    children.push(Box({ flexDirection: 'row', columnGap: 2, children: [
      Button({ key: 'refresh', label: 'Refresh analysis', onPress: () => refresh($) }),
      Button({ key: 'workbench', label: workbench?.url ? 'Close common workbench' : workbench ? 'Cancel common workbench startup' : 'Open common workbench', onPress: async () => {
        if (workbench) { closeWorkbench(); workbenchNote = ''; redraw(); return; }
        try {
          const opened = await openWorkbench($);
          if (!opened) { redraw(); return; }
          workbenchNote = '';
          // The copied address is the one the link opens.
          try { await $.ui.copy({ text: workbenchUrl(opened.url) }); opened.copied = true; } catch { opened.copied = false; }
        } catch (e) { workbenchNote = 'Common workbench failed: ' + message(e); }
        redraw();
      } }),
    ] }));
    // Mods Links and Buttons have no tooltip, so the secondary details are dimmed lines next to them.
    if (!workbench) children.push(Text({ dimColor: true, children: ['Opening the workbench also copies its address to the clipboard.'] }));
    if (workbench?.url) {
      // Desktop and VS Code make a Link clickable only for https: or http://localhost; the loopback server accepts both hosts.
      // Without a label the address is the link text, drawn once on every surface (a terminal adds the URL after a label).
      children.push(Box({ flexDirection: 'row', columnGap: 1, children: [Text({ children: ['Workbench:'] }), Link({ key: 'workbench-link', href: workbenchUrl(workbench.url) })] }));
      // Its own line: beside the link it would wrap into narrow columns on the terminal.
      const details = [workbench.copied ? 'Address copied to the clipboard' : 'Could not copy the address; use the link', ...(workbench.feature ? ['Opens on ' + workbench.feature] : [])];
      if (details.length) children.push(Text({ dimColor: true, children: [details.join(' · ')] }));
    }
    if (workbenchNote) children.push(Text({ children: [workbenchNote] }));
    children.push(Text({ children: [DISCLAIMER + ' No model is called by this pane.'] }));
    return Box({ flexDirection: 'column', rowGap: 1, children });
  });
}
