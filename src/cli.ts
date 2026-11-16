#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { resolve, dirname, basename, relative } from 'node:path';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { analyze, classifyArtifact, buildArtifacts, markdownReport, badgeSvg, createProposal } from './core.js';
import { discoverWorkspace, applyWorkspaceProposal, writeNewArtifacts } from './node/workspace.js';
import { importGitHub } from './node/github.js';
import { startServer } from './node/server.js';
import { terminalSummary } from './integration.js';
import { builderSchema, proposalSchema } from './node/schemas.js';
async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { json: { type: 'boolean' }, min: { type: 'string' }, root: { type: 'string' }, port: { type: 'string' }, output: { type: 'string' }, answers: { type: 'string' }, proposal: { type: 'string' }, line: { type: 'string' }, replacement: { type: 'string' }, reason: { type: 'string' }, apply: { type: 'boolean' }, 'fail-on-open': { type: 'boolean' }, 'require-complete': { type: 'boolean' }, help: { type: 'boolean', short: 'h' } } });
  const [command = 'help', source = '.'] = positionals;
  if (values.help || command === 'help') { console.log(`SpecTorque 0.1.0\n\n  spectorque serve [--root .] [--port 4317]\n  spectorque discover [folder] [--json]\n  spectorque analyze [file|folder|owner/repo] [--json] [--min N] [--fail-on-open] [--require-complete]\n  spectorque report [folder] [--output report.md]\n  spectorque badge [folder] [--output badge.svg]\n  spectorque create --answers answers.json [--root .] [--apply]\n  spectorque refine file.md --line N --replacement 'text' [--apply]\n  spectorque mcp\n\nAnalysis is heuristic. Scores are not correctness guarantees. Writes require --apply.`); return; }
  if (command === 'serve') {
    const port = Number(values.port ?? 4317);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port.');
    const root = resolve(values.root ?? source);
    const server = await startServer(root, port);
    console.log(`SpecTorque workbench: ${server.url}\nWorkspace: ${root}\nOnly loopback connections are accepted.`); return;
  }
  if (command === 'mcp') { await import('./mcp.js'); return; }
  if (command === 'apply') {
    if (!values.apply || !values.proposal) throw new Error('Applying a reviewed proposal requires --proposal and --apply.');
    const proposal = proposalSchema.parse(JSON.parse(values.proposal));
    await applyWorkspaceProposal(resolve(values.root ?? '.'), proposal);
    console.log(JSON.stringify({ applied: true, id: proposal.id })); return;
  }
  if (command === 'create') {
    if (!values.answers) throw new Error('Provide --answers answers.json, or use the guided dashboard.');
    const answers = builderSchema.parse(JSON.parse(await readFile(resolve(values.answers), 'utf8')));
    const artifacts = buildArtifacts(answers);
    if (values.apply) await writeNewArtifacts(resolve(values.root ?? '.'), artifacts);
    console.log(JSON.stringify({ written: Boolean(values.apply), artifacts }, null, 2)); return;
  }
  if (command === 'refine') {
    if (!values.line || !values.replacement) throw new Error('Provide --line and --replacement.');
    const full = resolve(source); const content = await readFile(full, 'utf8');
    const proposalRoot = resolve(values.root ?? dirname(full));
    const proposal = await createProposal(relative(proposalRoot, full).replaceAll('\\', '/'), content, Number(values.line), values.replacement, values.reason ?? 'User-authored refinement');
    if (values.apply) await applyWorkspaceProposal(proposalRoot, proposal);
    console.log(JSON.stringify({ applied: Boolean(values.apply), proposal }, null, 2)); return;
  }
  if (!['discover', 'analyze', 'report', 'badge'].includes(command)) throw new Error(`Unknown command: ${command}`);
  const isRemote = source.startsWith('https://') || /^[\w-]+\/[\w.-]+$/.test(source) && !(await stat(resolve(source)).then(() => true, () => false));
  const full = resolve(source);
  const set = isRemote ? await importGitHub(source) : (await stat(full)).isDirectory() ? await discoverWorkspace(full) : { name: basename(full), artifacts: [classifyArtifact(basename(full), await readFile(full, 'utf8'))] };
  if (command === 'discover') { console.log(values.json ? JSON.stringify(set, null, 2) : set.artifacts.map(a => `${a.role.padEnd(13)} ${a.framework.padEnd(12)} ${a.archived ? '[archive] ' : ''}${a.path}`).join('\n')); return; }
  const result = await analyze(set);
  const output = command === 'report' ? markdownReport(result) : command === 'badge' ? badgeSvg(result) : values.json ? JSON.stringify(result, null, 2) : terminalSummary(result).join('\n');
  if (values.output) await writeFile(resolve(values.output), output, { flag: 'wx' }); else console.log(output);
  if (values.min !== undefined) {
    const minimum = Number(values.min);
    if (!Number.isInteger(minimum) || minimum < 0 || minimum > 30) throw new Error('--min must be an integer from 0 to 30.');
    if (result.summary.score === null || result.summary.score < minimum) process.exitCode = 2;
  }
  if (values['require-complete'] && result.summary.score === null || values['fail-on-open'] && result.decisions.length > 0) process.exitCode = 2;
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Operation failed.'); process.exitCode = 1; });
