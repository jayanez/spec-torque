import type { Language } from '../core/types.js';

// Spanish display names for the engine's fixed English catalog. Presentation only: assessments,
// reports and exports keep the canonical English titles.
const dimensions: Record<string, string> = {
  E1: 'Sin ambigüedad', E2: 'Singularidad', E3: 'Verificabilidad', P1: 'Control de dependencias', P2: 'Completitud',
  I1: 'Conformidad', I2: 'Coherencia', I3: 'Comprensibilidad', C1: 'Disciplina de alcance', C2: 'Planificación de la implementación',
};
const practices: Record<string, string> = {
  'E1.1': 'Búsqueda explícita de aclaraciones', 'E1.2': 'Requisitos cuantificados y medibles', 'E1.3': 'Vocabulario y enumeraciones acotados',
  'E1.4': 'Coherencia normativa y estructural', 'E1.5': 'Límites de alcance y de verificación', 'E2.1': 'Enunciados de comportamiento atómicos',
  'E2.2': 'Hechos de arquitectura y diseño singulares', 'E2.3': 'Riesgos, supuestos y casos límite aislados', 'E2.4': 'Definiciones y escenarios singulares',
  'E2.5': 'Propiedades de seguridad y privacidad singulares', 'E3.1': 'Criterios y resultados de verificación', 'E3.2': 'Métodos de validación',
  'E3.3': 'Cobertura de la verificación', 'E3.4': 'Cierre y preparación de la verificación', 'P1.1': 'Supuestos y dependencias declarados',
  'P1.2': 'Restricciones y alcance explícitos', 'P1.3': 'Trazabilidad de dependencias por requisito', 'P1.4': 'Verificación de dependencias y gestión de fallos',
  'P2.1': 'Cobertura de requisitos funcionales y de usuario', 'P2.2': 'Comportamiento excepcional y definición del alcance', 'P2.3': 'Restricciones operativas y de calidad',
  'P2.4': 'Planificación de dependencias y entregas', 'P2.5': 'Gestión de la completitud', 'I1.1': 'Estructura de documento estandarizada',
  'I1.2': 'Identificadores de requisito estables y únicos', 'I1.3': 'Declaración explícita de plantilla', 'I2.1': 'Terminología compartida',
  'I2.2': 'Identificadores y notación uniformes', 'I2.3': 'Alineación entre documentos', 'I2.4': 'Organización coherente',
  'I3.1': 'Organización estructurada de los documentos', 'I3.2': 'Navegación entre documentos', 'I3.3': 'Apoyo a la comprensión',
  'C1.1': 'Especificación del comportamiento del producto', 'C1.2': 'Separación entre producto y proyecto', 'C1.3': 'Transición trazable a la implementación',
  'C2.1': 'Contexto técnico y fundamentos', 'C2.2': 'Organización de tareas', 'C2.3': 'Trazabilidad de requisitos a implementación', 'C2.4': 'Modelos de datos y evolución',
};
const statuses: Record<string, [string, string]> = {
  supported: ['supported', 'cubierta'], partial: ['partial', 'parcial'], missing: ['missing', 'ausente'],
  unknown: ['unknown', 'desconocida'], not_applicable: ['not applicable', 'no aplicable'],
};
const roles: Record<string, string> = { spec: 'especificación', plan: 'plan', tasks: 'tareas', instructions: 'instrucciones', context: 'contexto' };

const pick = (language: Language, english: string, spanish: string | undefined) => language === 'es' && spanish ? spanish : english;
export const dimensionTitle = (language: Language, id: string, english: string) => pick(language, english, dimensions[id]);
export const practiceTitle = (language: Language, id: string, english: string) => pick(language, english, practices[id]);
export const statusLabel = (language: Language, status: string) => statuses[status]?.[language === 'es' ? 1 : 0] ?? status.replace('_', ' ');
export const roleLabel = (language: Language, role: string) => pick(language, role, roles[role]);
/** "1 finding" / "2 findings", "1 hallazgo" / "2 hallazgos". */
export const findingCount = (language: Language, n: number) => `${n} ${language === 'es' ? (n === 1 ? 'hallazgo' : 'hallazgos') : (n === 1 ? 'finding' : 'findings')}`;
