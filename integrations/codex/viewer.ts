import { PRODUCT_VERSION } from '../../src/version.js';
import { fitsReadLimit, READ_LIMIT } from '../../src/core/artifacts.js';
import { DISCLAIMER, LABELS, dimensionsLine, findingCard, replacementLabel, summaryLine, titleLine } from '../../src/core/presentation.js';
import type { Assessment, Evidence, Finding, PatchProposal } from '../../src/core/types.js';

interface AssessmentView {
  root: string;
  feature: string | null;
  features: string[];
  /** Documents in the worktree index; above the read limit, All documents is not offered. */
  total: number;
  /** Whether the feature list is narrowed to features changed on the branch. */
  changed: boolean;
  assessment: Assessment | null;
}
type LoadedView = AssessmentView & { assessment: Assessment };
const SHOWN = 12;
// Select values besides a feature ID: '' for All documents (or the feature prompt), and the branch's changes.
const CHANGED = ':changed';

const main = document.querySelector<HTMLElement>('main')!;
const scope = document.querySelector<HTMLSelectElement>('#scope')!;
const scopeLabel = document.querySelector<HTMLLabelElement>('#scope-label')!;
const filterLabel = document.querySelector<HTMLLabelElement>('#filter-label')!;
const filter = document.querySelector<HTMLInputElement>('#scope-filter')!;
let current: AssessmentView | undefined;
let changedMode = false;
const refresh = document.querySelector<HTMLButtonElement>('#refresh')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const report = document.querySelector<HTMLDivElement>('#report')!;
const pending = new Map<number, { receive: (value: unknown) => void; fail: () => void; timer: number }>();
let nextId = 0;
let hostOrigin: string | undefined;
let feature: string | null = null;
let selectedFinding: string | undefined;
let isSpanish = navigator.language.toLowerCase().startsWith('es');

function label(en: string, es: string) { return isSpanish ? es : en; }

// The shared English presentation text, with its fixed prefixes translated for the Spanish view.
const spanishLine = (line: string) => line
  .replace(/^Finding (\d+) of (\d+)/, 'Hallazgo $1 de $2').replace(/^Evidence: /, 'Evidencia: ').replace(/^Fix: /, 'Corrección: ')
  .replace(/^Incomplete assessment/, 'Evaluación incompleta').replace(/ (\d+) findings?/, (_, n) => ` ${n} hallazgo${n === '1' ? '' : 's'}`)
  .replace(/ (\d+) open decisions?/, (_, n) => ` ${n} decisi${n === '1' ? 'ón pendiente' : 'ones pendientes'}`).replace(/ · engine /, ' · motor ');
const localized = (line: string) => isSpanish ? spanishLine(line) : line;

function send(message: Record<string, unknown>) {
  parent.postMessage({ jsonrpc: '2.0', ...message }, hostOrigin && hostOrigin !== 'null' ? hostOrigin : '*');
}

function request(method: string, params: object): Promise<unknown> {
  const id = ++nextId;
  return new Promise((receive, reject) => {
    const fail = () => reject(new Error('MCP Apps request failed'));
    const timer = window.setTimeout(() => {
      pending.delete(id);
      fail();
    }, 15_000);
    pending.set(id, { receive, fail, timer });
    send({ method, params, id });
  });
}

addEventListener('message', event => {
  if (event.source !== parent || (hostOrigin !== undefined && event.origin !== hostOrigin)) return;
  const message = event.data;
  if (message?.jsonrpc !== '2.0') return;
  const handler = pending.get(message.id);
  if (!handler || (!Object.hasOwn(message, 'result') && !Object.hasOwn(message, 'error'))) return;
  hostOrigin ??= event.origin;
  clearTimeout(handler.timer);
  pending.delete(message.id);
  if (message.error) handler.fail();
  else handler.receive(message.result);
});

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function source(evidence: Evidence) {
  const block = element('div');
  const path = element('p', evidence.path + ':' + evidence.line);
  path.className = 'path';
  block.append(path, element('pre', evidence.text));
  return block;
}

function refinement(view: LoadedView, finding: Finding) {
  const section = element('details');
  const caption = element('summary', label('Preview a change', 'Previsualizar un cambio'));
  const first = finding.evidence[0];
  const field = element('label', label(replacementLabel(first.line), 'Texto de reemplazo para la línea ' + first.line));
  const input = element('textarea');
  input.rows = 2;
  input.maxLength = 20_000;
  input.value = first.text;
  field.append(input);
  const preview = element('button', label(LABELS.reviewChange, 'Revisar cambio'));
  preview.type = 'button';
  preview.disabled = true;
  const feedback = element('p');
  feedback.setAttribute('role', 'status');
  feedback.hidden = true;
  const diff = element('div');
  function reset() {
    diff.replaceChildren();
    feedback.hidden = true;
    preview.disabled = input.value === first.text || !input.value.trim();
  }
  input.addEventListener('input', reset);
  preview.addEventListener('click', async () => {
    preview.disabled = true;
    input.disabled = true;
    diff.replaceChildren();
    feedback.hidden = false;
    feedback.textContent = label('Validating replacement…', 'Validando el texto…');
    try {
      const result = await request('tools/call', {
        name: 'preview_refinement',
        arguments: { feature: view.feature, revision: view.assessment.id, findingId: finding.id, replacement: input.value },
      }) as { isError?: boolean; _meta?: { proposal?: PatchProposal; stale?: boolean } };
      if (result?._meta?.stale) {
        feedback.textContent = label('The assessment changed. Refresh before reviewing this edit.', 'La evaluación cambió. Actualiza antes de revisar este cambio.');
        return;
      }
      const proposal = result?._meta?.proposal;
      if (result?.isError || !proposal || proposal.path !== first.path || proposal.line !== first.line ||
        proposal.original !== first.text || proposal.replacement !== input.value) throw new Error('Invalid proposal');
      const discard = element('button', label(LABELS.rejectProposal, 'Rechazar propuesta'));
      discard.type = 'button';
      discard.addEventListener('click', () => { input.value = first.text; reset(); input.focus(); });
      const transfer = element('details');
      const packet = element('textarea');
      packet.readOnly = true;
      packet.rows = 3;
      packet.value = JSON.stringify({ root: view.root, feature: view.feature, revision: view.assessment.id, findingId: finding.id, proposal });
      const packetField = element('label', label('Review data', 'Datos de revisión'));
      packetField.append(packet);
      transfer.append(
        element('summary', label('Review in local workbench', 'Revisar en el workbench local')),
        element('p', label('Copy the review data, then open the workbench review page (?review=1) for this worktree and paste it there.', 'Copia los datos, abre la página de revisión del workbench de este worktree (?review=1) y pégalos allí.')),
        packetField,
      );
      diff.append(
        element('p', proposal.path + ':' + proposal.line),
        element('strong', label('Before', 'Antes')), element('pre', proposal.original),
        element('strong', label('After', 'Después')), element('pre', proposal.replacement),
        discard, transfer,
      );
      feedback.textContent = label('Preview ready. The file is unchanged.', 'Vista previa lista. El archivo sigue intacto.');
    } catch {
      feedback.textContent = label('Could not preview this wording. Check that the replacement preserves the requirement.', 'No se pudo previsualizar el texto. Comprueba que el cambio conserva el requisito.');
    } finally {
      input.disabled = false;
      preview.disabled = false;
    }
  });
  section.append(caption, field, preview, feedback, diff);
  return section;
}

function exportControls(view: LoadedView) {
  const section = element('details');
  const packet = element('textarea');
  packet.readOnly = true;
  packet.rows = 2;
  packet.value = JSON.stringify({
    root: view.root,
    feature: view.feature,
    revision: view.assessment.id,
    createdAt: view.assessment.createdAt,
  });
  const field = element('label', label('Export selection', 'Selección de exportación'));
  field.append(packet);
  const select = element('button', label('Select export data', 'Seleccionar datos de exportación'));
  select.type = 'button';
  select.addEventListener('click', () => {
    packet.focus();
    packet.select();
  });
  section.append(
    element('summary', label('Export in local workbench', 'Exportar en el workbench local')),
    element('p', label(
      'Copy the selected data into the workbench export page to download JSON or ZIP.',
      'Copia los datos seleccionados en la página de exportación del workbench para descargar el JSON o el ZIP.',
    )),
    field,
    select,
  );
  return section;
}

function drawScope(view: AssessmentView) {
  const needle = filter.value.trim().toLowerCase();
  // The first matches, plus the current feature in its sorted position, so the selector always shows it.
  const shown = new Set(view.features.filter(id => id.toLowerCase().includes(needle)).slice(0, SHOWN));
  const listed = view.features.filter(id => id === feature || shown.has(id));
  const all = fitsReadLimit(view);
  scope.replaceChildren(
    ...(all ? [new Option(label(LABELS.allDocuments, 'Todos los documentos'), '')] : feature === null && !view.changed ? [new Option(label('Choose a feature…', 'Elige una funcionalidad…'), '')] : []),
    new Option(label(LABELS.changed, 'Cambiado en esta rama'), CHANGED),
    ...listed.map(id => new Option(id, id)));
  scope.value = view.changed && feature === null ? CHANGED : feature ?? '';
  scopeLabel.hidden = view.features.length < 2 && feature === null && view.assessment !== null;
  filterLabel.hidden = view.features.length <= SHOWN;
  filter.placeholder = label('Filter ' + view.features.length + ' features', 'Filtrar ' + view.features.length + ' funcionalidades');
}

function draw(view: AssessmentView) {
  if (feature !== view.feature) selectedFinding = undefined;
  feature = view.feature;
  current = view;
  changedMode = view.changed;
  drawScope(view);

  if (!view.assessment) {
    report.replaceChildren(element('p', view.changed
      ? (view.features.length
        ? label(view.features.length + ' features changed on this branch. Choose one.', view.features.length + ' funcionalidades cambiadas en esta rama. Elige una.')
        : label('No feature changed on this branch.', 'Ninguna funcionalidad cambió en esta rama.'))
      : label('This worktree has ' + view.total + ' documents, more than ' + READ_LIMIT + ' assessed at once. Choose a feature.',
        'Este worktree tiene ' + view.total + ' documentos, más de ' + READ_LIMIT + ' a la vez. Elige una funcionalidad.')));
    return;
  }
  const loaded = view as LoadedView;
  const result = loaded.assessment;
  // Summary and dimensions first, then the finding card, as in every host.
  report.replaceChildren(element('p', localized(summaryLine(result))), element('p', dimensionsLine(result)));

  if (result.findings.length) {
    const picker = element('label');
    picker.id = 'finding-field';
    picker.className = 'field';
    const choices = element('select');
    const previous = element('button', label('Previous', 'Anterior'));
    const next = element('button', label('Next', 'Siguiente'));
    previous.type = next.type = 'button';
    const evidence = element('div');
    choices.replaceChildren(...result.findings.map((finding, index) =>
      new Option(localized(findingCard(result, index)[0]) + ' · ' + finding.message, finding.id)));
    if (selectedFinding && result.findings.some(finding => finding.id === selectedFinding)) choices.value = selectedFinding;
    function showFinding() {
      const index = result.findings.findIndex(item => item.id === choices.value);
      const finding = result.findings[index];
      selectedFinding = finding?.id;
      previous.disabled = index <= 0;
      next.disabled = index < 0 || index >= result.findings.length - 1;
      evidence.replaceChildren();
      if (!finding) return;
      const [heading, ...lines] = findingCard(result, index).map(localized);
      const card = element('div');
      card.append(element('strong', heading), ...lines.map(line => {
        const node = element(line.startsWith('Evid') ? 'pre' : 'p', line);
        if (finding.evidence[0] && line === finding.evidence[0].path + ':' + finding.evidence[0].line) node.className = 'path';
        return node;
      }));
      evidence.append(card, ...finding.evidence.slice(1).map(source));
      if (finding.evidence[0]) evidence.append(refinement(loaded, finding));
    }
    const step = (offset: number) => () => {
      const index = result.findings.findIndex(item => item.id === choices.value) + offset;
      if (index < 0 || index >= result.findings.length) return;
      choices.value = result.findings[index].id;
      showFinding();
    };
    choices.addEventListener('change', showFinding);
    previous.addEventListener('click', step(-1));
    next.addEventListener('click', step(1));
    picker.append(element('span', label(LABELS.selectFinding, 'Selecciona un hallazgo')), choices, previous, next);
    report.append(picker, evidence);
    showFinding();
  } else {
    selectedFinding = undefined;
    report.append(element('p', label('No findings in this scope.', 'Sin hallazgos en este alcance.')));
  }

  const decisions = element('details');
  decisions.append(element('summary', label('Pending decisions', 'Decisiones pendientes') + ' (' + result.decisions.length + ')'));
  if (!result.decisions.length) decisions.append(element('p', label('No pending decisions.', 'Sin decisiones pendientes.')));
  for (const decision of result.decisions) decisions.append(source(decision));

  const overview = element('details');
  const root = element('p', loaded.root);
  root.className = 'path';
  const dimensions = element('ul');
  for (const dim of result.dimensions) {
    dimensions.append(element('li', dim.id + ' ' + dim.title + ' · ' + (dim.score === null ? label('Unknown', 'Desconocido') : dim.score + '/3')));
  }
  overview.append(element('summary', label('Assessment details', 'Detalles de la evaluación')),
    dimensions, element('p', label('Revision ', 'Revisión ') + result.id), root);
  report.append(decisions, overview, exportControls(loaded), element('p', label(DISCLAIMER, 'Evidencia heurística, no un certificado de corrección.')));
}

function observeSize() {
  let lastWidth = 0;
  let lastHeight = 0;
  new ResizeObserver(() => {
    const width = Math.ceil(main.getBoundingClientRect().width);
    const height = Math.ceil(main.getBoundingClientRect().height);
    if (!width || !height || (width === lastWidth && height === lastHeight)) return;
    lastWidth = width;
    lastHeight = height;
    send({ method: 'ui/notifications/size-changed', params: { width, height } });
  }).observe(main);
}

async function load(selected: string | null, initial = false) {
  scope.disabled = true;
  refresh.disabled = true;
  report.replaceChildren();
  status.classList.remove('screen-reader-only');
  status.textContent = label('Assessing local documents…', 'Analizando documentos locales…');
  try {
    const result = await request('tools/call', { name: 'assess_worktree', arguments: initial ? { feature: null, initial: true } : { feature: selected, changed: changedMode } }) as {
      isError?: boolean;
      _meta?: { assessmentView?: AssessmentView };
    };
    const view = result?._meta?.assessmentView;
    if (result?.isError || !view || typeof view.root !== 'string' || !Array.isArray(view.features) || typeof view.total !== 'number' || (view.assessment !== null && typeof view.assessment?.id !== 'string')) throw new Error('Invalid assessment response');
    draw(view);
    status.classList.add('screen-reader-only');
    status.textContent = view.assessment ? label('Assessment loaded.', 'Evaluación cargada.') : label('Choose a feature to assess.', 'Elige una funcionalidad para analizar.');
  } catch {
    scope.value = feature ?? '';
    status.textContent = label('Could not load the assessment. Select a scope or refresh.', 'No se pudo cargar la evaluación. Selecciona un alcance o actualiza.');
  } finally {
    scope.disabled = false;
    refresh.disabled = false;
  }
}

// Choosing the branch's changes lists only changed features; All documents or the prompt leaves that mode.
function choose(value: string) {
  if (value === CHANGED) { changedMode = true; return load(null); }
  if (!value) changedMode = false;
  return load(value || null);
}
scope.addEventListener('change', () => void choose(scope.value));
refresh.addEventListener('click', () => void choose(scope.value));
filter.addEventListener('input', () => { if (current) drawScope(current); });

async function initialize() {
  status.textContent = label('Connecting to Codex…', 'Conectando con Codex…');
  try {
    const result = await request('ui/initialize', {
      appInfo: { name: 'spectorque', version: PRODUCT_VERSION },
      appCapabilities: { availableDisplayModes: ['inline', 'fullscreen'] },
      protocolVersion: '2026-01-26',
    }) as { protocolVersion?: string; hostContext?: { locale?: string } };
    if (result?.protocolVersion !== '2026-01-26') throw new Error('Unsupported bridge protocol');
    const locale = result.hostContext?.locale;
    if (typeof locale === 'string') isSpanish = locale.toLowerCase().startsWith('es');
    document.documentElement.lang = isSpanish ? 'es' : 'en';
    document.querySelector('h1')!.textContent = titleLine(PRODUCT_VERSION);
    document.querySelector('#scope-caption')!.textContent = label(LABELS.selectScope, 'Selecciona el alcance');
    refresh.textContent = label('Refresh', 'Actualizar');
    send({ method: 'ui/notifications/initialized', params: {} });
    observeSize();
    filter.setAttribute('aria-label', label('Filter features', 'Filtrar funcionalidades'));
    await load(null, true);
  } catch {
    status.textContent = label('Connection failed. Reopen the viewer to retry.', 'Falló la conexión. Vuelve a abrir el visor.');
  }
}

void initialize();
