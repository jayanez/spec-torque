import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';

export interface ComboOption { value: string; label: string }

/**
 * A filterable single-select combobox (ARIA 1.2 pattern): type to narrow long feature lists, arrows
 * to move, Enter to choose, Escape to close. The input shows the chosen option while closed.
 */
export function FeatureCombobox({ label, placeholder, options, value, onChange, empty }: {
  label: string; placeholder: string; options: ComboOption[]; value: string; onChange: (value: string) => void; empty: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const chosen = options.find(option => option.value === value);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? options.filter(option => option.label.toLowerCase().includes(needle)) : options;
  }, [options, query]);
  function show() { setQuery(''); setActive(Math.max(0, options.findIndex(option => option.value === value))); setOpen(true); }
  function choose(option: ComboOption | undefined) {
    setOpen(false); setQuery('');
    if (option && option.value !== value) onChange(option.value);
  }
  function key(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) { show(); return; }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive(index => matches.length ? (index + step + matches.length) % matches.length : 0);
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      choose(matches[active]);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false); setQuery('');
    }
  }
  const activeId = open && matches[active] ? `${id}-option-${active}` : undefined;
  useEffect(() => { if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' }); }, [activeId]);
  return <div className="field feature-load combobox">
    <label htmlFor={id + '-input'}>{label}</label>
    <input id={id + '-input'} role="combobox" aria-expanded={open} aria-controls={id + '-list'} aria-autocomplete="list"
      aria-activedescendant={activeId} autoComplete="off" spellCheck={false} placeholder={placeholder}
      value={open ? query : chosen?.label ?? ''}
      onFocus={show} onClick={() => { if (!open) show(); }} onBlur={() => { setOpen(false); setQuery(''); }} onKeyDown={key}
      onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true); }}/>
    {/* Mousedown anywhere in the list (padding, scrollbar) must not blur the input and close it. */}
    {open && <ul id={id + '-list'} role="listbox" aria-label={label} className="combobox-list" onMouseDown={event => event.preventDefault()}>
      {matches.length ? matches.map((option, index) => <li key={option.value} id={`${id}-option-${index}`} role="option" aria-selected={index === active}
        className={[index === active ? 'active' : '', option.value === value ? 'chosen' : ''].join(' ').trim() || undefined}
        // Keep focus in the input so blur does not close the list before the choice lands.
        onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(option)}>{option.label}</li>)
        : <li className="combobox-empty" role="presentation">{empty}</li>}
    </ul>}
  </div>;
}
