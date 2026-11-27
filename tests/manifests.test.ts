import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
// @ts-expect-error plain ESM script without declarations
import { VERSION_TARGETS, productVersion, readTarget } from '../scripts/versions.mjs';

const json = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const REPO = 'https://github.com/jayanez/spec-torque';
const HOSTS = ['claude', 'codex', 'opencode', 'pi'];

test('every product manifest, catalog pin and CITATION.cff carries the root version', async () => {
  const version = await productVersion();
  for (const target of VERSION_TARGETS) assert.equal(await readTarget(target), version, target.path + ' (run npm run version:sync)');
});

test('marketplace catalogs point at the published host packages under the plugin names', async () => {
  const claude = await json('.claude-plugin/marketplace.json');
  const codex = await json('.agents/plugins/marketplace.json');
  for (const [catalog, host, manifest] of [[claude, 'claude', 'integrations/claude/.claude-plugin/plugin.json'], [codex, 'codex', 'integrations/codex/plugin.json']] as const) {
    assert.equal(catalog.plugins.length, 1);
    const [entry] = catalog.plugins;
    assert.equal(entry.name, (await json(manifest)).name);
    assert.equal(entry.source.source, 'npm');
    assert.equal(entry.source.package, (await json(`integrations/${host}/package.json`)).name);
  }
  assert.ok(!/^(claude|anthropic)-/u.test(claude.plugins[0].name), 'Claude rejects plugin names with a claude- or anthropic- prefix');
  assert.equal(codex.plugins[0].category, 'Developer Tools');
});

test('host npm packages carry publish metadata', async () => {
  for (const host of HOSTS) {
    const pkg = await json(`integrations/${host}/package.json`);
    assert.equal(pkg.license, 'Apache-2.0', host);
    assert.equal(pkg.repository.directory, 'integrations/' + host, host);
    assert.ok(pkg.repository.url.includes('jayanez/spec-torque'), host);
    assert.ok(pkg.description && pkg.homepage && pkg.bugs?.url && pkg.keywords?.length, host);
    assert.deepEqual(pkg.publishConfig, { access: 'public', provenance: true }, host);
    for (const required of ['README.md', 'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES', 'assets']) assert.ok(pkg.files.includes(required), `${host} files ${required}`);
  }
  assert.ok((await json('integrations/pi/package.json')).keywords.includes('pi-package'), 'Pi gallery and ThinkRail list packages by this keyword');
});

test('MCP Registry entry matches the npm package it lists', async () => {
  const server = await json('server.json');
  const pkg = await json('package.json');
  assert.equal(server.name, pkg.mcpName, 'the registry verifies ownership through mcpName');
  assert.match(server.name, /^io\.github\.jayanez\//u, 'GitHub OIDC login grants only the io.github.<owner> namespace');
  assert.ok(server.description.length <= 100, 'the registry schema caps description at 100 characters');
  const [entry] = server.packages;
  assert.equal(server.packages.length, 1);
  assert.deepEqual([entry.registryType, entry.registryBaseUrl, entry.identifier], ['npm', 'https://registry.npmjs.org', pkg.name]);
  assert.equal(entry.transport.type, 'stdio');
  assert.deepEqual(entry.packageArguments, [{ type: 'positional', value: 'mcp' }], 'clients start the server with `spectorque mcp`');
});

test('listing metadata: icons, links and VS Code identity', async () => {
  const claude = await json('integrations/claude/.claude-plugin/plugin.json');
  for (const key of ['homepage', 'repository', 'documentationUrl', 'supportUrl', 'privacyPolicyUrl']) assert.ok(String(claude[key]).startsWith(REPO), key);
  assert.equal(claude.icon, './assets/icon.png');
  const codex = (await json('integrations/codex/plugin.json')).extensions['com.openai'].interface;
  assert.ok(codex.shortDescription.length <= 30);
  assert.equal(codex.logo, './assets/icon.png');
  const vscode = await json('integrations/vscode/package.json');
  assert.equal(vscode.publisher, 'jayanez');
  assert.equal(vscode.icon, 'assets/icon.png');
  assert.match(vscode.version, /^\d+\.\d+\.\d+$/u, 'the Marketplace accepts only major.minor.patch');
});

test('spec-view is a Codex-only skill that opens the viewer through open_spectorque', async () => {
  const lf = async (path: string) => (await readFile(path, 'utf8')).replace(/\r\n/gu, '\n');
  const skill = await lf('integrations/codex/skill-src/spec-view/SKILL.md');
  assert.match(skill, /^---\nname: spec-view\n/u);
  assert.match(skill, /^description: \S/mu);
  assert.match(skill, /open_spectorque/u);
  const metadata = await lf('integrations/codex/skill-src/spec-view/agents/openai.yaml');
  assert.match(metadata, /^policy:\n  allow_implicit_invocation: false$/mu);
  assert.doesNotMatch(metadata, /display_name/u, 'a display_name drops the "Spectorque:" prefix the other skills show in the $ menu');
  await assert.rejects(readFile('skills/spec-view/SKILL.md', 'utf8'), 'the shared skills reach Claude Code and Pi, which have no open_spectorque tool');
});
