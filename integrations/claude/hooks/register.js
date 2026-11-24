const PANE = 'spectorque';
const ALL = 'All documents';
const LIMIT = 500;
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
const scopeLabel = value => !value ? 'not selected' : value.kind === 'all' ? ALL : value.kind === 'feature' ? value.id
  : value.kind === 'path' ? 'Folder · ' + value.path : 'Changed on this branch' + (value.base ? ' (vs ' + value.base + ')' : '');
const scopeArgs = value => value.kind === 'feature' ? ['--feature', value.id] : value.kind === 'path' ? ['--path', value.path]
  : value.kind === 'changed' ? ['--changed', ...(value.base ? ['--base', value.base] : [])] : [];
const fits = () => index && index.total <= LIMIT;
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
  const feature = scope?.kind === 'feature' ? ['--feature', scope.id] : [];
  const handle = $.process.spawn({ argv: ['node', cli, 'serve', '--root', root, '--port', '0', ...feature], cwd: root });
  Object.assign(current, { handle, root });
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
    const { Box, Text, Button, Input, Select } = $.ui.resolve(e);
    const redraw = () => $.ui.invalidate('ui.render');
    const choose = value => refresh($, value);
    const finding = assessment?.findings[selected];
    const ev = finding?.evidence[0];
    const children = [
      Text({ children: ['SpecTorque · ' + (assessment?.name || 'Review')] }),
      Button({ key: 'refresh', label: 'Refresh analysis', onPress: () => refresh($) }),
      Button({ key: 'workbench', label: workbench?.url ? 'Close common workbench' : workbench ? 'Cancel common workbench startup' : 'Open common workbench', onPress: async () => {
        if (workbench) { closeWorkbench(); workbenchNote = ''; redraw(); return; }
        try {
          const opened = await openWorkbench($);
          if (!opened) { redraw(); return; }
          workbenchNote = '';
          try { await $.ui.copy({ text: opened.url }); opened.copied = true; } catch { opened.copied = false; }
        } catch (e) { workbenchNote = 'Common workbench failed: ' + message(e); }
        redraw();
      } }),
    ];
    if (workbench?.url) children.push(Text({ children: ['Common workbench' + (workbench.copied ? ' (address copied)' : '') + ': ' + workbench.url + '\nOpen it in a browser and load the local workspace' + (scope?.kind === 'feature' ? '; it opens on ' + scope.id : '') + '.'] }));
    if (workbenchNote) children.push(Text({ children: [workbenchNote] }));
    if (index) {
      children.push(Text({ children: ['Scope: ' + scopeLabel(scope) + ' · ' + index.features.length + ' features · ' + index.mode] }));
      if (index.features.length > 1 || !scope) {
        const needle = filter.toLowerCase();
        const matches = index.features.filter(f => f.id.toLowerCase().includes(needle));
        const options = [
          ...(fits() ? [{ value: 'all', label: ALL }] : []),
          { value: 'changed', label: 'Changed on this branch' },
          ...matches.slice(0, SHOWN).map(f => ({ value: 'f:' + f.id, label: (f.layout ? '' : 'Other · ') + f.id })),
        ];
        if (index.features.length > SHOWN) children.push(Input({ key: 'scope-filter', label: 'Filter features (' + matches.length + ' of ' + index.features.length + ')', value: filter, submitLabel: 'filter', onInput: text => { filter = text; redraw(); }, onSubmit: text => { filter = text; redraw(); } }));
        children.push(Select({ key: 'scope', label: scope ? 'Change scope' : 'Choose a feature to analyze', value: scope?.kind === 'feature' ? 'f:' + scope.id : scope?.kind === 'all' ? 'all' : scope?.kind === 'changed' ? 'changed' : undefined, options, onSelect: value => choose(value === 'all' ? { kind: 'all' } : value === 'changed' ? { kind: 'changed' } : { kind: 'feature', id: value.slice(2) }) }));
        if (!scope && !fits()) children.push(Text({ children: ['This work tree has ' + index.total + ' documents, more than ' + LIMIT + ' analyzed at once. Choose a feature, or run /spectorque <feature | folder | --changed>.'] }));
      }
    }
    if (error) children.push(Text({ children: [error] }));
    if (assessment) {
      children.push(Text({ children: [(assessment.summary.score === null ? 'Incomplete assessment' : assessment.summary.score + '/30') + ' · ' + assessment.findings.length + ' findings · ' + assessment.decisions.length + ' open decisions'] }));
      children.push(Text({ children: [assessment.dimensions.map(d => d.id + ' ' + (d.score === null ? '—' : d.score + '/3')).join('   ')] }));
      if (!finding) children.push(Text({ children: ['No rule findings in this scope.'] }));
    }
    if (finding && ev) {
      children.push(Box({ flexDirection: 'row', columnGap: 2, children: [
        Button({ key: 'previous', label: 'Previous', onPress: () => { selected = Math.max(0, selected - 1); proposal = undefined; redraw(); } }),
        Button({ key: 'next', label: 'Next', onPress: () => { selected = Math.min(assessment.findings.length - 1, selected + 1); proposal = undefined; redraw(); } }),
      ] }));
      children.push(Text({ children: [ev.path + ':' + ev.line + '\n' + finding.message + '\n' + ev.text + '\n' + finding.suggestion] }));
      children.push(Input({ key: 'replacement-' + selected, label: 'Proposed wording', value: ev.text, submitLabel: 'review', onSubmit: async replacement => {
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
      children.push(Button({ key: 'apply', label: 'Apply reviewed change', onPress: async () => {
        try { await run($, ['apply', '--root', index.root, '--proposal', JSON.stringify(proposal), '--apply']); await refresh($); }
        catch (e) { error = 'Apply failed: ' + message(e) + ' Refresh the analysis before proposing again.'; proposal = undefined; redraw(); }
      } }));
      children.push(Button({ key: 'reject', label: 'Reject proposal', onPress: () => { proposal = undefined; redraw(); } }));
    }
    children.push(Text({ children: ['Heuristic evidence, not a correctness certificate. No model is called by this pane.'] }));
    return Box({ flexDirection: 'column', rowGap: 1, children });
  });
}
