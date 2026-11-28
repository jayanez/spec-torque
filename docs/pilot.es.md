# Recorrido del piloto de SpecTorque

Este recorrido está dirigido a quienes escriben o revisan especificaciones. Usa el TGZ del candidato, su archivo de sumas y la demostración correspondiente. El análisis, la revisión y la exportación funcionan en local, sin cuenta, modelo ni GPU. La descarga e instalación inicial de dependencias puede requerir red.

1. Verifica el SHA-256 del TGZ según la [guía de instalación](releases.md). Extrae la demo y copia `es/before` a un directorio desechable. Usa Node 22.20+ y npm. Define `TGZ`, `INSTALL` y `WORKSPACE` con rutas absolutas al archivo, el prefijo de instalación y la copia.

   ```sh
   npm install --no-audit --ignore-scripts --prefix "$INSTALL" "$TGZ"
   cli="$INSTALL/node_modules/spectorque/dist/cli.js"
   node "$cli" serve --root "$WORKSPACE" --port 0
   ```

2. Abre la dirección de loopback impresa. Cambia a español; el workbench carga el proyecto local al abrirse (**Recargar proyecto local** lo vuelve a cargar). Elige `specs/booking` si aparece el selector de alcance. Tu primer análisis termina cuando se muestran los hallazgos y se pueden abrir. Descarga el JSON y el informe inicial. Abre el hallazgo de redacción no acotada en `specs/booking/spec.md:5`.
3. En **Texto propuesto**, pega esta línea y pulsa **Revisar diferencia**. Inspecciona ambos textos y pulsa **Rechazar**. Comprueba que el archivo no cambió.

   ```markdown
   FR-001: El sistema DEBE ser [NEEDS CLARIFICATION: definir el límite de tiempo de respuesta y las condiciones de medición].
   ```

4. Vuelve a revisar la diferencia. Marca **Escribir este cambio en el proyecto local** y pulsa **Aceptar cambio**. Conserva FR-002, FR-003 y la exclusión de datos de pago. Abre **Decisiones** para comprobar la pregunta pendiente de la línea 5. Abre **40 prácticas** para ver un `unknown`, como I2.3, cuya evidencia depende de documentos complementarios. Descarga **JSON**, **Informe** y **Documentos**. Verifica el nuevo ID de revisión y los bytes de `specs/booking/spec.md` dentro del ZIP.
5. Comprueba la recuperación en una segunda copia. Con la propuesta preparada y la escritura en disco marcada, añade una línea al archivo desde tu editor y pulsa **Aceptar cambio**. El aviso de fuente modificada debe aparecer y tu edición externa conservarse. Carga de nuevo el proyecto, prepara una propuesta fresca y comprueba que la edición externa persiste después de aprobar.
6. Guarda tus exportaciones, para el servidor con Ctrl+C y verifica que la URL deja de responder. Puedes retirar la instalación con `npm uninstall --prefix "$INSTALL" spectorque`. Borra solo tus directorios desechables.

La demo incluye `es/walkthrough.webm`, subtítulos `es/captions.vtt`, informes y fuentes de ambos estados. La [guía de reproducción](pilot.md#rebuild-the-demonstration) permite volver a generar esos materiales. Las pruebas con teclado, Safari y lector de pantalla tienen sus propios resultados en la [cualificación](common-workbench-qualification.md).

Si deseas compartir feedback, usa el [formulario voluntario](pilot-feedback.md). Revisa cualquier extracto antes de enviarlo. El proyecto confirmará el canal de recepción para el piloto.
