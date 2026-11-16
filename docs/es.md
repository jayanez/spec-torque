# Guía rápida

SpecTorque ayuda a crear, revisar y refinar especificaciones antes de entregarlas a un agente. El análisis básico funciona en local, sin GPU ni credenciales de IA.

Con Node.js 22.20 o superior, instala desde el repositorio con `npm ci --ignore-scripts` y `npm run build`. Ejecuta `node dist/cli.js serve --root /ruta/absoluta/a/tu/proyecto` y abre la dirección local mostrada.

1. Prueba una muestra, crea una spec con el asistente o importa tus documentos.
2. Revisa las prácticas, sus evidencias y las decisiones pendientes. Selecciona una funcionalidad cuando haya varias.
3. Selecciona un hallazgo. Propón una redacción o solicita una aclaración. El modelo del agente puede preparar la propuesta; un proveedor adicional es opcional.
4. Revisa la diferencia antes de aceptar. Las cifras, obligaciones e identificadores existentes se conservan y los cambios concurrentes se rechazan.
5. Exporta los documentos y el informe. La edición directa y el historial viven en memoria durante la sesión. Guarda o exporta antes de cerrar.

Las puntuaciones son una ayuda heurística: no certifican la corrección de la spec ni predicen defectos. «Desconocido» indica evidencia insuficiente; «no aplicable» requiere justificación. Consulta [el estado real de las integraciones](compatibility.md) y [su instalación](integrations.md).

## Entorno y verificación reproducible

Para desarrollar y verificar usa Node 22.20.0, fijado en `.nvmrc`. `npm run check` comprueba el ejecutable efectivo. Instala los navegadores dentro del proyecto con `npm run browsers:install` y ejecuta `npm run test:browser`; conserva los fallos y límites en el informe, sin convertirlos en aceptación.

`npm run prepare:codex -- es` crea un proyecto desechable en `.spectorque/codex-es`, con MCP y las tres skills locales. No sobrescribe un proyecto existente ni modifica tu perfil global. Ábrelo en Codex y verifica la conexión. Exporta los cambios que quieras conservar antes de borrar esa carpeta.

`npm run qualify:codex` verifica el app-server real y el panel común sin iniciar un turno de modelo. Para VS Code, genera el VSIX con `npm run package:vscode` y configura `VSCODE_EXECUTABLE` antes de ejecutar `npm run test:vscode` y su variante `-- --restricted`. Se utilizan perfiles aislados. Consulta [los pasos, resultados y límites](qualification.md).

Los refinamientos conservan literalmente las cláusulas negativas detectadas, salvo espacios. Reformular una prohibición o exclusión exige una decisión explícita; el rechazo conservador no significa que el sistema comprenda toda la semántica del texto.

## Gates de corrección

Las operaciones de aplicar, deshacer y guardar bloquean temporalmente las mutaciones; las respuestas tardías no sustituyen el documento activo. Las propuestas modifican una sola línea y conservan exactamente los identificadores. Los cuerpos HTTP superiores a 6 MB se rechazan con 413. La detección de contradicciones sigue siendo acotada, no semántica general.

Consulta [las fases, evidencias y condiciones de parada](corrective-gates.md). G5 no se cierra hasta disponer de la revisión independiente final y de los resultados técnicos de la revisión concreta; las aceptaciones de los cuatro agentes siguen siendo independientes.

## Reconocimiento normativo EN/ES

El motor 0.1.1 reconoce palabras normativas completas, incluidas `DEBEN`, `DEBERÁ`,
`DEBERÁN`, `DEBERÍA`, `DEBERÍAN` y `PUEDEN`, con o sin identificador de requisito.
Conserva la diferencia entre obligación, recomendación y permiso. Los nuevos casos
reconocidos pueden cambiar los hallazgos y sus evidencias; no cambia la política de
puntuación ni convierte desconocidos en resultados aprobados. Consulta los
[ejemplos y límites](normative-recognition.md). La calibración independiente y el
resto del corpus siguen pendientes en #2.

## Corpus de formatos

El [corpus original de formatos](format-corpus.md) incorpora catorce casos EN/ES
con rutas anidadas, archivos archivados e identificadores compartidos. Verifica
las pistas de clasificación documentadas; no demuestra compatibilidad completa
con los generadores ni calibración científica. Las variantes ambiguas y las
etiquetas independientes siguen pendientes en #2.
