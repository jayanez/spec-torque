import { PRODUCT_VERSION } from '../../src/version.js';
import { readFile } from 'node:fs/promises';
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import { bindWorkspace, StaleAssessmentError } from '../../src/node/scoped-review.js';

const workspace = await bindWorkspace(process.env.SPECTORQUE_ROOT);
const uri = 'ui://spectorque/viewer.html';
const mimeType = 'text/html;profile=mcp-app';
const html = await readFile(new URL('./viewer.html', import.meta.url), 'utf8');
const server = new McpServer({ name: 'spectorque-workspace', version: PRODUCT_VERSION });
const annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

server.registerResource('SpecTorque viewer', uri, { mimeType }, async () => ({
  contents: [{
    uri, mimeType, text: html,
    _meta: { 'openai/ui': { availableDisplayModes: ['inline', 'fullscreen'], preferredDisplayMode: 'inline' } },
  }],
}));

// The scope asked for when the viewer was opened; the viewer's first assessment uses it.
let requested: { feature: string | null; changed: boolean; base?: string } = { feature: null, changed: false };

server.registerTool('open_spectorque', {
  description: 'Open the SpecTorque viewer for the configured local worktree. Optionally open it on one feature (for example specs/001-booking) or on the features changed on the current branch.',
  inputSchema: z.object({
    feature: z.string().max(4096).optional(),
    changed: z.boolean().optional(),
    base: z.string().max(200).optional(),
  }),
  annotations,
  _meta: { ui: { resourceUri: uri }, 'openai/ui': { entrypoints: [{ type: 'thread' }] } },
}, async ({ feature, changed, base }) => {
  requested = { feature: feature ?? null, changed: Boolean(changed), ...(base ? { base } : {}) };
  return { content: [{ type: 'text', text: 'SpecTorque viewer opened.' }] };
});

server.registerTool('assess_worktree', {
  description: 'Load a local assessment into the SpecTorque viewer.',
  inputSchema: z.object({ feature: z.string().max(4096).nullable(), initial: z.boolean().optional(), changed: z.boolean().optional() }),
  annotations,
  _meta: { ui: { visibility: ['app'] } },
}, async ({ feature, initial, changed }) => {
  try {
    const assessmentView = initial
      ? await workspace.assess(requested.feature, { changed: requested.changed, base: requested.base })
      : await workspace.assess(feature, { changed: Boolean(changed), base: changed ? requested.base : undefined });
    return {
      content: [{ type: 'text', text: assessmentView.assessment ? 'Local assessment available in the viewer.' : 'Choose a feature in the viewer.' }],
      _meta: { assessmentView: { ...assessmentView, changed: initial ? requested.changed : Boolean(changed) } },
    };
  } catch {
    return { isError: true, content: [{ type: 'text', text: 'The requested scope could not be assessed.' }] };
  }
});

server.registerTool('preview_refinement', {
  description: 'Validate a proposed line replacement against the current local assessment.',
  inputSchema: z.object({
    feature: z.string().max(4096).nullable(),
    revision: z.string().regex(/^[a-f0-9]{64}$/),
    findingId: z.string().max(4096),
    replacement: z.string().max(20_000),
  }),
  annotations,
  _meta: { ui: { visibility: ['app'] } },
}, async input => {
  try {
    const proposal = await workspace.propose(input);
    return {
      content: [{ type: 'text', text: 'Review preview available in the viewer.' }],
      _meta: { proposal },
    };
  } catch (error) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'The change could not be previewed.' }],
      _meta: { stale: error instanceof StaleAssessmentError },
    };
  }
});

await server.connect(new StdioServerTransport());
