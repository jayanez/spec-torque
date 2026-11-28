import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { analyze, applyProposal, badgeSvg, clarifyE12, classifyArtifact, markdownReport } from '../core.js';
import type { Clarification } from '../core.js';
import type { ArtifactSet, Assessment, Finding, Language, PatchProposal } from '../core/types.js';
import { api, connectLocal, download } from './api.js';
import { sampleName, sampleSet } from './samples.js';
import { listFeatures, selectFeature } from '../core/artifacts.js';
import { LanguageToggle } from './LanguageToggle.js';
import { dimensionTitle, findingCount, practiceTitle, statusLabel } from './i18n.js';
import { PanelResizer, PanelToggle, usePanelLayout } from './Panels.js';
import { artifactArchive } from './archive.js';
import { Builder } from './Builder.js';
import { Connect } from './Connect.js';
import { Radar } from './Radar.js';
import { SourcePanel, type ImportKind } from './SourcePanel.js';
import { ReviewPanel } from './ReviewPanel.js';

// `demo` marks an unedited sample: kept as the baseline for a sample edit, but not listed in History.
type HistoryEntry = { report: Assessment; scope: string | null; demo: boolean };
// A loaded set opens on the specification of its first listed feature (known layouts first),
// not on an instruction file that sorts first by path.
// Within the feature, a file named spec.md comes before other spec-role files.
function firstSource(artifacts: ArtifactSet['artifacts']): string {
  const feature = listFeatures(artifacts)[0]?.id;
  const specs = artifacts.filter(a => a.role === 'spec' && !a.archived && a.featureId === feature);
  return (specs.find(a => /(?:^|\/)spec\.md$/i.test(a.path)) ?? specs[0] ?? artifacts[0])?.path ?? '';
}

export function App() {
  const [language, setLanguage] = useState<Language>('en'); const es = language === 'es';
  const [tab, setTab] = useState<'analyze' | 'build' | 'history' | 'connect'>('analyze');
  const [set, setSet] = useState<ArtifactSet>(() => sampleSet(true));
  const [selected, setSelected] = useState('specs/booking/spec.md');
  const [result, setResult] = useState<{ input: ArtifactSet; report: Assessment }>();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [sample, setSample] = useState(true);
  const panels = usePanelLayout();
  const detailPanel = useRef<HTMLElement>(null);
  const initialSet = useRef(set);
  const [finding, setFinding] = useState<Finding>(); const [filter, setFilter] = useState('all');
  const [view, setView] = useState<'findings' | 'checklist' | 'traceability' | 'questions'>('findings');
  const [local, setLocal] = useState(false); const [disk, setDisk] = useState(false); const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [undo, setUndo] = useState<{ set: ArtifactSet; diskUndo?: { id: string; path: string } }[]>([]);
  const [feature, setFeature] = useState<string | null>(null);
  const [saved, setSaved] = useState<ArtifactSet | undefined>(set);
  const [builderDirty, setBuilderDirty] = useState(false);
  const [pasteDirty, setPasteDirty] = useState(false);
  const [proposalDirty, setProposalDirty] = useState(false);
  const [reviewContext, setReviewContext] = useState(0);
  const [focusAfterMutation, setFocusAfterMutation] = useState(false);
  const editor = useRef<HTMLTextAreaElement>(null);
  const sourceHeading = useRef<HTMLHeadingElement>(null);
  const operation = useRef<Promise<void> | null>(null);
  const [pending, setPending] = useState(false);
  const currentSet = useRef(set);
  const scoped = useMemo(() => selectFeature(set, feature), [set, feature]);
  const assessment = result?.input === scoped ? result.report : undefined;
  const selectedFinding = finding?.evidence[0]?.path === selected ? finding : undefined;
  const clarificationId = selectedFinding?.practiceId === 'E1.2' ? selectedFinding.id : undefined;
  const [guidance, setGuidance] = useState<{ assessment: Assessment; findingId: string; language: Language; value: Clarification }>();
  const clarification = guidance && guidance.assessment === assessment && guidance.findingId === clarificationId &&
    guidance.language === language ? guidance.value : undefined;
  useEffect(() => {
    if (!assessment || !clarificationId) return;
    let cancelled = false;
    void clarifyE12(scoped, assessment, clarificationId, language).then(value => {
      if (!cancelled && value) setGuidance({ assessment, findingId: clarificationId, language, value });
    }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [scoped, assessment, clarificationId, language]);
  const artifactsDirty = saved !== set && (
    saved?.artifacts.length !== set.artifacts.length ||
    set.artifacts.some((item, index) => item.path !== saved.artifacts[index].path || item.content !== saved.artifacts[index].content)
  );
  const loadState = useRef({ artifactsDirty, proposalDirty, builderDirty, pasteDirty, es });
  useLayoutEffect(() => { loadState.current = { artifactsDirty, proposalDirty, builderDirty, pasteDirty, es }; }, [artifactsDirty, proposalDirty, builderDirty, pasteDirty, es]);
  // Loading the local workspace on connect may only replace the untouched initial sample.
  function untouched() {
    const current = loadState.current;
    return !operation.current && currentSet.current === initialSet.current &&
      !current.artifactsDirty && !current.proposalDirty && !current.builderDirty && !current.pasteDirty;
  }
  useEffect(() => {
    if (!artifactsDirty && !builderDirty && !pasteDirty && !proposalDirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = true; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [artifactsDirty, builderDirty, pasteDirty, proposalDirty]);
  useLayoutEffect(() => {
    if (!pending && focusAfterMutation) {
      if (tab === 'analyze') sourceHeading.current?.focus();
      setFocusAfterMutation(false);
    }
  }, [pending, focusAfterMutation, tab]);
  function replaceSet(next: ArtifactSet) { currentSet.current = next; setSet(next); }
  function markWritten(path: string, content: string) {
    setSaved(baseline => baseline && {
      ...baseline, artifacts: baseline.artifacts.map(item => item.path === path ? { ...item, content } : item),
    });
  }
  function exclusive(action: (initial: ArtifactSet) => Promise<void>): Promise<void> {
    if (operation.current) return operation.current;
    const initial = currentSet.current;
    setPending(true);
    const completion = Promise.resolve().then(() => action(initial)).finally(() => {
      operation.current = null; setPending(false);
    });
    operation.current = completion;
    return completion;
  }
  const artifact = scoped.artifacts.find(a => a.path === selected);
  useEffect(() => { document.documentElement.lang = language; document.title = 'SpecTorque — ' + (language === 'es' ? 'Banco de trabajo de especificaciones' : 'Specification workbench'); }, [language]);
  useEffect(() => { void connectLocal().then(setLocal); }, []);
  useEffect(() => {
    let cancelled = false;
    void analyze(scoped).then(report => {
      if (cancelled) return;
      setResult({ input: scoped, report });
      setHistory(h => h.at(-1)?.report.id === report.id ? h : [...h.slice(-19), { report, scope: feature, demo: sample && !artifactsDirty }]);
    }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [scoped, feature, sample, artifactsDirty]);
  function load(next: ArtifactSet, kind: ImportKind = 'file', auto = false): boolean {
    if (operation.current || currentSet.current !== set || (auto && !untouched())) return false;
    const current = loadState.current;
    if ((current.artifactsDirty || current.proposalDirty) && !window.confirm(current.es
      ? '¿Descartar los cambios sin guardar y cargar otros documentos? Cancela para volver y exportarlos.'
      : 'Discard unsaved work and load other artifacts? Cancel to return and export your work.')) return false;
    setUndo([]); replaceSet(next); setSaved(kind === 'draft' ? undefined : next);
    setDisk(kind === 'workspace'); setSample(kind === 'sample'); setSelected(firstSource(next.artifacts));
    setFinding(undefined); setProposalDirty(false); setReviewContext(context => context + 1);
    setFeature(null); setError(''); setStatus(current.es ? 'Documentos cargados.' : 'Artifacts loaded.');
    if (!auto) setTab('analyze');
    return true;
  }
  function discardWording(): boolean {
    return !proposalDirty || window.confirm(es ? '¿Descartar el texto propuesto sin aceptar?' : 'Discard the unaccepted proposed replacement?');
  }
  function selectSource(path: string) {
    if (path === selected || !discardWording()) return;
    setFinding(undefined);
    setSelected(path);
  }
  function changeFeature(next: string | null) {
    if (!discardWording()) return;
    const artifacts = selectFeature(set, next).artifacts;
    setFeature(next);
    setSelected(artifacts.some(item => item.path === selected) ? selected : firstSource(artifacts));
    setFinding(undefined);
    setStatus(es ? 'Alcance actualizado.' : 'Scope updated.');
  }
  // Reveal the evidence line as part of the selection commit. A deferred timer could move
  // focus after the user starts typing elsewhere and replace that line without review.
  const [reveal, setReveal] = useState<{ line: number }>();
  useLayoutEffect(() => {
    const node = editor.current; if (!reveal || !node) return;
    const lines = node.value.split(/\r?\n/); const start = lines.slice(0, reveal.line - 1).reduce((n, l) => n + l.length + 1, 0);
    node.focus(); node.setSelectionRange(start, start + (lines[reveal.line - 1]?.length ?? 0));
  }, [reveal]);
  function pickFinding(f: Finding) {
    if (operation.current) return;
    if (finding?.id !== f.id && !discardWording()) return;
    // The source and its review live in the Source text panel: open it so the selection is visible.
    if (panels.layout.right.collapsed) panels.toggle('right');
    setFinding(f); setSelected(f.evidence[0]?.path ?? ''); setReveal({ line: f.evidence[0]?.line ?? 1 });
  }
  async function accept(p: PatchProposal, persist: boolean) {
    await exclusive(async initial => {
      const source = initial.artifacts.find(a => a.path === p.path);
      if (!source) throw new Error('Source artifact is not loaded.');
      let content: string; let undoId: string | undefined;
      if (persist) { const result = await api<{ content: string; undoId: string }>('apply', { proposal: p, approved: true }); content = result.content; undoId = result.undoId; }
      else content = await applyProposal(source.content, p);
      if (currentSet.current !== initial) throw new Error(persist ? 'The file changed on disk. Reload the workspace explicitly to inspect it.' : 'The active documents changed. Review the proposal again.');
      setUndo(h => [...h, { set: initial, diskUndo: undoId ? { id: undoId, path: p.path } : undefined }]);
      if (undoId) markWritten(p.path, content);
      replaceSet({ ...initial, artifacts: initial.artifacts.map(a => a.path === p.path ? classifyArtifact(a.path, content) : a) });
      setError(''); setFocusAfterMutation(true);
      setFinding(undefined); setStatus(es ? 'Cambio aceptado y análisis actualizado.' : 'Change accepted. Assessment updated.');
    });
  }
  async function undoLast() {
    if (!discardWording()) return;
    try { await exclusive(async initial => {
      const entry = undo.at(-1); if (!entry) return;
      if (entry.diskUndo) {
        const { id, path } = entry.diskUndo;
        const previous = entry.set.artifacts.find(item => item.path === path);
        await api('undo', { id, approved: true });
        if (previous) markWritten(path, previous.content);
      }
      if (currentSet.current !== initial) throw new Error('The active documents changed. Reload the workspace explicitly.');
      const artifacts = selectFeature(entry.set, feature).artifacts;
      replaceSet(entry.set); setSelected(artifacts.some(item => item.path === selected) ? selected : artifacts[0]?.path ?? '');
      setUndo(h => h.slice(0, -1)); setFinding(undefined); setError(''); setFocusAfterMutation(true);
      setStatus(es ? 'Cambio deshecho.' : 'Change undone.');
    }); } catch (e) { setError((e as Error).message); setFocusAfterMutation(true); }
  }
  async function saveNew() {
    try { await exclusive(async initial => {
      await api('save', { set: initial, approved: true });
      if (currentSet.current !== initial) throw new Error('Files were saved. Reload the workspace explicitly.');
      setSaved(initial); setDisk(true); setError(''); setStatus(es ? 'Documentos guardados.' : 'Artifacts saved.');
    }); } catch (e) { setError((e as Error).message); }
  }
  function edit(content: string) {
    if (operation.current || !artifact || !discardWording()) return;
    setUndo(h => [...h.slice(-49), { set }]);
    replaceSet({ ...set, artifacts: set.artifacts.map(a => a.path === artifact.path ? classifyArtifact(a.path, content) : a) });
    setFinding(undefined);
  }
  const findings = assessment?.findings.filter(f => filter === 'all' || f.severity === filter) ?? [];
  // The same selectable features as every host: active features that contain a specification.
  const features = listFeatures(set.artifacts).map(f => f.id);
  // Compare only with an earlier assessment of the same set and scope.
  const previous = assessment && history.filter(h => h.report.name === assessment.name && h.scope === feature && h.report.id !== assessment.id).at(-1)?.report;
  // Built-in samples are named in the view's language; the user's sets keep their own names.
  const displayName = sample ? sampleName(set.name, es) : set.name;
  const version = assessment ? `${es ? 'Motor' : 'Engine'} ${assessment.engineVersion} · ${es ? 'Rúbrica' : 'Rubric'} ${assessment.rubricVersion}` : (es ? 'Heurística EPIC' : 'EPIC heuristic');
  const incomplete = es ? 'Incompleta' : 'Incomplete';
  return <div className="app">
    <header className="topbar"><a className="brand" href="#" onClick={e => { e.preventDefault(); setTab('analyze'); }}><svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><path d="M23 8A11 11 0 1 0 24 18" fill="none" stroke="currentColor" strokeWidth="3"/><path d="M14 3v10l7 4" fill="none" stroke="#e9b454" strokeWidth="3"/></svg><strong>SpecTorque</strong><span>{es ? 'Banco de trabajo de especificaciones' : 'Specification workbench'}</span></a><p className="workspace-name" title={displayName}><small>{es ? 'Proyecto' : 'Workspace'}</small><strong>{displayName}</strong></p><div className="header-right"><span className="connection"><i/>{local ? (es ? 'Proyecto local conectado' : 'Local workspace connected') : (es ? 'Motor en el navegador' : 'Browser engine')}</span><LanguageToggle className="language" es={es} onToggle={() => setLanguage(es ? 'en' : 'es')}/><a href="https://github.com/jayanez/spec-torque" target="_blank" rel="noreferrer">GitHub ↗</a></div></header>
    <nav className="main-tabs" aria-label={es ? 'Navegación principal' : 'Main navigation'}>{([['analyze', es ? 'Analizar' : 'Analyze'], ['build', es ? 'Crear una spec' : 'Build a spec'], ['history', es ? 'Evolución' : 'History'], ['connect', es ? 'Conectar agentes' : 'Connect agents']] as const).map(([id, label]) => <button disabled={pending && id === 'build'} key={id} aria-current={tab === id ? 'page' : undefined} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}<span className="version">{version}</span></nav>
    {error && <div className="notice error" role="alert">{error}<button onClick={() => setError('')}>{es ? 'Cerrar' : 'Dismiss'}</button></div>}
    <p className="sr-only" role="status">{assessment ? status : !error && (es ? 'Analizando documentos…' : 'Analyzing artifacts…')}</p>
    <main className="single" hidden={tab !== 'build'}><Builder language={language} active={tab === 'build'} onCreate={next => load(next, 'draft')} onDraftChange={setBuilderDirty}/></main>
    {tab === 'history' ? <main className="single"><h1>{es ? 'Evolución del análisis' : 'Assessment history'}</h1><p>{es ? 'Historial de esta sesión. Las comparaciones usan la misma rúbrica; un cambio de puntuación no demuestra una mejora del software.' : 'This session only. Comparisons use the same rubric; a score change does not establish better software.'}</p>{history.filter(entry => !entry.demo).map(({ report: a, scope }, i) => <div className="history-row" key={a.id + i}><strong>{a.name}{scope ? ' · ' + scope : ''}</strong><span>{a.summary.score === null ? incomplete : a.summary.score + '/' + a.summary.maximum}</span><span>{findingCount(language, a.findings.length)}</span><code>{a.id.slice(0, 12)}</code><span>{es ? 'Rúbrica' : 'Rubric'} {a.rubricVersion}</span><button onClick={() => download('spectorque-' + a.id.slice(0, 8) + '.json', JSON.stringify(a, null, 2), 'application/json')}>{es ? 'Exportar' : 'Export'}</button></div>)}</main> : tab === 'connect' ? <Connect language={language} /> : null}
    <div className="workspace" style={panels.style} hidden={tab !== 'analyze'}><SourcePanel set={scoped} selected={selected} language={language} local={local} pending={pending} panels={panels} onLoad={load} canAutoLoad={untouched} onPasteDraftChange={setPasteDirty} onSelect={selectSource} onError={setError}/><main className="analysis">
      <div className="page-heading"><h1 className="panel-title">{es ? 'Entiende dónde tendrá que adivinar tu agente' : 'Find where your agent would have to guess'}</h1><button disabled={pending} onClick={() => setTab('build')}>{es ? 'Nueva spec' : 'New specification'}</button></div>
      {features.length > 1 && <label className="feature-select">{es ? 'Conjunto de documentos' : 'Artifact set'} <select disabled={pending} value={feature ?? ''} onChange={e => changeFeature(e.target.value || null)}><option value="">{es ? 'Todos los documentos' : 'All documents'}</option>{features.map(f => <option key={f} value={f}>{f}</option>)}</select></label>}
      {assessment && <><section className="overview" aria-label={es ? 'Resumen de la evaluación' : 'Assessment overview'}><div className="score"><span className="score-label">{es ? 'Evaluación EPIC' : 'EPIC assessment'}</span><div className="score-value">{assessment.summary.score === null ? '—' : assessment.summary.score}<span>/{assessment.summary.maximum}</span></div><span className="pill">{assessment.summary.score === null ? (es ? 'Evaluación parcial' : 'Partial assessment') : (es ? 'Rúbrica heurística' : 'Heuristic rubric')}</span><p>{assessment.summary.assessedDimensions}/10 {es ? 'dimensiones evaluadas' : 'dimensions assessed'}</p>{assessment.summary.score !== null && <p>{es ? 'Máximo alcanzable' : 'Highest reachable'}: {assessment.summary.reachable}</p>}<small>{es ? 'Lo desconocido permanece visible.' : 'Unknowns remain visible.'}</small></div><Radar assessment={assessment} language={language}/><div className="dimension-bars">{assessment.dimensions.map(d => <div key={d.id}><span><strong>{d.id}</strong> <span>{dimensionTitle(language, d.id, d.title)}</span></span><b>{d.score === null ? (es ? 'Desconocido' : 'Unknown') : <>{d.score}<small>/3</small></>}</b><div className="track"><i style={{ width: (d.score === null ? 0 : d.score / 3 * 100) + '%' }}/></div></div>)}</div></section>
      <div className="metrics-strip"><span><strong>{assessment.findings.length}</strong> {findingCount(language, assessment.findings.length).replace(/^\d+ /, '')}</span><span><strong>{assessment.decisions.length}</strong> {es ? 'decisiones pendientes' : 'open decisions'}</span><span><strong>{assessment.traceability.length}</strong> {es ? 'referencias' : 'references'}</span><span><strong>{assessment.summary.unknown}</strong> {es ? 'prácticas sin evaluar' : 'unassessed practices'}</span></div>
      <p className="method-note">{es ? 'Las reglas buscan evidencias; no certifican corrección ni completitud. Las decisiones de producto siguen siendo tuyas.' : 'Rules identify evidence; they do not certify correctness or completeness. Product decisions remain yours.'}</p>
      <div className="report-actions"><button onClick={() => download('spectorque-report.md', markdownReport(assessment))}>↓ {es ? 'Informe' : 'Report'}</button><button onClick={() => download('spectorque-report.json', JSON.stringify(assessment, null, 2), 'application/json')}>↓ JSON</button><button onClick={() => download('spectorque-badge.svg', badgeSvg(assessment), 'image/svg+xml')}>↓ {es ? 'Insignia' : 'Badge'}</button><button onClick={() => { try { download('spectorque-artifacts.zip', artifactArchive(scoped), 'application/zip'); } catch (e) { setError((e as Error).message); } }}>↓ {es ? 'Documentos' : 'Artifacts'}</button><button disabled={pending || !undo.length} onClick={() => void undoLast()}>{es ? 'Deshacer' : 'Undo'}</button>{local && !disk && !sample && <button disabled={pending} onClick={() => void saveNew()}>{es ? 'Guardar como archivos nuevos' : 'Save as new files'}</button>}</div>
      <div className="work-tabs">{(['findings', 'checklist', 'traceability', 'questions'] as const).map(v => <button key={v} aria-pressed={view === v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>{v === 'findings' ? es ? 'Hallazgos' : 'Findings' : v === 'checklist' ? es ? '40 prácticas' : '40 practices' : v === 'traceability' ? es ? 'Trazabilidad' : 'Traceability' : es ? 'Decisiones' : 'Decisions'}</button>)}{view === 'findings' && <select aria-label={es ? 'Filtrar hallazgos' : 'Filter findings'} value={filter} onChange={e => setFilter(e.target.value)}><option value="all">{es ? 'Todos' : 'All severities'}</option><option value="error">{es ? 'Errores' : 'Errors'}</option><option value="warning">{es ? 'Advertencias' : 'Warnings'}</option></select>}</div>
      {view === 'findings' ? <div className="findings-list">{findings.length ? findings.map(f => <button disabled={pending} className={'finding ' + (finding?.id === f.id ? 'selected' : '')} key={f.id} onClick={() => pickFinding(f)}><span className={'severity ' + f.severity}>{f.severity === 'error' ? '!' : '◐'}</span><div><span className="finding-meta">{f.practiceId} · {f.evidence[0]?.path}:{f.evidence[0]?.line}</span><strong>{f.message}</strong><p>{f.suggestion}</p></div><span className="open-arrow">↗</span></button>) : <p className="empty">{es ? 'Sin hallazgos para este filtro. Revisa también las prácticas y decisiones pendientes.' : 'No findings for this filter. Also review practices and open decisions.'}</p>}</div> : view === 'checklist' ? <div className="checklist">{assessment.practices.map(p => <details key={p.id}><summary><span className={'status-dot ' + p.status}/><strong>{p.id}</strong> {practiceTitle(language, p.id, p.title)}<small>{statusLabel(language, p.status)}</small></summary><p>{p.reason}</p>{p.evidence.map(e => <blockquote key={e.path + e.line}>{e.path}:{e.line}<br/>{e.text}</blockquote>)}<p>{p.suggestion}</p></details>)}</div> : view === 'questions' ? <div className="findings-list">{assessment.decisions.length ? assessment.decisions.map((e, i) => <button disabled={pending} className="finding" key={e.path + e.line} onClick={() => pickFinding({ id: 'decision-' + i, practiceId: 'P2.5', dimension: 'P2', severity: 'info', message: 'Unresolved product decision', suggestion: 'Record the explicit product decision. Use the source editor to enter new approved values.', evidence: [e], source: 'rule' })}><div><span className="finding-meta">{e.path}:{e.line}</span><strong>{e.text}</strong></div></button>) : <p className="empty">{es ? 'No hay marcadores de decisiones pendientes.' : 'No pending-decision markers found.'}</p>}</div> : <div className="trace-list">{assessment.traceability.length ? assessment.traceability.map((t, i) => <p key={i}><span className={'pill ' + (t.resolved ? '' : 'warning')}>{t.resolved ? (es ? 'Vinculada' : 'Linked') : (es ? 'Sin resolver' : 'Unresolved')}</span> {t.from}:{t.evidence.line} → <strong>{t.to}</strong></p>) : <p>{es ? 'No se han encontrado referencias entre los documentos seleccionados.' : 'No cross-artifact requirement references found.'}</p>}<p className="fine">{es ? 'Un vínculo no demuestra que el código implemente el requisito.' : 'A link does not establish that code implements a requirement.'}</p></div>}
      {previous && <p className="fine">{es ? 'Comparación anterior' : 'Previous assessment'}: {previous.summary.score === null ? incomplete.toLowerCase() : previous.summary.score + '/' + previous.summary.maximum} · {findingCount(language, previous.findings.length)} · {previous.id.slice(0, 8)} · {es ? 'Rúbrica' : 'Rubric'} {previous.rubricVersion}</p>}
      </>}
    </main><aside ref={detailPanel} className={'detail-panel' + (panels.layout.right.collapsed ? ' collapsed' : '')}><div className="panel-header"><h2 className="panel-title" ref={sourceHeading} tabIndex={-1}>{es ? 'Texto fuente' : 'Source text'}</h2><span className="pill">{disk ? (es ? 'Proyecto' : 'Workspace') : (es ? 'En memoria' : 'In memory')}</span><PanelToggle side="right" panels={panels} es={es} controls="source-panel-body"/></div><div className="panel-body" id="source-panel-body" hidden={panels.layout.right.collapsed}><section className="editor-panel"><p className="fine">{selected || (es ? 'Selecciona un archivo' : 'Select an artifact')}</p><textarea disabled={pending} readOnly={!artifact} ref={editor} aria-label={es ? 'Editor del texto fuente' : 'Source text editor'} spellCheck={false} value={artifact?.content ?? ''} onChange={e => edit(e.target.value)} rows={15}/><p className="fine">{es ? 'La edición directa permanece en memoria. Exporta los documentos para conservarla.' : 'Direct edits stay in memory. Export artifacts to keep them.'}</p></section><fieldset disabled={pending} className="mutation-controls"><ReviewPanel key={reviewContext} active={tab === 'analyze'} onDraftChange={setProposalDirty} onReject={() => setStatus(es ? 'Propuesta rechazada.' : 'Proposal rejected.')} artifact={artifact} finding={selectedFinding} clarification={clarification} local={local} disk={disk} language={language} onApply={accept} onError={setError}/></fieldset></div><PanelResizer side="right" panels={panels} es={es} panel={() => detailPanel.current}/></aside></div>
    <footer>SpecTorque · Apache-2.0 <span>{es ? 'Evidencias antes que suposiciones.' : 'Evidence before assumptions.'}</span></footer>
  </div>;
}
