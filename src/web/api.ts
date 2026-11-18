let session: string | undefined;
export async function connectLocal(): Promise<boolean> {
  try { const response = await fetch('./api/session'); if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return false; session = (await response.json()).token; return Boolean(session); } catch { return false; }
}
export async function api<T>(path: string, input?: unknown): Promise<T> {
  if (!session) throw new Error('Start the local workbench to use this connection: npm start.');
  const response = await fetch('./api/' + path, { method: input === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', 'X-SpecTorque-Token': session }, ...(input === undefined ? {} : { body: JSON.stringify(input) }) });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || 'Operation failed.');
  return value as T;
}
export function download(name: string, content: string | ArrayBuffer, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement('a');
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadZip(name: string, base64: string) {
  const bytes = Uint8Array.from(atob(base64), value => value.charCodeAt(0));
  download(name, bytes.buffer, 'application/zip');
}
