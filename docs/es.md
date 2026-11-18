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

`npm run prepare:codex -- es` crea un proyecto desechable en `.spec-torque/codex-es`, con MCP y las tres skills locales. No sobrescribe un proyecto existente ni modifica tu perfil global. Ábrelo en Codex y verifica la conexión. Exporta los cambios que quieras conservar antes de borrar esa carpeta.

`npm run qualify:codex` verifica el app-server real y el panel común sin iniciar un turno de modelo. Para VS Code, genera el VSIX con `npm run package:vscode` y configura `VSCODE_EXECUTABLE` antes de ejecutar `npm run test:vscode` y su variante `-- --restricted`. Se utilizan perfiles aislados. Consulta [los pasos, resultados y límites](qualification.md).

Los refinamientos conservan literalmente las cláusulas negativas detectadas, salvo espacios. Reformular una prohibición o exclusión exige una decisión explícita; el rechazo conservador no significa que el sistema comprenda toda la semántica del texto.

## Continuación en otros clientes

Consulta los [recorridos de Claude, OpenCode y Pi](host-common-qualification.md).

En Claude Code, genera el paquete con `npm run package:integrations` y
`npm run package:claude`; el script imprime el SHA-256 del ZIP determinista.
Cárgalo en tu proyecto con `claude --plugin-dir /ruta/absoluta/spectorque-claude-0.1.0.zip`
y ejecuta `/spectorque`. El panel usa el `node` del `PATH` (Node 22.20+).
Si el workspace tiene varias funcionalidades, el panel ofrece **All documents** o
una funcionalidad concreta, como en OpenCode. Una propuesta se rechaza si el
archivo ya no coincide con el hash evaluado.
**Open common workbench** inicia el panel común en loopback para el workspace de la
sesión, copia su dirección e indica el alcance que hay que seleccionar; se detiene
al cerrarlo, al cerrar el panel o al terminar la sesión. Pulsarlo mientras arranca
cancela ese arranque.
`npm run qualify:claude -- "$(which claude)" artifacts/spectorque-claude-0.1.0.zip <node_modules>`
recorre el ZIP instalado en un cliente real (EN/ES, alcance, rechazo, aplicación,
fuente obsoleta, traspaso, errores e instalación por marketplace) sin enviar
prompts al modelo.
También comprueba que el host conecta el servidor MCP del plugin y lista las tres
skills, y llama a las seis herramientas MCP en EN/ES sin escribir archivos. El uso
por Claude (skill `spec-review` y herramientas MCP) se comprueba aparte con un
turno de modelo por idioma; consulta la guía de cualificación.
En Claude Desktop (Claude Code 2.1.325 integrado), instala el ZIP desde un
marketplace local con ámbito de proyecto, abre una sesión del Code tab en esa
carpeta y escribe `/spectorque` en el cuadro de mensajes: el primer mensaje de
una sesión nueva va al modelo, no se ejecuta como comando.
`claude plugin validate` solo valida carpetas: valida una copia extraída.

En OpenCode 2.1.4, extrae el ZIP de SpecTorque y añade su directorio a
`plugins` en el `cli.json` del perfil CLI. En una sesión existente del
workspace local, ejecuta `/spectorque`. Con el panel enfocado, usa **s**
para elegir alcance, **e** para ver la ruta, línea y texto fuente, **r** para
revisar un cambio, **w** para obtener la URL del panel común y **q** para
cerrar el panel. En el navegador, carga el workspace y selecciona el mismo
alcance. Para retirar el plugin, quita la entrada y reinicia el cliente.
Consulta la [instalación y sus límites](integrations.md#opencode).
`npm run qualify:handoff -- /ruta/absoluta/al/proyecto-de-prueba` comprueba el
traspaso al panel común y las exportaciones después del cambio nativo. Esa prueba
no automatiza el cliente ni sustituye su aceptación, la de otros sistemas o la
revisión humana de accesibilidad.

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
