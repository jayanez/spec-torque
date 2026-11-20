import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { zipSync } from 'fflate';

const [releasePath, demoPath, ...extra] = process.argv.slice(2);
assert.ok(releasePath && demoPath && !extra.length, 'Usage: npm run package:pilot -- <release-directory> <demo-directory>');
const out = resolve(releasePath);
const demo = resolve(demoPath);
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const tgz = `spectorque-${version}.tgz`;
const installers = [tgz, ...['claude', 'codex', 'opencode', 'pi'].map(host => `spectorque-${host}-${version}.zip`)];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const digest = {};
for (const name of installers) digest[name] = sha256(await readFile(join(out, name)));

const manifest = JSON.parse(await readFile(join(demo, 'manifest.json'), 'utf8'));
assert.deepEqual(manifest.installation, { name: tgz, sha256: digest[tgz] }, 'Demo was recorded against a different tarball');
assert.deepEqual(Object.keys(manifest.examples).sort(), ['en', 'es']);
const files = {
  'manifest.json': Buffer.from(JSON.stringify({ ...manifest, installerDigests: digest }, null, 2) + '\n'),
};
const published = ['LICENSE', 'pilot.md', 'pilot.es.md', 'pilot-feedback.md', 'pilot-operations.md',
  'releases.md', 'privacy.md', 'common-workbench-qualification.md', 'compatibility.md', 'integrations/codex/README.md'];
for (const lang of ['en', 'es']) {
  for (const path of [
    'before/specs/booking/spec.md', 'after/specs/booking/spec.md', 'before.json', 'after.json',
    'before.md', 'after.md', 'after.zip', 'walkthrough.webm', 'captions.vtt', 'recovery.webm', 'recovery.vtt',
  ]) published.push(lang + '/' + path);
}
for (const path of published.sort()) files[path] = await readFile(join(demo, path));
const archive = `spectorque-demo-${version}.zip`;
const bytes = zipSync(files, { mtime: new Date(2000, 0, 1) });
await writeFile(join(out, archive), bytes);
const sums = { ...digest, [archive]: sha256(bytes) };
await writeFile(join(out, 'SHA256SUMS'), Object.entries(sums).map(([name, hash]) => hash + '  ' + name).join('\n') + '\n');
console.log(join(out, archive));
