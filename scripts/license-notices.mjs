import { readFile, writeFile, readdir } from 'node:fs/promises';
export async function generateLicenseNotices() {
  const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
  let text = 'THIRD-PARTY NOTICES\n\nProduction dependencies bundled or distributed with SpecTorque. The following licenses apply to their respective upstream material, not to the original SpecTorque code.\n';
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (!path || entry.dev) continue;
    const files = await readdir(path);
    const license = files.find(file => /^licen[sc]e(?:[.-].*)?$/i.test(file));
    text += '\n' + path.replace(/^node_modules\//, '') + ' ' + entry.version + ' (' + (entry.license || 'see upstream') + ')\n';
    if (license) text += await readFile(path + '/' + license, 'utf8');
    text += '\n';
  }
  await writeFile('THIRD_PARTY_NOTICES', text);
}
