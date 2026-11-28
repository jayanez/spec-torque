import type { Assessment } from './types.js';
/** Strips trailing spaces and tabs from every report line (#126); the assessment's Evidence.text is unchanged. */
export function markdownReport(a: Assessment): string {
  const report = `# SpecTorque report: ${a.name}\n\nRevision: \`${a.id}\`\nEngine: ${a.engineVersion} · Rubric: ${a.rubricVersion}\n\nScore: ${a.summary.score === null ? `incomplete (${a.summary.assessedDimensions}/10 dimensions assessed)` : `${a.summary.score}/30`}\n\nThis is an evidence-based heuristic, not an EPIC author score, ISO certification or a prediction of software correctness.\n\n## Dimensions\n\n${a.dimensions.map(d => `- ${d.id} ${d.title}: ${d.score ?? 'not assessed'}`).join('\n')}\n\n## Practices\n\n${a.practices.map(p => `### ${p.id} ${p.title} — ${p.status}\n${p.reason}\n${p.evidence.map(e => `- ${e.path}:${e.line}: ${e.text}`).join('\n')}\nNext: ${p.suggestion}`).join('\n\n')}\n\n## Findings\n\n${a.findings.map(f => `- **${f.severity}** ${f.message} (${f.evidence[0]?.path}:${f.evidence[0]?.line})\n  ${f.suggestion}`).join('\n')}\n\n## Open decisions\n\n${a.decisions.map(e => `- ${e.path}:${e.line}: ${e.text}`).join('\n') || 'No explicit clarification markers detected; this does not establish completeness.'}\n`;
  return report.replace(/[ \t]+(?=\n|$)/g, '');
}
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
export function badgeSvg(a: Assessment): string {
  const label = a.summary.score === null ? 'incomplete' : `${a.summary.score}/30`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="198" height="24" role="img" aria-label="SpecTorque: ${escape(label)}"><title>Revision ${escape(a.id)}</title><rect width="198" height="24" rx="4" fill="#173f4f"/><rect x="100" width="98" height="24" fill="#ac6414"/><g fill="white" font-family="Verdana,sans-serif" font-size="11" text-anchor="middle"><text x="50" y="16">SpecTorque</text><text x="149" y="16">${escape(label)}</text></g></svg>`;
}
