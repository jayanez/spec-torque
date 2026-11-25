/**
 * Names the other language in the current view's language ("Spanish" in English, "Inglés" in
 * Spanish). The button carries that language itself, so label and accessible name stay consistent on
 * pages that do not set the document language.
 */
export function LanguageToggle({ es, onToggle, className }: { es: boolean; onToggle: () => void; className?: string }) {
  return <button type="button" className={className} lang={es ? 'es' : 'en'} aria-label={es ? 'Cambiar a inglés' : 'Switch to Spanish'} onClick={onToggle}>{es ? 'Inglés' : 'Spanish'}</button>;
}
