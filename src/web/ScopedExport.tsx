import { useState } from 'react';
import type { Assessment } from '../core/types.js';
import { api, connectLocal, download, downloadZip, WorkbenchUnavailableError } from './api.js';

export function ScopedExport() {
  const [source, setSource] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [es, setSpanish] = useState(() => navigator.language.toLowerCase().startsWith('es'));
  const t = (en: string, spanish: string) => es ? spanish : en;

  async function exportSelection(format: 'json' | 'zip') {
    setBusy(true);
    setMessage('');
    try {
      const selection = JSON.parse(source);
      if (!await connectLocal()) throw new Error(t('No local workbench connection.', 'Sin conexión al workbench local.'));
      const value = await api<{ assessment?: Assessment; archive?: string }>('scoped-export', { selection, format });
      const name = 'spectorque-' + selection.revision.slice(0, 12);
      if (value.assessment) download(name + '.json', JSON.stringify(value.assessment, null, 2), 'application/json');
      else if (typeof value.archive === 'string') downloadZip(name + '.zip', value.archive);
      else throw new Error(t('Export unavailable.', 'Exportación no disponible.'));
      setMessage(t('Download requested.', 'Descarga solicitada.'));
    } catch (error) {
      setMessage(error instanceof WorkbenchUnavailableError
        ? t('The local workbench is not reachable. Restart it, open the address it prints with ?export=1 and paste the export selection again.',
          'No se puede conectar con el workbench local. Reinícialo, abre la dirección que muestra con ?export=1 y vuelve a pegar la selección de exportación.')
        : error instanceof Error ? error.message : t('Export failed.', 'Falló la exportación.'));
    } finally {
      setBusy(false);
    }
  }

  return <main style={{ maxWidth: '48rem', margin: '2rem auto', padding: '0 1rem' }}>
    <button type="button" onClick={() => setSpanish(!es)}>{es ? 'English' : 'Spanish'}</button>
    <h1>{t('Export a Codex assessment', 'Exportar una evaluación de Codex')}</h1>
    <label className="field">
      <span>{t('Export selection from the Codex viewer', 'Selección de exportación del visor de Codex')}</span>
      <textarea rows={4} value={source} disabled={busy} onChange={event => {
        setSource(event.target.value);
        setMessage('');
      }}/>
    </label>
    <button type="button" disabled={busy || !source.trim()} onClick={() => void exportSelection('json')}>{t('Download JSON', 'Descargar JSON')}</button>{' '}
    <button type="button" disabled={busy || !source.trim()} onClick={() => void exportSelection('zip')}>{t('Download ZIP', 'Descargar ZIP')}</button>
    <p role="status">{message}</p>
  </main>;
}
