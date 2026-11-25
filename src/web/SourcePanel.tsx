import { useRef, useState } from 'react';
import { classifyArtifact } from '../core/artifacts.js';
import type { Artifact, ArtifactSet, Language } from '../core/types.js';
import type { FeatureSummary } from '../core/artifacts.js';
import { api } from './api.js';
import { sampleSet } from './samples.js';
export function SourcePanel({ set, selected, language, local, onLoad, onSelect, onError, onPasteDraftChange }: { set: ArtifactSet; selected: string; language: Language; local: boolean; onLoad: (set: ArtifactSet, kind?: 'file' | 'workspace' | 'draft') => boolean; onPasteDraftChange: (dirty: boolean) => void; onSelect: (path: string) => void; onError: (text: string) => void }) {
  const es = language === 'es'; const input = useRef<HTMLInputElement>(null);
  const [repo, setRepo] = useState(''); const [localFeatures, setLocalFeatures] = useState<FeatureSummary[]>(); const [localFeature, setLocalFeature] = useState(''); const localRequest = useRef(0); const [busy, setBusy] = useState(false); const [paste, setPaste] = useState(false); const [text, setText] = useState('');
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
  async function loadLocal(feature?: string) {
    // Only the latest local load may replace the artifacts; an earlier, slower one is dropped.
    const request = ++localRequest.current;
    try {
      if (feature === undefined) {
        const info = await api<{ total: number; features: FeatureSummary[]; preselected: string | null }>('features');
        if (request !== localRequest.current) return;
        setLocalFeatures(info.features.length > 1 ? info.features : undefined);
        if (info.preselected) feature = info.preselected;
        else if (info.total > 500) { setLocalFeature(''); return; }
      }
      if (feature) setLocalFeature(feature);
      const loaded = await api<ArtifactSet>(feature ? 'workspace?feature=' + encodeURIComponent(feature) : 'workspace');
      if (request !== localRequest.current) return;
      onLoad(loaded, 'workspace');
    } catch (e) { if (request === localRequest.current) onError((e as Error).message); }
  }
  async function remote() { setBusy(true); try { onLoad(await api<ArtifactSet>('github', { source: repo })); } catch (e) { onError((e as Error).message); } finally { setBusy(false); } }
  return <aside className="source-panel"><h2>{es ? 'Documentos' : 'Artifacts'}</h2><p className="muted">{es ? 'Selecciona un conjunto por funcionalidad.' : 'Review one feature set at a time.'}</p>
    <div className="source-actions"><button onClick={() => input.current?.click()}>{es ? 'Importar archivos' : 'Import files'}</button><button onClick={() => setPaste(!paste)}>{es ? 'Pegar texto' : 'Paste text'}</button></div>
    <input ref={input} type="file" accept=".md" multiple hidden onChange={e => { void files(e.target.files); e.target.value = ''; }}/>
    {paste && <div className="paste"><label className="field"><span>{es ? 'Texto de la especificación' : 'Specification text'}</span><textarea value={text} rows={5} onChange={e => { setText(e.target.value); onPasteDraftChange(Boolean(e.target.value)); }}/></label><button disabled={!text.trim()} onClick={() => { if (onLoad({ name: es ? 'Texto importado' : 'Pasted specification', artifacts: [classifyArtifact('spec.md', text)] }, 'draft')) { setText(''); onPasteDraftChange(false); setPaste(false); } }}>{es ? 'Analizar texto' : 'Analyze text'}</button></div>}
    {local && <button className="workspace-button" onClick={() => void loadLocal()}>{es ? 'Cargar proyecto local' : 'Load local workspace'}</button>}
    {local && localFeatures && <label className="field feature-load"><span>{es ? 'Funcionalidad del proyecto local' : 'Local workspace feature'}</span><select value={localFeature} onChange={e => { if (e.target.value) void loadLocal(e.target.value); }}><option value="">{es ? 'Elige una funcionalidad' : 'Choose a feature'}</option>{localFeatures.map(f => <option key={f.id} value={f.id}>{f.layout ? f.id : (es ? 'Otros · ' : 'Other · ') + f.id}</option>)}</select></label>}
    <label className="field repo-field"><span>{es ? 'Repositorio público o carpeta de GitHub' : 'Public GitHub repository or folder'}</span><input value={repo} onChange={e => setRepo(e.target.value)} placeholder="owner/repo"/></label><button disabled={!repo.trim() || busy || !local} onClick={() => void remote()}>{busy ? (es ? 'Importando…' : 'Importing…') : es ? 'Buscar documentos' : 'Find artifacts'}</button>
    {!local && <p className="fine">{es ? 'Abre el servidor local para conectar GitHub y archivos.' : 'Start the local server to connect GitHub and workspace files.'}</p>}
    <div className="file-heading"><strong>{set.artifacts.length} {es ? 'archivos' : 'files'}</strong><span>{new Set(set.artifacts.map(a => a.framework)).size} {es ? 'formatos' : 'formats'}</span></div>
    <div className="file-list">{set.artifacts.map(a => <button key={a.path} title={a.path} aria-pressed={selected === a.path} className={selected === a.path ? 'selected' : ''} onClick={() => onSelect(a.path)}><span className="file-icon">{a.role === 'tasks' ? '☑' : a.role === 'plan' ? '◇' : '≡'}</span><span><strong>{a.path.split('/').at(-1)}</strong><small>{a.role} · {a.framework}{a.archived ? ' · archive' : ''}</small></span></button>)}</div>
    <details className="samples"><summary>{es ? 'Explorar ejemplos' : 'Explore samples'}</summary><button onClick={() => onLoad(sampleSet(false, es))}>{es ? 'Borrador ambiguo' : 'Ambiguous draft'}</button><button onClick={() => onLoad(sampleSet(true))}>{es ? 'Spec + plan + tareas' : 'Spec + plan + tasks'}</button></details>
    <p className="privacy-note">◉ {es ? 'Análisis local. Sin telemetría.' : 'Local analysis. No telemetry.'}</p>
  </aside>;
}
