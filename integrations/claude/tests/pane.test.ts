import { expect, test } from 'claude-code/testing';

const PANE = { plugin: 'spectorque', component: 'Pane', requestId: 'spectorque', viewport: { columns: 100, rows: 30 }, props: { title: 'SpecTorque', isFocused: true, bodyColumns: 60, placement: 'inline', scroll: { offset: 0, bodyRows: 10 }, view: {} } } as const;
const ok = (stdout: unknown) => ({ value: { exitCode: 0, stdout: typeof stdout === 'string' ? stdout : JSON.stringify(stdout), stderr: '' } });
const fail = (stderr: string) => ({ value: { exitCode: 1, stdout: '', stderr } });
const artifact = (featureId: string, path: string, hash: string) => ({ path, featureId, role: 'spec', archived: false, framework: 'spec-kit', hash });
const finding = (path: string) => ({ practiceId: 'I1.2', severity: 'warning', message: 'Unbounded wording: “fast”.', suggestion: 'Ask for any missing limit.', evidence: [{ path, line: 5, text: 'FR-001: The system MUST be fast.' }] });
const report = (scope: string | null) => ({
  name: 'Sample', engineVersion: '0.1.9', summary: { score: null, maximum: 30 }, decisions: [], dimensions: [],
  artifacts: [artifact('specs/booking', 'specs/booking/spec.md', 'a'.repeat(64)), artifact('specs/payments', 'specs/payments/spec.md', 'b'.repeat(64))].filter(a => scope === null || a.featureId === scope),
  findings: [finding(scope === 'specs/payments' ? 'specs/payments/spec.md' : 'specs/booking/spec.md')],
});

const feature = (id: string, layout = true) => ({ id, framework: layout ? 'spec-kit' : 'generic', layout, artifacts: 1 });
const twoFeatures = { version: '0.2.2', root: '/sample', mode: 'git', focus: null, total: 2, limit: 500, features: [feature('specs/booking'), feature('specs/payments')] };

// Pane callbacks start a refresh without waiting for it; wait until the expected command runs.
async function until(check: () => boolean) { for (let i = 0; i < 200 && !check(); i++) await new Promise(done => setTimeout(done, 5)); }
const lastIs = (calls: string[][], args: string[]) => () => JSON.stringify(calls.at(-1)) === JSON.stringify(args);

function stubHost(on: any, cli: (args: string[]) => unknown | Promise<unknown>, index: unknown = twoFeatures) {
  const calls: string[][] = [];
  const saved = new Map<string, unknown>();
  on('session.cwd', () => ({ value: '/sample' }));
  on('ui.open', () => ({ value: undefined }));
  on('store.get', (_: unknown, e: { key: string }) => ({ value: saved.get(e.key) }));
  on('store.set', (_: unknown, e: { key: string; value: unknown }) => { saved.set(e.key, e.value); return { value: undefined }; });
  on('process.run', (_: unknown, e: { argv: string[] }) => {
    if (e.argv[1] === '--version') return ok('v22.20.0\n');
    const args = e.argv.slice(2);
    calls.push(args);
    return args[0] === 'features' ? ok(index) : cli(args);
  });
  return calls;
}

test('native pane loads in terminal and desktop render harnesses without model calls', async ($, on) => {
  stubHost(on, () => ok({ name: 'Sample', engineVersion: '0.1.9', summary: { score: null, maximum: 30 }, findings: [], decisions: [], dimensions: [], artifacts: [] }), { ...twoFeatures, total: 1, features: [feature('specs/booking')] });
  await $.command.run({ command: 'spectorque', args: '' });
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface });
    expect(await ui.find({ type: 'Text', text: 'SpecTorque 0.2.2 · Sample' })).toBeDefined();
    await ui.press({ key: 'refresh' });
    expect(await ui.find({ type: 'Text', text: 'Incomplete assessment · 0 findings · 0 open decisions · engine 0.1.9' })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: 'Heuristic evidence, not a correctness certificate. No model is called by this pane.' })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: 'No rule findings in this scope.' })).toBeDefined();
    expect(await ui.find({ key: 'scope-filter' })).toBeUndefined();
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
  expect(await ui.find({ type: 'Text', text: 'Scope: All documents · 2 features · git' })).toBeDefined();
  expect(calls[0]).toEqual(['features', '--json']);
  await ui.select({ key: 'scope', value: 'f:specs/payments' });
  await until(lastIs(calls, ['analyze', '/sample', '--json', '--feature', 'specs/payments']));
  expect(await ui.find({ type: 'Text', text: /^Scope: specs\/payments/ })).toBeDefined();
  expect(calls.at(-1)).toEqual(['analyze', '/sample', '--json', '--feature', 'specs/payments']);
  expect(await ui.find({ type: 'Text', text: 'Finding 1 of 1 · I1.2 · warning\nspecs/payments/spec.md:5\nUnbounded wording: “fast”.\nEvidence: «FR-001: The system MUST be fast.»\nFix: Ask for any missing limit.' })).toBeDefined();
  expect((await ui.find({ key: 'replacement-0' }))?.props.label).toBe('Proposed replacement for line 5');
  expect((await ui.find({ key: 'previous' }))?.props.dimColor).toBe(true);
  expect((await ui.find({ key: 'next' }))?.props.dimColor).toBe(true);

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

  await ui.select({ key: 'scope', value: 'all' });
  await until(lastIs(calls, ['analyze', '/sample', '--json']));
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

  const slowScope = $.command.run({ command: 'spectorque', args: 'specs/payments' });
  await until(() => calls.some(args => args.includes('specs/payments')));
  await ui.select({ key: 'scope', value: 'f:specs/booking' });
  await until(lastIs(calls, ['analyze', '/sample', '--json', '--feature', 'specs/booking']));
  releaseAnalysis();
  await slowScope;
  expect(await ui.find({ type: 'Text', text: /^Scope: specs\/booking/ })).toBeDefined();
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

  await ui.select({ key: 'scope', value: 'all' });
  await ui.unmount();
});

test('large work trees wait for a feature, filter the list and accept command arguments', async ($, on) => {
  const many = { root: '/repo', mode: 'git', focus: null, total: 640, limit: 500, features: [...Array.from({ length: 30 }, (_, i) => feature(`specs/${String(i + 1).padStart(3, '0')}-item`)), feature('docs/adr', false)] };
  const calls = stubHost(on, args => args[0] === 'analyze' ? ok(report(null)) : fail('unexpected ' + args.join(' ')), many);
  await $.command.run({ command: 'spectorque', args: '' });
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' });
  expect(calls.some(args => args[0] === 'analyze')).toBe(false);
  expect(await ui.find({ type: 'Text', text: /640 documents, more than 500/ })).toBeDefined();
  const options = () => ui.find({ key: 'scope' }).then(select => select!.props.options.map((o: { value: string }) => o.value));
  expect(await options()).not.toContain('all');
  expect(await options()).toHaveLength(13);
  await ui.input({ key: 'scope-filter', text: 'adr', kind: 'change' });
  expect((await ui.find({ key: 'scope' }))!.props.options.at(-1).label).toBe('Other · docs/adr');
  await ui.input({ key: 'scope-filter', text: '017', kind: 'change' });
  expect(await options()).toEqual(['changed', 'f:specs/017-item']);
  await ui.select({ key: 'scope', value: 'f:specs/017-item' });
  await until(lastIs(calls, ['analyze', '/repo', '--json', '--feature', 'specs/017-item']));
  expect(calls.at(-1)).toEqual(['analyze', '/repo', '--json', '--feature', 'specs/017-item']);
  await ui.unmount();

  await $.command.run({ command: 'spectorque', args: '--changed develop' });
  expect(calls.at(-1)).toEqual(['analyze', '/repo', '--json', '--changed', '--base', 'develop']);
  await $.command.run({ command: 'spectorque', args: 'specs/003-item' });
  expect(calls.at(-1)).toEqual(['analyze', '/repo', '--json', '--feature', 'specs/003-item']);
  await $.command.run({ command: 'spectorque', args: 'docs/specs/' });
  expect(calls.at(-1)).toEqual(['analyze', '/repo', '--json', '--path', 'docs/specs']);
});

test('a subfolder session focuses its folder and the last scope is remembered per work tree', async ($, on) => {
  const calls = stubHost(on, args => args[0] === 'analyze' ? ok(report(null)) : fail('unexpected'), { ...twoFeatures, focus: 'specs/payments' });
  await $.command.run({ command: 'spectorque', args: '' });
  expect(calls.at(-1)).toEqual(['analyze', '/sample', '--json', '--path', 'specs/payments']);
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' });
  await ui.select({ key: 'scope', value: 'f:specs/booking' });
  await until(lastIs(calls, ['analyze', '/sample', '--json', '--feature', 'specs/booking']));
  await ui.unmount();
  await $.command.run({ command: 'spectorque', args: '' });
  expect(calls.at(-1)).toEqual(['analyze', '/sample', '--json', '--feature', 'specs/booking']);
});

const READY = { stream: 'stdout', text: 'SpecTorque workbench: http://127.0.0.1:4321\nWorkspace: /sample\nOnly loopback connections are accepted.\n' };
const emptyReport = () => ok({ name: 'Sample', engineVersion: '0.1.9', summary: { score: null, maximum: 30 }, findings: [], decisions: [], dimensions: [], artifacts: [] });

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
  // One workbench line: the copied address is the link's, and nothing asks for a manual load.
  expect(copied).toEqual([{ text: 'http://localhost:4321/' }]);
  const link = await ui.find({ type: 'Link' });
  expect(link?.props.href).toBe('http://localhost:4321/');
  expect(link?.props.label).toBe('Workbench: http://localhost:4321/ (address copied)');
  expect(await ui.find({ type: 'Text', text: /127\.0\.0\.1|load the local workspace/ })).toBeUndefined();
  expect((await ui.find({ key: 'workbench' }))?.props.label).toBe('Close common workbench');
  await ui.press({ key: 'workbench' });
  expect(await ui.find({ type: 'Link' })).toBeUndefined();
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
  expect((await ui.find({ type: 'Link' }))?.props.label).toBe('Workbench: http://localhost:4321/ (address copied)');
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
  expect(await ui.find({ type: 'Link' })).toBeUndefined();
  expect((await ui.find({ key: 'workbench' }))?.props.label).toBe('Open common workbench');
  await ui.unmount();
});


test('the scope selector always lists the current scope, even past the shown features', async ($, on) => {
  const many = { version: '0.2.2', root: '/repo', mode: 'git', focus: null, total: 900, limit: 500, features: Array.from({ length: 70 }, (_, i) => feature(`specs/${String(i + 1).padStart(3, '0')}-item`)) };
  const calls = stubHost(on, args => args[0] === 'analyze' ? ok(report(null)) : fail('unexpected ' + args.join(' ')), many);
  await $.command.run({ command: 'spectorque', args: 'specs/062-item' });
  expect(calls.at(-1)).toEqual(['analyze', '/repo', '--json', '--feature', 'specs/062-item']);
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' });
  const select = await ui.find({ key: 'scope' });
  expect(select?.props.label).toBe('Select scope');
  expect(select?.props.value).toBe('f:specs/062-item');
  const values = select!.props.options.map((o: { value: string }) => o.value);
  expect(values).toHaveLength(14);
  expect(values.at(-1)).toBe('f:specs/062-item');
  await ui.input({ key: 'scope-filter', text: '017', kind: 'change' });
  expect((await ui.find({ key: 'scope' }))!.props.options.map((o: { value: string }) => o.value)).toEqual(['changed', 'f:specs/017-item', 'f:specs/062-item']);
  await ui.unmount();

  await $.command.run({ command: 'spectorque', args: '--changed develop' });
  const based = await $.ui.mount({ ...PANE, surface: 'terminal' });
  expect((await based.find({ key: 'scope' }))?.props.value).toBe('c:develop');
  expect((await based.find({ key: 'scope' }))!.props.options.slice(0, 2)).toEqual([{ value: 'changed', label: 'Changed on this branch' }, { value: 'c:develop', label: 'Changed on this branch (vs develop)' }]);
  await based.unmount();

  await $.command.run({ command: 'spectorque', args: 'docs/specs' });
  const folder = await $.ui.mount({ ...PANE, surface: 'terminal' });
  expect((await folder.find({ key: 'scope' }))?.props.value).toBe('p:docs/specs');
  expect((await folder.find({ key: 'scope' }))!.props.options[0]).toEqual({ value: 'p:docs/specs', label: 'Folder · docs/specs' });
  await folder.unmount();
});

test('the workbench line names the feature the workbench opens on', async ($, on) => {
  stubHost(on, args => args[0] === 'analyze' ? ok(report('specs/payments')) : fail('unexpected'));
  const spawned: string[][] = [];
  on('ui.copy', () => ({ value: undefined }));
  on('process.spawn', async function* (_: unknown, e: { argv: string[] }) { spawned.push(e.argv); yield READY; await new Promise(() => {}); });
  await $.command.run({ command: 'spectorque', args: 'specs/payments' });
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' });
  await ui.press({ key: 'workbench' });
  expect(spawned[0].slice(2)).toEqual(['serve', '--root', '/sample', '--port', '0', '--feature', 'specs/payments']);
  expect((await ui.find({ type: 'Link' }))?.props.label).toBe('Workbench: http://localhost:4321/ — opens on specs/payments (address copied)');
  await ui.press({ key: 'workbench' });
  await ui.unmount();
});
