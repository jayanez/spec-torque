import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';

export type Side = 'left' | 'right';
interface PanelState { width?: number; collapsed: boolean }
type Layout = Record<Side, PanelState>;
const KEY = 'spectorque.layout';
export const LIMITS: Record<Side, { min: number; max: number; initial: number }> = {
  left: { min: 180, max: 480, initial: 240 },
  right: { min: 260, max: 640, initial: 340 },
};
const COLLAPSED = 52;
const STEP = 16;
// The same share of the window that the CSS grid allows (28vw / 34vw), so the stored width is the drawn one.
const SHARE: Record<Side, number> = { left: .28, right: .34 };
export const maxWidth = (side: Side) => Math.max(LIMITS[side].min, Math.min(LIMITS[side].max, Math.floor(innerWidth * SHARE[side])));
const clamp = (side: Side, width: number) => Math.round(Math.min(maxWidth(side), Math.max(LIMITS[side].min, width)));

function stored(): Layout {
  const fallback: Layout = { left: { collapsed: false }, right: { collapsed: false } };
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Layout> | null;
    const read = (side: Side): PanelState => {
      const panel = value?.[side];
      return { collapsed: panel?.collapsed === true, ...(typeof panel?.width === 'number' ? { width: clamp(side, panel.width) } : {}) };
    };
    return value ? { left: read('left'), right: read('right') } : fallback;
  } catch { return fallback; }
}

/** Side-panel widths and collapsed state, remembered in localStorage. */
export function usePanelLayout() {
  const [layout, setLayout] = useState<Layout>(stored);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(layout)); } catch { /* storage may be unavailable */ } }, [layout]);
  const update = (side: Side, change: Partial<PanelState>) => setLayout(current => ({ ...current, [side]: { ...current[side], ...change } }));
  // CSS variables, so the responsive layouts keep their own defaults until a panel is resized or collapsed.
  const column = (side: Side) => layout[side].collapsed ? COLLAPSED : layout[side].width;
  const style: Record<string, string> = {};
  for (const side of ['left', 'right'] as const) { const width = column(side); if (width) style['--' + side] = width + 'px'; }
  return {
    style: style as CSSProperties, layout,
    toggle: (side: Side) => update(side, { collapsed: !layout[side].collapsed }),
    resize: (side: Side, width: number) => update(side, { width: clamp(side, width), collapsed: false }),
  };
}
export type PanelLayout = ReturnType<typeof usePanelLayout>;

const names = (side: Side, es: boolean) => side === 'left' ? (es ? 'Documentos' : 'Artifacts') : (es ? 'Texto fuente' : 'Source text');

/** Collapses or expands one side panel. */
export function PanelToggle({ side, panels, es, controls }: { side: Side; panels: PanelLayout; es: boolean; controls: string }) {
  const collapsed = panels.layout[side].collapsed;
  const name = names(side, es);
  const label = collapsed ? (es ? 'Expandir ' : 'Expand ') + name : (es ? 'Contraer ' : 'Collapse ') + name;
  // The arrow points the way the panel will move.
  const arrow = (side === 'left') === collapsed ? '›' : '‹';
  return <button type="button" className="panel-toggle" aria-expanded={!collapsed} aria-controls={controls} aria-label={label} title={label} onClick={() => panels.toggle(side)}>{arrow}</button>;
}

/** A keyboard- and pointer-operable separator on a panel's inner edge. */
export function PanelResizer({ side, panels, es, panel }: { side: Side; panels: PanelLayout; es: boolean; panel: () => HTMLElement | null }) {
  const drag = useRef<{ x: number; width: number; frame?: number; next?: number } | undefined>(undefined);
  // The drawn width, measured after layout: during render the panel may still have its previous size.
  const [measured, setMeasured] = useState<number>();
  useLayoutEffect(() => {
    const width = panel()?.getBoundingClientRect().width;
    if (width && Math.round(width) !== measured) setMeasured(Math.round(width));
  });
  if (panels.layout[side].collapsed) return null;
  const current = () => panels.layout[side].width ?? measured ?? LIMITS[side].initial;
  // Widening moves away from the panel's own side: right for the left panel, left for the right one.
  const sign = side === 'left' ? 1 : -1;
  function key(event: KeyboardEvent<HTMLDivElement>) {
    const width = current();
    const next = event.key === 'ArrowRight' ? width + sign * STEP : event.key === 'ArrowLeft' ? width - sign * STEP
      : event.key === 'Home' ? LIMITS[side].min : event.key === 'End' ? maxWidth(side) : undefined;
    if (next === undefined) return;
    event.preventDefault();
    panels.resize(side, next);
  }
  function down(event: PointerEvent<HTMLDivElement>) {
    drag.current = { x: event.clientX, width: current() };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  // One layout update per animation frame, not one per pointer event.
  function move(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current) return;
    current.next = current.width + sign * (event.clientX - current.x);
    current.frame ??= requestAnimationFrame(() => { current.frame = undefined; if (current.next !== undefined) panels.resize(side, current.next); });
  }
  return <div role="separator" tabIndex={0} aria-orientation="vertical" className={'panel-resizer ' + side}
    aria-label={(es ? 'Cambiar el ancho de ' : 'Resize ') + names(side, es)}
    aria-valuemin={LIMITS[side].min} aria-valuemax={maxWidth(side)} aria-valuenow={Math.min(maxWidth(side), Math.round(current()))}
    onKeyDown={key} onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = undefined; }} onPointerCancel={() => { drag.current = undefined; }}/>;
}
