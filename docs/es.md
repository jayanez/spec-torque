# Guía rápida

SpecTorque ayuda a crear, revisar y refinar especificaciones antes de entregarlas a un agente. El análisis básico funciona en local, sin GPU ni credenciales de IA.

## Pruébalo con un comando

Desde la raíz de un repositorio git con tus specs (Node.js 22.20 o superior):

```bash
npx -y spectorque serve --root .
```

Abre el workbench en una dirección local y analiza ese árbol de trabajo en tu máquina, sin cuenta, modelo ni telemetría. Para dar a tu agente las seis herramientas de solo lectura, añade el servidor MCP en una línea: `claude mcp add spectorque -- npx -y spectorque mcp` o `codex mcp add spectorque -- npx -y spectorque mcp`. Otros clientes MCP usan el mismo comando como servidor stdio. Los paneles nativos llegan con el plugin de cada plataforma, en la tabla siguiente.

## Instalación

SpecTorque 0.3.0 es una **versión preliminar**, publicada en el canal `next` hasta superar el [gate de candidato estable](pilot-operations.md#stable-candidate-gate). Al ser la primera versión en npm también es `latest`, así que `npm i spectorque` la instala. Todas las rutas usan el mismo motor local y necesitan Node.js 22.20 o superior en el `PATH`.

| Plataforma | Instalación | Después |
|---|---|---|
| Claude Code (CLI y pestaña Code de Desktop) | `claude plugin marketplace add jayanez/spec-torque` y `claude plugin install spectorque@spectorque` | `/spectorque` |
| Codex (CLI y Desktop) | `codex plugin marketplace add jayanez/spec-torque` y `codex plugin add spectorque@spectorque` | [Vincula el worktree con `$spec-setup`](../integrations/codex/README.md#install-and-bind-a-worktree) y abre otro chat local para `$spec-view` (visor integrado: solo Desktop) |
| OpenCode | Añade `"opencode-spectorque@0.3.0"` a `plugins` en `~/.config/opencode/cli.json` | `/spectorque` en una sesión |
| Pi y ThinkRail | `pi install npm:pi-spectorque@0.3.0` | `/spectorque` |
| VS Code | Busca **SpecTorque** y elige *Switch to Pre-Release*, o `code --install-extension jayanez.spectorque --pre-release` | **SpecTorque: Open Specification Workbench** |
| Cursor, Windsurf, VSCodium | El VSIX de la [release de GitHub](https://github.com/jayanez/spec-torque/releases) (*Install from VSIX…*); en Open VSX cuando se apruebe el namespace `jayanez` (instalable, aún sin cualificar) | El mismo comando |
| Navegador, CLI o cualquier cliente MCP | `npx -y spectorque@0.3.0 serve --root .` o `npx -y spectorque@0.3.0 mcp`; en el [registro MCP](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.jayanez/spectorque) como `io.github.jayanez/spectorque` | Abre la dirección local mostrada |

**Dónde está publicado:** [npm](https://www.npmjs.com/package/spectorque) (los cinco paquetes), [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=jayanez.spectorque) (pre-release), el registro MCP, los catálogos de Claude Code y Codex de este repositorio y la [release de GitHub](https://github.com/jayanez/spec-torque/releases/tag/v0.3.0). Las galerías de Pi y ThinkRail listan `pi-spectorque` desde npm. Open VSX llegará cuando se apruebe su namespace.

Los recursos de cada versión para instalaciones sin conexión y la política de versiones están en [releases](releases.md). Desde el código fuente, con Node.js 22.20 o superior, ejecuta `npm ci --ignore-scripts` y `npm run build`, después `node dist/cli.js serve --root /ruta/absoluta/a/tu/proyecto`, y abre la dirección local mostrada.

## Uso

1. Prueba una muestra, crea una spec con el asistente o importa tus documentos.
2. Revisa las prácticas, sus evidencias y las decisiones pendientes. Selecciona una funcionalidad cuando haya varias.
3. Selecciona un hallazgo. Propón una redacción o solicita una aclaración. El modelo del agente puede preparar la propuesta; un proveedor adicional es opcional.
4. Revisa la diferencia antes de aceptar. Las cifras, obligaciones e identificadores existentes se conservan y los cambios concurrentes se rechazan.
5. Exporta los documentos y el informe. La edición directa y el historial viven en memoria durante la sesión. Guarda o exporta antes de cerrar.

Las puntuaciones son una ayuda heurística: no certifican la corrección de la spec ni predicen defectos. «Desconocido» indica evidencia insuficiente; «no aplicable» requiere justificación. Consulta [el estado real de las integraciones](compatibility.md) y [su instalación](integrations.md).

## Cómo funciona el motor

Un único motor determinista en TypeScript da servicio al CLI, al servidor MCP, al banco de trabajo y a todos los hosts. Descubre los documentos del worktree sin leerlos (las plantillas de `.specify/` y `.kittify/` no cuentan) y lee solo el alcance elegido; clasifica cada archivo (spec, plan, tareas, instrucciones o contexto, como `quickstart.md` y las `checklists/` de Spec Kit); reconoce palabras normativas completas en inglés y español; cuenta un identificador como requisito solo en posición de definición; resuelve referencias dentro del espacio de nombres de la funcionalidad; evalúa las 40 prácticas con evidencia exacta de ruta, línea y texto; y puntúa diez dimensiones de 0 a 3, sin total mientras alguna sea desconocida. Las propuestas cambian una línea, conservan identificadores, cantidades, obligaciones y cláusulas negativas, y solo se escriben tras una aprobación explícita. Motor 0.1.21, rúbrica `epic-heuristic-1`. [Arquitectura](architecture.md#engine-pipeline)

## Fundamento científico

EPIC reúne 40 prácticas en diez dimensiones a partir de un estudio de 114 repositorios de código abierto y la evaluación de 15 profesionales. SpecTorque usa ese marco para revisar especificaciones, planes y tareas con evidencias en inglés y español. [Estudio EPIC](https://arxiv.org/abs/2610.07534)

Desde el motor 0.1.9, cada cambio de detección sigue una reproducción preregistrada frente a un comparador congelado y el corpus EN/ES antes de publicarse. [Método de precisión](research.md#precision-method)

La precisión permite comprobar una obligación. Si una reserva debe confirmarse «rápido», queda por decidir qué tiempo de respuesta se acepta y en qué condiciones. La selectividad consiste en preguntar por decisiones que cambian la implementación o la aceptación. Los estudios de aclaración con agentes evalúan esa capacidad en tareas concretas. El efecto de SpecTorque sobre los defectos de implementación sigue pendiente de evaluación. [Fundamento y límites](research.md) · [Corpus EN/ES](format-corpus.md)

## Entorno y verificación reproducible

Para desarrollar y verificar usa Node 22.20.0, fijado en `.nvmrc`. `npm run check` comprueba el ejecutable efectivo. Instala los navegadores dentro del proyecto con `npm run browsers:install` y ejecuta `npm run test:browser`; conserva los fallos y límites en el informe, sin convertirlos en aceptación.

`npm run prepare:codex -- es` crea un proyecto desechable en `.spec-torque/codex-es`, con MCP y las skills compartidas. No sobrescribe un proyecto existente ni modifica tu perfil global. Ábrelo en Codex y verifica la conexión. Exporta los cambios que quieras conservar antes de borrar esa carpeta.

`npm run qualify:codex` verifica el app-server real y el panel común sin iniciar un turno de modelo. Para VS Code, genera el VSIX con `npm run package:vscode` y configura `VSCODE_EXECUTABLE` antes de ejecutar `npm run test:vscode` y su variante `-- --restricted`. Se utilizan perfiles aislados. Consulta [los pasos, resultados y límites](qualification.md).

Los refinamientos conservan literalmente las cláusulas negativas detectadas, salvo espacios. Reformular una prohibición o exclusión exige una decisión explícita; el rechazo conservador no significa que el sistema comprenda toda la semántica del texto.

## Visor de Codex Desktop

Genera el ZIP con `npm run check`, `npm run package:integrations` y `npm run package:codex`. `npm run verify:codex-package` comprueba el paquete fuera del checkout. Instala el ZIP desde un marketplace local. En un chat local del worktree, confía en la carpeta y ejecuta **Setup** del plugin o invoca `$spec-setup`. Confirma la raíz que se muestra, revisa el bloque MCP y autoriza la escritura en `.codex/config.toml` cuando se te pida. Abre un chat local nuevo para usar `$spec-view`. Después de actualizar el plugin o Node, vuelve a ejecutar `$spec-setup` para reparar las rutas si hace falta.

Para configurar la acción de entorno, usa el bloque que muestra la skill o que imprime `setup-workspace.mjs`. Incorpóralo a `.codex/environments/environment.toml` conservando las demás acciones y el script de setup. Si el archivo aún no existe, el script imprime su contenido completo. En Windows imprime el comando para terminal. La configuración manual del MCP usa el mismo script y el bloque que imprime. Vincula cada worktree por separado. Para retirar la integración, detén el workbench, elimina los bloques de SpecTorque y desinstala el plugin o marketplace de prueba. [Guía del paquete](../integrations/codex/README.md)

Abre un solo workbench por worktree. Si ya hay uno activo, reutilízalo o detenlo antes de cambiar de vía.

| Vía | Abrir | Detener |
| --- | --- | --- |
| **Acción de entorno**, recomendada en perfiles con aprobación | Pulsa **⌘K**, busca **Open SpecTorque workbench** y elige **Run: Open SpecTorque workbench** en **Project**. Pulsa la URL del terminal integrado. No consume un turno de modelo. | **Ctrl+C** en el terminal de la acción, cerrar su pestaña o archivar el chat. |
| **Skill opcional**, cómoda con **Full access** | Invoca `$spec-workbench`. Consume un turno y puede abrir el navegador integrado con `@Browser`. Con **Ask for approval**, Desktop puede pedir **Allow once**. Si ya hay un workbench para ese worktree, pregunta si quieres reutilizarlo. | Si lo abrió la skill, verifica el comando y el worktree con `ps -p <PID> -o command=` y ejecuta `kill -TERM <PID>`. Si lo reutilizaste, sigue la parada de su vía original. |

En la versión probada, la acción no abrió la página sola ni mostró un botón en la cabecera. Cambiar de chat dejó el servidor activo. Queda sin verificar el cierre de la ventana con el servidor en marcha. [Cualificación de Desktop](codex-desktop-probe.md#workbench-launch-in-codex-desktop-2026-11-28-issue-116)

Las dos vías abren `/`. Para el visor en línea, `$spec-view` o `open_spectorque` inicia un turno con el proveedor configurado. Sus enlaces `?review=1` y `?export=1` siguen usando los datos copiados desde el visor. Los datos de revisión requieren aprobación explícita y se rechazan si cambió la revisión. [Guía de revisión y exportación](../integrations/codex/README.md#review-and-export)

## Continuación en otros clientes

Consulta los [recorridos de Claude, OpenCode y Pi](host-common-qualification.md).

En Claude Code, genera el paquete con `npm run package:claude`, que antes
recompila el motor y los runtimes de los hosts; el script imprime el SHA-256 del ZIP determinista.
Para una instalación sin marketplace, cárgalo en tu proyecto con `claude --plugin-dir /ruta/absoluta/spectorque-claude-<versión>.zip`
y ejecuta `/spectorque`. El panel usa el `node` del `PATH` (Node 22.20+).
Si el workspace tiene varias funcionalidades, el panel ofrece **All documents** o
una funcionalidad concreta, como en OpenCode. Una propuesta se rechaza si el
archivo ya no coincide con el hash evaluado.
**Open common workbench** inicia el panel común en loopback para el workspace de la
sesión, copia su dirección e indica el alcance que hay que seleccionar; se detiene
al cerrarlo, al cerrar el panel o al terminar la sesión. Pulsarlo mientras arranca
cancela ese arranque.
`npm run qualify:claude -- "$(which claude)" artifacts/spectorque-claude-<versión>.zip <node_modules>`
recorre el ZIP instalado en un cliente real (EN/ES, alcance, rechazo, aplicación,
fuente obsoleta, traspaso, errores e instalación por marketplace) sin enviar
prompts al modelo.
También comprueba que el host conecta el servidor MCP del plugin y lista las tres
skills, y llama a las seis herramientas MCP en EN/ES sin escribir archivos. El uso
por Claude (skill `spec-review` y herramientas MCP) se comprueba aparte con un
turno de modelo por idioma; consulta la guía de cualificación.
En CI, el workflow `qualify-claude.yml` ejecuta `qualify:claude` en macOS (arm64 y
x64), Linux (x64 y arm64) y Windows (x64 y arm64) con un perfil aislado, una clave
ficticia y salida de red bloqueada por el sistema operativo; consulta la tabla en
la guía de cualificación.

En Claude Desktop (Claude Code 2.1.325 integrado), instala el plugin desde el
marketplace con ámbito de proyecto, abre una sesión del Code tab en esa
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

En Pi 1.5.2, genera el ZIP con `npm run package:integrations` y `npm run package:pi`. Extrae el archivo, registra el directorio con `pi install /ruta/absoluta/al/paquete --local` y ejecuta `/spectorque` en un proyecto de prueba con el perfil aislado en modo offline. Usa `pi remove /ruta/absoluta/al/paquete --local --approve` para retirarlo. Consulta la [cualificación del ZIP de Pi](integrations.md#pi-installed-package-qualification).

## Gates de corrección

Las operaciones de aplicar, deshacer y guardar bloquean temporalmente las mutaciones; las respuestas tardías no sustituyen el documento activo. Las propuestas modifican una sola línea y conservan exactamente los identificadores. Los cuerpos HTTP superiores a 6 MB se rechazan con 413. La detección de contradicciones sigue siendo acotada, no semántica general.

Consulta [las fases, evidencias y condiciones de parada](corrective-gates.md). G5 no se cierra hasta disponer de la revisión independiente final y de los resultados técnicos de la revisión concreta; las aceptaciones de los cuatro agentes siguen siendo independientes.

## Reconocimiento normativo EN/ES

Desde el motor 0.1.1, SpecTorque reconoce palabras normativas completas, incluidas `DEBEN`, `DEBERÁ`,
`DEBERÁN`, `DEBERÍA`, `DEBERÍAN` y `PUEDEN`, con o sin identificador de requisito.
Conserva la diferencia entre obligación, recomendación y permiso. Los nuevos casos
reconocidos pueden cambiar los hallazgos y sus evidencias; no cambia la política de
puntuación ni convierte desconocidos en resultados aprobados. Consulta los
[ejemplos y límites](normative-recognition.md). La ampliación y revisión agéntica del corpus se completaron en [#2](https://github.com/jayanez/spec-torque/issues/2). La calibración humana sigue pendiente.

## Corpus de formatos

El [corpus de formatos](format-corpus.md) reúne catorce casos iniciales, 28 conjuntos EN/ES de siete familias y controles de archivos históricos, proyectos anidados e identificadores compartidos. Dos sesiones agénticas independientes etiquetaron la muestra y una tercera resolvió discrepancias. Las etiquetas y los casos `unknown` se conservan con su procedencia. Los resultados describen esa muestra y la calibración humana sigue pendiente.

[Recorrido del piloto y demostración bilingüe](pilot.es.md)
