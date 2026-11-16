const PANE = 'spectorque';
let assessment;
let selected = 0;
let proposal;
let error = '';
const modulePath = decodeURIComponent(new URL('../dist/cli.js', import.meta.url).pathname);
const cli = /^\/[A-Za-z]:/.test(modulePath) ? modulePath.slice(1) : modulePath;
async function run($, args) {
  const output = await $.process.run(['node', cli, ...args]);
  if (output.exitCode || output.isStdoutTruncated) throw new Error(output.stderr || 'Analysis failed or exceeded the output limit. Select a smaller workspace.');
  return JSON.parse(output.stdout);
}
async function refresh($) {
  try { assessment = await run($, ['analyze', await $.session.cwd(), '--json']); selected = 0; proposal = undefined; error = ''; }
  catch (e) { error = String(e.message || e); }
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
    const finding = assessment?.findings[selected];
    const ev = finding?.evidence[0];
    const children = [
      Text({ children: ['SpecTorque · ' + (assessment?.name || 'Review')] }),
      Button({ key: 'refresh', label: 'Refresh analysis', onPress: () => refresh($) }),
    ];
    if (error) children.push(Text({ children: [error] }));
    if (assessment) {
      children.push(Text({ children: [(assessment.summary.score === null ? 'Incomplete assessment' : assessment.summary.score + '/30') + ' · ' + assessment.findings.length + ' findings · ' + assessment.decisions.length + ' open decisions'] }));
      children.push(Text({ children: [assessment.dimensions.map(d => d.id + ' ' + (d.score === null ? '—' : d.score + '/3')).join('   ')] }));
    }
    if (finding && ev) {
      children.push(Box({ flexDirection: 'row', columnGap: 2, children: [
        Button({ key: 'previous', label: 'Previous', onPress: () => { selected = Math.max(0, selected - 1); proposal = undefined; redraw(); } }),
        Button({ key: 'next', label: 'Next', onPress: () => { selected = Math.min(assessment.findings.length - 1, selected + 1); proposal = undefined; redraw(); } }),
      ] }));
      children.push(Text({ children: [ev.path + ':' + ev.line + '\n' + finding.message + '\n' + ev.text + '\n' + finding.suggestion] }));
      children.push(Input({ key: 'replacement-' + selected, label: 'Proposed wording', value: ev.text, submitLabel: 'review', onSubmit: async replacement => {
        try { proposal = (await run($, ['refine', (await $.session.cwd()) + '/' + ev.path, '--root', await $.session.cwd(), '--line', String(ev.line), '--replacement', replacement])).proposal; error = ''; }
        catch (e) { error = String(e.message || e); }
        redraw();
      } }));
    }
    if (proposal) {
      children.push(Text({ children: ['Before: ' + proposal.original + '\nAfter: ' + proposal.replacement] }));
      children.push(Button({ key: 'apply', label: 'Apply reviewed change', onPress: async () => {
        try { await run($, ['apply', '--root', await $.session.cwd(), '--proposal', JSON.stringify(proposal), '--apply']); await refresh($); }
        catch (e) { error = String(e.message || e); redraw(); }
      } }));
      children.push(Button({ key: 'reject', label: 'Reject proposal', onPress: () => { proposal = undefined; redraw(); } }));
    }
    children.push(Text({ children: ['Heuristic evidence, not a correctness certificate. No model is called by this pane.'] }));
    return Box({ flexDirection: 'column', rowGap: 1, children });
  });
}
