import type { Assessment, Evidence, Finding, PatchProposal } from '../../src/core/types.js';

interface AssessmentView {
  root: string;
  feature: string | null;
  features: string[];
  assessment: Assessment;
}

const main = document.querySelector<HTMLElement>('main')!;
const scope = document.querySelector<HTMLSelectElement>('#scope')!;
const scopeLabel = document.querySelector<HTMLLabelElement>('#scope-label')!;
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

function refinement(view: AssessmentView, finding: Finding) {
  const section = element('details');
  const caption = element('summary', label('Preview a change', 'Previsualizar un cambio'));
  const first = finding.evidence[0];
  const field = element('label', label('Replacement line', 'Línea propuesta'));
  const input = element('textarea');
  input.rows = 2;
  input.maxLength = 20_000;
  input.value = first.text;
  field.append(input);
  const preview = element('button', label('Show difference', 'Mostrar diferencia'));
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
      const discard = element('button', label('Discard preview', 'Descartar vista previa'));
      discard.type = 'button';
      discard.addEventListener('click', () => { input.value = first.text; reset(); input.focus(); });
      diff.append(
        element('p', proposal.path + ':' + proposal.line),
        element('strong', label('Before', 'Antes')), element('pre', proposal.original),
        element('strong', label('After', 'Después')), element('pre', proposal.replacement),
        discard,
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

function draw(view: AssessmentView) {
  if (feature !== view.feature) selectedFinding = undefined;
  feature = view.feature;
  scope.replaceChildren(new Option(label('All documents', 'Todos los documentos'), ''),
    ...view.features.map(id => new Option(id, id)));
  scope.value = feature ?? '';
  scopeLabel.hidden = view.features.length < 2 && feature === null;

  const result = view.assessment;
  const score = result.summary.score;
  const scoreText = score === null ? label('Incomplete', 'Incompleta') : score + '/' + result.summary.maximum;
  const summary = element('p', [
    scoreText,
    result.findings.length + label(' findings', ' hallazgos'),
    result.summary.unknown + label(' unknown', ' desconocidas'),
  ].join(' · '));
  report.replaceChildren(summary);

  if (result.findings.length) {
    const picker = element('label');
    picker.id = 'finding-field';
    picker.className = 'field';
    const choices = element('select');
    const evidence = element('div');
    choices.replaceChildren(...result.findings.map((finding, index) =>
      new Option((index + 1) + '. ' + finding.message, finding.id)));
    if (selectedFinding && result.findings.some(finding => finding.id === selectedFinding)) choices.value = selectedFinding;
    function showFinding() {
      const finding = result.findings.find(item => item.id === choices.value);
      selectedFinding = finding?.id;
      evidence.replaceChildren();
      if (finding) {
        evidence.append(...finding.evidence.map(source), element('p', finding.suggestion));
        if (finding.evidence[0]) evidence.append(refinement(view, finding));
      }
    }
    choices.addEventListener('change', showFinding);
    picker.append(element('span', label('Finding', 'Hallazgo')), choices);
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
  const root = element('p', view.root);
  root.className = 'path';
  const dimensions = element('ul');
  for (const dim of result.dimensions) {
    dimensions.append(element('li', dim.title + ' · ' + (dim.score ?? label('Unknown', 'Desconocido'))));
  }
  overview.append(element('summary', label('Assessment details', 'Detalles de la evaluación')),
    dimensions, element('p', label('Revision ', 'Revisión ') + result.id), root);
  report.append(decisions, overview);
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

async function load(selected: string | null) {
  scope.disabled = true;
  refresh.disabled = true;
  report.replaceChildren();
  status.classList.remove('screen-reader-only');
  status.textContent = label('Assessing local documents…', 'Analizando documentos locales…');
  try {
    const result = await request('tools/call', { name: 'assess_worktree', arguments: { feature: selected } }) as {
      isError?: boolean;
      _meta?: { assessmentView?: AssessmentView };
    };
    const view = result?._meta?.assessmentView;
    if (result?.isError || !view || typeof view.root !== 'string' || !Array.isArray(view.features) || typeof view.assessment?.id !== 'string') throw new Error('Invalid assessment response');
    draw(view);
    status.classList.add('screen-reader-only');
    status.textContent = label('Assessment loaded.', 'Evaluación cargada.');
  } catch {
    scope.value = feature ?? '';
    status.textContent = label('Could not load the assessment. Select a scope or refresh.', 'No se pudo cargar la evaluación. Selecciona un alcance o actualiza.');
  } finally {
    scope.disabled = false;
    refresh.disabled = false;
  }
}

scope.addEventListener('change', () => void load(scope.value || null));
refresh.addEventListener('click', () => void load(scope.value || null));

async function initialize() {
  status.textContent = label('Connecting to Codex…', 'Conectando con Codex…');
  try {
    const result = await request('ui/initialize', {
      appInfo: { name: 'spectorque', version: '0.1.0' },
      appCapabilities: { availableDisplayModes: ['inline', 'fullscreen'] },
      protocolVersion: '2026-01-26',
    }) as { protocolVersion?: string; hostContext?: { locale?: string } };
    if (result?.protocolVersion !== '2026-01-26') throw new Error('Unsupported bridge protocol');
    const locale = result.hostContext?.locale;
    if (typeof locale === 'string') isSpanish = locale.toLowerCase().startsWith('es');
    document.documentElement.lang = isSpanish ? 'es' : 'en';
    document.querySelector('#scope-caption')!.textContent = label('Artifact scope', 'Alcance de documentos');
    refresh.textContent = label('Refresh', 'Actualizar');
    send({ method: 'ui/notifications/initialized', params: {} });
    observeSize();
    await load(null);
  } catch {
    status.textContent = label('Connection failed. Reopen the viewer to retry.', 'Falló la conexión. Vuelve a abrir el visor.');
  }
}

void initialize();
