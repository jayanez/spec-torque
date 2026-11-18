import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute } from 'node:path';
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';

const uri = 'ui://spectorque-desktop-probe/probe.html';
const mimeType = 'text/html;profile=mcp-app';
const uiExtension = 'io.modelcontextprotocol/ui';
const version = '0.1.0';
const server = new McpServer({ name: 'spectorque-desktop-probe', version });
const annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const tracePath = process.env.SPECTORQUE_PROBE_TRACE;
const cwdName = basename(process.cwd());
const cwd = ['project-a', 'project-b', 'project-direct'].includes(cwdName) ? cwdName : 'other';

async function trace(event: string) {
  const line = JSON.stringify({
    event, cwd, pid: process.pid, version,
    uiAdvertised: Boolean(server.server.getClientCapabilities()?.extensions?.[uiExtension]),
  }) + '\n';
  process.stderr.write(line);
  if (tracePath && isAbsolute(tracePath)) {
    try {
      await mkdir(dirname(tracePath), { recursive: true, mode: 0o700 });
      await appendFile(tracePath, line, { mode: 0o600 });
    } catch {
      process.stderr.write('Probe trace file unavailable.\n');
    }
  }
}

server.registerResource('Desktop probe', uri, { mimeType }, async () => {
  await trace('resource-read');
  const html = await readFile(new URL('../assets/probe.html', import.meta.url), 'utf8');
  return { contents: [{
    uri, mimeType, text: html,
    _meta: { 'openai/ui': { availableDisplayModes: ['inline', 'fullscreen'], preferredDisplayMode: 'inline' } },
  }] };
});

server.registerTool('open_probe', {
  description: 'Open the read-only SpecTorque Desktop qualification probe.',
  annotations,
  _meta: {
    ui: { resourceUri: uri },
    'openai/ui': { entrypoints: [{ type: 'thread' }] },
  },
}, async () => {
  await trace('open-probe');
  return {
    content: [{ type: 'text', text: 'SpecTorque Desktop probe ready.' }],
    structuredContent: { marker: 'probe-open' },
  };
});

server.registerTool('read_probe', {
  description: 'Read a synthetic marker and the server working-directory category.',
  annotations,
  _meta: { ui: { visibility: ['app'] } },
}, async () => {
  await trace('read-probe');
  return {
    content: [{ type: 'text', text: 'Probe second read complete.' }],
    structuredContent: { marker: 'probe-second-read', cwd },
  };
});

await trace('server-start');
await server.connect(new StdioServerTransport());
