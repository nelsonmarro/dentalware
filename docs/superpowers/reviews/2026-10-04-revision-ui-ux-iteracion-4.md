# Revisión UI/UX — Iteración 4 (Entregas)

Fecha: 2026-10-04 · Revisor: Claude (frontend-design + chrome-devtools-mcp) · Issue: #115 · Rama: `fix/revision-ui-ux-it4`

## Alcance y método

Recorrido en Chrome DevTools a 1280×800, 390×844 y 360×740 con la BD de desarrollo. Todos los datos creados para la revisión llevan «UX It4» en el nombre:

- clínicas «Clínica UX It4 Norte» (con dirección larga y teléfono) y «Clínica UX It4 Sur» (sin dirección ni teléfono), con sus doctores;
- usuarios «Mensajero UX It4» y «Recepción UX It4», creados desde Configuración → Usuarios con una contraseña generada en el momento que no se guardó en ningún archivo;
- trabajos `26-00086` a `26-00097`:
  - recogidas para hoy (`26-00086`, `26-00087`);
  - recogida atrasada (`26-00088`);
  - recogida de otro mensajero, «Luis Mensajero T7» (`26-00089`);
  - recogida de un trabajo cancelado (`26-00090`);
  - entregas pendientes (`26-00091` urgente, `26-00092`);
  - terminado sin entrega (`26-00093`);
  - original y repetición (`26-00094` → `26-00096`);
  - trabajo que vence el siguiente día hábil (`26-00095`);
  - trabajo para provocar un 409 (`26-00097`).

La sesión de admin ya estaba abierta en el Chrome del MCP. El mensajero y recepción entraron en contextos aislados. Las medidas salen de `getBoundingClientRect`/`getComputedStyle`, y los contrastes se calcularon sobre el color real compuesto (fondo con alfa resuelto en un `canvas`). La causa de cada hallazgo se localizó leyendo el código.

**Límites del recorrido** (cada hallazgo afectado lo dice):

- **Hoy es domingo 4 de octubre.** Las fechas de la API no aceptan días pasados, así que la recogida atrasada se preparó con un `UPDATE deliveries SET scheduled_for = '2026-10-03'` directo en la BD de desarrollo. Es la única escritura fuera de la API.
- Los estados intermedios (aceptar, finalizar, marcar enviado, cancelar) se prepararon por la API de desarrollo. «Recibido», «No se pudo» y «Marcar entregado» con foto sí se ejecutaron desde la UI, como mensajero.
- El 409 se provocó en vivo: el mensajero tenía abierto el diálogo de entrega con la foto subida y recepción canceló el trabajo por la API.
- El chip «Por recoger» partido (UX4-14) se reprodujo cambiando en el DOM el paciente por un nombre largo ficticio. Los datos de prueba tenían referencias cortas.
- No se creó un técnico. Que no vea «Entregas» se verificó en el código: `DELIVERY_ROLES` en `app-shell.tsx:14`, `beforeLoad` en `routes/_app/entregas.tsx:12-14` y la prueba de `app-shell.test.tsx:34`.

## Resumen ejecutivo

La Iteración 4 cumple lo esencial para el mensajero:

- **Una sola pantalla del día** agrupada por clínica, con mapa y teléfono de 44 px.
- **Tarjetas con tipo, código, urgencia y atraso en texto**, sin fiarse solo del color. Los chips miden entre 4,5:1 y 5,9:1 sobre su fondo.
- **Un solo primario por tarjeta.**
- **Diálogos que nombran la acción y cierran con «Volver».**
- **Lo ajeno no aparece**: el mensajero no ve en la lista ni en la ficha corta las recogidas de otro mensajero.
- **Sin precios para el mensajero**: ni `$` ni notas internas en la ficha completa ni en la ficha corta.
- **Sin scroll horizontal y con todos los controles de 44 px** a 1280, 390 y 360 px en «Entregas», en el inicio del mensajero y en la ficha corta.
- **Consola limpia**: solo aparecen los 409 de red provocados a propósito.

Los problemas son de **permisos, de lo que pasa cuando algo falla y de qué información lleva cada pantalla**:

1. **El mensajero puede subir una «constancia» a cualquier trabajo** (201 en vivo sobre `26-00093`, que no tiene ninguna entrega suya). Es lo único que toca de otros, pero es una regla no negociable (UX4-01).
2. **Los enlaces de la repetición miden 20 px de alto** («Repetición de 26-00094», 239×20 a 390, y el código en «Repeticiones», 67×20) (UX4-02).
3. **Los fallos dejan restos o silencio**:
   - tras un 409, el diálogo de entrega sigue abierto, con «Marcar entregado» habilitado sobre un trabajo cancelado;
   - cada «Volver» deja una constancia huérfana, idéntica a la buena;
   - sin señal, «Recibido» se queda deshabilitado sin decir nada y se aplica solo cuando vuelve la red (UX4-05, UX4-06, UX4-11).
4. **Lo que el mensajero necesita no está en su pantalla**:
   - la ficha corta dice «Entrega: 09/10/2026», que es la fecha comprometida y no la de hoy, y no dice clínica ni dirección;
   - en un trabajo ajeno no explica por qué no hay botón;
   - los diálogos abiertos desde la lista no dicen qué trabajo se está cerrando (UX4-07, UX4-08, UX4-12).
5. **Recepción no ve la entrega en la ficha y no puede cambiar el mensajero**. «Vencen mañana» no es mañana en fin de semana, y su pestaña se solapa con la vecina (UX4-03, UX4-04, UX4-09, UX4-13).

Ninguno exige rediseño. El más grave (UX4-01) es una comprobación en el servicio de adjuntos.

## Pantallas × viewport

| Pantalla | 1280×800 | 390×844 | 360×740 |
|---|---|---|---|
| «Entregas» como admin y recepción: día, filtro de mensajero, grupos, estado vacío | UX4-18, UX4-19, UX4-20, UX4-23 · sin scroll | UX4-21 · sin scroll · 0 controles < 44 px | 0 controles < 44 px, sin scroll |
| «Entregas» como mensajero: «Recibido», «No se pudo», «Marcar entregado» con foto | — | UX4-10, UX4-12, UX4-15 · sin scroll | UX4-05, UX4-17 · sin scroll |
| «Entregas» sin red | — | UX4-11, UX4-26 | — |
| Inicio del mensajero | — | OK: «Ver todas» de 44 px, primera acción en y = 533 | — |
| Ficha corta del mensajero: propia, ajena y sin entrega | — | — | UX4-07, UX4-08, UX4-14 |
| Ficha completa: barra, «Marcar enviado», adjuntos, historial | UX4-06, UX4-09, UX4-16 | UX4-24 | — |
| Repeticiones y enlace al original | UX4-02, UX4-25 | UX4-02 | — |
| Nuevo trabajo con «Programar recogida» | — | OK, sin scroll | — |
| Inicio de recepción y vista «Vencen mañana» | UX4-03, UX4-04, UX4-22 | UX4-03 | — |

`—` = no recorrida a ese ancho porque repite un patrón ya verificado sin diferencias nuevas.

## Hallazgos

### Critical

**UX4-01 — El mensajero puede subir una constancia a cualquier trabajo**
Pantalla: API de adjuntos (la usan el diálogo de entrega y la ficha) · Viewports: todos
Evidencia (en vivo, como «Mensajero UX It4»):
- `POST /api/adjuntos/trabajo/{26-00093}` con `kind=constancia` responde **201**. `26-00093` está terminado, no tiene ninguna entrega pendiente y no es suyo.
- El historial de ese trabajo registra «Adjunto agregado» a su nombre.
- Además, `GET /api/adjuntos/trabajo/:id` le devuelve los adjuntos de cualquier trabajo, fotos clínicas incluidas. La regla «el mensajero solo actúa sobre lo suyo» (`canActOnDelivery`) se cumple en las acciones de estado, pero no en los adjuntos.

Confirma el hallazgo ya anotado.
Causa: `apps/api/src/features/attachments/service.ts:59-62`. Solo comprueba el rol (`DELIVERY_ROLES` para `constancia`), no que exista una entrega pendiente del trabajo asignada a ese mensajero.
Fix propuesto: un puerto `PendingDeliveryLookup` (inyectado en `app.ts` desde `deliveries`, ADR 34). Si `isProof` y el rol no está en `DELIVERY_MANAGE_ROLES`, exigir `canActOnDelivery(ctx, 'marcar_entregado', pending)`; si no, `AttachmentForbiddenError` (403). Valorar también limitar `list` del mensajero a sus trabajos con entrega pendiente. Tests: servicio con fakes (mensajero ajeno → 403; propio → 201) y ruta contra Postgres.

**UX4-02 — Los enlaces de la repetición miden 20 px de alto**
Pantalla: ficha (cabecera de la repetición y bloque «Repeticiones» del original) · Viewports: 390 (`capturas/it4/ficha-repeticion-enlace-original-390.png`) y 1280 (`capturas/it4/bloque-repeticiones-1280.png`)
Evidencia (en vivo): «Repetición de 26-00094» mide **239×20 px** a 390, y el código «26-00096» del bloque «Repeticiones» mide **67×20 px** a 1280. Los dos están por debajo del objetivo táctil de 44 px (ADR 14). Son el único camino entre el original y su repetición, y el barrido táctil no los cubre.
Causa: `apps/web/src/features/cases/case-header.tsx:76` y `apps/web/src/features/cases/remakes-list.tsx:55`, enlaces de texto sin `min-h-11`.
Fix propuesto: `inline-flex min-h-11 items-center` en los dos enlaces (o toda la fila del bloque como enlace). Añadir la ficha de una repetición y la de un original con repeticiones a `accesibilidad.spec.ts`.

### Important

**UX4-03 — En la lista de trabajos, la pestaña «Vencen mañana» se monta sobre sus vecinas**
Pantalla: Trabajos (vistas rápidas) · Viewports: 1280 y 390 (`capturas/it4/lista-vencen-manana-1280.png`, `capturas/it4/lista-vencen-manana-390.png`)
Evidencia (en vivo): las ocho pestañas miden **84 px** cada una, pero el texto «Vencen mañana» ocupa **94 px** (`scrollWidth`). Se sale 5 px por cada lado: se lee «Vencen ho**y**Vencen mañana**A**trasados», con letras pisadas.
Causa: `apps/web/src/components/ui/tabs.tsx:59` (`flex-1` + `whitespace-nowrap` reparten el ancho por igual) y la lista de `routes/_app/trabajos/index.tsx:88-92`. La octava vista llegó en esta iteración.
Fix propuesto: `className="flex-none px-3"` en los `TabsTrigger` de esa lista (ya va dentro de un `overflow-x-auto`), o `TabsList` con `w-max`. Test: E2E que compruebe que ninguna pestaña tiene `scrollWidth > clientWidth`.

**UX4-04 — «Vencen mañana» cuenta el siguiente día hábil, pero dice «mañana»**
Pantalla: inicio de recepción (tarjeta) y lista · Viewport: 1280 (`capturas/it4/inicio-recepcion-1280.png`)
Evidencia (en vivo, domingo 04/10): la tarjeta «Vencen mañana: 2» lista trabajos del **lunes 05/10**. En un viernes contaría los del lunes con el rótulo «mañana», que sería sábado. Por la condición de igualdad, un trabajo que vence el sábado no sale el viernes ni en «Vencen hoy» ni en «Vencen mañana»: aparece directamente en «Atrasados» el lunes.
Causa: `apps/api/src/features/cases/repo.ts:149,157-160` (`effectiveDate = siguienteDiaHabil`) y el rótulo de `apps/web/src/features/cases/case-views.ts:8`.
Fix propuesto:
- condición `effectiveDate > hoy AND effectiveDate <= siguienteDiaHabil`;
- rótulo que diga el día: «Vencen el lunes», derivado en `shared`, o «Próximo día hábil».

Test de repo con reloj fijo en viernes y en domingo (ADR 32).

**UX4-05 — Tras un 409, el diálogo de entrega sigue abierto sobre el estado nuevo**
Pantalla: «Entregas» → «Marcar entregado» · Viewport: 360 (`capturas/it4/dialogo-entregar-tras-409-360.png`)
Evidencia (en vivo):
- con la foto subida en `26-00097`, recepción cancela el trabajo y el mensajero toca «Marcar entregado»;
- el toast avisa bien («No se puede "Marcar entregado": el trabajo está en estado "Cancelado". Puede que otra persona lo haya cambiado.») y la tarjeta de fondo ya dice «Cancelado»;
- pero el diálogo **sigue abierto**, con «Constancia lista» y «Marcar entregado» habilitado.

Desde la ficha corta, el mismo caso cierra el diálogo, porque `CaseActions` se desmonta al quedarse sin acciones. En la ficha completa de un trabajo que otro marcó entregado, «Repetir» mantiene montada la barra (por código).
Hallazgo ya anotado, confirmado.
Causa: `apps/web/src/features/deliveries/delivery-card.tsx:128-136`. El estado `dialog` no depende de `canClose`, y `deliver-dialog.tsx:40-43` solo cierra en `onSuccess`.
Fix propuesto: cerrar el diálogo en el `onError` del 409 (por ejemplo, `onConflict` en `useCaseAction`), o desmontarlo cuando `!canClose` en la tarjeta. Test de componente con el mock de `api.ts` rechazando con `ApiError(409)`.

**UX4-06 — Constancias huérfanas que no se distinguen de la buena, y se pueden borrar sin aviso**
Pantalla: diálogo de entrega y pestaña «Adjuntos» · Viewport: 1280 (`capturas/it4/adjuntos-constancias-duplicadas-1280.png`)
Evidencia:
- **En vivo**: en `26-00092` el mensajero subió la foto, tocó «Volver» y la volvió a abrir. El diálogo **no reutiliza** la foto ya subida («Tomar foto de constancia» de nuevo).
- **En vivo**: «Adjuntos (2)» muestra dos miniaturas «constancia.jpg» idénticas, sin marca de cuál cerró la entrega. El historial registra dos «Adjunto agregado».
- **Por código**: borrar la constancia ligada usa el `ConfirmDialog` genérico («¿Eliminar "constancia.jpg"?») y la FK `proof_attachment_id` es `ON DELETE SET NULL`. La entrega queda «Hecha» sin foto, sin ninguna señal.

Confirma dos hallazgos ya anotados.
Causa:
- `apps/web/src/features/cases/deliver-dialog.tsx:30-36`: la foto vive en el estado del diálogo;
- `apps/api/src/features/attachments/service.ts:142-152`: `remove` no mira las entregas;
- `apps/api/drizzle/20261004015908_bored_captain_america/migration.sql:26`.

Fix propuesto:
- al abrir, el diálogo propone la última constancia del trabajo que no esté ligada a ninguna entrega («Usar la foto ya tomada» / «Cambiar foto»);
- en «Adjuntos», un chip «Constancia de entrega 04/10» en la que tiene `proofAttachmentId`;
- la API responde 409 al borrar una constancia ligada, con «Esta foto es la constancia de la entrega del 04/10».

Tests: diálogo con una constancia previa, servicio de adjuntos con fakes y la ruta DELETE.

**UX4-07 — La ficha corta del mensajero da la fecha equivocada y no dice adónde ir**
Pantalla: `/t/:code` (mensajero) · Viewport: 360 (`capturas/it4/ficha-corta-mensajero-entrega-360.png`)
Evidencia (en vivo): `26-00091`, con entrega programada **para hoy** con «Mensajero UX It4», muestra «**Entrega: 09/10/2026**», que es la fecha comprometida con la clínica. No aparecen la clínica, la dirección ni el teléfono. Al mensajero que escanea el QR en el laboratorio, la pantalla le dice que se entrega en cinco días y no le dice dónde.
Causa: `apps/web/src/features/cases/quick-case.tsx:109,151` (`promisedDate ?? dueDate` con el rótulo «Entrega»). La API solo expone `pendingDelivery { type, courierId }`, sin fecha programada ni nombre del mensajero.
Fix propuesto:
- ampliar `pendingDelivery` con `scheduledFor` y `courierName` (shared + API, enmascarado igual);
- para el mensajero, «Entregar hoy en Clínica UX It4 Norte», con el mismo botón de mapa y teléfono de `ClinicGroup`;
- para los demás roles, renombrar la fecha a «Fecha comprometida».

Test de `quick-case`.

**UX4-08 — En una entrega ajena o sin entrega, la ficha corta del mensajero no explica nada**
Pantalla: `/t/:code` (mensajero) · Viewport: 360 (`capturas/it4/ficha-corta-mensajero-ajena-360.png`)
Evidencia (en vivo): `26-00089`, recogida asignada a «Luis Mensajero T7», muestra solo «26-00089 · paciente · Por recoger · Entrega: 09/10/2026 · Ver ficha completa». En `26-00095` (nuevo, sin entrega) pasa lo mismo. No hay botón ni motivo, y el mensajero no sabe si la app falló o si no le toca.
Causa: `apps/web/src/features/cases/quick-case.tsx:187`. `CaseActions` devuelve `null` sin acciones, y la ficha corta no tiene rama para el mensajero sin acción (sí la tiene para el técnico: `blockedReason`).
Fix propuesto: para `deliversOnly(role)` sin acciones, una línea con el motivo: «Esta recogida la tiene Luis Mensajero T7» si hay una pendiente de otro, o «Este trabajo no tiene una entrega pendiente para ti». Test de `quick-case`.

**UX4-09 — La ficha completa no muestra la recogida ni la entrega**
Pantalla: ficha (por recoger, enviado, entregado) · Viewport: 1280 (`capturas/it4/ficha-enviado-admin-1280.png`)
Evidencia (en vivo):
- `26-00091` (enviado) muestra estado, fechas y «Marcar entregado», pero no dice con quién salió ni para cuándo; eso solo está en «Historial».
- `26-00087` (por recoger) no dice quién la recoge ni cuándo.
- `26-00092` (entregado) no dice quién la entregó ni enlaza la constancia.

Cuando la clínica llama a preguntar, recepción tiene que abrir el historial y leer los eventos.
Causa: `apps/web/src/features/cases/case-header.tsx` y `production-panel.tsx` no tienen datos de entrega; la API no los devuelve (ver UX4-07).
Fix propuesto: una línea en el panel «Producción» (o un bloque «Entrega»): «Recogida programada para hoy con Mensajero UX It4», «Sale el 04/10 con …» o «Entregado el 04/10 por … · Ver constancia». Tests de la ficha y del DTO.

**UX4-10 — «Recibido» no dice qué hace el mensajero ni qué le pasa al trabajo**
Pantalla: «Entregas» y ficha corta (mensajero) · Viewports: 390/360 (`capturas/it4/entregas-grupo-clinica-360.png`)
Evidencia (en vivo):
- el botón de la recogida es «**Recibido**», un participio y no un verbo;
- tras tocarlo, el toast dice «Trabajo recibido», el chip de la tarjeta «**Hecha**» y el historial «**Recibido en el laboratorio**»;
- el mensajero lo toca al recoger en la clínica, y en ese momento el trabajo pasa a «Nuevo» (en el laboratorio) aunque sigue en su moto.

Son cuatro palabras para el mismo hecho, y una describe un lugar que no es verdad todavía.
Causa: `CASE_ACTION_LABEL.recibir` (`packages/shared/src/case-status.ts`), `apps/web/src/features/cases/case-history.tsx:49` y `DELIVERY_STATUS_LABEL.hecha` (`packages/shared/src/deliveries.ts`).
Fix propuesto (decisión de producto): si «recibir» lo hace el mensajero en la clínica, botón «**Recogido**» o «Marcar recogido», historial «Recogido por {mensajero}» y chip «Recogida hecha». Si debe hacerlo recepción al llegar, quitar `mensajero` de `CASE_TRANSITIONS.recibir.roles`. Test literal en `shared`.

**UX4-11 — Sin red, las acciones de entrega se quedan en pausa sin avisar y se aplican solas después**
Pantalla: «Entregas» · Viewport: 390 (`capturas/it4/recibido-sin-red-pausado-390.png`)
Evidencia (en vivo, con `networkConditions: Offline`):
- tras tocar «Recibido» en `26-00088`, durante ocho segundos «Recibido» y «No se pudo» quedan **deshabilitados**, sin toast, sin «Sin conexión» y sin `role="status"`;
- al volver la red, la mutación pausada **se envió sola** y apareció «Trabajo recibido».

El mensajero en la calle no sabe si registró la recogida, y puede reintentarla desde otra pantalla o pensar que falló.
Causa: `apps/web/src/main.tsx:12-14`. El `QueryClient` usa el `networkMode: 'online'` por omisión, que pausa las mutaciones sin conexión, y ninguna pantalla lo muestra.
Fix propuesto: un aviso global «Sin conexión: lo que marques se enviará al volver la señal», con `onlineManager`/`useIsMutating` y `role="status"`. O `networkMode: 'always'` en las mutaciones, para fallar al momento con «No se pudo guardar: sin conexión». Decidir y anotar en `conventions.md` §5. Test con `onlineManager.setOnline(false)`.

**UX4-12 — Los diálogos abiertos desde la lista no dicen qué trabajo cierran, y «No se pudo» obliga a escribir**
Pantalla: «Entregas» → «No se pudo» y «Marcar entregado» · Viewport: 390 (`capturas/it4/dialogo-no-se-pudo-vacio-390.png`, `capturas/it4/dialogo-entregar-sin-foto-390.png`)
Evidencia (en vivo):
- el título es «No se pudo recoger» o «Marcar entregado», sin código, clínica ni paciente;
- con seis tarjetas en pantalla y el diálogo tapando la lista, el mensajero no puede comprobar que eligió la buena;
- el motivo es un `textarea` libre que abre el teclado al entrar (foco automático): con guantes y prisa, escribir «Clínica cerrada» cuesta;
- el texto de «Marcar entregado» habla de «la cuenta de la clínica», un dato contable que al mensajero no le dice nada.

Causa: `apps/web/src/features/deliveries/fail-dialog.tsx:68-69,89` y `apps/web/src/features/cases/deliver-dialog.tsx:50-51`.
Fix propuesto:
- descripción que empiece por «26-00087 · Clínica UX It4 Sur»;
- en «No se pudo», chips de motivo frecuente («Clínica cerrada», «Nadie para recibir», «Dirección incorrecta», «Falta pago») que rellenan el campo y se pueden editar, sin foco automático en el `textarea`;
- para el mensajero, «Se registrará la entrega con la fecha de hoy. No hay ninguna acción para deshacerlo.».

Tests de los dos diálogos.

**UX4-13 — Recepción no puede cambiar el mensajero de una recogida o entrega**
Pantalla: «Entregas» y ficha · Viewports: todos
Evidencia:
- **Código**: `apps/api/src/features/deliveries/routes.ts` solo expone `GET /mensajeros`, `GET /` y `POST /:id/fallida`, y «No se pudo» reprograma «**con el mismo mensajero**» (`fail-dialog.tsx:27-32`).
- **Código**: la recogida solo se programa al crear el trabajo (`case-form.tsx:236-237`); un trabajo creado sin ella no puede tenerla después.
- **En vivo**: «Reprogramar» no ofrece elegir mensajero.

Si un mensajero falta, sus entregas se quedan asignadas a él y nadie más las ve como suyas.
Fix propuesto (decisión de producto, historia ENT): en `FailDialog`, para `DELIVERY_MANAGE_ROLES`, un `CourierSelect` («Mensajero para la nueva fecha», el mismo por omisión), y la API acepta `mensajeroId` en `deliveryFailSchema`. Valorar «Reasignar» en la tarjeta para recepción. Tests de servicio y de diálogo.

### Minor

**UX4-14 — El chip de estado de la ficha corta se parte en dos líneas**
Evidencia: con una referencia de paciente larga (simulada en el DOM: «María Fernanda Villacís Andrade de Cevallos»), el chip «Por recoger» pasa de 95×22 a **73×38 px**, con «Por / recoger» en dos líneas (`capturas/it4/ficha-corta-chip-por-recoger-partido-360.png`). Con referencias cortas no se parte (`capturas/it4/ficha-corta-mensajero-ajena-360.png`). Hallazgo ya anotado, confirmado con nombre largo.
Causa: `apps/web/src/features/cases/quick-case.tsx:140-145` (fila `justify-between` sin `shrink-0`) y `status-chip.tsx:32` (sin `whitespace-nowrap`).
Fix propuesto: `shrink-0 whitespace-nowrap` en `StatusChip` (o en su contenedor de la ficha corta). Test de `quick-case` con un paciente largo.

**UX4-15 — Doble aviso al entregar**
Evidencia (en vivo, `26-00092`): «Foto añadida» al subir y «Marcado como entregado» al confirmar. La miniatura con «Constancia lista» ya confirma la foto; el primer toast tapa el diálogo en el móvil. Hallazgo ya anotado, confirmado.
Causa: `apps/web/src/features/cases/use-photo-upload.ts:55-56` (siempre anuncia).
Fix propuesto: opción `silent` en `usePhotoUpload`, usada por `DeliverDialog`. Test del hook.

**UX4-16 — El historial no dice el tipo de lo que falló ni enlaza la constancia**
Evidencia (en vivo, `capturas/it4/historial-no-se-pudo-1280.png`):
- `26-00087` muestra «**Entrega o recogida fallida** · Motivo: Clínica cerrada por la tarde — nueva fecha 05/10/2026»;
- `26-00092` muestra «Entregado · Con foto de constancia», sin enlace a la foto, y dos «Adjunto agregado» sin nombre ni tipo.

Confirma el hallazgo ya anotado (comentario del PR 2).
Causa: `apps/web/src/features/cases/case-history.tsx:50,157`; el evento `delivery_failed` no guarda el tipo.
Fix propuesto: guardar el tipo en `fromValue` («No se pudo recoger» / «No se pudo entregar»), y «Ver constancia» como enlace al adjunto del evento `delivered`. Tests de servicio y de `case-history`.

**UX4-17 — La entrega de un trabajo cancelado: chip distinto y sin motivo**
Evidencia (en vivo, `capturas/it4/entregas-trabajos-cancelados-360.png`, `capturas/it4/entregas-trabajos-cancelados-1280.png`):
- La regla del fix M-3 se cumple en los tres viewports:
  - solo la entrega que cerró la cancelación dice «Cancelado» (`26-00090`, `26-00091`, `26-00097`);
  - la recogida ya «Hecha» de `26-00086` y la fallida real de `26-00087` conservan su estado y su motivo después de cancelar esos trabajos.
- Se entiende que ya no hay que ir. Pero el chip es el del **trabajo** («● Cancelado», con punto y en otra línea a 360 px), distinto de «Hecha» y «Fallida»; no lleva el motivo de la cancelación, y en `26-00091` convive con «Urgente», que ya no aplica.
- La recogida «Hecha» y la «Fallida» de un trabajo cancelado no dicen que el trabajo se canceló.
- **Borde (por código)**: un «No se pudo» cuyo motivo empiece por «Trabajo cancelado: » se vería como cancelado; `deliveryFailSchema` no lo impide.

Hallazgos ya anotados, confirmados.
Causa: `apps/web/src/features/deliveries/delivery-card.tsx:91-97` y `packages/shared/src/deliveries.ts` (`isClosedByCancellation` por prefijo).
Fix propuesto:
- chip de entrega «Anulada» con «Trabajo cancelado: {motivo}» debajo;
- sin «Urgente» en lo cerrado;
- una nota «Trabajo cancelado» en las cerradas de trabajos cancelados;
- rechazar en el schema un motivo con ese prefijo, o mejor una columna `closed_by_cancel`.

**UX4-18 — El resumen del día no cuenta lo fallido ni lo anulado, y la fallida no dice su nueva fecha**
Evidencia (en vivo): «5 pendientes · 1 atrasada» para el mensajero y «9 pendientes · 2 atrasadas · 3 hechas» para admin, a 14 px gris (5,18:1). No menciona la fallida ni las anuladas. La tarjeta fallida dice el motivo pero no «Reprogramada para el 05/10».
Causa: `apps/web/src/features/deliveries/deliveries-day.tsx:95-104` y `delivery-card.tsx:104-106`.
Fix propuesto: «· 1 no se pudo · 1 anulada» en el resumen, y «Nueva fecha: 05/10/2026» en la tarjeta fallida (el dato está en el evento o en la nueva entrega).

**UX4-19 — Dentro de una parada, lo urgente no sube**
Evidencia (en vivo, `capturas/it4/entregas-admin-1280.png`): en «Clínica UX It4 Norte», la entrega **urgente** `26-00091` sale después de dos recogidas normales.
Causa: `rank` en `apps/web/src/features/deliveries/deliveries-day.tsx:12-16` (atrasada, pendiente, cerrada; sin prioridad).
Fix propuesto: dentro de las pendientes, primero lo urgente. Test de `deliveries-day`.

**UX4-20 — Alineación y repeticiones en «Entregas» a 1280**
Evidencia (en vivo, `capturas/it4/entregas-recepcion-filtro-mensajero-1280.png`):
- la lista tiene `max-w-4xl` (896 px), pero el filtro de mensajero queda pegado al borde derecho (x ≈ 977–1233), fuera de la columna;
- los botones de acción tienen anchos distintos según su texto, y «No se pudo» no se alinea entre tarjetas;
- con el filtro puesto, cada tarjeta repite «Mensajero: Mensajero UX It4»;
- el estado vacío ocupa todo el ancho y la lista no.

Causa: `apps/web/src/routes/_app/entregas.tsx:34-40`, `deliveries-day.tsx:93` y `delivery-card.tsx:102`.
Fix propuesto: el mismo `max-w-4xl` para la barra de filtros y el estado vacío; ancho mínimo común para las acciones (`sm:min-w-40`); ocultar «Mensajero:» cuando hay filtro por mensajero.

**UX4-21 — El enlace al mapa busca la dirección sin la ciudad y no avisa de que sale de la app**
Evidencia (en vivo): «Av. Amazonas N34-56» se busca tal cual en Google Maps, aunque la clínica tiene `city` = «Quito». El enlace abre otra pestaña y su nombre accesible es solo la dirección. «Clínica UX It4 Sur», sin dirección ni teléfono, no da ninguna pista de cómo llegar, y el WhatsApp de la clínica no aparece.
Causa: `apps/web/src/features/deliveries/map-link.ts:4-6` y `clinic-group.tsx:45`. `GET /api/entregas` no trae `city` ni `whatsapp`.
Fix propuesto: `mapUrl(address, city)`, `aria-label="Abrir en el mapa: …"`, el enlace de WhatsApp (`wa.me`) y «Sin dirección registrada» cuando falta.

**UX4-22 — Inicio de recepción: «Listos» sola en la segunda fila y nada de entregas**
Evidencia (en vivo, `capturas/it4/inicio-recepcion-1280.png`): siete tarjetas en una rejilla de seis columnas, así que «Listos» queda sola en otra fila. El inicio no dice nada de las entregas del día (pendientes, atrasadas, fallidas): recepción solo se entera si abre «Entregas».
Causa: `apps/web/src/features/cases/summary-cards.tsx:40` (`lg:grid-cols-6`).
Fix propuesto: `lg:grid-cols-4` (dos filas parejas) o `xl:grid-cols-7`, y una tarjeta «Entregas de hoy» con pendientes y atrasadas que enlace a `/entregas`.

**UX4-23 — Selector de día y estados vacíos**
Evidencia (en vivo, `capturas/it4/entregas-vacio-1280.png`):
- el `input type="date"` sigue el idioma del navegador («10/04/2026» con el Chrome en inglés, que se lee 10 de abril); el rótulo «Hoy · domingo, 4 de octubre» lo compensa;
- los vacíos no son invitaciones y no siguen el mismo formato: «No tienes entregas hoy» sin punto, «No hay entregas ni recogidas este día.» con punto.

Causa: `apps/web/src/features/deliveries/day-picker.tsx:54-62` y `deliveries-day.tsx:81-82`.
Fix propuesto: `lang="es-EC"` en el input y textos con salida («No hay entregas este día. Usa las flechas para ver otro día»).

**UX4-24 — «Producción» encabeza las acciones de envío y entrega**
Evidencia (en vivo, `capturas/it4/ficha-enviado-admin-1280.png`): en enviado y por recoger, el panel se llama «Producción» y sigue mostrando «Técnico responsable» editable, aunque lo que toca hacer es entregar o recibir.
Causa: `apps/web/src/features/cases/production-panel.tsx` (título fijo).
Fix propuesto: título por estado derivado de `shared` («Recogida», «Producción», «Entrega»). La línea de UX4-09 va en ese mismo panel.

**UX4-25 — El original no avisa de que tiene repetición**
Evidencia (en vivo, `capturas/it4/bloque-repeticiones-1280.png`): en `26-00094`, «Repeticiones» empieza en y = 1237 de una página de 1389 px, al final de «Detalle», y no se ve desde «Adjuntos» ni «Historial». La cabecera no dice que el trabajo se repitió.
Causa: `apps/web/src/routes/_app/trabajos/$caseId.tsx:88`.
Fix propuesto: un chip «Repetido: 26-00096» en la cabecera, de 44 px y enlazado, junto al estado.

**UX4-26 — Sin red, cambiar de día en «Entregas» tapa la lista ya cargada**
Evidencia (en vivo, `capturas/it4/entregas-sin-red-390.png`): sin conexión, tocar «Día siguiente» lleva a la pantalla completa «No hay conexión con el servidor», sin barra de navegación. La lista de hoy, ya en caché, desaparece.
Causa: `beforeLoad` de `_app` (`getSession` en cada navegación) y el `defaultErrorComponent` (UX3-02).
Fix propuesto: en `beforeLoad`, si `getSession` falla por red y ya hay sesión en caché, dejar pasar y que la consulta muestre su `LoadError` en línea.

## Verificación de los hallazgos ya anotados en #115

| # | Hallazgo anotado | Estado | Id / evidencia |
|---|---|---|---|
| 1 | El chip «Por recoger» se parte en dos líneas a 360 px en la ficha corta | **Confirmado con paciente largo** | UX4-14: 73×38 px, simulado en el DOM; con referencias cortas, 95×22 |
| 2 | «Cambiar foto», «Volver» o Escape dejan una constancia sin usar | **Confirmado en vivo** | UX4-06: dos «constancia.jpg» idénticas en `26-00092` |
| 3 | Tras un 409, el diálogo de entrega sigue abierto | **Confirmado en vivo en «Entregas»** (en la ficha corta se cierra) | UX4-05 |
| 4 | Doble aviso «Foto añadida» + «Marcado como entregado» | **Confirmado en vivo** | UX4-15 |
| 5 | Borrar una constancia deja la entrega sin foto | **Confirmado por código** (FK `SET NULL`, confirmación genérica) | UX4-06 |
| 6 | Un mensajero puede subir una constancia a cualquier trabajo | **Confirmado en vivo, Critical** | UX4-01: 201 sobre `26-00093` |
| 7 | La entrega de un trabajo cancelado, ¿se entiende? | **Se entiende; falta el motivo y el chip es el del trabajo** | UX4-17 |
| 8 | `delivery_failed` no dice si fue recogida o entrega | **Confirmado en vivo** | UX4-16 |
| 9 | Solo la entrega cerrada por la cancelación dice «Cancelado» (M-3) | **Confirmado en vivo a 1280, 390 y 360**; el borde del prefijo, confirmado por código | UX4-17 |

## Aciertos (mantener)

- **Una pantalla, una ruta**: grupos por clínica en orden alfabético, con la dirección y el teléfono como botones de 44 px y la dirección completa visible (no se trunca: 296×78 px a 360). El `region` con el nombre de la clínica deja al lector de pantalla saltar de parada en parada.
- **Nunca solo color**: tipo («Recogida»/«Entrega») con icono y texto, «Urgente», «Atrasada», «Hecha», «Fallida». Contrastes medidos entre **4,5:1 y 5,9:1** en tarjetas abiertas y cerradas. Las cerradas se atenúan con el fondo, no con `opacity`, y conservan el AA.
- **Un primario por tarjeta** («Recibido»/«Marcar entregado») y «No se pudo» secundario, a ancho completo en el móvil.
- **El mensajero solo ve lo suyo**: la recogida de «Luis Mensajero T7» no aparece en su lista ni tiene botón en su ficha corta. La API filtra y la web usa la misma `canActOnDelivery`.
- **Sin precios para el mensajero** en la ficha completa ni en la ficha corta (sin `$` ni «Notas internas», en vivo).
- **«Marcar entregado» exige la foto**: el botón no se habilita hasta «Constancia lista» con su miniatura, y la cámara trasera se abre directamente.
- **«No se pudo» valida** («Escribe el motivo», con `aria-invalid`), propone el siguiente día hábil y avisa «Reprogramada para el 05/10/2026».
- **El inicio del mensajero es su trabajo del día**: «Entregas de hoy» con sus acciones, la primera en y = 533 a 390, y «Ver todas» de 44 px. Sustituye a los contadores del laboratorio (cierra UX3-09).
- **Recepción filtra por mensajero** desde la URL. El técnico no tiene «Entregas» en la navegación ni en la ruta (código y test).
- **Los 409 se leen**: «No se puede "Marcar entregado": el trabajo está en estado "Cancelado". Puede que otra persona lo haya cambiado.», con rótulos y no claves (UX3-03 se mantiene).
- **Fallo de carga ≠ vacío**: `LoadError` en la lista y la pantalla del router en español sin red.
- **Sin scroll horizontal** (`scrollWidth === clientWidth`) en «Entregas», el inicio del mensajero, la ficha corta, la ficha, el formulario y la lista, a 1280, 390 y 360.
- **Consola limpia** en todo el recorrido; solo aparecen los 409 provocados.

## Propuesta de ola de fixes

| # | Commit | Hallazgos | Tamaño | Test que lo cubre |
|---|---|---|---|---|
| 1 | `fix(api): el mensajero solo sube constancias de sus entregas pendientes` | UX4-01 | S | Servicio de adjuntos con fakes; ruta contra Postgres (403 ajeno) |
| 2 | `fix(web): enlaces de repetición de 44 px y pestañas de vistas sin solaparse` | UX4-02, UX4-03, UX4-25 | S | `accesibilidad.spec.ts` (ficha de repetición); E2E de pestañas |
| 3 | `fix(web): el diálogo de entrega se cierra tras un 409, reutiliza la constancia y no avisa dos veces` | UX4-05, UX4-06 (web), UX4-15 | M | `deliver-dialog.test.tsx`; `delivery-card` con 409; `use-photo-upload` |
| 4 | `fix(api): constancia ligada a la entrega, marcada en adjuntos y protegida al borrar` | UX4-06 (api), UX4-16 | M | Servicio de adjuntos; `case-history` |
| 5 | `feat: la ficha y la ficha corta muestran la entrega pendiente (fecha, mensajero, clínica)` | UX4-07, UX4-08, UX4-09, UX4-24 | M | DTO de shared; `quick-case`; `production-panel` |
| 6 | `fix: «Vencen mañana» como siguiente día hábil, con su rótulo` | UX4-04 | S | Repo con reloj fijo (viernes y domingo) |
| 7 | `fix(web): aviso sin conexión en las acciones de entrega` | UX4-11, UX4-26 | S | Test con `onlineManager`; convención en `conventions.md` §5 |
| 8 | Decisión de producto + issue | UX4-10 («Recibido»), UX4-13 (reasignar mensajero) | — | Al implementar: test literal en `shared`; servicio de `fail` con `mensajeroId` |
| 9 | `fix(web): pulido de «Entregas»` | UX4-12, UX4-14, UX4-17, UX4-18, UX4-19, UX4-20, UX4-21, UX4-22, UX4-23 | M | Tests de `deliveries-day`, `delivery-card`, `fail-dialog`, `map-link`, `summary-cards` |

## Capturas

Todas en `capturas/it4/`. Ninguna muestra credenciales: los formularios de login y de usuario no se capturaron.

- Entregas:
  - admin: `entregas-admin-1280.png`, `entregas-admin-390.png`, `entregas-grupo-clinica-360.png`;
  - mensajero: `entregas-mensajero-390.png`, `entregas-mensajero-cerradas-360.png`;
  - recepción: `entregas-recepcion-filtro-mensajero-1280.png`;
  - trabajos cancelados: `entregas-trabajos-cancelados-360.png`, `entregas-trabajos-cancelados-1280.png`;
  - vacío y sin red: `entregas-vacio-1280.png`, `entregas-sin-red-390.png`, `recibido-sin-red-pausado-390.png`.
- Diálogos: `dialogo-no-se-pudo-vacio-390.png`, `dialogo-entregar-sin-foto-390.png`, `dialogo-entregar-con-foto-390.png`, `dialogo-entregar-tras-409-360.png`, `dialogo-marcar-enviado-390.png`
- Inicio: `inicio-mensajero-390.png`, `inicio-recepcion-1280.png`
- Ficha corta: `ficha-corta-mensajero-entrega-360.png`, `ficha-corta-mensajero-ajena-360.png`, `ficha-corta-chip-por-recoger-partido-360.png`
- Ficha: `ficha-enviado-admin-1280.png`, `historial-no-se-pudo-1280.png`, `adjuntos-constancias-duplicadas-1280.png`, `bloque-repeticiones-1280.png`, `ficha-repeticion-enlace-original-390.png`
- Formulario y lista: `formulario-programar-recogida-390.png`, `lista-vencen-manana-1280.png`, `lista-vencen-manana-390.png`

## Resultado de la ola

Ola en la rama `fix/revision-ui-ux-it4` (plan `8164306`, 10 tareas). Commits de `git log 8164306..HEAD`; el detalle de cada revisión está en el ledger `.superpowers/sdd/2026-10-04-ola-fixes-ui-ux-it4/progress.md`.

| Hallazgo | Estado | Commit(s) |
|---|---|---|
| UX4-01 | Corregido | `8521161` |
| UX4-02 | Corregido | `fdb5070` |
| UX4-03 | Corregido | `6bae268`, `e6243b6`, `e32f51b` |
| UX4-04 | Corregido («Vencen mañana» hasta el siguiente día hábil; el viernes, «Vencen hasta el lunes») | `f86ae91`, `1e97d52` |
| UX4-05 | Corregido | `56ece50`, `c780577`, `cc77cb7`, `0088c68`, `9c5c814` |
| UX4-06 | Corregido (la constancia se sube al confirmar; la de la entrega se distingue y no se borra, ni en carrera con «Marcar entregado») | `868f9e5`, `385ecaa`, `8570551`, `dcde13d`, `5c67677`, `ae4e129`, `9264e0f` |
| UX4-07 | Corregido | `ed3cd51`, `fcc63a5`, `ab9327a` |
| UX4-08 | Corregido | `fcfb7d3`, `fcc63a5` |
| UX4-09 | Corregido | `83b63ae`, `44aa8db`, `fcc63a5` |
| UX4-10 | Corregido (decisión de Nelson: «Recibido» solo lo marcan admin y recepción) | `2032c4b` |
| UX4-11 | Corregido (aviso global sin conexión; las acciones siguen en pausa y se envían al volver la señal) | `0ba4d02` |
| UX4-12 | Corregido | `2c5161c`, `f45adad`, `7490919`, `68c3aac`, `798dc19` |
| UX4-13 | Post-MVP (#117): reasignar el mensajero de una recogida o entrega | — |
| UX4-14 | Corregido | `98985e4` |
| UX4-15 | Corregido | `868f9e5` |
| UX4-16 | Corregido | `c2fe3f8`, `44aa8db` |
| UX4-17 | Corregido | `2c5161c`, `271b878`, `e0aaaa1`, `1db0310` |
| UX4-18 | Corregido | `2c5161c`, `271b878`, `68c3aac`, `1db0310` |
| UX4-19 | Corregido | `2c5161c`, `271b878` |
| UX4-20 | Corregido | `6c074e0` |
| UX4-21 | Corregido | `2c5161c`, `e4abd17`, `e0aaaa1` |
| UX4-22 | Corregido | `e11a014`, `27d2b0a`, `68c3aac` |
| UX4-23 | Corregido | `6c074e0` |
| UX4-24 | Corregido | `5f73dc5` |
| UX4-25 | Corregido | `7d7ddea` |
| UX4-26 | Corregido (sin red, la navegación no tapa la pantalla y «Entregas» dice que el día se cargará al volver la señal) | `c47dda5`, `20a9d59` |

Cierre (Tarea 10): `9264e0f` cierra la carrera borrar contra «Marcar entregado» con la FK `RESTRICT`; `3503f95` anota en `conventions.md` §5 y en `architecture.md` lo nuevo de la ola (contexto y foco de los diálogos, «Anulada», motivos frecuentes, `ClinicContact`/`map-link`, reglas del día de `GET /api/entregas`); `ab9327a` amplía el barrido táctil a «Entregas» del mensajero, sus diálogos y la ficha corta de un trabajo enviado. Con un build de producción (`vite preview` y service worker activo), sin red se navega entre «Entregas», «Trabajos» e «Inicio» sin caer en la página de Chrome sin conexión y con el aviso «Sin conexión» a la vista; una recarga completa sin red también recibe la app del service worker, y sin sesión conocida en memoria sale el error del router (lo previsto en el plan).

Diferidos, con su motivo (ledger):

- **403 antes que 413/415 para el mensajero** al subir: el orden de las comprobaciones no cambia lo que puede hacer; solo cuál de los dos errores ve.
- **Carrera teórica entre `pendingFor` y el guardado de la constancia**: `marcar_entregado` vuelve a comprobar la entrega pendiente, así que no hay daño.
- **Pausar, cancelar y finalizar no se cierran solos tras un refresco**: un segundo toque da 409 sin daño.
- **Constancia usada por la vía de tolerancia** (admin o recepción sin entrega pendiente) que se ve «sin usar»: solo pasa con datos anteriores a la Iteración 4. Y el `cast` de `eventLabel`, que pasará a `isDeliveryType`.
- **«Ver constancia» da 404 en eventos viejos** cuya constancia se borró antes de la protección: solo datos de desarrollo.
- **`Promise.all` en `toDetail`** y la forma de `lastDelivered` repetida en dos puertos: rendimiento y duplicación menores, sin efecto visible.
- **Efecto de `document.fonts.ready` sin test unitario**: jsdom no tiene `document.fonts`; se comprobó en Chrome a 360 px.
- **Regla del rango de «Vencen mañana» duplicada en el repo y en su fake**: igual que el resto de vistas, que el fake reproduce para probar el servicio.
- **«Cargando…» sin fin en otras pantallas con la consulta en pausa y sin caché**: generalizarlo con `fetchStatus === 'paused'` es una tarea aparte.
- **Sesión conocida solo en memoria**: arrancar la app sin red cae en el error del router, como decide el plan.
- **El mensajero ve las fotos de cualquier trabajo** (ficha básica, spec §8): pendiente de valorar con Nelson desde la LOPDP.
