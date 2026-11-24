#!/usr/bin/env node
import { PRODUCT_VERSION } from './version.js';
import { parseArgs } from 'node:util';
import { resolve, dirname, basename, relative } from 'node:path';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { analyze, classifyArtifact, buildArtifacts, markdownReport, badgeSvg, createProposal, contentHash, selectFeature } from './core.js';
import { applyWorkspaceProposal, readScope, writeNewArtifacts } from './node/workspace.js';
import { changedFeatures, indexWorkspace, resolveImplicitRoot } from './node/scope.js';
import { importGitHub } from './node/github.js';
import { startServer } from './node/server.js';
import { terminalSummary } from './integration.js';
import { builderSchema, proposalSchema } from './node/schemas.js';
async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { json: { type: 'boolean' }, min: { type: 'string' }, root: { type: 'string' }, port: { type: 'string' }, output: { type: 'string' }, answers: { type: 'string' }, proposal: { type: 'string' }, line: { type: 'string' }, replacement: { type: 'string' }, reason: { type: 'string' }, feature: { type: 'string' }, path: { type: 'string', multiple: true }, changed: { type: 'boolean' }, base: { type: 'string' }, 'expect-hash': { type: 'string' }, apply: { type: 'boolean' }, 'fail-on-open': { type: 'boolean' }, 'require-complete': { type: 'boolean' }, help: { type: 'boolean', short: 'h' } } });
  const [command = 'help', explicitSource] = positionals;
  const source = explicitSource ?? '.';
  if (values.help || command === 'help') { console.log(`SpecTorque ${PRODUCT_VERSION}\n\n  spectorque serve [--root .] [--port 4317] [--feature id]\n  spectorque features [folder] [--changed [--base rev]] [--json]\n  spectorque discover [folder] [--json]\n  spectorque analyze [file|folder|owner/repo] [--feature id | --path prefix... | --changed [--base rev]] [--json] [--min N] [--fail-on-open] [--require-complete]\n  spectorque report [folder] [--output report.md]\n  spectorque badge [folder] [--output badge.svg]\n  spectorque create --answers answers.json [--root .] [--apply]\n  spectorque refine file.md --line N --replacement 'text' [--expect-hash sha256] [--apply]\n  spectorque mcp\n\nWithout a folder, the workspace is the git work tree of the current directory, focused on it when it is a subfolder.\nAnalysis is heuristic. Scores are not correctness guarantees. Writes require --apply.`); return; }
  if (command === 'serve') {
    const port = Number(values.port ?? 4317);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port.');
    const root = values.root ?? explicitSource ? resolve(values.root ?? source) : (await resolveImplicitRoot(process.cwd())).root;
    const server = await startServer(root, port, values.feature ?? null);
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
    if (values['expect-hash'] && await contentHash(content) !== values['expect-hash']) throw new Error('Source changed since this assessment. Refresh the analysis.');
    const proposalRoot = resolve(values.root ?? dirname(full));
    const proposal = await createProposal(relative(proposalRoot, full).replaceAll('\\', '/'), content, Number(values.line), values.replacement, values.reason ?? 'User-authored refinement');
    if (values.apply) await applyWorkspaceProposal(proposalRoot, proposal);
    console.log(JSON.stringify({ applied: Boolean(values.apply), proposal }, null, 2)); return;
  }
  if (!['features', 'discover', 'analyze', 'report', 'badge'].includes(command)) throw new Error(`Unknown command: ${command}`);
  const scopeFlags = [values.feature !== undefined, values.path !== undefined, Boolean(values.changed)].filter(Boolean).length;
  const isRemote = explicitSource !== undefined && (source.startsWith('https://') || /^[\w-]+\/[\w.-]+$/.test(source) && !(await stat(resolve(source)).then(() => true, () => false)));
  const full = resolve(source);
  const isFile = !isRemote && explicitSource !== undefined && !(await stat(full)).isDirectory();
  if ((isRemote || isFile) && (scopeFlags || command === 'features') && values.feature === undefined) throw new Error('Scope options and features need a local folder.');
  const feature = values.feature ?? null;
  let discovered;
  if (isRemote) discovered = await importGitHub(source);
  else if (isFile) discovered = { name: basename(full), artifacts: [classifyArtifact(basename(full), await readFile(full, 'utf8'))] };
  else {
    const { root, focus } = explicitSource === undefined ? await resolveImplicitRoot(process.cwd()) : { root: full, focus: null };
    const index = await indexWorkspace(root, focus);
    const changed = values.changed ? await changedFeatures(index, values.base) : undefined;
    if (command === 'features') {
      const features = changed ? index.features.filter(f => changed.includes(f.id)) : index.features;
      console.log(values.json ? JSON.stringify({ root: index.root, mode: index.mode, focus: index.focus, features }, null, 2)
        : [`Workspace: ${index.root} (${index.mode}${index.focus ? `, focus ${index.focus}` : ''})`, ...features.map(f => `${f.id}  ${f.framework} · ${f.artifacts} artifacts`)].join('\n') || 'No features.');
      return;
    }
    discovered = await readScope(index, { feature, paths: values.path, changed: values.changed, base: values.base });
  }
  if (feature !== null && !discovered.artifacts.some(a => a.featureId === feature && a.role !== 'instructions')) throw new Error(`Unknown feature: ${feature}`);
  const set = selectFeature(discovered, feature);
  if (command === 'discover') { console.log(values.json ? JSON.stringify(set, null, 2) : set.artifacts.map(a => `${a.role.padEnd(13)} ${a.framework.padEnd(12)} ${a.archived ? '[archive] ' : ''}${a.path}`).join('\n')); return; }
  const result = await analyze(set);
  const output = command === 'report' ? markdownReport(result) : command === 'badge' ? badgeSvg(result) : values.json ? JSON.stringify(result, null, 2) : terminalSummary(result).join('\n');
  if (values.output) await writeFile(resolve(values.output), output, { flag: 'wx' }); else console.log(output);
  if (values.min !== undefined) {
    const minimum = Number(values.min);
    if (!Number.isInteger(minimum) || minimum < 0 || minimum > 30) throw new Error('--min must be an integer from 0 to 30.');
    if (result.summary.score === null || result.summary.score < minimum) process.exitCode = 2;
  }
  const incompleteEvidence = values['require-complete'] && result.summary.score === null;
  const unresolvedDecisions = values['fail-on-open'] && result.decisions.length > 0;
  if (incompleteEvidence || unresolvedDecisions) process.exitCode = 2;
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Operation failed.'); process.exitCode = 1; });
