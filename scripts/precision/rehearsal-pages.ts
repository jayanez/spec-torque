/**
 * Builds the static presentation pages for the E1.2 rehearsal (#57).
 *
 *   node --import tsx scripts/precision/rehearsal-pages.ts [--out .spec-torque/rehearsal/pages]
 *
 * Re-renders every case with the current engine first and refuses to build if
 * any frozen arm field differs. Writes one page per live case and arm, plus
 * manifest.json with each page's presentation ID and SHA-256.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { checkRenderings, load, page, presentationId, sha256, type Arm } from './rehearsal.js';

const { values } = parseArgs({ options: { out: { type: 'string', default: '.spec-torque/rehearsal/pages' } } });
const loaded = await load(process.cwd());
const differences = await checkRenderings(loaded);
if (differences.length) {
  console.error(`Engine output differs from tests/fixtures/e12/rehearsal.json:\n${differences.join('\n')}`);
  process.exit(1);
}
await mkdir(values.out!, { recursive: true });
const pages: { caseId: string; language: string; arm: Arm; presentationId: string; file: string; sha256: string }[] = [];
for (const c of loaded.rehearsal.cases.filter(x => x.live)) for (const arm of ['A', 'B'] as const) {
  const id = presentationId(loaded.protocolSha256, c.id, arm);
  const html = page(loaded, c, arm);
  const file = `${id}.html`;
  await writeFile(join(values.out!, file), html);
  pages.push({ caseId: c.id, language: c.language, arm, presentationId: id, file, sha256: sha256(html) });
}
await writeFile(join(values.out!, 'manifest.json'), JSON.stringify({ protocolSha256: loaded.protocolSha256, pages }, null, 2) + '\n');
console.log(`${pages.length} pages in ${values.out}; engine renderings match the frozen record.`);
