import { expect, test } from 'claude-code/testing';

const PANE = { plugin: 'spectorque', component: 'Pane', requestId: 'spectorque', viewport: { columns: 100, rows: 30 }, props: { title: 'SpecTorque', isFocused: true, bodyColumns: 60, placement: 'inline', scroll: { offset: 0, bodyRows: 10 }, view: {} } } as const;

test('native pane loads in terminal and desktop render harnesses without model calls', async ($, on) => {
  on('session.cwd', () => ({ value: '/sample' }));
  on('ui.open', () => ({ value: undefined }));
  on('ui.invalidate', () => ({ value: undefined }));
  on('process.run', () => ({ value: { exitCode: 0, stdout: JSON.stringify({ name: 'Sample', summary: { score: null }, findings: [], decisions: [], dimensions: [] }), stderr: '' } }));
  await $.command.run({ command: 'spectorque', args: '' });
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface });
    expect(await ui.find({ type: 'Text', text: /SpecTorque/ })).toBeDefined();
    await ui.press({ key: 'refresh' });
    expect(await ui.find({ type: 'Text', text: /Incomplete assessment/ })).toBeDefined();
    await ui.unmount();
  }
});
