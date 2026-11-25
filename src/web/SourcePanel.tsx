import { useEffect, useRef, useState } from 'react';
import { classifyArtifact, fitsReadLimit, listFeatures, READ_LIMIT } from '../core/artifacts.js';
import type { Artifact, ArtifactSet, Language } from '../core/types.js';
import type { FeatureSummary } from '../core/artifacts.js';
import { api } from './api.js';
import { sampleSet } from './samples.js';
const WHOLE_TREE = '*';
interface LocalInfo { total: number; features: FeatureSummary[]; preselected: string | null }
export type ImportKind = 'file' | 'workspace' | 'draft' | 'sample';
export function SourcePanel({ set, selected, language, local, onLoad, canAutoLoad, onSelect, onError, onPasteDraftChange }: { set: ArtifactSet; selected: string; language: Language; local: boolean; onLoad: (set: ArtifactSet, kind?: ImportKind, auto?: boolean) => boolean; canAutoLoad: () => boolean; onPasteDraftChange: (dirty: boolean) => void; onSelect: (path: string) => void; onError: (text: string) => void }) {
  const es = language === 'es'; const input = useRef<HTMLInputElement>(null);
  const [repo, setRepo] = useState(''); const localRequest = useRef(0); const [busy, setBusy] = useState(false); const [paste, setPaste] = useState(false); const [text, setText] = useState('');
  const [localInfo, setLocalInfo] = useState<LocalInfo>();
  // The loaded local scope: undefined before a load, null for the whole work tree, else a feature ID.
  const [localScope, setLocalScope] = useState<string | null>();
  async function files(list: FileList | null) {
    if (!list?.length) return;
    // FileList is live: the input is reset while File.text() is still pending.
    const selectedFiles = Array.from(list);
    try {
      if (selectedFiles.length > 500) throw new Error('Import at most 500 Markdown files.');
      const artifacts: Artifact[] = [];
      for (const f of selectedFiles) {
        if (f.size > 1_000_000 || !f.name.endsWith('.md')) throw new Error('Use Markdown files smaller than 1 MB.');
        artifacts.push(classifyArtifact(f.webkitRelativePath || f.name, await f.text()));
      }
      if (new Set(artifacts.map(a => a.path)).size !== artifacts.length) throw new Error('Duplicate filenames: import one feature folder at a time.');
      onLoad({ name: selectedFiles[0].name, artifacts });
    } catch (e) { onError((e as Error).message); }
  }
  // Large workspaces load one feature at a time; the index itself never reads document content.
  // Without a choice, this reads what the server was started for: its preselected feature, or the
  // whole work tree when it fits one read. Above the limit it reads nothing and offers the picker.
  async function loadLocal(choice?: string | null, auto = false) {
    // Only the latest local load may replace the artifacts; an earlier, slower one is dropped.
    const request = ++localRequest.current;
    let info: LocalInfo | undefined;
    try {
      info = await api<LocalInfo>('features');
      if (request !== localRequest.current) return;
      // On connect, an empty work tree keeps the sample, and nothing replaces work already started.
      if (auto && (info.total === 0 || !canAutoLoad())) { setLocalInfo(info); return; }
      // The whole tree is read only while it fits; otherwise fall back to the preselection or the picker.
      const whole = fitsReadLimit(info) ? null : undefined;
      const target = choice === null ? whole : choice !== undefined ? choice : info.preselected ?? whole;
      if (target === undefined) { setLocalInfo(info); setLocalScope(undefined); return; }
      const loaded = await api<ArtifactSet>(target ? 'workspace?feature=' + encodeURIComponent(target) : 'workspace');
      if (request !== localRequest.current) return;
      // The picker updates with the load, so it never flashes while a read is in flight.
      setLocalInfo(info);
      if (onLoad(loaded, 'workspace', auto)) setLocalScope(target);
    } catch (e) {
      if (request !== localRequest.current) return;
      if (info) setLocalInfo(info);
      onError((e as Error).message);
    }
  }
  useEffect(() => { if (local) void loadLocal(undefined, true); }, [local]);
  const loadedFeatures = listFeatures(set.artifacts);
  // The whole work tree is narrowed in memory with "Artifact set"; otherwise this picker reads another scope.
  const picker = local && localInfo && localInfo.features.length > 1 && localScope !== null;
  const fits = !!localInfo && fitsReadLimit(localInfo);
  async function remote() { setBusy(true); try { onLoad(await api<ArtifactSet>('github', { source: repo })); } catch (e) { onError((e as Error).message); } finally { setBusy(false); } }
  return <aside className="source-panel"><h2>{es ? 'Documentos' : 'Artifacts'}</h2><p className="muted">{loadedFeatures.length === 1 && loadedFeatures[0].id !== '(root)' ? loadedFeatures[0].id : es ? 'Selecciona un conjunto por funcionalidad.' : 'Review one feature set at a time.'}</p>
    <div className="source-actions"><button onClick={() => input.current?.click()}>{es ? 'Importar archivos' : 'Import files'}</button><button onClick={() => setPaste(!paste)}>{es ? 'Pegar texto' : 'Paste text'}</button></div>
    <input ref={input} type="file" accept=".md" multiple hidden onChange={e => { void files(e.target.files); e.target.value = ''; }}/>
    {paste && <div className="paste"><label className="field"><span>{es ? 'Texto de la especificación' : 'Specification text'}</span><textarea value={text} rows={5} onChange={e => { setText(e.target.value); onPasteDraftChange(Boolean(e.target.value)); }}/></label><button disabled={!text.trim()} onClick={() => { if (onLoad({ name: es ? 'Texto importado' : 'Pasted specification', artifacts: [classifyArtifact('spec.md', text)] }, 'draft')) { setText(''); onPasteDraftChange(false); setPaste(false); } }}>{es ? 'Analizar texto' : 'Analyze text'}</button></div>}
    {local && <button className="workspace-button" onClick={() => void loadLocal(localScope)}>{es ? 'Recargar proyecto local' : 'Reload local workspace'}</button>}
    {picker && <label className="field feature-load"><span>{es ? 'Funcionalidad del proyecto local' : 'Local workspace feature'}</span><select value={localScope ?? ''} onChange={e => { if (e.target.value) void loadLocal(e.target.value === WHOLE_TREE ? null : e.target.value); }}>{localScope === undefined && <option value="">{es ? 'Elige una funcionalidad' : 'Choose a feature'}</option>}{fits && <option value={WHOLE_TREE}>{es ? 'Todos los documentos' : 'All documents'}</option>}{localInfo.features.map(f => <option key={f.id} value={f.id}>{f.layout ? f.id : (es ? 'Otros · ' : 'Other · ') + f.id}</option>)}</select></label>}
    {picker && localScope === undefined && !fits && <p className="fine">{es ? `Este proyecto tiene ${localInfo.total} documentos, más de ${READ_LIMIT} a la vez. Elige una funcionalidad.` : `This work tree has ${localInfo.total} documents, more than ${READ_LIMIT} read at once. Choose a feature.`}</p>}
    <label className="field repo-field"><span>{es ? 'Repositorio público o carpeta de GitHub' : 'Public GitHub repository or folder'}</span><input value={repo} onChange={e => setRepo(e.target.value)} placeholder="owner/repo"/></label><button disabled={!repo.trim() || busy || !local} onClick={() => void remote()}>{busy ? (es ? 'Importando…' : 'Importing…') : es ? 'Buscar documentos' : 'Find artifacts'}</button>
    {!local && <p className="fine">{es ? 'Abre el servidor local para conectar GitHub y archivos.' : 'Start the local server to connect GitHub and workspace files.'}</p>}
    <div className="file-heading"><strong>{set.artifacts.length} {es ? 'archivos' : 'files'}</strong><span>{new Set(set.artifacts.map(a => a.framework)).size} {es ? 'formatos' : 'formats'}</span></div>
    <div className="file-list">{set.artifacts.map(a => <button key={a.path} title={a.path} aria-pressed={selected === a.path} className={selected === a.path ? 'selected' : ''} onClick={() => onSelect(a.path)}><span className="file-icon">{a.role === 'tasks' ? '☑' : a.role === 'plan' ? '◇' : '≡'}</span><span><strong>{a.path.split('/').at(-1)}</strong><small>{a.role} · {a.framework}{a.archived ? ' · archive' : ''}</small></span></button>)}</div>
    <details className="samples"><summary>{es ? 'Explorar ejemplos' : 'Explore samples'}</summary><button onClick={() => onLoad(sampleSet(false, es), 'sample')}>{es ? 'Borrador ambiguo' : 'Ambiguous draft'}</button><button onClick={() => onLoad(sampleSet(true), 'sample')}>{es ? 'Spec + plan + tareas' : 'Spec + plan + tasks'}</button></details>
    <p className="privacy-note">◉ {es ? 'Análisis local. Sin telemetría.' : 'Local analysis. No telemetry.'}</p>
  </aside>;
}
