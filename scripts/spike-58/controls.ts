import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { analyze } from '../../src/core/analyze.js';
import type { Artifact, Role } from '../../src/core/types.js';

type Case = { id: string; practice: string; role: Role; text: string; expected: string; note: string; spec?: string };
const cases: Case[] = [
  ...[
    ['P2.2','spec','The service MUST handle edge cases.','partial','term without concrete behavior'],
    ['P2.2','spec','El servicio DEBE tratar casos límite.','partial','plural translation'],
    ['P2.2','spec','The service MUST handle boundary cases.','partial','term without concrete behavior'],
    ['P2.2','spec','El servicio DEBE tratar casos extremos.','partial','equivalent without term'],
    ['P2.2','spec','# Boundary\nThe service MUST save records.','missing','heading without exception'],
    ['P2.2','spec','# Boundary\n# Other\nThe service MUST save records.','missing','heading with no body'],
    ['P2.2','spec','| Failure | Response | State | Retry |\n|---|---|---|---|\n| Invalid key | Reject | Unchanged | Never |\n| Provider failure | Return error | Unchanged | Twice |\n| Empty input | Reject | Unchanged | Never |\n| Boundary value | Reject | Unchanged | Never |','partial','keyword table'],
    ['P2.2','spec','| Situation | Response | State | Retry |\n|---|---|---|---|\n| Malformed key | Reject | Unchanged | Never |\n| Upstream stops | Return error | Unchanged | Twice |\n| No input | Reject | Unchanged | Never |\n| Beyond range | Reject | Unchanged | Never |','partial','paraphrased table'],
    ['P2.2','spec','| Fallo | Respuesta | Estado | Reintento |\n|---|---|---|---|\n| Clave inválida | Rechazar | Sin cambios | Nunca |\n| Fallo del proveedor | Devolver error | Sin cambios | Dos veces |\n| Entrada vacía | Rechazar | Sin cambios | Nunca |\n| Valor límite | Rechazar | Sin cambios | Nunca |','partial','Spanish keyword table'],
    ['P2.2','spec','| Situación | Respuesta | Estado | Reintento |\n|---|---|---|---|\n| Clave incorrecta | Rechazar | Sin cambios | Nunca |\n| Servicio externo interrumpido | Devolver error | Sin cambios | Dos veces |\n| Sin entrada | Rechazar | Sin cambios | Nunca |\n| Valor fuera de rango | Rechazar | Sin cambios | Nunca |','partial','Spanish paraphrased table'],
    ['P1.4','spec','| Failure | Response | State | Retry |\n|---|---|---|---|\n| Provider failure | Return error | Unchanged | retry 2 times |','partial','keyword table'],
    ['P1.4','spec','| Situation | Response | State | Attempts |\n|---|---|---|---|\n| Upstream stops | Return error | Unchanged | Two more |','partial','paraphrased table'],
    ['P1.4','spec','| Fallo | Respuesta | Estado | Reintento |\n|---|---|---|---|\n| Fallo del proveedor | Devolver error | Sin cambios | reintento 2 veces |','partial','Spanish keyword table'],
    ['P1.4','spec','| Situación | Respuesta | Estado | Intentos |\n|---|---|---|---|\n| Servicio externo interrumpido | Devolver error | Sin cambios | Dos más |','partial','Spanish paraphrased table'],
    ['P1.4','spec','The provider fails and the service MUST retry twice.','partial','term and behavior'],
    ['P1.4','spec','El proveedor falla y el servicio DEBE reintentar dos veces.','partial','translated behavior'],
    ['P1.4','spec','When the upstream service stops responding the service MUST try twice more.','partial','paraphrase'],
    ['P1.4','spec','Si el servicio externo deja de responder el servicio DEBE intentar dos veces más.','partial','translated paraphrase'],
    ['P1.4','spec','The provider failure MUST be discussed later.','missing','term without handling'],
    ['E3.1','spec','Acceptance criteria: the service MUST reject an invalid key.','partial','explicit criteria'],
    ['E3.1','spec','Criterios de aceptación: el servicio DEBE rechazar una clave inválida.','partial','translated criteria'],
    ['E3.1','spec','Pass condition: the service MUST reject an invalid key.','partial','equivalent wording'],
    ['E3.1','spec','Condición de aprobación: el servicio DEBE rechazar una clave inválida.','partial','translated wording'],
    ['E3.1','spec','Acceptance criteria will be written later.','missing','term only'],
    ['E3.2','spec','Verification method: execute the test suite.','partial','method'],
    ['E3.2','spec','Método de verificación: ejecutar la batería de pruebas.','partial','translated method'],
    ['E3.2','spec','Check by executing the test suite.','partial','equivalent wording'],
    ['E3.2','spec','Comprobar ejecutando la batería de pruebas.','partial','translated wording'],
    ['E3.2','spec','The verification method is undecided.','missing','term only'],
    ['E3.3','spec','Test invalid input by submitting an empty key.','partial','scenario'],
    ['E3.3','spec','Prueba entrada inválida enviando una clave vacía.','partial','translated scenario'],
    ['E3.3','spec','Exercise malformed input by submitting an empty key.','partial','equivalent wording'],
    ['E3.3','spec','Comprobar entrada incorrecta enviando una clave vacía.','partial','translated wording'],
    ['E3.3','spec','Test failure coverage is undecided.','missing','term only'],
    ['E3.4','spec','Complete when the suite passes.','partial','completion criterion'],
    ['E3.4','spec','Terminado cuando pasan las pruebas.','partial','translated criterion'],
    ['E3.4','spec','Finished once the suite passes.','partial','equivalent wording'],
    ['E3.4','spec','Finalizado cuando pasan las pruebas.','partial','translated wording'],
    ['E3.4','spec','The definition of done is undecided.','missing','term only'],
    ['I1.2','spec','FR-1: The service MUST save records.','supported','English identifier'],
    ['I1.2','spec','RF-1: El servicio DEBE guardar registros.','supported','Spanish identifier'],
    ['I1.2','spec','NFR-1: The service MUST save records.','supported','English identifier'],
    ['I1.2','spec','RNF-1: El servicio DEBE guardar registros.','supported','Spanish identifier'],
    ['I1.2','spec','RF-1: El servicio guardará registros.','unknown','unadmitted without recognized modal'],
    ['I1.2','spec','FR-1: The service MUST cite FR-2.','supported','one definition plus a reference'],
    ['C2.3','tasks','- Implement FR-1.','partial','English reference','FR-1: The service MUST save records.'],
    ['C2.3','tasks','- Implementar RF-1.','partial','Spanish reference','RF-1: El servicio DEBE guardar registros.'],
    ['C2.3','tasks','- Implement the record-saving requirement.','partial','equivalent reference','FR-1: The service MUST save records.'],
    ['C2.3','tasks','- Implementar el requisito de guardar registros.','partial','translated reference','RF-1: El servicio DEBE guardar registros.'],
    ['C2.3','tasks','- Ignore FR-1; this task serves another requirement.','missing','mention without link','FR-1: The service MUST save records.'],
    ['C2.3','spec','FR-1: The service MUST save records.','unknown','missing tasks role'],
  ].map(([practice,role,text,expected,note,spec],i) => ({id:`L58-${String(i+1).padStart(2,'0')}`,practice,role:role as Role,text,expected,note,spec})),
];
const artifact = (role: Role, content: string): Artifact => ({ path: `${role}.md`, role, content, framework:'generic', featureId:'f', archived:false });
const hashes: Record<string, string> = JSON.parse(readFileSync(new URL('../../research/58/control-hashes.json', import.meta.url), 'utf8'));
if (Object.keys(hashes).length !== cases.length) throw new Error('Control manifest size mismatch');
for (const c of cases) {
  const artifacts = c.spec ? [artifact('spec',c.spec),artifact(c.role,c.text)] : [artifact(c.role,c.text)];
  const canonical = JSON.stringify(artifacts.map(({path,role,framework,featureId,archived,content}) => ({path,role,framework,featureId,archived,content})));
  const sha256 = createHash('sha256').update(canonical,'utf8').digest('hex');
  if (hashes[c.id] !== sha256) throw new Error(`Control hash mismatch: ${c.id}`);
  const result = await analyze({name:c.id,artifacts});
  const p = result.practices.find(p => p.id===c.practice)!;
  const other = result.practices.filter(p => ['P2.2','P1.4','E3.1','E3.2','E3.3','E3.4','I1.2','C2.3'].includes(p.id)).map(({id,status})=>`${id}:${status}`).join(' ');
  console.log(JSON.stringify({id:c.id,practice:c.practice,sha256,expected:c.expected,observed:p.status,note:c.note,evidence:p.evidence,reason:p.reason,findings:result.findings.map(({practiceId,message,evidence})=>({practiceId,message,evidence})),other}));
}
