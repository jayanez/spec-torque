import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyLine, classifyLines, headingChain, mentionRanges } from '../src/core/admission.js';
import { classifyArtifact } from '../src/core/artifacts.js';
import type { LineKind } from '../src/core/types.js';

/** Kinds of a spec document, one per line. */
const kinds = (...lines: string[]): LineKind[] => classifyLines(classifyArtifact('specs/001/spec.md', lines.join('\n')));
const last = (...lines: string[]) => kinds(...lines).at(-1);

test('rule 1: structure is never a requirement', () => {
  assert.deepEqual(kinds('# The system MUST start.', '> The system MUST start.', '', '<!-- The system MUST start. -->', '```', 'The system MUST start.', '```'),
    ['other', 'other', 'other', 'other', 'other', 'other', 'other']);
  assert.equal(last('<!--', 'FR-001: El sistema DEBE iniciar.', '-->', 'FR-002: El sistema DEBE iniciar.'), 'requirement');
  assert.deepEqual(kinds('<!--', 'The system MUST start.', '-->').slice(1, 2), ['other']);
});

test('rule 2: a change-log section beats a modal', () => {
  assert.equal(last('## Change log', '- Changed MUST to SHOULD in FR-004.'), 'other');
  assert.equal(last('## Historial de cambios', '- El sistema DEBE guardar el historial.'), 'other');
  assert.equal(last('## Requirements', '### History', '- The system MUST log.'), 'other');
  assert.equal(last('## Requirements', '- The system MUST log.'), 'requirement');
});

test('rule 3: a question beats a modal, an ID and a scenario step', () => {
  assert.equal(last('C-2: ¿Aplica a invitados?'), 'other');
  assert.equal(last('- Should the system MUST lock accounts?'), 'other');
  assert.equal(last('- FR-001: Must guests log in?'), 'other');
  assert.equal(last('¿El sistema DEBE guardar el historial'), 'other');
  assert.equal(last('WHEN a user fails 4 times, THEN the system SHALL lock the account?'), 'other');
});

test('rule 4: a modal outside mentions is a requirement, EN and ES', () => {
  assert.equal(last('The system MUST lock the account.'), 'requirement');
  assert.equal(last('El sistema DEBE bloquear la cuenta.'), 'requirement');
  assert.equal(last('The word "MUST" is reserved.'), 'other');
  assert.equal(last('Use `MUST` for obligations.'), 'other');
  assert.equal(last('La palabra «DEBE» está reservada.'), 'other');
  assert.equal(last('The app MUST reject `SHALL`.'), 'requirement');
  assert.equal(last('The review ends in May 2026.'), 'other');
  assert.equal(last('- THEN the system SHALL lock the account'), 'requirement');
  assert.equal(last('- DADO que el usuario DEBE autenticarse'), 'requirement');
});

test('rule 5: scenario steps and criteria are acceptance', () => {
  assert.equal(last('- THEN the account is locked'), 'acceptance');
  assert.equal(last('- GIVEN a user with 4 failed attempts'), 'acceptance');
  assert.equal(last('  **WHEN** the user submits'), 'acceptance');
  assert.equal(last('- ENTONCES la cuenta queda bloqueada'), 'acceptance');
  assert.equal(last('- Y el usuario recibe un aviso'), 'acceptance');
  assert.equal(last('- And the user is notified'), 'acceptance');
  assert.equal(last('and so on'), 'other');
  assert.equal(last('SC-001: 95% of users finish checkout in under 2 minutes.'), 'acceptance');
  assert.equal(last('## Acceptance criteria', '- Login takes under 2 seconds'), 'acceptance');
  assert.equal(last('## Criterios de aceptación', '1. El acceso tarda menos de 2 segundos'), 'acceptance');
  assert.equal(last('## Acceptance criteria', 'Login takes under 2 seconds'), 'other');
});

test('rule 6: an ID in defining position is a requirement, a cross-reference is not', () => {
  assert.equal(last('FR-001: Users can export data.'), 'requirement');
  assert.equal(last('- **RF-002** Los usuarios exportan datos.'), 'requirement');
  assert.equal(last('| NFR-003 | Latency under 2 s |'), 'requirement');
  assert.equal(last('1. REQ-4 Backups are nightly.'), 'requirement');
  assert.equal(last('- [ ] R-12 Rotate keys.'), 'requirement');
  assert.equal(last('See FR-003 for the full rule.'), 'other');
  assert.equal(last('Ver RF-003 para la regla completa.'), 'other');
});

test('rule 7: bullets under a requirements heading that start with a verb or a negation', () => {
  assert.equal(last('## Requirements', '- Validate the email address.'), 'requirement');
  assert.equal(last('## Requisitos funcionales', '- Validar el correo electrónico.'), 'requirement');
  assert.equal(last('## Requirements', '- No schema change to the events table.'), 'requirement');
  assert.equal(last('## Restricciones', '- Sin cambios en la tabla de eventos.'), 'requirement');
  assert.equal(last('## Requirements', '- The list is sorted by date.'), 'other');
  assert.equal(last('## Requirements', '- Each user has one profile.'), 'other');
  assert.equal(last('## Requirements', '- El usuario tiene un perfil.'), 'other');
  assert.equal(last('## Requirements', '- Authentication via OAuth.'), 'other');
  assert.equal(last('## Requirements', 'Validate the email address.'), 'other');
  assert.equal(last('## Overview', '- Validate the email address.'), 'other');
  assert.equal(last('## Requirements', '- FR-9 Validate input.'), 'requirement');
});

test('rule 8: a system subject with a future or capability verb, anywhere', () => {
  assert.equal(last('## Overview', 'The system will store the audit trail.'), 'requirement');
  assert.equal(last('## Overview', 'The system can detect duplicate entries.'), 'requirement');
  assert.equal(last('## Overview', 'EL SISTEMA guardará el historial de cambios.'), 'requirement');
  assert.equal(last('## Overview', 'La aplicación permite exportar datos.'), 'requirement');
  assert.equal(last('## Overview', 'The service is able to retry.'), 'requirement');
  assert.equal(last('## Overview', 'The system stores data.'), 'other');
  assert.equal(last('## Overview', 'The user will see a message.'), 'other');
});

test('rule 9 and precedence between rules', () => {
  assert.equal(last('Rationale: users asked for it.'), 'other');
  // modal beats acceptance, change log beats a defining ID, a question beats the requirements section.
  assert.equal(last('## Acceptance criteria', '- The system SHALL lock the account.'), 'requirement');
  assert.equal(last('## Changelog', 'FR-004: The system will lock.'), 'other');
  assert.equal(last('## Requirements', '- Validate input?'), 'other');
  // a scenario step is acceptance before a defining ID
  assert.equal(last('GIVEN FR-004 holds'), 'acceptance');
});

test('only spec artifacts use the grammar; plans and tasks keep the 0.1.4 rule', () => {
  const read = (path: string, content: string) => classifyLines(classifyArtifact(path, content));
  assert.deepEqual(read('specs/001/plan.md', 'Validate the email.\nThe system will store it.\nTraces FR-001 and MUST hold.'), ['other', 'other', 'requirement']);
  assert.deepEqual(read('specs/001/tasks.md', 'GIVEN FR-001 MUST hold'), ['other']);
  assert.deepEqual(read('specs/001/tasks.md', '- [ ] T1 See FR-001'), ['requirement']);
});

test('the heading chain pairs fences and nests levels', () => {
  const lines = ['# A', '## B', '```', '## not a heading', '```', '### C', '## D', 'text'];
  assert.deepEqual(headingChain(lines, 8), ['A', 'D']);
  assert.deepEqual(headingChain(lines, 7), ['A', 'B', 'C']);
  assert.deepEqual(headingChain(lines, 4), ['A', 'B']);
  assert.deepEqual(headingChain(lines, 1), []);
});

test('mention ranges cover quotes, guillemets and keyword-only code spans', () => {
  assert.deepEqual(mentionRanges('a "MUST" b'), [[2, 8]]);
  assert.deepEqual(mentionRanges('a «DEBE» b'), [[2, 8]]);
  assert.deepEqual(mentionRanges('a `MUST` b'), [[2, 8]]);
  assert.deepEqual(mentionRanges('a `must start` b'), []);
  assert.deepEqual(mentionRanges("a 'MUST' b"), []);
});

test('classifyLine takes its context from the caller', () => {
  assert.equal(classifyLine('- Validate input.', { chain: ['Requirements'], fenced: false, comment: false }), 'requirement');
  assert.equal(classifyLine('- Validate input.', { chain: ['Requirements'], fenced: true, comment: false }), 'other');
  assert.equal(classifyLine('- Validate input.', { chain: ['Requirements'], fenced: false, comment: true }), 'other');
});

test('DEV round 1: innermost requirements heading, quoted subjects and bare prose openers', () => {
  assert.equal(last('## Requirements', '### Glossary', '- Define the term once.'), 'other');
  assert.equal(last('## Requirements', '### Functional requirements', '- Define the term once.'), 'requirement');
  assert.equal(last('## Overview', 'Template: "User or system can do X".'), 'other');
  assert.equal(last('## Overview', 'The system can do X, as in "the system can".'), 'requirement');
  assert.equal(last('When the product is stable it means a strict contract.'), 'other');
  assert.equal(last('WHEN the product is stable'), 'acceptance');
  assert.equal(last('- When the product is stable'), 'acceptance');
});
