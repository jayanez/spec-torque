/**
 * Names the other language in that language. Each part of the accessible name carries its own
 * language, so screen readers voice "Español" in Spanish and the hint in the page language.
 */
export function LanguageToggle({ es, onToggle, className }: { es: boolean; onToggle: () => void; className?: string }) {
  return <button type="button" className={className} onClick={onToggle}>
    <span lang={es ? 'en' : 'es'}>{es ? 'English' : 'Español'}</span><span className="sr-only">{es ? ' · Cambiar a inglés' : ' · Switch to Spanish'}</span>
  </button>;
}
