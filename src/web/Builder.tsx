import { useLayoutEffect, useRef, useState } from 'react';
import { buildArtifacts } from '../core/builder.js';
import type { ArtifactSet, BuilderAnswers, Language } from '../core/types.js';
function emptyAnswers(language: Language): BuilderAnswers {
  return { name: '', purpose: '', actors: '', behavior: '', success: '', exclusions: '', dependencies: '', failures: '', privacy: '', language };
}

export function Builder({ language, active, onCreate, onDraftChange }: {
  language: Language;
  active: boolean;
  onCreate: (set: ArtifactSet) => boolean;
  onDraftChange: (dirty: boolean) => void;
}) {
  const es = language === 'es';
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() => emptyAnswers(language));
  const [error, setError] = useState('');
  const stepHeading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => { if (active) stepHeading.current?.focus(); }, [step, active]);
  const fields: [keyof BuilderAnswers, string, string][][] = [
    [['name', es ? 'Nombre del proyecto' : 'Project name', 'Room booking'], ['purpose', es ? '¿Qué problema resuelve?' : 'What problem does it solve?', es ? 'Describe el resultado que necesita el usuario.' : 'Describe the outcome the user needs.'], ['actors', es ? '¿Quién lo utiliza?' : 'Who uses it?', es ? 'Actores y permisos conocidos.' : 'Actors and known permissions.']],
    [['behavior', es ? '¿Qué debe hacer?' : 'What must it do?', es ? 'Un comportamiento por línea. Usa DEBE, DEBERÍA o PUEDE de forma intencional.' : 'One behavior per line. Use MUST, SHOULD or MAY intentionally.']],
    [['exclusions', es ? '¿Qué queda fuera?' : 'What is outside the scope?', es ? 'Límites y exclusiones explícitos.' : 'Explicit boundaries and exclusions.'], ['privacy', es ? '¿Qué datos y restricciones de seguridad existen?' : 'What data and security constraints apply?', es ? 'Indica también si no son aplicables y por qué.' : 'Also state if none apply, and why.']],
    [['success', es ? '¿Cómo se comprobará?' : 'How will it be verified?', es ? 'Criterios observables por requisito; aporta solo valores decididos.' : 'Observable criteria per requirement; use only decided values.'], ['dependencies', es ? '¿De qué depende?' : 'What does it depend on?', es ? 'Supuestos, servicios y orden necesario.' : 'Assumptions, services and prerequisites.'], ['failures', es ? '¿Qué ocurre cuando falla?' : 'What happens on failure?', es ? 'Datos inválidos, límites y dependencias no disponibles.' : 'Invalid input, limits and unavailable dependencies.']],
  ];
  const steps = es ? ['Propósito', 'Comportamiento', 'Límites', 'Verificación'] : ['Purpose', 'Behavior', 'Boundaries', 'Verification'];
  function changeField(key: keyof BuilderAnswers, value: string) {
    const next = { ...form, [key]: value };
    setForm(next);
    onDraftChange(Object.keys(next).some(field => field !== 'language' && Boolean(next[field as keyof BuilderAnswers])));
  }
  function create() {
    try {
      const artifacts = buildArtifacts({ ...form, language });
      if (onCreate({ name: form.name, artifacts })) {
        setForm(emptyAnswers(language)); setStep(0); setError(''); onDraftChange(false);
      }
    } catch (e) { setError((e as Error).message); }
  }
  return <section className="builder"><div className="section-heading"><div><h2>{es ? 'De una idea a documentos revisables' : 'From intent to reviewable artifacts'}</h2><p>{es ? 'Lo desconocido se convierte en una pregunta, no en una suposición.' : 'Unknowns become questions, not invented product decisions.'}</p></div><span className="pill">{step + 1} / 4</span></div>
    <nav className="steps" aria-label={es ? 'Pasos del asistente' : 'Builder steps'}>{steps.map((s, i) => <button key={s} aria-current={step === i ? 'step' : undefined} className={step === i ? 'active' : ''} onClick={() => setStep(i)}>{i + 1}. {s}</button>)}</nav>
    <h3 ref={stepHeading} tabIndex={-1}>{steps[step]}</h3>
    {fields[step].map(([key, label, placeholder]) => <label className="field" key={key}><span>{label}</span>{key === 'name' ? <input value={form[key]} placeholder={placeholder} maxLength={120} onChange={e => changeField(key, e.target.value)}/> : <textarea value={form[key]} placeholder={placeholder} rows={key === 'behavior' ? 8 : 3} maxLength={20000} onChange={e => changeField(key, e.target.value)}/>}</label>)}
    {step === 3 && /api|service|servicio|network|red\b/i.test(form.behavior + form.purpose) && <p className="callout">{es ? 'Concreta qué ocurre ante un timeout y quién decide los reintentos.' : 'Clarify timeout behavior and who decides retry limits.'}</p>}
    {error && <p role="alert" className="error">{error}</p>}
    <div className="actions"><button disabled={!step} onClick={() => setStep(step - 1)}>{es ? 'Anterior' : 'Back'}</button>{step < 3 ? <button className="primary" onClick={() => setStep(step + 1)}>{es ? 'Siguiente' : 'Continue'}</button> : <button className="primary" onClick={create}>{es ? 'Crear y analizar borrador' : 'Create and analyze draft'}</button>}</div>
  </section>;
}
