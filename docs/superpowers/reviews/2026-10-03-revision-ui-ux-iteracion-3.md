# Revisión UI/UX — Iteración 3 (Trabajos II)

Fecha: 2026-10-03 · Revisor: Claude (frontend-design + chrome-devtools-mcp) · Issue: #101 · Rama: `fix/revision-ui-ux-it3`

## Alcance y método

Recorrido en Chrome DevTools a 1280×800, 390×844 y 360×740 con la BD de desarrollo y datos creados para la revisión, todos con «UX It3» en el nombre:

- clínica «Clínica UX It3» y doctora «Dra. UX It3»;
- usuarios «Técnico UX It3» y «Mensajero UX It3», creados desde Configuración → Usuarios con contraseñas de prueba de `.gitguardian.yaml`;
- nueve trabajos, `26-00067` a `26-00075`, uno por estado: nuevo incompleto, nuevo urgente que vence hoy, en proceso (con dos líneas y técnico reasignado), en espera, en prueba, terminado, enviado, entregado y cancelado.

La sesión de admin la abrió el coordinador. El técnico y el mensajero entraron en contextos de navegador aislados. Las medidas salen de `getBoundingClientRect`/`getComputedStyle` y los contrastes se calcularon con los valores reales de los tokens. La revisión de código, archivo por archivo, localiza la causa de cada hallazgo.

**Límites del recorrido** (no se pudo hacer en vivo, y el informe lo dice en cada caso):

- No se abrió el `ConfirmDialog` de «Finalizar»: el permiso del entorno denegó ese clic. El texto de los diálogos de confirmación sale del código (`case-actions.tsx:33-46`).
- Tampoco se ejecutaron «Finalizar», «Marcar enviado» ni «Marcar entregado» desde la UI. Los estados se prepararon por la API de desarrollo con la sesión de admin.
- La herramienta no emula el medio `print`: la impresión A4/A5 se juzgó en la vista de pantalla y en el código. La salida en papel ya la cubre el E2E de `74e27ae`.
- No se creó un usuario de recepción: en las pantallas de la Iteración 3, recepción ve lo mismo que admin, porque `CASE_WRITE_ROLES` y los demás roles de `shared` los tratan igual.

## Resumen ejecutivo

La Iteración 3 cumple el contrato de dominio en la UI:

- Las acciones de estado se derivan de `CASE_TRANSITIONS` y nunca se escriben a mano.
- La confirmación depende de si la acción se puede deshacer.
- El técnico y el mensajero **no reciben precios ni notas internas**, ni en la ficha ni en la ficha corta (verificado en vivo con los dos roles).
- La ficha corta del QR tiene botones de 56 px pensados para usar con guantes.
- Con red, ninguna pantalla tiene scroll horizontal y ningún control de la ficha a 360 px mide menos de 44 px.
- La consola queda limpia en todo el recorrido con red. Solo aparece el 404 de red esperado en `/t/26-99999`.

Los problemas son de **claridad y de qué pasa cuando algo falla**:

1. **Contraste e iconos sin texto**: el icono «Vence hoy» mide **2,45:1** (mínimo 3:1). En las tarjetas móviles, «Vence hoy» y «Urgente» son solo iconos, sin texto visible.
2. **Fallos de red**: sin red, una navegación dentro de la app muestra la pantalla por defecto del router, en inglés: «Something went wrong! / Failed to fetch». El login sin red no dice nada. La ficha, la ficha corta y «Mis trabajos» convierten un error en «no existe», «no encontrado» o «no tienes trabajos».
3. **Mensajes 409 con claves internas**: verificado contra la API, por ejemplo `No se puede "marcar_entregado" un trabajo en estado "en_proceso"`.
4. **Jerarquía y lugar del ciclo de vida**: tres acciones en teal primario y otra más en la tarjeta de fase. En 390 px, «Avanzar fase» queda bajo el pliegue (y = 927 con un viewport de 844). El técnico, a mitad de producción, ve «Finalizar» como única acción visible.
5. **Lo que lleva el papel y la ficha corta**: la orden impresa no marca la urgencia y, impresa por recepción, lleva precios a un papel que acompaña al trabajo hasta el banco. La ficha corta no dice ni la fecha de entrega ni la urgencia, y en un trabajo terminado muestra «Fase: Recepción».

Ninguno exige rediseño: casi todos se corrigen en un componente o en un helper de `shared`.

## Pantallas × viewport

| Pantalla | 1280×800 | 390×844 | 360×740 |
|---|---|---|---|
| Login (vacío, credenciales inválidas, sin red, desde el QR) | UX3-10, UX3-19 · OK | UX3-02, UX3-19 | OK |
| Lista de trabajos (iconos de vencimiento y urgencia, filtro de clínica) | UX3-01, UX3-14 · sin scroll | UX3-01 · sin scroll | — |
| Ficha: nuevo incompleto, nuevo, en proceso, en espera, en prueba, terminado, enviado, entregado, cancelado | UX3-04, UX3-05, UX3-18, UX3-25 | UX3-04, UX3-05 · sin scroll | OK: 0 controles < 44 px, sin scroll |
| Ficha: diálogos «Pausar» y «Repetir», confirmación de «Finalizar» (solo código) | UX3-06, UX3-12 | — | — |
| Ficha: fase, técnico e historial | UX3-11, UX3-13, UX3-24, UX3-26 | UX3-13 (como técnico) | — |
| Inicio: admin, técnico y mensajero | UX3-17 | UX3-09, UX3-28 (técnico) | UX3-09 (mensajero) |
| Orden imprimible (pantalla; impresión por código) | UX3-07, UX3-20, UX3-21 | — | — |
| Ficha corta `/t/:code`: técnico, mensajero y «No encontrado» | — | UX3-08, UX3-22, UX3-27 | UX3-09, UX3-23 |
| Sin red (login y navegación interna) | — | UX3-02 | — |

`—` = no recorrida a ese ancho porque repite un patrón ya verificado sin diferencias nuevas.

## Hallazgos

### Critical

**UX3-01 — El icono «Vence hoy» no llega a 3:1, y en móvil «Vence hoy» y «Urgente» no tienen texto visible**
Pantalla: Trabajos → lista (tabla y tarjetas) · Viewports: 1280, 390 (`capturas/it3/lista-ux-it3-1280.png`, `capturas/it3/lista-tarjetas-390.png`)
Evidencia: en el trabajo `26-00068` (urgente, vence hoy), `getComputedStyle` da para «Vence hoy» `rgb(217, 154, 22)` (`--wax-amber`): **2,45:1** sobre la tarjeta blanca, por debajo del 3:1 de WCAG 1.4.11. «Urgente» (`rgb(179, 38, 30)`, 6,5:1) cumple el contraste. Pero a 390 px las dos señales son **solo iconos de 16 px** junto al código y a la fecha. Su texto vive en `title` y `aria-label`, y `title` no aparece al tocar. En móvil, quien mira solo puede distinguir el estado por la forma del icono, y el ámbar además no se lee. Es el hallazgo ya anotado «Icono ámbar», confirmado.
Causa: `apps/web/src/features/cases/cases-table.tsx:51` (`text-[color:var(--wax-amber)]`); `StatusIcon` (`:30-40`), que reutiliza `DueCell` en la tarjeta (`:227`).
Fix propuesto: icono con `text-[color:var(--wax-amber-ink)]` (`#7A5900`, 6,45:1). En la variante de tarjeta, chips de texto «Urgente», «Vence hoy» y «Atrasado», como ya hace «Mis trabajos» (`my-cases.tsx:176-185`). Tests: `theme-tokens.test.ts` (3:1 del icono sobre `--card`) y `cases-table.test.tsx` (texto visible en la tarjeta).

### Important

**UX3-02 — Los fallos de red se presentan como datos, o con la pantalla de error del router en inglés**
Pantallas: toda la app con sesión, login, ficha, ficha corta e inicio · Viewports: todos
Evidencia:
- **Navegación interna sin red (en vivo, técnico, 390)**: en el inicio, se corta la red y se toca un trabajo de «Mis trabajos». La app muestra «**Something went wrong! / Hide Error / Failed to fetch**», en inglés y sin salida (`capturas/it3/sin-red-error-router-390.png`).
- **Login sin red (en vivo, 390)**: no aparece ningún mensaje y la consola registra `Uncaught (in promise)` (`capturas/it3/login-sin-red-390.png`).
- En el código, con cualquier error: la ficha dice «El trabajo no existe» (`routes/_app/trabajos/$caseId.tsx:33`), la ficha corta «No encontrado» (`quick-case.tsx:47`), «Mis trabajos» «No tienes trabajos asignados» (no mira `isError`, `my-cases.tsx:150-159`), y las tarjetas del inicio se quedan en «—» con `aria-label` «cargando» (`summary-cards.tsx:86,100-102`).
Hallazgo ya anotado (T12 M-5), confirmado y con más alcance.
Causa: ninguna ruta declara `errorComponent` y el router no tiene `defaultErrorComponent` (`grep` sin resultados). El `beforeLoad` de `_app.tsx` llama a `getSession()`, que propaga el rechazo de `authClient.getSession` (`features/auth/session.ts:18`). Las pantallas no distinguen un 404 (`ApiError.status`) de un fallo de red. `signIn` (`session.ts:38`) y `onSubmit` (`login-form.tsx:17-22`) no capturan el rechazo.
Fix propuesto:
- `defaultErrorComponent` en español en el router: «No hay conexión con el servidor», con «Reintentar» de 44 px que llame a `router.invalidate()`.
- Un componente `components/load-error.tsx` para las consultas.
- «No existe» y «No encontrado» solo con `ApiError` 404 (y 422 en `/t/:code`).
- Rama `isError` en «Mis trabajos» y en las tarjetas.
- `try/catch` en `signIn`.
Tests: por pantalla, con el mock de `api.ts` rechazando con `TypeError` y con `ApiError(404)`; test del `errorComponent`.

**UX3-03 — Los 409 del ciclo de vida muestran claves internas**
Pantalla: ficha (toast de error) · Viewports: todos
Evidencia (en vivo, contra la API con la sesión de admin): `POST /api/trabajos/{26-00069}/acciones {accion: 'marcar_entregado'}` responde **409** `{"message":"No se puede \"marcar_entregado\" un trabajo en estado \"en_proceso\""}`, y `toastApiError` lo muestra tal cual. El mismo patrón aparece en `service.ts:297` («usa "finalizar"») y `:333` (estado `"entregado"`). Un 409 es real cuando dos personas trabajan sobre el mismo trabajo. Hallazgo ya anotado (PR 1, M-10), confirmado.
Causa: `packages/shared/src/case-status.ts:81` y `apps/api/src/features/cases/service.ts:297,333` interpolan las claves. Los rótulos solo existen en la web (`case-actions.tsx:11`, `status-chip.tsx`).
Fix propuesto: `CASE_ACTION_LABEL` y `CASE_STATUS_LABEL` exhaustivos en `shared` (la web los reutiliza) y redactar «No se puede marcar entregado: el trabajo está en proceso. Recarga la ficha para ver su estado actual.». Tests: `applyAction` en `shared` y servicio con fakes (el mensaje no contiene `_`).

**UX3-04 — Barra de acciones sin jerarquía: varias acciones en primario**
Pantalla: ficha · Viewports: 1280 (fila) y 390/360 (pila) (`capturas/it3/ficha-en-proceso-1280.png`, `capturas/it3/ficha-en-proceso-390.png`)
Evidencia: en `26-00069` (en proceso, admin), «Pausar», «Enviar a prueba» y «Finalizar» van en teal primario (`rgb(15, 118, 110)`). Más abajo, «Avanzar fase» es otro primario y «Comentar» otro más en el historial. La dirección de diseño (§2) reserva el primario para la acción principal. «Cancelar trabajo» usa la variante destructiva suave (texto `#B3261E` sobre rojo al 10 %), **no** un rojo sólido: el informe parcial lo daba como sólido, y aquí se corrige. Aun así queda en la misma fila y con el mismo tamaño que «Finalizar». En 390 px las cuatro acciones ocupan una pila de 358×44 px entre y = 489 e y = 689.
Causa: `apps/web/src/features/cases/case-actions.tsx:92`.
Fix propuesto: `ACTION_EMPHASIS: Record<CaseAction, 'primary' | 'secondary' | 'destructive'>` exhaustivo. Primario para el avance natural (aceptar, reanudar, recibir_prueba, finalizar, marcar_enviado, marcar_entregado), `outline` para pausar y enviar_prueba, y «Cancelar trabajo» como `ghost` rojo, aparte y al final. Test: exactamente un primario por estado.

**UX3-05 — El ciclo de vida está repartido y «Avanzar fase» queda bajo el pliegue, detrás de «Finalizar»**
Pantalla: ficha · Viewports: 390 (medido) y todos
Evidencia:
- **Admin a 390**: las pestañas empiezan en y = 713 y «Avanzar fase» en **y = 927**, con un viewport de 844 px. Para avanzar la fase hay que desplazarse por debajo de las cuatro acciones de estado.
- **Técnico** en el mismo trabajo, en la fase «Modelo», que no es la última: la única acción sobre las pestañas es **«Finalizar»**, en primario, y «Avanzar fase» queda dentro de «Detalle».
- En las pestañas «Fotos» o «Historial» no hay forma de avanzar.
- En terminado, «Repetir» aparece como un botón `outline` suelto, alineado a la derecha entre dos tarjetas (`capturas/it3/ficha-terminado-1280.png`).
Causa: `routes/_app/trabajos/$caseId.tsx:56` (acciones sobre las pestañas) y `features/cases/case-detail-tab.tsx:119-131` (fase, técnico y «Repetir» dentro de «Detalle»).
Fix propuesto: un panel «Producción» bajo la cabecera y antes de las pestañas. Lleva la fase actual con «Avanzar fase» (primario mientras haya fase siguiente) y «Retroceder fase», el técnico responsable y la barra de estado. «Finalizar» queda como primario solo en la última fase y en secundario antes de ella. «Repetir» pasa a la barra como secundaria. Test: E2E que avance la fase con «Historial» activo; test de componente sobre el énfasis de «Finalizar» según la fase.

**UX3-06 — «Repetir trabajo» propone cobrar el 100 % con la responsabilidad del laboratorio**
Pantalla: ficha → «Repetir» · Viewport: 1280 (`capturas/it3/dialogo-repetir-1280.png`)
Evidencia (en vivo): el diálogo abre con «Responsabilidad: Laboratorio» y «Porcentaje a cobrar a la clínica: 100», sin `%` ni ayuda. Quien solo escribe el motivo registra una repetición por culpa del laboratorio que se cobra entera a la clínica. `remake_charge_pct` es la política de cobro que leerá el saldo de la Iteración 5 (`docs/architecture.md` §4).
Causa: `apps/web/src/features/cases/remake-dialog.tsx:263`.
Fix propuesto: derivar el porcentaje de la responsabilidad mientras no se edite (laboratorio → 0, clínica → 100, compartida → 50), sufijo «%» y una línea de ayuda «Se cobrará $X a la clínica» (admin y recepción). Test de componente.

**UX3-07 — La orden impresa no marca la urgencia**
Pantalla: orden imprimible · Viewport: 1280 (`capturas/it3/orden-imprimible-urgente-1280.png`)
Evidencia (en vivo): la orden de `26-00068`, **urgente**, no lo menciona en ninguna parte: código, QR, paciente, líneas, observaciones y firmas, sin la palabra «Urgente». El papel que acompaña al trabajo hasta el banco no avisa.
Causa: `features/cases/print-order.tsx` no lee `c.priority`.
Fix propuesto: una marca «URGENTE» con texto y borde negro de 2 px junto a «Orden de trabajo {código}» (`print-order.tsx:154-156`) y la fecha de entrega en negrita en la cabecera. Test en `print-order.test.tsx`.

**UX3-08 — La ficha corta no confirma la foto subida**
Pantalla: `/t/:code` (técnico) · Viewport: 390
Evidencia (en vivo): con «Añadir foto» en `26-00069` la foto se subió (`GET /api/adjuntos/trabajo/…` → 1 adjunto). En pantalla, durante seis segundos de muestreo, no apareció ningún toast ni contador, y la ficha corta quedó idéntica. Con guantes, el técnico no sabe si la foto entró.
Causa: `use-attachments.ts:18-21` (sin toast de éxito) y `use-photo-upload.ts:213`. `QuickCase` no muestra fotos.
Fix propuesto: `toast.success('Foto añadida')` (o «N fotos añadidas») al terminar el bucle y un «Fotos: N» en `QuickCase`. Test de `use-photo-upload`.

**UX3-09 — El mensajero no puede marcar enviado o entregado desde el QR, y su inicio es el de recepción**
Pantallas: `/t/:code`, inicio · Viewport: 360 (`capturas/it3/ficha-corta-mensajero-terminado-360.png`, `capturas/it3/inicio-mensajero-360.png`)
Evidencia (en vivo, mensajero):
- En `/t/26-00072` (terminado), la ficha corta ofrece solo «Añadir foto» y «Ver ficha completa». En la ficha completa del mismo trabajo **sí** aparece «Marcar enviado».
- Justo en el momento del QR, el mensajero tiene que ir a otra pantalla para registrar el envío.
- Su inicio repite las seis tarjetas del laboratorio («Nuevos 59», «En prueba»…), sin nada que sea suyo.
Confirma el hallazgo ya anotado «mensajero y "Añadir foto"»: el código muestra el botón sin condición de rol (`quick-case.tsx:113`); si el mensajero debe verlo es decisión de producto.
Fix propuesto: decidir con producto antes de la Iteración 4 (Entregas). Propuesta:
- en `/t/:code`, el botón grande de la acción de entrega disponible (`canPerform(role, a)`), con el mismo `ConfirmDialog` de la ficha;
- «Añadir foto» para el mensajero solo si se usa como prueba de entrega;
- inicio con «Listos» y «Enviados».

**UX3-21 — La orden impresa por recepción lleva precios al papel que acompaña al trabajo hasta el banco (nuevo)**
Pantalla: orden imprimible · Viewport: 1280 (`capturas/it3/orden-imprimible-urgente-1280.png`)
Evidencia (en vivo, admin): la orden lleva «$ 240.00» por línea y «Total: $ 240.00». Es lo que pide FIC-1 («con precios para administrador y recepción»), pero la spec (§5) dice que se imprimen **dos copias, clínica y laboratorio**, y la del laboratorio va al banco del técnico. La regla «técnico y mensajero nunca reciben precios» se cumple en la API y en la pantalla, pero no en el papel. No se clasifica como Critical porque FIC-1 lo pide así: es una contradicción entre la historia y la regla, y le toca decidir a producto.
Causa: `print-case-page.tsx:63`, `hidePrices={hidesPrices(role)}` según quién imprime, no según para quién es la copia.
Fix propuesto: dos botones en la pantalla de impresión, «Imprimir copia clínica» (con precios) e «Imprimir copia laboratorio» (sin precios), o un interruptor «Incluir precios» apagado por omisión. Test en `print-case-page.test.tsx`.

**UX3-22 — La ficha corta no dice la fecha de entrega ni si es urgente (nuevo)**
Pantalla: `/t/:code` · Viewports: 390/360 (`capturas/it3/ficha-corta-tecnico-390.png`)
Evidencia (en vivo): el texto completo de la ficha corta de `26-00069` es «26-00069 · UX It3 C en proceso · En proceso · Fase: Empaque · Avanzar fase · Añadir foto · Ver ficha completa». No hay fecha comprometida, prioridad ni aviso de atraso. Lo que el técnico más necesita saber en el banco («¿para cuándo es?», «¿es urgente?») solo está en la ficha completa.
Causa: `features/cases/quick-case.tsx:83-95` no pinta `promisedDate`/`dueDate` ni `priority`.
Fix propuesto: bajo el paciente, «Entrega: 13/10/2026» y los chips de texto «Urgente», «Vence hoy» y «Atrasado» (la misma lógica de `dueBadge` que «Mis trabajos»). Test de `quick-case`.

**UX3-23 — La ficha corta muestra una fase en trabajos que ya no están en producción (nuevo)**
Pantalla: `/t/:code` · Viewport: 360 (`capturas/it3/ficha-corta-mensajero-terminado-360.png`)
Evidencia (en vivo): `/t/26-00072`, **terminado**, muestra «Fase: Recepción». La ficha completa del mismo trabajo no muestra fase, porque `isStageVisible` la oculta fuera de producción. El mensajero o el técnico leen que el trabajo terminado está en «Recepción», es decir, sin empezar.
Causa: `features/cases/quick-case.tsx:91` (`{c.stage && …}`) no aplica `isStageVisible(c.status)`, que sí usan `case-header.tsx:104` y `stage-control.tsx:398`.
Fix propuesto: `c.stage && isStageVisible(c.status)`. Test de `quick-case` con un trabajo terminado.

### Minor

**UX3-10 — El login reduce cualquier fallo a «Correo o contraseña incorrectos» y valida el campo vacío como «Correo inválido»**
Pantalla: login · Viewports: todos (`capturas/it3/login-vacio-1280.png`, `capturas/it3/login-error-1280.png`)
Evidencia (en vivo): con los campos vacíos, «Correo inválido» y «La contraseña debe tener al menos 8 caracteres». Un usuario bloqueado o un 429 verían «Correo o contraseña incorrectos» (`session.ts:39`, `login-form.tsx:21`).
Fix propuesto: mapear el `status`/`code` de Better Auth («Usuario bloqueado: pide a administración que lo reactive», «Demasiados intentos; espera un minuto») y `min(1, 'Escribe tu correo')` en el schema (`packages/shared/src/schemas/auth.ts:11`).

**UX3-11 — Toasts genéricos**
Evidencia (en vivo): al avanzar la fase desde el QR el toast dice «Fase actualizada» (la fase nueva, «Modelo», solo se ve en la pantalla). Las acciones de estado terminan en «Trabajo actualizado» (`use-cases.ts:93,114`).
Fix propuesto: `CASE_ACTION_DONE: Record<CaseAction, string>` exhaustivo («Trabajo finalizado», «Marcado como enviado»…) y «Fase: {nombre}» desde la respuesta.

**UX3-12 — Diálogos que no nombran la acción ni su efecto**
Evidencia (en vivo, `capturas/it3/dialogo-pausar-vacio-1280.png`): el diálogo «Pausar» no dice qué pasa con el trabajo y su botón es «Confirmar». El error del campo vacío, «Escribe el motivo», sí está bien. Según el código, `ConfirmDialog` cierra con «Cancelar» (`components/confirm-dialog.tsx:255`) mientras el resto de diálogos usan «Volver», que se eligió para no confundirlo con «Cancelar trabajo» (`case-action-dialog.tsx:190-192`). El de «Finalizar» no se abrió en vivo (ver los límites del recorrido).
Fix propuesto: botón principal con el nombre de la acción («Pausar trabajo», «Cancelar trabajo», «Retroceder fase»), «Volver» en todos los diálogos (prop `cancelLabel` en `ConfirmDialog`) y una línea de efecto en «Pausar» («Sale de producción hasta que lo reanudes»).

**UX3-13 — El historial muestra «Técnico» genérico para un técnico anterior, aunque siga activo**
Evidencia (en vivo, técnico, `capturas/it3/historial-tecnico-390.png`): en `26-00069`, reasignado de «Técnico UX It3» a «Prueba Técnico» (activo) y de vuelta, el técnico lee «Técnico UX It3 → **Técnico**» y «**Técnico** → Técnico UX It3». El admin sí ve «Prueba Técnico» (`capturas/it3/historial-admin-1280.png`). Hallazgo ya anotado, confirmado con más alcance.
Causa: `features/cases/case-history.tsx:269-286`: el técnico y el mensajero no consultan `useTechnicians`.
Fix propuesto: que `GET /api/trabajos/:id/eventos` devuelva los nombres de origen y destino de `assigned` (join de solo lectura con `users`, como ya hace `actor`).

**UX3-14 — El filtro de clínica de la lista no tiene buscador**
Causa: `features/cases/cases-filters.tsx:75-92` usa un `Select`, aunque `components/combobox.tsx` existe y §5 lo pide para clínica. Hallazgo ya anotado, confirmado.
Fix propuesto: `Combobox` con la opción «Todas».

**UX3-15 — Tinta ámbar en modo oscuro: el modo oscuro no existe en la práctica**
Evidencia (en vivo): con `emulate colorScheme: dark`, el `body` sigue en `rgb(244, 246, 245)` y `<html>` no recibe la clase `.dark` (`prefers-color-scheme: dark` = `true`). No hay toggle ni `ThemeProvider` (`grep` sin resultados). El bloque `.dark` de `index.css:103-135` conserva valores de shadcn (`--primary` gris). El hallazgo ya anotado **se descarta como problema visible**; queda el riesgo de tokens sin probar.
Fix propuesto: borrar `.dark` hasta que se diseñe (la dirección de diseño, §8, dejó el tema oscuro para después) o probarlo entero.

**UX3-16 — Roles escritos a mano en la web**
Evidencia (`grep`): `role === 'admin' || role === 'recepcion'` en `case-header.tsx:43`, `photos-tab.tsx:27`, `case-detail-tab.tsx:116`, `case-form.tsx:120` y `routes/_app/trabajos/index.tsx:32`. La forma negada en `routes/_app/trabajos/nuevo.tsx:9` y `$caseId_.editar.tsx:16`. Hallazgo ya anotado, siete sitios.
Fix propuesto: las constantes de `shared` (`CASE_WRITE_ROLES`, `hidesPrices`).

**UX3-17 — «Incluye en prueba» a 11 px, sin número, y desalinea la tarjeta**
Evidencia (en vivo, `capturas/it3/inicio-admin-1280.png`): `font-size: 11px`, por debajo de la escala mínima de 12 px. La tarjeta «En curso» sube su número (7) respecto a las otras cinco, porque `justify-between` reparte tres hijos en vez de dos. El hallazgo ya anotado («de ellos N en prueba») queda **parcialmente resuelto**.
Causa: `features/cases/summary-cards.tsx:107,116`.
Fix propuesto: «de ellos {en_prueba} en prueba» a `text-xs`, con el número anclado igual que en las demás tarjetas (p. ej. `mt-auto` en el número y la nota debajo).

**UX3-18 — El técnico aparece dos veces en la ficha**
Evidencia (en vivo): «Técnico: Técnico UX It3» en la cabecera y la tarjeta «Técnico responsable» en «Detalle» (`case-header.tsx:103`, `case-detail-tab.tsx:121-125`).
Fix propuesto: con el panel «Producción» de UX3-05, quitar el campo de la cabecera.

**UX3-19 — El login al que lleva el QR no dice qué trabajo se abrirá**
Evidencia (en vivo, `capturas/it3/login-redirect-qr-390.png`): `/login?redirect=%2Ft%2F26-00001` es idéntico al login normal. La vuelta al destino sí funciona: el técnico y el mensajero aterrizaron en `/t/26-00069` y `/t/26-00072` tras entrar.
Fix propuesto: si el destino empieza por `/t/`, «Inicia sesión para abrir el trabajo 26-00001» bajo «Laboratorio dental».

**UX3-20 — La orden impresa usa en A4 los tamaños de A5 (7–10 px)** (solo código: el medio `print` no se pudo emular)
Evidencia: `print:text-[10px]` en el cuerpo, `print:text-[9px]` en piezas y material y `print:text-[7px]` en el odontograma (`print-order.tsx:40`), sin variante por tamaño de hoja. En la pantalla, el QR mide 96×96 px (≈ 25 mm impreso), suficiente para escanear.
Fix propuesto: tamaños base para A4 y reducción solo para A5; números del odontograma a ≥ 9 px.

**UX3-24 — El selector de técnico no está ordenado (nuevo)**
Evidencia (en vivo): «Técnico responsable» lista 27 técnicos en el orden de inserción de la BD: «Prueba Técnico», «Prueba Fix», 20 «Técnico E2E», … «Técnico UX It3» al final. Los homónimos vienen de los E2E de la BD de desarrollo, pero el orden es real: con 10–15 técnicos, recepción busca por nombre.
Causa: `apps/api/src/features/cases/repo.ts:536-541` (`activeTechnicians` sin `orderBy`).
Fix propuesto: `.orderBy(asc(users.name))`. Test de repo.

**UX3-25 — Huecos y encabezados en la ficha (nuevo)**
Evidencia (en vivo): cuando «Repetir» no aplica (p. ej. `26-00067`, nuevo), queda un `div.flex.justify-end` vacío de 0 px entre la tarjeta del técnico y «Líneas», que duplica el `gap-6` (48 px de hueco, `capturas/it3/ficha-nuevo-incompleto-1280.png`). Además, la ficha solo expone el `h1`: «Fase de producción», «Líneas», «Color y sistema»… son `CardTitle` sin rol de encabezado, así que un lector de pantalla no puede saltar entre secciones.
Causa: `case-detail-tab.tsx:127-131` (el `RemakeDialog` devuelve `null` dentro del contenedor) y `components/ui/card.tsx` (`CardTitle` como `div`).
Fix propuesto: no montar el contenedor si `!canRemake(status)`; `CardTitle` con `asChild` o un `h2` en las tarjetas de la ficha.

**UX3-26 — Historial: lo más reciente al fondo y comentario sin etiqueta (nuevo)**
Evidencia (en vivo, `capturas/it3/historial-admin-1280.png`): el formulario de comentario está arriba y la lista va de lo más antiguo a lo más reciente. En un trabajo largo, lo último que pasó queda al final. El `textarea` solo tiene placeholder («Escribe un comentario…»), sin etiqueta visible, y el piso de calidad (§7) pide etiquetas visibles en todos los campos.
Fix propuesto: orden de lo más reciente a lo más antiguo (o el formulario al pie) y la etiqueta «Comentario».

**UX3-27 — Ficha corta: «No encontrado» sin salida y «Avanzar fase» sin destino (nuevo)**
Evidencia (en vivo, `capturas/it3/ficha-corta-no-encontrado-390.png`): «No encontrado» sugiere «búscalo en la lista de trabajos», pero no ofrece un botón para ir. «Avanzar fase» no dice a qué fase lleva («Avanzar a Modelo»), y con un toque accidental el técnico solo puede deshacerlo desde la ficha completa y con motivo.
Fix propuesto: botón «Ir a trabajos» de 44 px en el `EmptyState` y rótulo «Avanzar a {siguiente}».

**UX3-28 — El inicio del técnico se abre con los contadores del laboratorio (nuevo)**
Evidencia (en vivo, `capturas/it3/inicio-tecnico-390.png`): a 390 px, las seis tarjetas del laboratorio («Nuevos 59», «Atrasados 9»…) ocupan la pantalla y «Mis trabajos» empieza en y = 513. Las tarjetas de «Mis trabajos» muestran una fecha sin decir de qué es («Recepción · En prueba · 09/10/2026»).
Fix propuesto: para el técnico, «Mis trabajos» primero y las tarjetas del laboratorio después (o solo «Vencen hoy» y «Atrasados»); «Entrega 09/10/2026».

## Verificación de los hallazgos ya anotados en #101

| # | Hallazgo anotado | Estado | Id / evidencia |
|---|---|---|---|
| 1 | Estados de error de red | **Confirmado, alcance mayor** | UX3-02: pantalla del router en inglés sin red (en vivo), login sin aviso (en vivo), y errores convertidos en datos falsos |
| 2 | 409 con claves crudas | **Confirmado en vivo** | UX3-03: `No se puede "marcar_entregado" un trabajo en estado "en_proceso"` |
| 3 | Icono ámbar de `cases-table.tsx` | **Confirmado, Critical** | UX3-01: 2,45:1, y en móvil sin texto visible |
| 4 | «de ellos N en prueba» | **Parcialmente resuelto** | UX3-17 |
| 5 | Técnico anterior como «Técnico» | **Confirmado en vivo, alcance mayor** | UX3-13: le pasa también a un técnico anterior activo |
| 6 | Filtro de clínica sin buscador | **Confirmado** | UX3-14 |
| 7 | Tinta ámbar en modo oscuro | **Descartado como problema visible** | UX3-15: `.dark` no se aplica ni con `prefers-color-scheme: dark` |
| 8 | Mensajero y «Añadir foto» | **Confirmado en vivo (decisión de producto)** | UX3-09 |
| 9 | Roles escritos a mano | **Confirmado, siete sitios** | UX3-16 |

## Aciertos (mantener)

- **Precios y notas internas, bien enmascarados en vivo**: el técnico y el mensajero no ven ningún `$` ni «Notas internas» en la ficha completa ni en la ficha corta; el admin sí.
- **Ficha corta para el banco**: «Avanzar fase» y «Añadir foto» de 358×56 px, «Ver ficha completa» de 44 px y cámara trasera directa. Avanzar desde el QR funcionó al primer toque (Empaque → Modelo).
- **La vuelta al QR tras el login funciona** para el técnico y el mensajero, con el destino validado por `safeRedirect`.
- **Ficha a 360 px**: ningún control interactivo por debajo de 44 px y sin scroll horizontal (`scrollWidth === clientWidth` en 1280, 390 y 360 en ficha, lista, inicio y ficha corta).
- **Acciones por estado y por rol** derivadas de `shared`: el técnico ve «Finalizar», el mensajero «Marcar enviado» en terminado, y nadie ve acciones en entregado o cancelado. El selector de técnico se vuelve de solo lectura donde la API respondería 409.
- **Aviso «En espera desde 03/10/2026: Esperando aprobación de color de la clínica»** con tinta ámbar legible, y «Para aceptar falta: Prescripción (texto o documento)» que explica por qué «Aceptar» está deshabilitado (`capturas/it3/ficha-en-espera-1280.png`).
- **La tarjeta de fase explica cada bloqueo** en lenguaje de laboratorio («El trabajo está en una prueba en boca: recíbela para poder cambiar de fase»).
- **El diálogo de motivo valida antes de enviar** («Escribe el motivo», con `aria-invalid`), y la confirmación nombra la consecuencia en lugar de un «¿estás seguro?».
- **La orden imprimible** reproduce la hoja en papel: odontograma con borde (no relleno), QR SVG de 96 px, checklist y firmas.
- **Consola limpia** en todo el recorrido con red, con los tres roles.

## Propuesta de ola de fixes

| # | Commit | Hallazgos | Tamaño | Test que lo cubre |
|---|---|---|---|---|
| 1 | `fix(web): iconos de vencimiento y urgencia legibles y con texto en móvil` | UX3-01 | S | `theme-tokens.test.ts`; `cases-table.test.tsx` |
| 2 | `fix(web): pantalla de error del router en español y errores de red distintos de «no existe»` | UX3-02 | M | Test del `errorComponent`; tests por pantalla con mocks de `api.ts` (red y 404) |
| 3 | `fix(shared): mensajes 409 legibles y toasts con el nombre de la acción` | UX3-03, UX3-11 | S | `applyAction` en `shared`; servicio con fakes; `use-cases` |
| 4 | `fix(web): panel «Producción» antes de las pestañas y jerarquía de acciones` | UX3-04, UX3-05, UX3-12, UX3-18, UX3-25 | M | `case-actions` (un primario); E2E de avanzar fase desde «Historial» |
| 5 | `fix(web): la ficha corta dice entrega y urgencia, oculta la fase fuera de producción y confirma la foto` | UX3-08, UX3-22, UX3-23, UX3-27 | S | `quick-case.test.tsx`; `use-photo-upload` |
| 6 | `fix(web): orden impresa con urgencia, copia sin precios y escala A4` | UX3-07, UX3-20, UX3-21 | S | `print-order.test.tsx`; `print-case-page.test.tsx`; E2E A4/A5 |
| 7 | `fix(web): la repetición propone el cobro según la responsabilidad` | UX3-06 | S | `remake-dialog.test.tsx` |
| 8 | Decisión de producto + issue de la Iteración 4 | UX3-09, UX3-21 (copias), UX3-28 | — | Al implementar: E2E del mensajero desde `/t/:code` |
| 9 | `refactor: roles de shared, combobox de clínica, técnicos ordenados, nombres en el historial, avisos del login` | UX3-10, UX3-13, UX3-14, UX3-16, UX3-17, UX3-19, UX3-24, UX3-26 | M | Tests de cada componente; repo de técnicos; `/eventos` con nombres |

UX3-15: borrar el bloque `.dark` o probarlo (decisión de Nelson).

## Resultado de la ola

Ola en la rama `fix/revision-ui-ux-it3` (plan `56e9e0d`, 9 tareas). Commits de `git log 56e9e0d..HEAD`; el detalle de cada revisión está en el ledger `.superpowers/sdd/2026-10-03-revision-ui-ux-it3/progress.md`.

| Hallazgo | Estado | Commit(s) |
|---|---|---|
| UX3-01 | Corregido | `e55896b`, `ab0eafb` |
| UX3-02 | Corregido | `818dfce`, `bf2448e`, `2134f85`, `a082597`, `d00dc28` |
| UX3-03 | Corregido | `7804eda`, `6242a80`, `137c806`, `4bca5ef` |
| UX3-04 | Corregido | `ab820f1`, `5623f7c`, `d85808d` |
| UX3-05 | Corregido | `5623f7c`, `15eee26`, `d85808d`, `db4e98b`, `4988e92`, `a56b11d` |
| UX3-06 | Corregido | `0b5a86c`, `b153a60`, `ae8b6ed` |
| UX3-07 | Corregido | `d3dc7db` |
| UX3-08 | Corregido | `f352a49`, `e4eb70d`, `6dcec6c` |
| UX3-09 | Diferido a la Iteración 4 (#105, historias ENT) | — |
| UX3-10 | Corregido | `be061c1`, `818dfce`, `a3d1506`, `82dca12` |
| UX3-11 | Corregido | `b2fbf30`, `37a9727` |
| UX3-12 | Corregido | `ae6f4ab`, `bb048d9`, `37a9727`, `1e69ca9` |
| UX3-13 | Corregido | `0f7a3a6`, `40f7fda`, `5b7a2c7` |
| UX3-14 | Corregido | `c198d86`, `e9b8196` |
| UX3-15 | Solo documentado: el modo oscuro no está activo en el MVP | `963b941` |
| UX3-16 | Corregido | `6081fe9`, `8c3b04e`, `ccfdfe6`, `409783f`, `88395c1`, `a2e3eda` |
| UX3-17 | Corregido | `6b99b99`, `f8bc5da` |
| UX3-18 | Corregido | `5623f7c`, `9526139` |
| UX3-19 | Corregido | `cee88e7` |
| UX3-20 | Corregido | `1d2dcca`, `bfcc439` |
| UX3-21 | Corregido (dos copias: laboratorio sin precios, clínica con precios) | `93d2961`, `3811381`, `78732e9` |
| UX3-22 | Corregido | `3391cb3`, `465c7a6`, `f456152`, `bcc3054` |
| UX3-23 | Corregido | `6f311f9` |
| UX3-24 | Corregido | `c14d63c` |
| UX3-25 | Corregido | `5623f7c`, `15eee26` |
| UX3-26 | Corregido | `0f7a3a6` |
| UX3-27 | Corregido | `465c7a6`, `f43c4fe` |
| UX3-28 | Corregido | `ac8a49c` |

La revisión final de la rama dejó solo hallazgos Minor; su ola de fixes está en la tabla junto al hallazgo que cierra: los 409 de fase pasan a `STAGE_MOVE_BLOCKED_REASON` en `shared` (UX3-03); las rutas de catálogos de la API usan `SETTINGS_ROLES`, `/cuentas` se protege con `ACCOUNTS_ROLES` y la convención precisa que «nunca `role === …`» es para permisos (UX3-16); `f43c4fe` da `h1` a «No encontrado» y a los estados vacíos de pantalla completa, visto en el recorrido de cierre (UX3-27).

## Capturas

Todas en `capturas/it3/`. Ninguna muestra credenciales: los formularios de login no se capturaron con datos reales y las contraseñas aparecen enmascaradas.

- Login: `login-vacio-1280.png`, `login-error-1280.png`, `login-redirect-qr-390.png`, `login-sin-red-390.png`, `login-360.png`
- Lista: `lista-ux-it3-1280.png`, `lista-tarjetas-390.png`
- Ficha: `ficha-nuevo-incompleto-1280.png`, `ficha-en-proceso-1280.png`, `ficha-en-proceso-390.png`, `ficha-en-espera-1280.png`, `ficha-terminado-1280.png`, `dialogo-pausar-vacio-1280.png`, `dialogo-repetir-1280.png`, `historial-admin-1280.png`, `historial-tecnico-390.png`
- Inicio: `inicio-admin-1280.png`, `inicio-tecnico-390.png`, `inicio-mensajero-360.png`
- Orden imprimible: `orden-imprimible-urgente-1280.png`
- Ficha corta: `ficha-corta-tecnico-390.png`, `ficha-corta-mensajero-terminado-360.png`, `ficha-corta-no-encontrado-390.png`
- Sin red: `sin-red-error-router-390.png`
