import { useRef, useState } from 'react';
import type { PatchProposal } from '../core/types.js';
import { api, connectLocal, WorkbenchUnavailableError } from './api.js';

interface Review {
  root: string;
  feature: string | null;
  revision: string;
  findingId: string;
  proposal: PatchProposal;
}

export function ScopedReview() {
  const [source, setSource] = useState('');
  const [review, setReview] = useState<Review>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [es, setSpanish] = useState(() => navigator.language.toLowerCase().startsWith('es'));
  const t = (en: string, spanish: string) => es ? spanish : en;
  const input = useRef<HTMLTextAreaElement>(null);
  const failure = (error: unknown, fallback: string) => error instanceof WorkbenchUnavailableError
    ? t('The local workbench is not reachable. Restart it, open the address it prints with ?review=1 and paste the review data again. No file was written.',
      'No se puede conectar con el workbench local. Reinícialo, abre la dirección que muestra con ?review=1 y vuelve a pegar los datos de revisión. No se escribió ningún archivo.')
    : error instanceof Error ? error.message : fallback;

  function reject() {
    setSource('');
    setReview(undefined);
    setMessage(t('Change rejected. No file was written.', 'Cambio rechazado. No se escribió ningún archivo.'));
    input.current?.focus();
  }

  async function verify() {
    setReview(undefined);
    setBusy(true);
    setMessage('');
    try {
      if (!await connectLocal()) throw new Error(t('No local workbench connection.', 'Sin conexión al workbench local.'));
      setReview(await api<Review>('scoped-review', JSON.parse(source)));
    } catch (error) {
      setMessage(failure(error, t('Review failed.', 'Falló la revisión.')));
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!review) return;
    setBusy(true);
    setReview(undefined);
    setMessage('');
    try {
      await api('scoped-apply', { review, approved: true });
      setSource('');
      setMessage(t('Change saved. Refresh the selected scope in Codex.', 'Cambio guardado. Actualiza el alcance seleccionado en Codex.'));
    } catch (error) {
      setMessage(failure(error, t('Save failed.', 'Falló el guardado.')));
    } finally {
      setBusy(false);
    }
  }

  return <main style={{ maxWidth: '48rem', margin: '2rem auto', padding: '0 1rem' }}>
    <button type="button" onClick={() => setSpanish(!es)}>{es ? 'English' : 'Spanish'}</button>
    <h1>{t('Review a Codex change', 'Revisar un cambio de Codex')}</h1>
    <label className="field">
      <span>{t('Review data from the Codex viewer', 'Datos de revisión del visor de Codex')}</span>
      <textarea ref={input} rows={4} value={source} disabled={busy} onChange={event => {
        setSource(event.target.value); setReview(undefined); setMessage('');
      }}/>
    </label>
    <button type="button" disabled={busy || !source.trim()} onClick={() => void verify()}>{t('Verify review', 'Verificar revisión')}</button>
    {review && <section aria-label={t('Verified difference', 'Diferencia verificada')}>
      <p>{review.root} · {review.feature ?? t('All documents', 'Todos los documentos')}</p>
      <p><code>{review.revision}</code></p>
      <p>{review.proposal.path}:{review.proposal.line}</p>
      <strong>{t('Before', 'Antes')}</strong><pre style={{ whiteSpace: 'pre-wrap' }}>{review.proposal.original}</pre>
      <strong>{t('After', 'Después')}</strong><pre style={{ whiteSpace: 'pre-wrap' }}>{review.proposal.replacement}</pre>
      <button type="button" disabled={busy} onClick={reject}>{t('Reject change', 'Rechazar cambio')}</button>{' '}
      <button type="button" disabled={busy} onClick={() => void apply()}>{t('Approve and write to disk', 'Aprobar y escribir en disco')}</button>
    </section>}
    <p role="status">{message}</p>
  </main>;
}
