const PANE = 'spectorque';
const ALL = 'All documents';
let assessment;
let scope = null;
let scopes = [];
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
async function run($, args) {
  const output = await $.process.run(['node', cli, ...args]);
  if (output.exitCode || output.isStdoutTruncated) throw new Error(output.stderr?.trim() || 'Command failed or exceeded the output limit. Select a smaller workspace.');
  return JSON.parse(output.stdout);
}
async function analyzeScope($, cwd) {
  return run($, ['analyze', cwd, '--json', ...(scope === null ? [] : ['--feature', scope])]);
}
async function refresh($) {
  try {
    await checkNode($);
    const cwd = await $.session.cwd();
    try { assessment = await analyzeScope($, cwd); }
    catch (e) {
      if (scope === null || !/Unknown feature/.test(message(e))) throw e;
      scope = null;
      assessment = await analyzeScope($, cwd);
    }
    if (scope === null) scopes = [...new Set(assessment.artifacts.filter(a => !a.archived && a.role !== 'instructions').map(a => a.featureId))].sort();
    selected = 0; proposal = undefined; error = '';
  } catch (e) { assessment = undefined; proposal = undefined; error = 'Analysis failed: ' + message(e); }
  $.ui.invalidate('ui.render');
}
export function register(on) {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: PANE, description: 'Review specification quality and evidence' });
    return next(e);
  });
  on('command.run', { command: PANE }, async ($) => {
    await refresh($);
    await $.ui.open({ id: PANE, title: 'SpecTorque', focus: true, closeOnEscape: true });
    return {};
  });
  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e);
    const { Box, Text, Button, Input } = $.ui.resolve(e);
    const redraw = () => $.ui.invalidate('ui.render');
    const choose = value => { scope = value; return refresh($); };
    const finding = assessment?.findings[selected];
    const ev = finding?.evidence[0];
    const children = [
      Text({ children: ['SpecTorque · ' + (assessment?.name || 'Review')] }),
      Button({ key: 'refresh', label: 'Refresh analysis', onPress: () => refresh($) }),
    ];
    if (scopes.length > 1) {
      children.push(Text({ children: ['Scope: ' + (scope ?? ALL)] }));
      children.push(Box({ flexDirection: 'row', columnGap: 2, children: [
        Button({ key: 'scope-all', label: ALL, onPress: () => choose(null) }),
        ...scopes.map((value, index) => Button({ key: 'scope-' + index, label: value, onPress: () => choose(value) })),
      ] }));
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
        try {
          const cwd = await $.session.cwd();
          const source = assessment.artifacts.find(a => a.path === ev.path);
          if (!source) throw new Error('Evidence source is not in this assessment. Refresh the analysis.');
          proposal = (await run($, ['refine', cwd + '/' + ev.path, '--root', cwd, '--line', String(ev.line), '--replacement', replacement, '--expect-hash', source.hash])).proposal;
          error = '';
        } catch (e) { proposal = undefined; error = 'Proposal failed: ' + message(e); }
        redraw();
      } }));
    }
    if (proposal) {
      children.push(Text({ children: ['Before: ' + proposal.original + '\nAfter: ' + proposal.replacement] }));
      children.push(Button({ key: 'apply', label: 'Apply reviewed change', onPress: async () => {
        try { await run($, ['apply', '--root', await $.session.cwd(), '--proposal', JSON.stringify(proposal), '--apply']); await refresh($); }
        catch (e) { error = 'Apply failed: ' + message(e) + ' Refresh the analysis before proposing again.'; proposal = undefined; redraw(); }
      } }));
      children.push(Button({ key: 'reject', label: 'Reject proposal', onPress: () => { proposal = undefined; redraw(); } }));
    }
    children.push(Text({ children: ['Heuristic evidence, not a correctness certificate. No model is called by this pane.'] }));
    return Box({ flexDirection: 'column', rowGap: 1, children });
  });
}
