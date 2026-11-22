export type Role = 'spec' | 'plan' | 'tasks' | 'instructions' | 'context';
export type Language = 'en' | 'es';
export type Framework = 'spec-kit' | 'spec-kitty' | 'openspec' | 'kiro' | 'bmad' | 'zeespec' | 'generic';
export type Status = 'supported' | 'partial' | 'missing' | 'unknown' | 'not_applicable';
export interface Artifact { path: string; content: string; role: Role; framework: Framework; featureId: string; archived: boolean }
export interface ArtifactSet { name: string; artifacts: Artifact[] }
export type LineKind = 'requirement' | 'acceptance' | 'other';
export interface Evidence { path: string; line: number; text: string }
export interface Finding { id: string; practiceId: string; dimension: string; severity: 'error' | 'warning' | 'info'; message: string; suggestion: string; evidence: Evidence[]; source: 'rule' }
export interface PracticeResult { id: string; dimension: string; title: string; status: Status; evidence: Evidence[]; reason: string; suggestion: string }
export interface DimensionResult { id: string; title: string; category: string; score: number | null; evaluated: number; applicable: number }
export interface Assessment {
  schemaVersion: '1.0'; engineVersion: string; rubricVersion: string; id: string; createdAt: string; name: string;
  artifacts: (Omit<Artifact, 'content'> & { hash: string })[];
  practices: PracticeResult[]; findings: Finding[]; dimensions: DimensionResult[];
  summary: { score: number | null; maximum: 30; assessedDimensions: number; supported: number; partial: number; missing: number; unknown: number; notApplicable: number };
  decisions: Evidence[];
  traceability: { from: string; to: string; evidence: Evidence; resolved: boolean }[];
}
export interface PatchProposal {
  id: string; path: string; baseHash: string; line: number; original: string; replacement: string; reason: string;
  source: 'human' | 'host' | 'provider' | 'rule';
}
export interface BuilderAnswers {
  name: string; purpose: string; actors: string; behavior: string; success: string;
  exclusions: string; dependencies: string; failures: string; privacy: string;
  language: Language;
}
export interface AnalyzeOptions { notApplicable?: Record<string, string> }
