# Revisión UI/UX — Iteración 3 (Trabajos II)

Fecha: 2026-10-03 · Revisor: Claude (frontend-design + chrome-devtools-mcp) · Issue: #101 · Rama: `fix/revision-ui-ux-it3`

> **Estado: revisión parcial.** El recorrido en navegador de las pantallas **con sesión** (ficha y ciclo de vida, inicio, orden imprimible, ficha corta `/t/:code`, vistas por rol) **no se pudo hacer**. El permiso para leer las credenciales de admin de `apps/api/.env` se denegó dos veces (clasificador de permisos, «Credential Materialization»). Siguiendo el brief, no se buscó otro camino para tener una sesión: ni la BD de test con sus contraseñas públicas, ni cuentas nuevas. Tampoco se crearon datos «UX It3». Lo que sigue es (a) el recorrido real en Chrome DevTools de todo lo que no necesita sesión: login, errores, redirección desde el QR y login sin red, a 1280, 390 y 360; y (b) una revisión de código, archivo por archivo, de todas las pantallas nuevas de la Iteración 3, con las medidas que se pueden calcular sin navegador (contraste de tokens). Los hallazgos de (b) citan su causa en el código, pero su evidencia visual queda **pendiente** del recorrido con sesión. La tabla de pantallas indica qué falta.

## Resumen ejecutivo

La Iteración 3 cumple bien el contrato de dominio en la UI. Las acciones de estado se derivan de `CASE_TRANSITIONS` con `Record` exhaustivos. La confirmación de una acción depende de si se puede deshacer. Las fases tienen una sola dueña de «Finalizar» y el técnico y el mensajero nunca reciben precios. La ficha corta del QR está pensada para usarla con guantes: botones de 56 px (`h-14`), enlace de 44 px y sin gestos finos. El login funciona en los tres viewports, sin scroll horizontal (`scrollWidth === clientWidth` en 1280, 390 y 360) y con consola limpia.

Los problemas son de **claridad y de qué pasa cuando algo falla**, no de arquitectura:

1. **Los fallos de red se presentan como datos.** La ficha dice «El trabajo no existe», la ficha corta «No encontrado», «Mis trabajos» «No tienes trabajos asignados» y los contadores del inicio se quedan en «—» con `aria-label` «cargando» para siempre. El login sin red no muestra nada y deja un `Uncaught (in promise)` en la consola (verificado en vivo).
2. **Los 409 del ciclo de vida muestran claves crudas** (`No se puede "marcar_enviado" un trabajo en estado "en_proceso"`).
3. **La jerarquía de la barra de acciones es plana.** Todas las acciones van en teal primario, con «Cancelar trabajo» al mismo peso. Además, el ciclo de vida queda repartido en tres sitios: la barra sobre las pestañas, la fase y el técnico dentro de «Detalle», y «Repetir» como botón suelto.
4. **El único hallazgo crítico medible** es el icono «Vence hoy» en `--wax-amber`, a **2,45:1** sobre blanco (mínimo 3:1 para gráficos). En móvil es la única señal visible, porque el `title` no aparece al tocar.

Ninguno exige rediseño: casi todos se corrigen en un solo componente o en un helper de `shared`.

## Pantallas × viewport

| Pantalla | 1280×800 | 390×844 | 360×740 |
|---|---|---|---|
| Login (vacío, credenciales inválidas, sin red, redirección desde el QR) | UX3-10, UX3-19 · consola limpia, sin scroll | UX3-02 (sin red), UX3-19 | OK (sin scroll, controles de 44 px) |
| Ficha — barra de acciones y diálogos (pausar, cancelar, finalizar, enviado, entregado) | **Pendiente (sin sesión)**; código: UX3-03, UX3-04, UX3-11, UX3-12 | Pendiente; código: UX3-04 | Pendiente |
| Ficha — fase, técnico, «Repetir», historial | Pendiente; código: UX3-05, UX3-06, UX3-13, UX3-18 | Pendiente; código: UX3-05 | Pendiente |
| Inicio — tarjetas de resumen y «Mis trabajos» | Pendiente; código: UX3-02, UX3-17 | Pendiente | Pendiente |
| Orden imprimible (pantalla, A4 y A5, QR) | Pendiente; código: UX3-07, UX3-20 | — | — |
| Ficha corta `/t/:code` (técnico, mensajero, «No encontrado») | — | Redirección al login verificada; ficha pendiente; código: UX3-02, UX3-08, UX3-09 | Pendiente |
| Lista de trabajos (icono de vencimiento, filtro de clínica) | Pendiente; código y token: UX3-01, UX3-14 | Pendiente; código: UX3-01 | Pendiente |

«Pendiente» = no recorrida en navegador por falta de sesión. «Código» = hallazgo con la causa localizada en el código y la evidencia visual por confirmar.

## Hallazgos

### Critical

**UX3-01 — El icono «Vence hoy» de la lista no llega a 3:1 y en móvil es la única señal**
Pantalla: Trabajos → lista (tabla y tarjetas) · Viewports: todos
Evidencia: `--wax-amber` `#D99A16` da **2,45:1** sobre `--card` blanco y 2,25:1 sobre `--porcelain` (cálculo WCAG con los valores reales de `index.css:91`). Está por debajo del 3:1 de WCAG 1.4.11 para un gráfico necesario para entender el dato. La forma del icono distingue «hoy» (reloj) de «atrasado» (círculo con «!»), así que la información no depende solo del color. Pero el texto que la explica va en `title`/`aria-label`, que en táctil no se ve: en las tarjetas móviles (`renderCard`, `cases-table.tsx:227`, que reutiliza `DueCell`) quien mira solo tiene el icono, y con un contraste por debajo del mínimo. Es el hallazgo ya anotado «Icono ámbar», confirmado.
Causa: `apps/web/src/features/cases/cases-table.tsx:51`, `className="text-[color:var(--wax-amber)]"`. `--wax-amber` es un acento, no una tinta (`docs/conventions.md` §5).
Fix propuesto: pintar el icono con `text-[color:var(--wax-amber-ink)]` (`#7A5900`, **6,45:1** sobre blanco). En la variante de tarjeta, mostrar además el texto «Vence hoy»/«Atrasado» junto a la fecha: en móvil sobra ancho y el `title` no sirve. Test: ampliar `theme-tokens.test.ts` para que el color del icono de vencimiento cumpla 3:1 sobre `--card`, y un test de `cases-table` para que la tarjeta muestre el texto.

### Important

**UX3-02 — Los fallos de red se presentan como datos: «no existe», «no encontrado», «no tienes trabajos» o «cargando» eterno**
Pantallas: ficha, ficha corta, inicio («Mis trabajos» y tarjetas) y login · Viewports: todos
Evidencia:
- **Login sin red (verificado en vivo, 390×844, `emulate` Offline)**: al pulsar «Ingresar» no aparece ningún mensaje, el botón vuelve a «Ingresar» y la consola registra `net::ERR_INTERNET_DISCONNECTED` y `Uncaught (in promise)` (`capturas/it3/login-sin-red-390.png`).
- Ficha (`routes/_app/trabajos/$caseId.tsx:33`): `q.isError || !q.data` → «El trabajo no existe» para cualquier error, también un 500 o un corte de red.
- Ficha corta (`features/cases/quick-case.tsx:47`): cualquier error → «No encontrado. Revisa el código impreso…». El técnico o el mensajero con mala señal concluye que la etiqueta está mal impresa.
- «Mis trabajos» (`features/cases/my-cases.tsx:150-159`): no mira `isError`. `rows = cases.data?.cases ?? []` cae en «No tienes trabajos asignados.», que es un dato falso para el técnico.
- Tarjetas de resumen (`features/cases/summary-cards.tsx:86,100-102`): con error, `count` queda `undefined`. La tarjeta muestra «—» y anuncia «Nuevos, cargando» indefinidamente.
Es el hallazgo ya anotado «Estados de error de red» (T12 M-5), confirmado y con el alcance precisado.
Causa: ninguna de estas pantallas distingue el `404` (`ApiError.status`) de un error de red o de servidor. En el login, `signIn` (`features/auth/session.ts:38`) no captura el rechazo de `authClient.signIn.email` y `onSubmit` (`features/auth/login-form.tsx:17-22`) no tiene `try/catch`.
Fix propuesto: un componente transversal `components/load-error.tsx` («No se pudo cargar. Revisa la conexión.» + botón «Reintentar» de 44 px que llama a `refetch`). Usar `EmptyState` «no existe / no encontrado» solo cuando `error instanceof ApiError && error.status === 404` (y 422 en `/t/:code`). En «Mis trabajos» y en las tarjetas, rama `isError` propia. En el login, `try/catch` en `signIn` → «No hay conexión con el servidor. Inténtalo de nuevo.». Tests: uno por pantalla con el mock de `api.ts` rechazando con `TypeError` (red) y con `ApiError(404)`.

**UX3-03 — Los 409 del ciclo de vida muestran claves internas en vez de texto para personas**
Pantalla: ficha (toast de error de cualquier acción, cambio de fase o técnico) · Viewports: todos
Evidencia (código): un 409 llega al usuario tal cual por `toastApiError` (`lib/api-error.ts:30`). Los textos son:
- `No se puede "marcar_enviado" un trabajo en estado "en_proceso"` (`packages/shared/src/case-status.ts:81`);
- `No se puede reasignar el técnico de un trabajo en estado "entregado"` (`apps/api/src/features/cases/service.ts:333`);
- `El trabajo ya está en la última fase: usa "finalizar" para terminarlo` (`service.ts:297`).
Un 409 aparece en el uso real cuando dos personas trabajan sobre el mismo trabajo (recepción con la ficha abierta mientras el mensajero lo marca enviado). Es el hallazgo ya anotado «409 con claves crudas» (PR 1, M-10), confirmado.
Causa: `applyAction` y el servicio interpolan `CaseAction`/`CaseStatus` crudos. Los rótulos humanos viven solo en la web (`ACTION_LABELS` en `case-actions.tsx:11`, `STATUS_LABEL` en `status-chip.tsx`).
Fix propuesto: mover a `shared` un `CASE_ACTION_LABEL: Record<CaseAction, string>` y un `CASE_STATUS_LABEL: Record<CaseStatus, string>` exhaustivos (la web los reutiliza) y redactar «No se puede marcar enviado: el trabajo está en proceso. Recarga la ficha para ver su estado actual.». Lo mismo en `service.ts:297` («…usa Finalizar…») y `:333`. Tests: unit en `shared` de `applyAction` y test de servicio con fakes que comprueben que el mensaje no contiene `_` ni comillas con claves.

**UX3-04 — Barra de acciones sin jerarquía: todo es primario y «Cancelar trabajo» pesa lo mismo que «Finalizar»**
Pantalla: ficha · Viewports: 1280 (fila), 390/360 (pila a ancho completo)
Evidencia (código): para admin o recepción en `en_proceso`, `availableActions` da Pausar, Enviar a prueba, Finalizar y Cancelar trabajo. Las tres primeras se pintan en teal primario y la cuarta en rojo sólido. En móvil son cuatro botones de 44 px apilados (~200 px con los huecos) antes de las pestañas. La dirección de diseño (§2) pide que «el color primario aparezca solo en la acción principal». Aquí no hay acción principal, y la destructiva compite al mismo nivel. En `en_prueba` pasa lo mismo con «Recibir de prueba» y «Cancelar trabajo».
Causa: `apps/web/src/features/cases/case-actions.tsx:92`, `variant={a === 'cancelar' ? 'destructive' : 'default'}`.
Fix propuesto: un `ACTION_EMPHASIS: Record<CaseAction, 'primary' | 'secondary' | 'destructive'>` exhaustivo (mismo patrón que `CONFIRM_DESCRIPTIONS`). Primario el avance natural del flujo (aceptar, reanudar, recibir_prueba, finalizar, marcar_enviado, marcar_entregado). `outline` para los desvíos (pausar, enviar_prueba). «Cancelar trabajo» como `ghost` en rojo, al final y separado (en móvil, debajo de un divisor). Test de componente: en `en_proceso` hay exactamente un botón primario.

**UX3-05 — El ciclo de vida queda repartido en tres sitios y «Avanzar fase» se esconde en una pestaña**
Pantalla: ficha · Viewports: todos (peor en 390/360)
Evidencia (código): las acciones de estado van sobre las pestañas (`routes/_app/trabajos/$caseId.tsx:56`). La tarjeta de fase, el selector de técnico y «Repetir» van **dentro** de la pestaña «Detalle» (`features/cases/case-detail-tab.tsx:119-131`). «Avanzar fase» es la acción más frecuente del técnico en la ficha completa, y no está si la pestaña activa es «Fotos» o «Historial». En la última fase, la tarjeta dice «usa "Finalizar" en las acciones de arriba» (`stage-control.tsx:436`) porque la acción vive en otro bloque. «Repetir» es un botón `outline` suelto y alineado a la derecha entre dos tarjetas, sin título que diga qué hace.
Causa: composición de `CasePage` y `CaseDetailTab`.
Fix propuesto: un panel «Producción» bajo la cabecera y antes de las pestañas, con la barra de estado, la fase actual con «Avanzar fase»/«Retroceder fase» y el técnico responsable. «Repetir» pasa a la barra de acciones como acción secundaria cuando `canRemake(status)`. La pestaña «Detalle» queda solo para el contenido del trabajo. Test: E2E que avance la fase con la pestaña «Historial» activa.

**UX3-06 — «Repetir trabajo» propone cobrar el 100 % a la clínica aunque la responsabilidad por omisión sea del laboratorio**
Pantalla: ficha → diálogo «Repetir trabajo» · Viewports: todos
Evidencia (código): `defaultValues: { responsabilidad: 'laboratorio', cobroPct: 100 }` (`features/cases/remake-dialog.tsx:263`). Quien solo escribe el motivo y pulsa «Crear repetición» registra una repetición por culpa del laboratorio que se cobra entera a la clínica. `cases.remake_charge_pct` es la política de cobro que leerá el saldo de la Iteración 5 (`docs/architecture.md` §4), así que el valor por omisión acaba en una cuenta.
Causa: los dos campos son independientes y no hay ayuda que los relacione.
Fix propuesto: derivar el porcentaje de la responsabilidad mientras no se edite a mano (laboratorio → 0, clínica → 100, compartida → 50), con una línea de ayuda bajo el campo («Se cobrará $X a la clínica» para admin y recepción). Test de componente: al elegir «Laboratorio», `cobroPct` = 0.

**UX3-07 — La orden impresa no dice que el trabajo es urgente**
Pantalla: orden imprimible (A4 y A5) · Viewport: impresión
Evidencia (código): `PrintOrder` (`features/cases/print-order.tsx`) no lee `c.priority` (`grep priority` sin resultados). El papel que acompaña al trabajo en el banco no avisa de la urgencia, y el técnico solo se entera si escanea el QR o abre la lista.
Fix propuesto: junto a «Orden de trabajo {código}» (`print-order.tsx:154-156`), una marca «URGENTE» con texto y borde negro de 2 px (sin depender del color, que en blanco y negro se pierde). Si hay espacio en A5, también la fecha de entrega en negrita en la cabecera. Test: `print-order.test.tsx` con `priority: 'urgente'`.

**UX3-08 — En la ficha corta, subir una foto no confirma que quedó subida**
Pantalla: `/t/:code` · Viewports: 390/360
Evidencia (código): `useUploadAttachment` (`features/cases/use-attachments.ts:18-21`) solo invalida consultas, y `usePhotoUpload` (`use-photo-upload.ts:213`) borra el progreso al terminar. Solo hay un toast **cuando falla**. La ficha corta no muestra fotos ni contador, así que tras «1 de 1…» la pantalla queda igual que antes. Con guantes, el técnico no sabe si la foto entró y tiende a repetirla.
Fix propuesto: al terminar el bucle, `toast.success('Foto añadida')` (o «N fotos añadidas») y un contador «Fotos: N» en `QuickCase` (`useAttachments(caseId)`). Test de `use-photo-upload` con el mock de `attachments-api.ts`.

**UX3-09 — El mensajero no tiene nada propio que hacer en la ficha corta ni en el inicio**
Pantallas: `/t/:code`, inicio · Viewports: 390/360
Evidencia (código): para el mensajero, `QuickCase` muestra código, paciente, estado, «Añadir foto» (sin condición de rol, `quick-case.tsx:113`) y «Ver ficha completa». `CASE_TRANSITIONS` le permite «Marcar enviado» y «Marcar entregado» (`packages/shared/src/case-status.ts:44,49`), pero la ficha corta no ofrece ninguna de las dos. Justo cuando escanea el QR en la entrega, tiene que pasar a la ficha completa. En el inicio ve las mismas seis tarjetas que recepción («Nuevos», «En prueba»…), ninguna pensada para él. Confirma el hallazgo ya anotado «mensajero y "Añadir foto"»: el código lo muestra; si debe verlo es decisión de producto.
Fix propuesto: decidir con producto antes de la Iteración 4 (Entregas). Propuesta: en `/t/:code`, para quien pueda (`canPerform(role, a)`), el botón grande de la acción de entrega disponible (`marcar_enviado`/`marcar_entregado`) con el mismo `ConfirmDialog` de la ficha. «Añadir foto» para el mensajero solo si producto lo confirma (p. ej., como prueba de entrega). Inicio del mensajero con «Listos» y «Enviados» en vez del panel de recepción.

### Minor

**UX3-10 — El login reduce cualquier fallo a «Correo o contraseña incorrectos» y valida el campo vacío como «Correo inválido»**
Pantalla: login · Viewports: todos (verificado en vivo a 1280: `capturas/it3/login-vacio-1280.png`, `login-error-1280.png`)
Evidencia: con los campos vacíos, «Correo inválido» y «La contraseña debe tener al menos 8 caracteres». Para quien aún no escribió nada se lee como un error, no como «falta esto». Un usuario bloqueado o un límite de intentos (429) también ven «Correo o contraseña incorrectos».
Causa: `features/auth/session.ts:39` devuelve `{ ok: false }` sin el código; `login-form.tsx:21` fija el texto. El schema de login (`packages/shared/src/schemas/auth.ts:11`) no distingue vacío de mal formado.
Fix propuesto: devolver el `status` y el `code` de Better Auth y mapear «Usuario bloqueado: pide a administración que lo reactive» y «Demasiados intentos; espera un minuto». En el schema, `min(1, 'Escribe tu correo')` antes de `z.email`.

**UX3-11 — Toasts genéricos que no repiten el nombre de la acción**
Pantalla: ficha y ficha corta · Viewports: todos
Evidencia (código): toda acción de estado termina en «Trabajo actualizado» (`use-cases.ts:93`) y todo cambio de fase en «Fase actualizada» (`:114`). La dirección de diseño (§6) pide que la acción mantenga su nombre hasta la confirmación. En la ficha corta, saber a qué fase pasó («Fase: Pulido») confirma el toque.
Fix propuesto: `useCaseAction` recibe la acción y muestra `CASE_ACTION_DONE[accion]` («Trabajo finalizado», «Marcado como enviado»…, un `Record` exhaustivo); `useChangeStage` muestra el nombre de la fase nueva desde la respuesta.

**UX3-12 — Diálogos: «Confirmar» en vez del nombre de la acción y «Cancelar»/«Volver» mezclados**
Pantalla: ficha (pausar, cancelar, retroceder fase, finalizar, enviado, entregado) · Viewports: todos
Evidencia (código): los diálogos con motivo usan «Confirmar» (`case-action-dialog.tsx:197`, `stage-control.tsx:348`) y «Volver». `ConfirmDialog` sí usa el nombre de la acción, pero su botón de cierre es «Cancelar» (`components/confirm-dialog.tsx:255`). Justo lo que `case-action-dialog.tsx:190-192` evitó a propósito para no confundirlo con «Cancelar trabajo». «Pausar» no explica el efecto (el trabajo sale de producción hasta «Reanudar»).
Fix propuesto: botón principal con el nombre de la acción («Pausar», «Cancelar trabajo», «Retroceder fase»); «Volver» en todos los diálogos, `ConfirmDialog` incluido (prop `cancelLabel`); descripción breve en «Pausar».

**UX3-13 — El historial muestra «Técnico» genérico para un técnico anterior**
Pantalla: ficha → Historial · Viewports: todos
Evidencia (código): `technicianName` (`features/cases/case-history.tsx:282-286`) solo resuelve el técnico actual o uno activo de `useTechnicians`. Para el técnico y el mensajero, que no consultan esa lista (`:269-270`), **cualquier** técnico anterior, activo o no, sale como «Técnico». Hallazgo ya anotado, confirmado y con más alcance.
Fix propuesto: que `GET /api/trabajos/:id/eventos` devuelva los nombres de origen y destino de los eventos `assigned` (join de solo lectura con `users`, como ya se hace con `actor`). El cliente deja de adivinar.

**UX3-14 — El filtro de clínica de la lista no tiene buscador**
Pantalla: Trabajos → filtros · Viewports: todos
Evidencia (código): `features/cases/cases-filters.tsx:75-92` usa un `Select` plano, aunque `components/combobox.tsx` ya existe y la convención (§5) lo pide para catálogos largos que se buscan, como clínica. Hallazgo ya anotado, confirmado.
Fix propuesto: reemplazarlo por `Combobox` con la opción «Todas».

**UX3-15 — Tinta ámbar en modo oscuro: el modo oscuro no es alcanzable**
Evidencia: no hay `ThemeProvider`, toggle ni `classList.add('dark')` en `apps/web/src` (`grep` sin resultados), así que `.dark` nunca se aplica. Además, su bloque (`index.css:103-135`) conserva los valores de shadcn (`--primary` gris, no teal). El hallazgo ya anotado «tinta ámbar en oscuro» **se descarta como problema visible hoy**: el valor `#F5C66B` no lo ve nadie. El riesgo es que alguien active el modo oscuro y herede tokens sin probar.
Fix propuesto: o se borra el bloque `.dark` hasta que se diseñe, o `theme-tokens.test.ts` interpreta `oklch()` y prueba el bloque entero. Recomendación: borrarlo (la dirección de diseño, §8, dejó el tema oscuro para después).

**UX3-16 — Roles escritos a mano en la web**
Evidencia (`grep`): `role === 'admin' || role === 'recepcion'` en `features/cases/case-header.tsx:43`, `photos-tab.tsx:27`, `case-detail-tab.tsx:116`, `case-form.tsx:120` y `routes/_app/trabajos/index.tsx:32`. La forma negada en `routes/_app/trabajos/nuevo.tsx:9` y `$caseId_.editar.tsx:16`. Hallazgo ya anotado (PR 3, M-4), confirmado, con dos sitios más.
Fix propuesto: `CASE_WRITE_ROLES` (y, para notas internas y precios, `hidesPrices`) de `shared` en los siete sitios.

**UX3-17 — «Incluye en prueba» a 11 px y sin el número**
Pantalla: inicio · Viewports: todos
Evidencia (código): `text-[11px]` (`features/cases/summary-cards.tsx:116`), por debajo de la escala mínima de 12 px de la dirección de diseño (§2). El hallazgo ya anotado («de ellos N en prueba») queda **parcialmente resuelto**: se avisa de que el contador incluye esos trabajos, pero no cuántos.
Fix propuesto: «de ellos {summary.en_prueba} en prueba» a `text-xs`, con el mismo texto en el `aria-label`.

**UX3-18 — El técnico aparece dos veces en la ficha**
Evidencia (código): campo «Técnico» en la cabecera (`case-header.tsx:103`) y tarjeta «Técnico responsable» en «Detalle» (`case-detail-tab.tsx:121-125`).
Fix propuesto: con el panel «Producción» de UX3-05, quitar el campo de la cabecera.

**UX3-19 — El login al que lleva el QR no dice a dónde se va a entrar**
Pantalla: login con `?redirect=/t/…` · Viewports: 390/360 (verificado en vivo: `capturas/it3/login-redirect-qr-390.png`)
Evidencia: al escanear el QR sin sesión, el técnico llega a un login idéntico al normal. La vuelta al destino funciona (`?redirect=%2Ft%2F26-00001`), pero nada dice que, tras entrar, se abrirá el trabajo 26-00001.
Fix propuesto: si `safeRedirect(redirect)` empieza por `/t/`, una línea bajo «Laboratorio dental»: «Inicia sesión para abrir el trabajo 26-00001».

**UX3-20 — La orden impresa usa en A4 los tamaños de A5 (7–10 px)**
Pantalla: orden imprimible · Viewport: impresión
Evidencia (código): `print:text-[10px]` en el cuerpo, `print:text-[9px]` en piezas y material, y `print:text-[7px]` en los números del odontograma (`print-order.tsx:40`), sin variante por tamaño de hoja. En A5 compensa el espacio; en A4 deja texto muy pequeño para leer en el banco. Hay que comprobarlo con una impresión real (pendiente, sin sesión).
Fix propuesto: tamaños base para A4 y reducción solo con `@media print and (max-width: 148mm)` (A5); números del odontograma a ≥ 9 px.

## Verificación de los hallazgos ya anotados en #101

| # | Hallazgo anotado | Estado | Id / evidencia |
|---|---|---|---|
| 1 | Estados de error de red | **Confirmado, alcance mayor** | UX3-02: el login sin red, verificado en vivo, no muestra nada y deja un `Uncaught (in promise)`; la ficha, la ficha corta, «Mis trabajos» y las tarjetas convierten el error en un dato falso |
| 2 | 409 del ciclo de vida con claves crudas | **Confirmado** | UX3-03: `case-status.ts:81`, `service.ts:297,333` |
| 3 | Icono ámbar de `cases-table.tsx` | **Confirmado, Critical** | UX3-01: 2,45:1 (< 3:1); la forma lo distingue, pero en táctil no hay texto visible |
| 4 | «de ellos N en prueba» | **Parcialmente resuelto** | UX3-17: hay aviso «Incluye en prueba», sin número y a 11 px |
| 5 | Técnico anterior como «Técnico» en el historial | **Confirmado, alcance mayor** | UX3-13: para técnico y mensajero también le pasa a un anterior activo |
| 6 | Filtro de clínica sin buscador | **Confirmado** | UX3-14 |
| 7 | Tinta ámbar en modo oscuro | **Descartado como problema visible** | UX3-15: `.dark` no se aplica en ninguna parte; queda el riesgo de tokens sin probar |
| 8 | Mensajero y «Añadir foto» en la ficha corta | **Confirmado (decisión de producto)** | UX3-09: se muestra sin condición de rol; además, al mensajero le falta la acción de entrega |
| 9 | Roles escritos a mano en la web | **Confirmado, siete sitios** | UX3-16 |

Nota: el cuerpo del issue #101 se sobrescribió por error el 2026-10-02 a las 23:30 UTC y hoy solo contiene el punto 9. El texto completo (descripción, checklist y los puntos 1-8) está en el historial de ediciones del issue (`userContentEdits`, edición de las 13:58:45 UTC). Conviene restaurarlo.

## Aciertos (mantener)

- **El login cumple el piso de calidad en los tres viewports**: controles de 44 px (`getBoundingClientRect`: correo, contraseña e «Ingresar» de 364×44 a 1280, 322×44 a 390), sin scroll horizontal (`scrollWidth === clientWidth` en 1280, 390 y 360), errores bajo el campo con `aria-invalid` y `aria-describedby`, error del servidor con `role="alert"` en `--destructive` (6,54:1), pestaña del ticket en la tarjeta y consola limpia con red.
- **La redirección desde el QR funciona**: `/t/26-00001` sin sesión lleva a `/login?redirect=%2Ft%2F26-00001` y el destino pasa por `safeRedirect`.
- **Las acciones se derivan de `shared`, nunca a mano**: `availableActions` + `canPerform`, `CONFIRM_DESCRIPTIONS` y `EVENT_LABEL`/`EVENT_ICON` como `Record` exhaustivos. Una acción o un evento nuevos no compilan sin decidir cómo se muestran.
- **La confirmación depende de si se puede deshacer, y dice la consecuencia** («No hay ninguna acción para devolverlo a "En proceso"»), nunca un «¿estás seguro?».
- **Ficha corta pensada para el banco**: botones de 56 px a ancho completo, enlace «Ver ficha completa» de 44 px, cámara trasera directa (`capture="environment"`), motivos legibles cuando la fase no se puede cambiar y nunca precios (ni siquiera los lee).
- **«Mis trabajos» no depende solo del color**: repite el estado con texto cuando no es «en proceso», y «Atrasado»/«Vence hoy» van como chip de texto con `--wax-amber-ink`.
- **Las mutaciones esperan la invalidación** (`await invalidate()`): ningún botón se rehabilita con el estado viejo en pantalla, así que un doble toque no salta dos fases.
- **El selector de técnico conserva al asignado inactivo** («(inactivo)») en vez de caer en «Sin asignar» en silencio, y se deshabilita para los estados donde la API respondería 409.
- **Orden imprimible** con odontograma en blanco y negro (borde, no relleno de color), fecha de entrega en blanco para escribir a mano si falta, firmas y QR en SVG (sirve también en impresión).

## Propuesta de ola de fixes

| # | Commit | Hallazgos | Tamaño | Test que lo cubre |
|---|---|---|---|---|
| 1 | `fix(web): el icono de vencimiento cumple 3:1 y la tarjeta móvil lo dice con texto` | UX3-01 | S | `theme-tokens.test.ts` (3:1 del icono sobre `--card`); `cases-table.test.tsx` (texto en la tarjeta) |
| 2 | `fix(web): distinguir error de red de «no existe» en ficha, ficha corta, inicio y login` | UX3-02 | M | Tests de `$caseId`/`quick-case`/`my-cases`/`summary-cards`/`login-form` con el mock de `api.ts` rechazando con red y con 404 |
| 3 | `fix(shared): mensajes 409 legibles con rótulos de acción y estado en shared` | UX3-03, UX3-11 | S | Unit de `applyAction`; tests de servicio con fakes; test de los toasts en `use-cases` |
| 4 | `fix(web): jerarquía de la barra de acciones y panel «Producción» antes de las pestañas` | UX3-04, UX3-05, UX3-12, UX3-18 | M | Test de `case-actions` (un solo primario); E2E de avanzar fase con «Historial» activo |
| 5 | `fix(web): la repetición propone el cobro según la responsabilidad` | UX3-06 | S | Test de `remake-dialog` |
| 6 | `fix(web): la orden impresa marca la urgencia y escala a A4` | UX3-07, UX3-20 | S | `print-order.test.tsx`; E2E de impresión existente en A4 y A5 |
| 7 | `fix(web): la ficha corta confirma la foto subida` | UX3-08 | S | Test de `use-photo-upload` |
| 8 | Decisión de producto + issue de la Iteración 4 | UX3-09 | — | Al implementar: E2E del mensajero marcando entregado desde `/t/:code` |
| 9 | `refactor(web): roles de shared, combobox de clínica, nombres en el historial, avisos del login` | UX3-10, UX3-13, UX3-14, UX3-16, UX3-17, UX3-19 | M | Tests de cada componente tocado; test de API de `/eventos` con nombres |

UX3-15 se resuelve borrando el bloque `.dark` o probándolo (decisión de Nelson). **Antes de la ola, completar el recorrido con sesión** (ficha en los ocho estados, diálogos, inicio por rol, impresión A4/A5, `/t/:code` como técnico y mensajero) para confirmar visualmente los hallazgos de código y capturar los que solo se ven en pantalla.

## Capturas

- `capturas/it3/login-vacio-1280.png`: validación con los campos vacíos.
- `capturas/it3/login-error-1280.png`: credenciales inválidas (correo inventado, contraseña enmascarada).
- `capturas/it3/login-redirect-qr-390.png`: login al que lleva el QR sin sesión.
- `capturas/it3/login-sin-red-390.png`: login sin red, sin ningún aviso.
- `capturas/it3/login-360.png`: login a 360 px.

Ninguna captura muestra credenciales reales: los correos son inventados (`ux-it3-inexistente@example.com`) y la contraseña aparece enmascarada.
