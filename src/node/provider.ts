import { z } from 'zod';
import { refinementPrompt } from '../core/refine.js';
import { boundedJson } from './http.js';
const reply = z.object({ replacement: z.string().min(1).max(20_000), reason: z.string().min(1).max(2000) });
export interface ProviderConfig { kind: 'ollama' | 'openai'; model: string; apiKey?: string }
export async function requestRewrite(config: ProviderConfig, original: string, context: string, language = 'en', fetcher: typeof fetch = fetch): Promise<z.infer<typeof reply>> {
  if (!config.model.trim()) throw new Error('Choose a model.');
  if (config.kind === 'openai' && !config.apiKey?.trim()) throw new Error('An API key is required for the selected provider.');
  const prompt = refinementPrompt(original, context, language);
  const ollama = config.kind === 'ollama';
  let response: Response;
  try {
    response = await fetcher(ollama ? 'http://127.0.0.1:11434/api/chat' : 'https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal: AbortSignal.timeout(60_000),
      headers: { 'Content-Type': 'application/json', ...(!ollama ? { Authorization: `Bearer ${config.apiKey}` } : {}) },
      body: JSON.stringify({ model: config.model, messages: [{ role: 'user', content: prompt }], ...(ollama ? { stream: false, format: 'json' } : { response_format: { type: 'json_object' } }) }),
    });
  } catch { throw new Error('Model connection failed or timed out. Check the provider and try again.'); }
  if (!response.ok) throw new Error(`Model provider returned ${response.status}. Check the model, credentials and limits.`);
  const result = await boundedJson<{ message?: { content?: string }; choices?: { message: { content: string } }[] }>(response, 100_000);
  const content = ollama ? result.message?.content : result.choices?.[0]?.message.content;
  if (!content || content.length > 25_000) throw new Error('The model did not return a bounded proposal.');
  try { return reply.parse(JSON.parse(content)); } catch { throw new Error('The model returned an invalid proposal. No content was changed.'); }
}
