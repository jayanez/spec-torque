import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { analyze, ENGINE_VERSION, RUBRIC_VERSION } from '../../src/core/analyze.js';
import { classifyArtifact } from '../../src/core/artifacts.js';

interface Source {
  repository: string;
  commit: string;
  license: string;
}
interface Download extends Source {
  matching?: number;
  tree_truncated?: boolean;
  error?: string;
  documents?: { path: string; local?: string; error?: string }[];
}
interface Block {
  start: number;
  end: number;
  headings: string[];
  kind: 'heading' | 'table' | 'prose';
  text: string;
}

const hash = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');
const normalize = (text: string) => text.normalize('NFC').toLowerCase().replace(/\s+/gu, ' ').trim();
const fold = (text: string) => normalize(text).normalize('NFD').replace(/\p{M}/gu, '');

// Search cues rank leads for review. They are independent of the engine's patterns.
const exception = /\b(edge cases?|boundary|out of range|malformed|invalid|empty|failure|casos? limite|fuera de rango|incorrect[oa]s?|invalid[oa]s?|vaci[oa]s?|fallos?)\b/u;
const interruption = /\b(upstream|provider|dependency|no response|stops? responding|unavailable|timeout|proveedor|dependencia|servicio externo|deja de responder|no responde|no disponible|interrupcion)\b/u;
const response = /\b(reject\w*|retry|retries|try again|unchanged|retain\w*|rollback|preserv\w*|return\w* an? error|rechaz\w*|reintent\w*|intentar de nuevo|sin cambios|no se modific\w*|devolv\w* un error)\b/u;
const pending = /\b(tbd|undecided|pending|to be defined|defined later|por definir|pendiente|sin definir|se definira)\b/u;
const criteria = /\b(acceptance criteria|success criteria|pass condition|passes if|criterios? de (?:aceptacion|exito)|condicion de aprobacion|se acepta si)\b/u;
const method = /\b(verification method|manual check|run the suite|execute the tests|verify by|check by|metodo de verificacion|comprobacion manual|ejecutar las pruebas|comprobar mediante|verificar con)\b/u;
const test = /\b(test\w*|scenario|exercise|prueb\w*|escenario|simular|comprobar)\b/u;
const done = /\b(definition of done|exit criteria|ready when|complete when|finished once|criterios? de salida|terminad[oa] cuando|finalizad[oa] cuando|list[oa] cuando|definicion de terminado)\b/u;

function blocksOf(lines: string[]): Block[] {
  const blocks: Block[] = [];
  const headings: { depth: number; text: string }[] = [];
  let fence: string | undefined;
  for (const [index, line] of lines.entries()) {
    const marker = /^\s*(`{3,}|~{3,})(.*)$/u.exec(line);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = undefined;
      continue;
    }
    if (marker) {
      fence = marker[1];
      continue;
    }
    if (!line.trim() || /^\s*\|?(?:\s*:?-+:?\s*\|)+\s*:?-*:?(?:\s*\|)?\s*$/u.test(line)) continue;
    const heading = /^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/u.exec(line);
    if (heading) {
      while (headings.length && headings.at(-1)!.depth >= heading[1].length) headings.pop();
      headings.push({ depth: heading[1].length, text: heading[2] });
    }
    blocks.push({
      start: index + 1, end: index + 1,
      headings: headings.map(heading => heading.text),
      kind: heading ? 'heading' : /^\s*\|.*\|/u.test(line) ? 'table' : 'prose',
      text: line,
    });
  }
  return blocks;
}

function leads(block: Block): [string, string][] {
  const body = fold(block.text);
  const section = fold(block.headings.join(' '));
  const hits: [string, string][] = [];
  if (block.kind === 'heading' && /^(boundary|limites?|casos? limite)$/u.test(body.replace(/^#+\s*/u, '')))
    hits.push(['P2.2', 'boundary-heading']);
  if (/\bcasos limite\b/u.test(body)) hits.push(['P2.2', 'spanish-plural']);
  if ((exception.test(body) && response.test(body)) ||
      (block.kind === 'table' && exception.test(section) && response.test(body)))
    hits.push(['P2.2', 'exception-and-response']);
  if (interruption.test(body) && (response.test(body) || pending.test(body)))
    hits.push(['P1.4', 'dependency-and-response-or-pending']);
  if (criteria.test(body)) hits.push(['E3.1', pending.test(body) ? 'criteria-pending' : 'criteria-wording']);
  if (method.test(body)) hits.push(['E3.2', pending.test(body) ? 'method-pending' : 'method-wording']);
  if (test.test(body) && (exception.test(body) || exception.test(section)))
    hits.push(['E3.3', 'test-and-exception']);
  if (done.test(body)) hits.push(['E3.4', pending.test(body) ? 'completion-pending' : 'completion-wording']);
  if (/\b(?:rf|rnf)-\d+\b/u.test(body)) hits.push(['I1.2', 'known-spanish-id']);
  if (new Set(body.match(/\b(?:fr|nfr|req|r)-\d+\b/gu)).size > 1)
    hits.push(['I1.2', 'multiple-ids']);
  return hits;
}

const root = await realpath(resolve(process.argv[2] ?? '/private/tmp/spec58-natural'));
const manifest = JSON.parse(await readFile(new URL('../../fixtures/precision/r52-dev-sources.json', import.meta.url), 'utf8')) as { sources: Source[] };
const index = JSON.parse(await readFile(join(root, 'index.json'), 'utf8')) as Download[];
const pinned = new Map(manifest.sources.map(source => [source.repository, source]));
if (new Set(index.map(source => source.repository)).size !== index.length || index.some(source => {
  const pin = pinned.get(source.repository);
  return !pin || pin.commit !== source.commit || pin.license !== source.license;
})) throw new Error('Index contains duplicate or unauthorized DEV sources');

const counts: Record<string, number> = {};
const coverage = [];
for (const source of index) {
  const repo = source.repository.replace(/^github\.com\//u, '');
  const ledger = { repository: source.repository, indexed: source.documents?.length ?? 0,
    matching: source.matching ?? null, scanned: 0, truncated: source.tree_truncated ?? null,
    sourceError: source.error ?? null, skipped: [] as { path: string; reason: string }[] };
  coverage.push(ledger);
  for (const document of source.documents ?? []) {
    if (!document.local) {
      ledger.skipped.push({ path: document.path, reason: document.error ?? 'missing download' });
      continue;
    }
    if (!/^\d+\.md$/u.test(document.local)) throw new Error('Unexpected download filename');
    let file: string;
    try {
      file = await realpath(join(root, repo, document.local));
      if (relative(root, file) !== join(repo, document.local)) throw new Error('Unexpected download target');
    } catch (error) {
      ledger.skipped.push({ path: document.path, reason: String(error) });
      continue;
    }
    const data = await readFile(file);
    const content = data.toString('utf8');
    const artifact = classifyArtifact(document.path, content);
    if (artifact.role !== 'spec' || artifact.archived) {
      ledger.skipped.push({ path: document.path, reason: 'not an active spec' });
      continue;
    }
    ledger.scanned++;
    const lines = content.split(/\r?\n/u);
    const blocks = blocksOf(lines);
    const assessment = await analyze({ name: document.path, artifacts: [artifact] });
    const documentHash = hash(data);
    const negatives: { block: Block; selector: string }[] = [];
    function emit(block: Block, practice: string | null, cue: string) {
      const result = assessment.practices.find(item => item.id === practice);
      counts[cue] = (counts[cue] ?? 0) + 1;
      console.log(JSON.stringify({
        record: practice ? 'lead' : 'negative-sample', practice, cue,
        repository: source.repository, revision: source.commit, manifestLicense: source.license,
        path: document.path, documentHash, fragmentHash: hash(normalize(block.text)),
        ...block, contextStart: Math.max(1, block.start - 2),
        context: lines.slice(Math.max(0, block.start - 3), block.end + 2),
        scanScope: 'single-spec',
        observation: result && {
          documentStatus: result.status, reason: result.reason, evidence: result.evidence,
          findings: assessment.findings.filter(f => f.practiceId === practice &&
            f.evidence.some(e => e.path === document.path && e.line >= block.start && e.line <= block.end)),
        },
      }));
    }
    for (const block of blocks) {
      const hits = leads(block);
      for (const [practice, cue] of hits) emit(block, practice, cue);
      if (!hits.length && block.kind !== 'heading' && /\p{L}{3}/u.test(block.text)) {
        negatives.push({ block, selector: hash(JSON.stringify([source.repository, source.commit, document.path, block.start])) });
      }
    }
    negatives.sort((a, b) => a.selector.localeCompare(b.selector));
    if (negatives.length) emit(negatives[0].block, null, 'uncaught-window-sample');
  }
}
console.error(JSON.stringify({
  engineVersion: ENGINE_VERSION, rubricVersion: RUBRIC_VERSION, counts, coverage, absent: [...pinned.keys()].filter(repo => !index.some(source => source.repository === repo)),
  unassessed: { 'C2.3': 'The authorized download index contains specs only. This check needs a task companion.' },
}, null, 2));
