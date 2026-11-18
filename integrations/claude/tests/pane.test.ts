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

function stubHost(on: any, cli: (args: string[]) => unknown | Promise<unknown>) {
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

test('superseded refreshes and proposals do not replace newer state', async ($, on) => {
  let releaseAnalysis!: () => void, releaseRefine!: () => void;
  const analysisGate = new Promise<void>(done => { releaseAnalysis = done; });
  const refineGate = new Promise<void>(done => { releaseRefine = done; });
  const calls = stubHost(on, async args => {
    if (args[0] === 'analyze') {
      const at = args.indexOf('--feature');
      const feature = at < 0 ? null : args[at + 1];
      if (feature === 'specs/payments') await analysisGate;
      return ok(report(feature));
    }
    if (args[0] === 'refine') {
      await refineGate;
      return ok({ applied: false, proposal: { id: 'late', path: 'specs/booking/spec.md', line: 5, original: 'FR-001: The system MUST be fast.', replacement: 'late', baseHash: 'a'.repeat(64) } });
    }
    return fail('unexpected ' + args.join(' '));
  });
  await $.command.run({ command: 'spectorque', args: '' });
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' });

  const slowScope = ui.press({ key: 'scope-1' });
  await ui.press({ key: 'scope-0' });
  releaseAnalysis();
  await slowScope;
  expect(await ui.find({ type: 'Text', text: 'Scope: specs/booking' })).toBeDefined();
  expect(await ui.find({ type: 'Text', text: /specs\/booking\/spec\.md:5/ })).toBeDefined();
  expect(await ui.find({ type: 'Text', text: /specs\/payments\/spec\.md/ })).toBeUndefined();

  const lateProposal = ui.input({ key: 'replacement-0', text: 'late' });
  for (let i = 0; i < 100 && !calls.some(args => args[0] === 'refine'); i++) await new Promise(done => setTimeout(done, 5));
  expect(calls.some(args => args[0] === 'refine')).toBe(true);
  await ui.press({ key: 'refresh' });
  releaseRefine();
  await lateProposal;
  expect(await ui.find({ key: 'apply' })).toBeUndefined();
  expect(await ui.find({ type: 'Text', text: /After: late/ })).toBeUndefined();

  await ui.press({ key: 'scope-all' });
  await ui.unmount();
});

const READY = { stream: 'stdout', text: 'SpecTorque workbench: http://127.0.0.1:4321\nWorkspace: /sample\nOnly loopback connections are accepted.\n' };
const emptyReport = () => ok({ name: 'Sample', summary: { score: null }, findings: [], decisions: [], dimensions: [], artifacts: [] });

test('common workbench opens for the session workspace, copies its address and stops on close', async ($, on) => {
  stubHost(on, emptyReport);
  const spawned: { argv: string[]; cwd?: string }[] = [];
  const copied: unknown[] = [];
  let serverExit!: () => void;
  on('ui.copy', (_: unknown, e: unknown) => { copied.push(e); return { value: undefined }; });
  // The harness cannot observe the host stopping a process; the real-client run checks the port closes.
  on('process.spawn', async function* (_: unknown, e: { argv: string[]; cwd?: string }) {
    spawned.push(e);
    yield READY;
    await new Promise<void>(done => { serverExit = done; });
    return { value: { exitCode: 0, stdout: '', stderr: '' } };
  });
  await $.command.run({ command: 'spectorque', args: '' });
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' });
  await ui.press({ key: 'workbench' });
  expect(spawned).toHaveLength(1);
  expect(spawned[0].argv.slice(2)).toEqual(['serve', '--root', '/sample', '--port', '0']);
  expect(spawned[0].cwd).toBe('/sample');
  expect(JSON.stringify(copied)).toContain('http://127.0.0.1:4321');
  expect(await ui.find({ type: 'Text', text: /Common workbench \(address copied\): http:\/\/127\.0\.0\.1:4321\nOpen it in a browser, load the local workspace and select: All documents/ })).toBeDefined();
  expect((await ui.find({ key: 'workbench' }))?.props.label).toBe('Close common workbench');
  await ui.press({ key: 'workbench' });
  expect(await ui.find({ type: 'Text', text: /Common workbench/ })).toBeUndefined();
  expect((await ui.find({ key: 'workbench' }))?.props.label).toBe('Open common workbench');
  serverExit();
  await new Promise(done => setTimeout(done, 20));
  expect(await ui.find({ type: 'Text', text: /stopped/ })).toBeUndefined();
  await ui.unmount();
});

test('common workbench reports startup failure and an unexpected exit', async ($, on) => {
  stubHost(on, emptyReport);
  let mode: 'fail' | 'exit' = 'fail';
  let exitNow!: () => void;
  on('ui.copy', () => ({ value: undefined }));
  on('process.spawn', async function* () {
    if (mode === 'fail') { yield { stream: 'stderr', text: 'listen EADDRINUSE: address already in use\n' }; return { value: { exitCode: 1, stdout: "", stderr: "" } }; }
    yield READY;
    await new Promise<void>(done => { exitNow = done; });
    return { value: { exitCode: 1, stdout: "", stderr: "" } };
  });
  await $.command.run({ command: 'spectorque', args: '' });
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' });
  await ui.press({ key: 'workbench' });
  expect(await ui.find({ type: 'Text', text: 'Common workbench failed: listen EADDRINUSE: address already in use' })).toBeDefined();
  expect((await ui.find({ key: 'workbench' }))?.props.label).toBe('Open common workbench');

  mode = 'exit';
  await ui.press({ key: 'workbench' });
  expect(await ui.find({ type: 'Text', text: /Common workbench \(address copied\): http:\/\/127\.0\.0\.1:4321/ })).toBeDefined();
  exitNow();
  for (let i = 0; i < 100 && !(await ui.find({ type: 'Text', text: /stopped/ })); i++) await new Promise(done => setTimeout(done, 5));
  expect(await ui.find({ type: 'Text', text: 'The common workbench stopped. Open it again to continue.' })).toBeDefined();
  expect((await ui.find({ key: 'workbench' }))?.props.label).toBe('Open common workbench');
  await ui.unmount();
});

test('a second press cancels a pending workbench startup without starting another server', async ($, on) => {
  stubHost(on, emptyReport);
  let spawns = 0;
  let ready!: () => void;
  on('ui.copy', () => ({ value: undefined }));
  on('process.spawn', async function* () {
    spawns++;
    await new Promise<void>(done => { ready = done; });
    yield READY;
    await new Promise(() => {});
  });
  await $.command.run({ command: 'spectorque', args: '' });
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' });
  const starting = ui.press({ key: 'workbench' });
  for (let i = 0; i < 100 && (await ui.find({ key: 'workbench' }))?.props.label !== 'Cancel common workbench startup'; i++) await new Promise(done => setTimeout(done, 5));
  expect((await ui.find({ key: 'workbench' }))?.props.label).toBe('Cancel common workbench startup');
  await ui.press({ key: 'workbench' });
  expect((await ui.find({ key: 'workbench' }))?.props.label).toBe('Open common workbench');
  for (let i = 0; i < 100 && !ready; i++) await new Promise(done => setTimeout(done, 5));
  ready();
  await starting;
  expect(spawns).toBe(1);
  expect(await ui.find({ type: 'Text', text: /Common workbench/ })).toBeUndefined();
  expect((await ui.find({ key: 'workbench' }))?.props.label).toBe('Open common workbench');
  await ui.unmount();
});

