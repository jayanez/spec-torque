import type { Assessment } from '../core/types.js';
export function Radar({ assessment }: { assessment: Assessment }) {
  const center = 130; const radius = 85;
  const point = (i: number, fraction: number) => { const angle = Math.PI * 2 * i / 10 - Math.PI / 2; return [center + Math.cos(angle) * radius * fraction, center + Math.sin(angle) * radius * fraction]; };
  return <svg className="radar" viewBox="0 0 260 260" role="img" aria-label="EPIC dimensions. Unknown dimensions have no score marker.">
    {[1 / 3, 2 / 3, 1].map(scale => <polygon key={scale} points={assessment.dimensions.map((_, i) => point(i, scale).join(',')).join(' ')} fill="none" stroke="var(--line)" />)}
    {assessment.dimensions.map((d, i) => { const [x, y] = point(i, 1.22); const [endX, endY] = point(i, 1); return <g key={d.id}><line x1={center} y1={center} x2={endX} y2={endY} stroke="var(--line)"/><text x={x} y={y + 4} textAnchor="middle">{d.id}</text></g>; })}
    {assessment.dimensions.every(d => d.score !== null) && <polygon points={assessment.dimensions.map((d, i) => point(i, (d.score ?? 0) / 3).join(',')).join(' ')} fill="var(--chart-fill)" stroke="var(--accent)" strokeWidth="2" />}
    {assessment.dimensions.map((d, i) => { const [cx, cy] = point(i, (d.score ?? 0) / 3); return d.score === null ? null : <circle key={d.id} cx={cx} cy={cy} r="3" fill="var(--accent)"><title>{d.title}: {d.score}/3</title></circle>; })}
  </svg>;
}
