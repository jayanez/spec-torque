// Copies the root package.json version into every product manifest, catalog pin
// and CITATION.cff. Run after changing the root version: npm run version:sync
import { VERSION_TARGETS, productVersion, readTarget, writeTarget } from './versions.mjs';

const version = await productVersion();
for (const target of VERSION_TARGETS) {
  const before = await readTarget(target);
  if (before === version) continue;
  await writeTarget(target, version);
  console.log(`${target.path}: ${before} -> ${version}`);
}
console.log('Product version ' + version + ' in every manifest.');
