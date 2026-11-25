// Pane text. The pane runs the CLI instead of importing the engine, so it keeps its own copy of
// the shared presentation helpers (src/core/presentation.ts); tests/parity.test.ts checks both agree.
export const DISCLAIMER = 'Heuristic evidence, not a correctness certificate.';
export const ALL = 'All documents';
export const CHANGED = 'Changed on this branch';

export const titleLine = (version, name) => 'SpecTorque' + (version ? ' ' + version : '') + (name ? ' · ' + name : '');
const count = (n, one, many) => n + ' ' + (n === 1 ? one : many);
export const scoreText = a => a.summary.score === null ? 'Incomplete assessment' : a.summary.score + '/' + a.summary.maximum;
export const summaryLine = a => [scoreText(a), count(a.findings.length, 'finding', 'findings'),
  count(a.decisions.length, 'open decision', 'open decisions'), 'engine ' + a.engineVersion].join(' · ');
export const dimensionsLine = a => a.dimensions.map(d => d.id + ' ' + (d.score === null ? '—' : d.score + '/3')).join('   ');
export function findingCard(a, index) {
  const finding = a.findings[index];
  if (!finding) return [];
  const evidence = finding.evidence[0];
  return [
    'Finding ' + (index + 1) + ' of ' + a.findings.length + ' · ' + finding.practiceId + ' · ' + finding.severity,
    ...(evidence ? [evidence.path + ':' + evidence.line] : []),
    finding.message,
    ...(evidence ? ['Evidence: «' + evidence.text + '»'] : []),
    'Fix: ' + finding.suggestion,
  ];
}
export const featureLabel = feature => (feature.layout ? '' : 'Other · ') + feature.id;
export const scopeLabel = value => !value ? 'not selected' : value.kind === 'all' ? ALL : value.kind === 'feature' ? value.id
  : value.kind === 'path' ? 'Folder · ' + value.path : CHANGED + (value.base ? ' (vs ' + value.base + ')' : '');
// Select values: 'all', 'changed', 'c:<base>', 'p:<folder>' or 'f:<feature>', as in host-scope.ts.
export const scopeValue = value => !value ? undefined : value.kind === 'feature' ? 'f:' + value.id : value.kind === 'path' ? 'p:' + value.path
  : value.kind === 'changed' && value.base ? 'c:' + value.base : value.kind;
export const valueScope = value => value === 'all' ? { kind: 'all' } : value === 'changed' ? { kind: 'changed' }
  : value.startsWith('c:') ? { kind: 'changed', base: value.slice(2) } : value.startsWith('p:') ? { kind: 'path', path: value.slice(2) }
  : { kind: 'feature', id: value.slice(2) };
export const replacementLabel = line => 'Proposed replacement for line ' + line;
export function workbenchUrl(url) {
  const parsed = new URL(url);
  if (parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]') parsed.hostname = 'localhost';
  return parsed.toString();
}
export const workbenchLine = (url, feature) => 'Workbench: ' + workbenchUrl(url) + (feature ? ' — opens on ' + feature : '');
