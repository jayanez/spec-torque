import { z } from 'zod';
import { classifyArtifact } from '../core/artifacts.js';
export const documentSchema = z.object({ path: z.string().min(1).max(500), content: z.string().max(1_000_000) });
export const setSchema = z.object({ name: z.string().min(1).max(200), artifacts: z.array(documentSchema).max(500) });
export const builderSchema = z.object({ name: z.string().min(1).max(120), purpose: z.string().min(1).max(5000), actors: z.string().max(5000), behavior: z.string().min(1).max(20000), success: z.string().max(10000), exclusions: z.string().max(5000), dependencies: z.string().max(5000), failures: z.string().max(5000), privacy: z.string().max(5000), language: z.enum(['en', 'es']) });
export const proposalSchema = z.object({ id: z.string().min(1), path: z.string().min(1).max(500), baseHash: z.string().regex(/^[a-f0-9]{64}$/), line: z.number().int().positive(), original: z.string().max(1_000_000), replacement: z.string().min(1).max(20000), reason: z.string().max(5000), source: z.enum(['human', 'host', 'provider', 'rule']) });
export const rewriteSchema = z.object({ document: documentSchema, line: z.number().int().positive(), context: z.string().max(12000).default(''), language: z.enum(['en', 'es']).default('en'), provider: z.object({ kind: z.enum(['ollama', 'openai']), model: z.string().min(1).max(200), apiKey: z.string().max(1000).optional() }) });
export function parseSet(input: unknown) { const value = setSchema.parse(input); return { name: value.name, artifacts: value.artifacts.map(a => classifyArtifact(a.path, a.content)) }; }

export const scopedExportSchema = z.object({
  root: z.string().min(1).max(32768),
  feature: z.string().max(4096).nullable(),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.iso.datetime(),
});
