import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { zipSync } from 'fflate';

const root = 'integrations/vscode';
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const xml = value => String(value).replace(/[<>&"']/g, char =>
  ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]);
const encode = value => Buffer.from(value, 'utf8');
const files = {};
for (const [source, target] of Object.entries({
  'package.json': 'package.json',
  'extension.cjs': 'extension.cjs',
  'README.md': 'readme.md',
  LICENSE: 'LICENSE.txt',
  NOTICE: 'NOTICE',
  THIRD_PARTY_NOTICES: 'THIRD_PARTY_NOTICES',
})) {
  files['extension/' + target] = await readFile(join(root, source));
}
for (const dir of ['runtime', 'web-dist']) {
  const entries = await readdir(join(root, dir), { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw new Error('Unexpected symlink in VSIX payload: ' + entry.name);
    if (!entry.isFile()) continue;
    const source = join(entry.parentPath, entry.name);
    files['extension/' + source.slice(root.length + 1).replaceAll('\\', '/')] = await readFile(source);
  }
}
for (const required of ['runtime/cli.js', 'web-dist/index.html']) {
  if (!files['extension/' + required]) throw new Error('Missing VSIX payload: ' + required);
}
files['extension.vsixmanifest'] = encode(`<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata>
    <Identity Language="en-US" Id="${xml(manifest.name)}" Version="${xml(manifest.version)}" Publisher="${xml(manifest.publisher)}"/>
    <DisplayName>${xml(manifest.displayName)}</DisplayName>
    <Description xml:space="preserve">${xml(manifest.description)}</Description>
    <Categories>${xml(manifest.categories.join(','))}</Categories>
    <GalleryFlags>Public</GalleryFlags>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="${xml(manifest.engines.vscode)}"/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="workspace"/>
      <Property Id="Microsoft.VisualStudio.Code.ExecutesCode" Value="true"/>
    </Properties>
    <License>extension/LICENSE.txt</License>
  </Metadata>
  <Installation><InstallationTarget Id="Microsoft.VisualStudio.Code"/></Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/>
    <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/readme.md" Addressable="true"/>
    <Asset Type="Microsoft.VisualStudio.Services.Content.License" Path="extension/LICENSE.txt" Addressable="true"/>
  </Assets>
</PackageManifest>
`);
const types = {
  cjs: 'application/octet-stream', css: 'text/css', html: 'text/html',
  js: 'application/javascript', json: 'application/json', md: 'text/markdown',
  txt: 'text/plain', vsixmanifest: 'text/xml',
};
const defaults = [...new Set(Object.keys(files).map(path => extname(path).slice(1)).filter(Boolean))]
  .sort().map(ext => `<Default Extension="${xml(ext)}" ContentType="${types[ext] ?? 'application/octet-stream'}"/>`);
files['[Content_Types].xml'] = encode(`<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
${defaults.join('\n')}
</Types>
`);
await mkdir('artifacts', { recursive: true });
const output = `artifacts/${manifest.name}-${manifest.version}.vsix`;
await writeFile(output, zipSync(files));
console.log(output);
