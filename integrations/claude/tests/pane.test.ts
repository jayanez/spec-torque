import { expect, test } from 'claude-code/testing';

const PANE = { plugin: 'spectorque', component: 'Pane', requestId: 'spectorque', viewport: { columns: 100, rows: 30 }, props: { title: 'SpecTorque', isFocused: true, bodyColumns: 60, placement: 'inline', scroll: { offset: 0, bodyRows: 10 }, view: {} } } as const;
const ok = (stdout: unknown) => ({ value: { exitCode: 0, stdout: typeof stdout === 'string' ? stdout : JSON.stringify(stdout), stderr: '' } });
const fail = (stderr: string) => ({ value: { exitCode: 1, stdout: '', stderr } });
const artifact = (featureId: string, path: string, hash: string) => ({ path, featureId, role: 'spec', archived: false, framework: 'spec-kit', hash });
const finding = (path: string) => ({ message: 'Unbounded wording: “fast”.', suggestion: 'Ask for any missing limit.', evidence: [{ path, line: 5, text: 'FR-001: The system MUST be fast.' }] });
const report = (scope: string | null) => ({
  name: 'Sample', summary: { score: null }, decisions: [], dimensions: [],
  artifacts: [artifact('specs/booking', 'specs/booking/spec.md', 'a'.repeat(64)), artifact('specs/payments', 'specs/payments/spec.md', 'b'.repeat(64))].filter(a => scope === null || a.featureId === scope),
  findings: [finding(scope === 'specs/payments' ? 'specs/payments/spec.md' : 'specs/booking/spec.md')],
});

function stubHost(on: any, cli: (args: string[]) => unknown) {
  const calls: string[][] = [];
  on('session.cwd', () => ({ value: '/sample' }));
  on('ui.open', () => ({ value: undefined }));
  on('process.run', (_: unknown, e: { argv: string[] }) => {
    if (e.argv[1] === '--version') return ok('v22.20.0\n');
    const args = e.argv.slice(2);
    calls.push(args);
    return cli(args);
  });
  return calls;
}

test('native pane loads in terminal and desktop render harnesses without model calls', async ($, on) => {
  stubHost(on, () => ok({ name: 'Sample', summary: { score: null }, findings: [], decisions: [], dimensions: [], artifacts: [] }));
  await $.command.run({ command: 'spectorque', args: '' });
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface });
    expect(await ui.find({ type: 'Text', text: /SpecTorque/ })).toBeDefined();
    await ui.press({ key: 'refresh' });
    expect(await ui.find({ type: 'Text', text: /Incomplete assessment/ })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: 'No rule findings in this scope.' })).toBeDefined();
    expect(await ui.find({ key: 'scope-all' })).toBeUndefined();
    await ui.unmount();
  }
});

test('pane reports an unsuitable or missing Node.js runtime', async ($, on) => {
  let version: string | null = 'v20.11.0\n';
  on('session.cwd', () => ({ value: '/sample' }));
  on('ui.open', () => ({ value: undefined }));
  on('process.run', () => version === null ? { value: { exitCode: 127, stdout: '', stderr: 'node: command not found' } } : ok(version));
  await $.command.run({ command: 'spectorque', args: '' });
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' });
  expect(await ui.find({ type: 'Text', text: /Analysis failed: Node\.js 22\.20 or later is required on PATH; found v20\.11\.0/ })).toBeDefined();
  version = null;
  await ui.press({ key: 'refresh' });
  expect(await ui.find({ type: 'Text', text: 'Analysis failed: Node.js 22.20 or later is required on PATH; found none.' })).toBeDefined();
  await ui.unmount();
});

test('scope selection, hash-bound proposal, rejection, application and stale rejection', async ($, on) => {
  let stale = false;
  const calls = stubHost(on, args => {
    if (args[0] === 'analyze') { const at = args.indexOf('--feature'); return ok(report(at < 0 ? null : args[at + 1])); }
    if (args[0] === 'refine') return ok({ applied: false, proposal: { id: 'p1', path: 'specs/payments/spec.md', line: 5, original: 'FR-001: The system MUST be fast.', replacement: args[args.indexOf('--replacement') + 1], baseHash: 'b'.repeat(64) } });
    if (args[0] === 'apply') return stale ? fail('Source changed: this edit is stale.') : ok({ applied: true, id: 'p1' });
    return fail('unexpected ' + args.join(' '));
  });
  await $.command.run({ command: 'spectorque', args: '' });
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' });
  expect(await ui.find({ type: 'Text', text: 'Scope: All documents' })).toBeDefined();
  await ui.press({ key: 'scope-1' });
  expect(await ui.find({ type: 'Text', text: 'Scope: specs/payments' })).toBeDefined();
  expect(calls.at(-1)).toEqual(['analyze', '/sample', '--json', '--feature', 'specs/payments']);
  expect(await ui.find({ type: 'Text', text: /specs\/payments\/spec\.md:5/ })).toBeDefined();

  const replacement = 'FR-001: The system MUST respond. [NEEDS CLARIFICATION: response-time limit?]';
  await ui.input({ key: 'replacement-0', text: replacement });
  const refine = calls.at(-1)!;
  expect(refine.slice(0, 2)).toEqual(['refine', '/sample/specs/payments/spec.md']);
  expect(refine[refine.indexOf('--expect-hash') + 1]).toBe('b'.repeat(64));
  expect(await ui.find({ type: 'Text', text: 'Before: FR-001: The system MUST be fast.\nAfter: ' + replacement })).toBeDefined();
  await ui.press({ key: 'reject' });
  expect(await ui.find({ key: 'apply' })).toBeUndefined();
  expect(calls.some(args => args[0] === 'apply')).toBe(false);

  await ui.input({ key: 'replacement-0', text: replacement });
  await ui.press({ key: 'apply' });
  expect(calls.filter(args => args[0] === 'apply')).toHaveLength(1);
  expect(calls.at(-1)).toEqual(['analyze', '/sample', '--json', '--feature', 'specs/payments']);
  expect(await ui.find({ type: 'Text', text: /Scope: specs\/payments/ })).toBeDefined();

  stale = true;
  await ui.input({ key: 'replacement-0', text: replacement });
  await ui.press({ key: 'apply' });
  expect(await ui.find({ type: 'Text', text: /Apply failed: Source changed: this edit is stale\. Refresh the analysis/ })).toBeDefined();
  expect(await ui.find({ key: 'apply' })).toBeUndefined();

  await ui.press({ key: 'scope-all' });
  expect(calls.at(-1)).toEqual(['analyze', '/sample', '--json']);
  await ui.unmount();
});
