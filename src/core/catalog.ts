import type { Role } from './types.js';
export const DIMENSIONS = [
  ['E1', 'Unambiguity', 'Expressive'], ['E2', 'Singularity', 'Expressive'], ['E3', 'Verifiability', 'Expressive'],
  ['P1', 'Dependency control', 'Precise'], ['P2', 'Completeness', 'Precise'],
  ['I1', 'Conformance', 'Interpretable'], ['I2', 'Consistency', 'Interpretable'], ['I3', 'Comprehensibility', 'Interpretable'],
  ['C1', 'Scope discipline', 'Compartmentalized'], ['C2', 'Implementation planning', 'Compartmentalized'],
] as const;
export interface PracticeDefinition { id: string; title: string; roles: Role[]; pattern?: RegExp; fix: string }
// H6 (#88): a validation-plan table row with an identifier cell and a test-file reference.
const testFile = /(?:^|[\s|\x60(/])(?:tests?|__tests__)\/[^\s|\x60]+|\btest_[\w-]+\.py\b|\b[\w.-]+(?:_test|_spec|\.test|\.spec)\.\w+\b|\b\w+Tests?\.(?:cs|java|kt|swift)\b/;
const validationRow = new RegExp(String.raw`^(?=\s*\|)(?=.*\|\s*(?:\*\*|\x60)?[A-Z]{1,8}-\d+(?:\*\*|\x60)?\s*\|)(?=.*(?:${testFile.source}))`);
// H106 (#106): a labeled dependency field ("Dependencies: T001, T003") whose value, before the sentence ends, names
// a task or requirement ID. Absent values (none, a dash, empty) do not count.
const dependencyField = /\b(?:dependencies|dependencias|depends on|depende de|blocked by|bloqueado por)\**\s*:\**\s*(?!\**\s*(?:none|ninguna|ninguno|nada|n\/a)\b|\**\s*[—–-])[^.\n]*?\b(?:[A-Z]{1,8}-\d+|T\d+)\b/;
const s: Role[] = ['spec']; const p: Role[] = ['plan']; const t: Role[] = ['tasks'];
const all: Role[] = ['spec', 'plan', 'tasks', 'instructions', 'context'];
export const PRACTICES: PracticeDefinition[] = [
  { id: 'E1.1', title: 'Explicit clarification-seeking', roles: all, pattern: /NEEDS CLARIFICATION|PENDIENTE DE ACLARAR|open questions|decisiones pendientes|no unresolved|sin decisiones pendientes/i, fix: 'Record unresolved decisions as specific questions, or explicitly state that none remain.' },
  { id: 'E1.2', title: 'Quantified and measurable requirements', roles: s, fix: 'State the measurable outcome and operating conditions; ask for unknown values.' },
  { id: 'E1.3', title: 'Bounded vocabulary and enumerations', roles: s, pattern: /glossary|glosario|allowed values|valores permitidos|(?:means|significa):|(?:types|tipos|states|estados):.+[,|]/i, fix: 'Define domain terms and enumerate supported values.' },
  { id: 'E1.4', title: 'Normative and structural consistency', roles: s, fix: 'Use intentional MUST, SHOULD or MAY wording consistently; preserve the chosen obligation.' },
  { id: 'E1.5', title: 'Scope and verification boundaries', roles: s, pattern: /out of scope|non-goals|fuera de alcance|exclusions|exclusiones|MUST NOT|NO DEBE/i, fix: 'State explicit exclusions and the boundaries of verification.' },
  { id: 'E2.1', title: 'Atomic behavioral statements', roles: s, fix: 'Split independent obligations while keeping conditions of the same obligation together.' },
  { id: 'E2.2', title: 'Singular architecture and design facts', roles: p, pattern: /^\s*(?:[-*]|[A-Z]+-\d+|\d+[.)]).*(?:component|module|service|módulo|componente|servicio)/i, fix: 'Record each design fact as a separate statement in the plan.' },
  { id: 'E2.3', title: 'Isolated risks, assumptions and edge cases', roles: all, pattern: /^\s*(?:[-*]|[A-Z]+-\d+).*\b(?:risk|assumption|edge case|riesgo|supuesto|caso límite)\b/i, fix: 'Give each risk, assumption or edge case its own entry.' },
  { id: 'E2.4', title: 'Singular definitions and scenarios', roles: s, pattern: /(?:GIVEN|DADO).+(?:WHEN|CUANDO).+(?:THEN|ENTONCES)|(?:Scenario|Escenario):/i, fix: 'Define one behavior per scenario and one concept per definition.' },
  { id: 'E2.5', title: 'Singular security and privacy properties', roles: s, pattern: /^\s*(?:[-*]|[A-Z]+-\d+).*(?:MUST|SHALL|DEBE).*(?:privacy|personal data|encrypt|secret|privacidad|datos personales|cifra|secreto)/i, fix: 'State applicable security and privacy obligations as separate, testable requirements.' },
  { id: 'E3.1', title: 'Verification criteria and outcomes', roles: s, pattern: /acceptance criteria|criterios de aceptación|success criteria|criterios de éxito|acceptance scenarios?|escenarios? de aceptación|\b(?:given|dado|dada)\b.+\b(?:when|cuando)\b.+\b(?:then|entonces)\b/i, fix: 'Connect each requirement to observable acceptance criteria.' },
  { id: 'E3.2', title: 'Validation methods', roles: all, pattern: new RegExp(String.raw`npm (?:run )?test|pytest|cargo test|dotnet test|python3? -m unittest|go test|node --test|bun test|deno test|make (?:test|check)|mvn test|(?:\.\/)?gradlew? test|verification method|método de verificación|manual check|comprobación manual|${validationRow.source}`, 'i'), fix: 'Describe an executable or manual method for checking each outcome.' },
  { id: 'E3.3', title: 'Verification coverage', roles: all, pattern: /test.*(?:invalid|failure|boundary|edge)|prueba.*(?:inválid|fallo|límite)|(?:GIVEN|DADO).*(?:invalid|failure|inválid|fallo)/i, fix: 'Cover normal, exceptional and boundary scenarios.' },
  { id: 'E3.4', title: 'Verification completion and readiness', roles: all, pattern: /definition of done|exit criteria|ready when|complete when|terminad[oa] cuando|criterios de salida|definición de terminado/i, fix: 'State what evidence is required to consider verification complete.' },
  { id: 'P1.1', title: 'Declared assumptions and dependencies', roles: all, pattern: /(?:dependenc|dependencia|assumption|supuesto).*[:—-].+|no external dependencies|sin dependencias externas/i, fix: 'Declare dependencies and assumptions, including an explicit absence where applicable.' },
  { id: 'P1.2', title: 'Explicit constraints and scope', roles: s, pattern: /constraint|restricción|out of scope|fuera de alcance|MUST NOT|NO DEBE/i, fix: 'Document constraints that affect feasible solutions.' },
  { id: 'P1.3', title: 'Requirement-level dependency traceability', roles: ['plan', 'tasks'], pattern: new RegExp(String.raw`(?:depends on|depende de|requires|requiere).*(?:[A-Z]{1,8}-\d+|T\d+)|${dependencyField.source}`, 'i'), fix: 'Link each dependency or risk to the requirement or task it affects.' },
  { id: 'P1.4', title: 'Dependency verification and failure handling', roles: all, pattern: /(?:dependency|provider|API|dependencia|proveedor).*(?:fail|timeout|unavailable|fall|tiempo|no disponible)|(?:retry|reintento|fallback).*(?:\d|limit|límite)/i, fix: 'State how dependencies are checked and what happens when they fail.' },
  { id: 'P2.1', title: 'Functional and user requirement coverage', roles: s, fix: 'Identify intended actors, capabilities and scope; completeness still needs domain review.' },
  { id: 'P2.2', title: 'Exceptional behavior and scope definition', roles: s, pattern: /invalid|failure|empty|boundary|edge case|inválid|fallo|vacío|caso límite/i, fix: 'Describe relevant invalid input, failures, empty states and exclusions.' },
  { id: 'P2.3', title: 'Operational and quality constraints', roles: s, pattern: /NFR-\d+|non-functional|no funcional|availability|accessibility|observability|disponibilidad|accesibilidad|observabilidad/i, fix: 'Describe applicable operational and non-functional expectations.' },
  { id: 'P2.4', title: 'Dependency and delivery planning', roles: ['plan', 'tasks'], pattern: /milestone|release|delivery|hito|entrega|phase|fase/i, fix: 'Describe a delivery order and its prerequisites.' },
  { id: 'P2.5', title: 'Completeness management', roles: all, pattern: /open questions|decisiones pendientes|NEEDS CLARIFICATION|PENDIENTE DE ACLARAR|no unresolved|sin decisiones pendientes/i, fix: 'Track unanswered questions until a decision and owner are recorded.' },
  { id: 'I1.1', title: 'Standardized document structure', roles: all, pattern: /^#{1,3}\s+\S+/i, fix: 'Organize documents by purpose using recognizable headings.' },
  { id: 'I1.2', title: 'Stable unique requirement identifiers', roles: s, fix: 'Give each requirement a stable, unique identifier.' },
  { id: 'I1.3', title: 'Explicit template declaration', roles: all, pattern: /(?:schema|template|format|plantilla|formato|esquema)\s*[:=]\s*\S+/i, fix: 'Declare the document convention and validate it.' },
  { id: 'I2.1', title: 'Shared terminology', roles: all, pattern: /glossary|glosario|terminology|terminología|domain terms|términos del dominio/i, fix: 'Use a shared glossary and consistent domain names.' },
  { id: 'I2.2', title: 'Uniform identifiers and notation', roles: s, fix: 'Keep identifier syntax and references consistent.' },
  { id: 'I2.3', title: 'Cross-artifact alignment', roles: ['spec', 'plan', 'tasks'], fix: 'Reference requirement identifiers from plans and tasks, then inspect semantic agreement.' },
  { id: 'I2.4', title: 'Consistent organization', roles: ['spec', 'plan', 'tasks'], pattern: /^#{1,3}\s+(?:Overview|Purpose|Requirements|Verification|Resumen|Objetivo|Requisitos|Verificación)/i, fix: 'Use a predictable organization across related artifacts.' },
  { id: 'I3.1', title: 'Structured document organization', roles: all, pattern: /^#{1,3}\s+\S+/i, fix: 'Group information in navigable sections with meaningful headings.' },
  { id: 'I3.2', title: 'Cross-document navigation', roles: ['spec', 'plan', 'tasks'], pattern: /\[[^\]]+\]\([^)]*\.md(?:#[^)]*)?\)/i, fix: 'Link related specifications, plans and tasks.' },
  { id: 'I3.3', title: 'Comprehension support', roles: s, pattern: /purpose|problem statement|example|user story|objetivo|propósito|problema|ejemplo|historia de usuario/i, fix: 'Explain the product purpose and include a concrete example.' },
  { id: 'C1.1', title: 'Behavioral product specification', roles: s, fix: 'State required behavior from the user or system perspective.' },
  { id: 'C1.2', title: 'Separation of product and project concerns', roles: ['spec', 'plan', 'tasks'], fix: 'Keep behavior identifiable and place implementation choices in supporting artifacts.' },
  { id: 'C1.3', title: 'Traceable transition to implementation', roles: ['spec', 'tasks'], fix: 'Connect tasks to the requirements they implement.' },
  { id: 'C2.1', title: 'Technical context and foundations', roles: p, pattern: /technical context|architecture|tech stack|contexto técnico|arquitectura|tecnologías/i, fix: 'Document the technical context and required compatibility in the plan.' },
  { id: 'C2.2', title: 'Task organization', roles: t, pattern: /^\s*[-*]\s+\[[ x]\]\s+\S+/i, fix: 'Break delivery into individually checkable tasks.' },
  { id: 'C2.3', title: 'Requirements-to-implementation traceability', roles: ['spec', 'tasks'], fix: 'Record the requirement IDs served by each task; links alone do not prove implementation.' },
  { id: 'C2.4', title: 'Data models and evolution', roles: p, pattern: /data model|interface\s+\w+|schema|migration|modelo de datos|contrato|migración/i, fix: 'Describe relevant data or interface contracts and evolution requirements.' },
];
