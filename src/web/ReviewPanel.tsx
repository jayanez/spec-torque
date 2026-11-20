import { useLayoutEffect, useRef, useState } from 'react';
import type { Artifact, Finding, PatchProposal, Language } from '../core/types.js';
import { createProposal } from '../core/refine.js';
import { api, download } from './api.js';
export function ReviewPanel({ artifact, finding, local, disk, language, active, onApply, onError, onReject, onDraftChange }: {
  artifact?: Artifact;
  finding?: Finding;
  local: boolean;
  disk: boolean;
  language: Language;
  active: boolean;
  onApply: (p: PatchProposal, disk: boolean) => Promise<void>;
  onError: (s: string) => void;
  onReject: () => void;
  onDraftChange: (dirty: boolean) => void;
}) {
  const es = language === 'es'; const [replacement, setReplacement] = useState(''); const [proposal, setProposal] = useState<PatchProposal>();
  const [provider, setProvider] = useState<'host' | 'ollama' | 'openai'>('host'); const [model, setModel] = useState(''); const [key, setKey] = useState('');
  const [persist, setPersist] = useState(false); const [busy, setBusy] = useState(false);
  const epoch = useRef(0);
  const differenceHeading = useRef<HTMLHeadingElement>(null);
  const reviewButton = useRef<HTMLButtonElement>(null);
  const line = finding?.evidence[0]?.line ?? 1;
  const original = artifact?.content.split(/\r?\n/)[line - 1] ?? '';
  useLayoutEffect(() => {
    epoch.current++;
    setReplacement(original); setProposal(undefined); setPersist(false); setBusy(false);
    onDraftChange(false);
    return () => { epoch.current++; };
  }, [artifact?.content, finding?.id, artifact?.path, original, onDraftChange]);
  useLayoutEffect(() => {
    if (active && proposal) differenceHeading.current?.focus();
  }, [active, proposal]);
  useLayoutEffect(() => { if (!active) setKey(''); }, [active]);
  function updateWording(value: string) {
    epoch.current++;
    setReplacement(value); setProposal(undefined); setPersist(false);
    onDraftChange(value !== original);
  }
  async function preview() {
    if (!artifact) return;
    const requestEpoch = ++epoch.current;
    try {
      const next = await createProposal(artifact.path, artifact.content, line, replacement, finding?.suggestion ?? 'User-reviewed improvement');
      if (requestEpoch === epoch.current) { setPersist(false); setProposal(next); }
    } catch (e) { if (requestEpoch === epoch.current) onError((e as Error).message); }
  }
  function reject() {
    setProposal(undefined); setPersist(false); onReject(); reviewButton.current?.focus();
  }
  async function rewrite() {
    if (!artifact || provider === 'host') return;
    const requestEpoch = epoch.current;
    setBusy(true);
    try { const p = await api<PatchProposal>('rewrite', { document: { path: artifact.path, content: artifact.content }, line, context: artifact.content.slice(0, 12000), language, provider: { kind: provider, model, ...(provider === 'openai' ? { apiKey: key } : {}) } }); if (requestEpoch === epoch.current) { setReplacement(p.replacement); setPersist(false); setProposal(p); onDraftChange(p.replacement !== original); } } catch (e) { if (requestEpoch === epoch.current) onError((e as Error).message); } finally { if (requestEpoch === epoch.current) setBusy(false); }
  }
  return <section className="review-panel"><div className="section-heading"><h2>{es ? 'Refinar con evidencia' : 'Refine with evidence'}</h2><span className="pill">{es ? 'Revisión humana' : 'Human review'}</span></div>
    {!finding || !artifact ? <p>{es ? 'Selecciona un hallazgo para revisar el texto original y proponer un cambio.' : 'Select a finding to review its source and propose a change.'}</p> : <>
      <p className="fine">{artifact.path}:{line}</p><blockquote>{original}</blockquote><p>{finding.suggestion}</p>
      <label className="field"><span>{es ? 'Texto propuesto' : 'Proposed wording'}</span><textarea disabled={busy} rows={4} value={replacement} onChange={e => updateWording(e.target.value)}/></label>
      <div className="actions"><button disabled={busy} onClick={() => updateWording(original.replace(/\b(fast|easily|scalable|etc\.?|as needed|rápid[oa]|escalable|etcétera|cuando sea necesario)\b/giu, word => '[NEEDS CLARIFICATION: ' + (es ? 'definir ' : 'define ') + word + ']'))}>{es ? 'Marcar la aclaración' : 'Mark clarification'}</button><button ref={reviewButton} className="primary" disabled={busy || replacement === original} onClick={() => void preview()}>{es ? 'Revisar diferencia' : 'Review difference'}</button></div>
      <details className="provider"><summary>{es ? 'Asistencia de un modelo' : 'Model assistance'}</summary><label className="field"><span>{es ? 'Ruta del modelo' : 'Model route'}</span><select value={provider} onChange={e => setProvider(e.target.value as typeof provider)}><option value="host">{es ? 'Mi agente actual' : 'My current agent'}</option><option value="ollama">Ollama · local</option><option value="openai">OpenAI · API</option></select></label>
        {provider === 'host' ? <><p>{es ? 'Comparte el contexto con tu agente. La aplicación no realiza otra llamada.' : 'Share the context with your agent. The app makes no additional model call.'}</p><button onClick={() => download('spectorque-refinement-context.md', 'Improve this requirement without inventing decisions. Preserve IDs, numbers, obligations and exclusions. Ask for unknown values.\n\n' + artifact.path + ':' + line + '\n' + original + '\n\nFinding: ' + finding.message + '\nSuggested direction: ' + finding.suggestion)}>{es ? 'Exportar contexto' : 'Export context'}</button></> : <><label className="field"><span>{es ? 'Modelo' : 'Model'}</span><input value={model} placeholder={provider === 'ollama' ? 'Your installed model' : 'Your model ID'} onChange={e => setModel(e.target.value)}/></label>{provider === 'openai' && <label className="field"><span>API key · {es ? 'solo en memoria' : 'memory only'}</span><input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)}/></label>}<p className="fine">{provider === 'openai' ? (es ? 'Al pulsar, enviarás el texto y contexto a OpenAI usando tu cuenta y sus tarifas.' : 'Clicking sends the source and context to OpenAI using your account and its pricing.') : es ? 'Se enviará al servicio Ollama en este equipo.' : 'Sent to the Ollama service on this computer.'}</p><button disabled={!local || !model || busy || provider === 'openai' && !key} onClick={() => void rewrite()}>{busy ? (es ? 'Solicitando…' : 'Requesting…') : es ? 'Solicitar propuesta' : 'Request proposal'}</button></>}
      </details>
      {proposal && <div className="diff"><h3 ref={differenceHeading} tabIndex={-1}>{es ? 'Cambio propuesto' : 'Proposed change'}</h3><strong>{es ? 'Texto original' : 'Original wording'}</strong><del>{proposal.original}</del><strong>{es ? 'Texto propuesto' : 'Proposed wording'}</strong><ins>{proposal.replacement}</ins><p>{proposal.reason}</p>{disk && <label className="check"><input type="checkbox" checked={persist} onChange={e => setPersist(e.target.checked)}/>{es ? 'Escribir este cambio en el proyecto local' : 'Write this change to the local workspace'}</label>}<div className="actions"><button disabled={busy} onClick={reject}>{es ? 'Rechazar' : 'Reject'}</button><button disabled={busy} className="primary" onClick={() => void onApply(proposal, disk && persist).then(() => setProposal(undefined)).catch(e => { onError(e.message); differenceHeading.current?.focus(); })}>{es ? 'Aceptar cambio' : 'Accept change'}</button></div></div>}
    </>}
  </section>;
}
