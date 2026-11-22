/** Loopback-only client for a local Ollama server. Models are never pulled; hosted models are refused. */
export const defaultEndpoint = 'http://127.0.0.1:11434';
const loopback = new Set(['127.0.0.1', 'localhost', '[::1]']);

export interface LocalModel { name: string; digest: string; ollama: string }

export class Ollama {
  constructor(readonly endpoint = defaultEndpoint) {
    if (!loopback.has(new URL(endpoint).hostname)) throw new Error('Ollama must run on the loopback interface.');
  }

  async api(path: string, body?: unknown): Promise<Record<string, unknown>> {
    const response = await fetch(this.endpoint + path, body
      ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
    if (!response.ok) throw new Error(`Ollama ${path} returned ${response.status}`);
    return response.json() as Promise<Record<string, unknown>>;
  }

  /** The installed local model with this name, with its digest and the server version. */
  async localModel(name: string): Promise<LocalModel> {
    const tags = await this.api('/api/tags');
    const found = (tags.models as { name: string; digest: string; remote_host?: string }[]).find(item => item.name === name);
    if (!found || found.remote_host) throw new Error('The model must be a local Ollama model.');
    return { name: found.name, digest: found.digest, ollama: String((await this.api('/api/version')).version) };
  }
}
