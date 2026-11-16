import { createServer, type IncomingMessage } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { z } from 'zod';
import { analyze } from '../core/analyze.js';
import { buildArtifacts } from '../core/builder.js';
import { createProposal, applyProposal } from '../core/refine.js';
import { discoverWorkspace, applyWorkspaceProposal, readWorkspaceArtifact, writeNewArtifacts, replaceWorkspaceContent } from './workspace.js';
import { contentHash } from '../core/artifacts.js';
import { importGitHub } from './github.js';
import { requestRewrite } from './provider.js';
import { parseSet, builderSchema, proposalSchema, rewriteSchema } from './schemas.js';
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
class RequestTooLarge extends Error {}
async function body(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 6_000_000) throw new RequestTooLarge('Request exceeds 6 MB.'); chunks.push(Buffer.from(chunk)); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
export async function startServer(root: string, requestedPort = 4317) {
  const token = randomBytes(32).toString('hex');
  const builtWeb = new URL('../web-dist/', import.meta.url);
  const webRoot = resolve(fileURLToPath(existsSync(new URL('index.html', builtWeb)) ? builtWeb : new URL('../../web-dist/', import.meta.url)));
  const undo = new Map<string, { path: string; before: string; afterHash: string }>();
  const server = createServer(async (req, res) => {
    const port = (server.address() as { port: number } | null)?.port ?? requestedPort;
    const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
    const origins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]);
    if (process.env.SPECTORQUE_DEV === '1') origins.add('http://127.0.0.1:5173');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'self' vscode-webview: vscode-file://vscode-app; base-uri 'none'; object-src 'none'");
    const send = (status: number, value: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
    if (!hosts.has(req.headers.host ?? '') || req.headers.origin && !origins.has(req.headers.origin)) { send(403, { error: 'Untrusted origin or host.' }); return; }
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
    try {
      if (url.pathname === '/api/session' && req.method === 'GET') { send(200, { token, version: '0.1.0' }); return; }
      if (url.pathname.startsWith('/api/')) {
        if (req.headers['x-spectorque-token'] !== token) { send(403, { error: 'Open the workbench to establish a local session.' }); return; }
        if (req.method === 'GET' && url.pathname === '/api/workspace') { send(200, await discoverWorkspace(root)); return; }
        if (req.method !== 'POST') { send(405, { error: 'Method not allowed.' }); return; }
        const input = await body(req);
        if (url.pathname === '/api/analyze') { send(200, await analyze(parseSet(input))); return; }
        if (url.pathname === '/api/build') { send(200, { artifacts: buildArtifacts(builderSchema.parse(input)) }); return; }
        if (url.pathname === '/api/github') { send(200, await importGitHub(z.object({ source: z.string().max(1000) }).parse(input).source)); return; }
        if (url.pathname === '/api/rewrite') {
          const value = rewriteSchema.parse(input);
          const original = value.document.content.split(/\r?\n/)[value.line - 1];
          if (original === undefined) throw new Error('Invalid source line.');
          const suggestion = await requestRewrite(value.provider, original, value.context, value.language);
          send(200, await createProposal(value.document.path, value.document.content, value.line, suggestion.replacement, suggestion.reason, 'provider')); return;
        }
        if (url.pathname === '/api/apply') {
          const value = z.object({ proposal: proposalSchema, approved: z.literal(true) }).parse(input);
          const before = await readWorkspaceArtifact(root, value.proposal.path);
          const content = await applyWorkspaceProposal(root, value.proposal);
          const undoId = randomBytes(20).toString('hex');
          if (undo.size >= 20) undo.delete(undo.keys().next().value!);
          undo.set(undoId, { path: value.proposal.path, before, afterHash: await contentHash(content) });
          send(200, { content, undoId }); return;
        }
        if (url.pathname === '/api/undo') {
          const value = z.object({ id: z.string(), approved: z.literal(true) }).parse(input);
          const entry = undo.get(value.id); if (!entry) throw new Error('Undo is unavailable for this session.');
          await replaceWorkspaceContent(root, entry.path, entry.afterHash, entry.before);
          undo.delete(value.id); send(200, { restored: true }); return;
        }
        if (url.pathname === '/api/save') {
          const value = z.object({ set: z.unknown(), approved: z.literal(true) }).parse(input);
          await writeNewArtifacts(root, parseSet(value.set).artifacts);
          send(200, { saved: true }); return;
        }
        if (url.pathname === '/api/proposal') {
          const value = z.object({ path: z.string(), line: z.number().int().positive(), replacement: z.string(), reason: z.string() }).parse(input);
          const content = await readWorkspaceArtifact(root, value.path);
          const proposal = await createProposal(value.path, content, value.line, value.replacement, value.reason);
          await applyProposal(content, proposal);
          send(200, proposal); return;
        }
        send(404, { error: 'Unknown operation.' }); return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') { send(405, { error: 'Method not allowed.' }); return; }
      const target = resolve(webRoot, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      const rel = relative(webRoot, target);
      if (rel.startsWith('..') || isAbsolute(rel)) { send(403, { error: 'Invalid asset path.' }); return; }
      const content = await readFile(target);
      res.writeHead(200, { 'Content-Type': mime[extname(target)] ?? 'application/octet-stream' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      const message = error instanceof z.ZodError ? 'Invalid request parameters.' : (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'File not found. Build the dashboard first with npm run build.' : error instanceof Error ? error.message : 'Operation failed.';
      send(error instanceof RequestTooLarge ? 413 : (error as NodeJS.ErrnoException).code === 'ENOENT' ? 404 : 400, { error: message });
    }
  });
  await new Promise<void>((resolveListen, reject) => { server.once('error', reject); server.listen(requestedPort, '127.0.0.1', () => { server.off('error', reject); resolveListen(); }); });
  const address = server.address() as { port: number };
  return { server, url: `http://127.0.0.1:${address.port}`, token };
}
