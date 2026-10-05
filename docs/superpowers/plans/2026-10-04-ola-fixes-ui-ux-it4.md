# Ola de fixes UI/UX de la Iteración 4 (#115)

Origen: `docs/superpowers/reviews/2026-10-04-revision-ui-ux-iteracion-4.md` (UX4-01..26: 2 Critical, 11 Important, 13 Minor). Rama `fix/revision-ui-ux-it4`. Ledger: `.superpowers/sdd/2026-10-04-ola-fixes-ui-ux-it4/progress.md`. Cierra #115 (regla 6 de `CLAUDE.md`: la ola va antes de construir la Iteración 5).

## Decisiones (no se re-litigan)

- **UX4-10** (Nelson, 2026-10-04): «Recibido» lo marca **recepción al llegar el trabajo al laboratorio**, no el mensajero.
  - `CASE_TRANSITIONS.recibir.roles` pasa a `['admin','recepcion']`.
  - El mensajero ve sus recogidas en «Entregas» (adónde ir, mapa, teléfono) y puede marcar «No se pudo», pero no «Recibido».
  - El historial «Recibido en el laboratorio» queda así porque ya es verdad.
- **UX4-13** (Nelson, 2026-10-04): reasignar el mensajero de una recogida o entrega queda **fuera por ahora**. Se crea un issue Post-MVP. «No se pudo» sigue reprogramando con el mismo mensajero.
- **UX4-04**: la vista sigue contando el siguiente día hábil, pero:
  - la condición pasa a `hoy < fecha ≤ siguiente día hábil`, para que lo del sábado no se pierda;
  - el rótulo dice el día cuando no es mañana («Vencen el lunes»), derivado en `shared`.
- **UX4-11**: sin red, las mutaciones siguen en pausa y se envían al volver (no se pierde lo marcado), pero la app lo **avisa siempre**: «Sin conexión: lo que marques se enviará al volver la señal» (`role="status"`). La convención va en `docs/conventions.md` §5.

## Restricciones globales

Las de `CLAUDE.md`, `docs/conventions.md` y `docs/architecture.md`:
- TDD (RED → GREEN, mutación sobre código de producción).
- Español en sentence case.
- Objetivos táctiles de 44 px; contraste AA, nunca solo color.
- `Record` exhaustivos; reglas en `shared`.
- Mocks solo de `api.ts`.
- Contraseñas de prueba solo con `testPassword()`; nunca literales.
- Verificación completa antes de cada commit: `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`.
- Chrome DevTools a 1280×800, 390×844 y 360×740, con consola limpia, en toda tarea de UI.
- Puertos 3000 y 5173 libres al terminar.
- Commits pequeños con `Refs #115`.
- Un implementador a la vez.

## Tareas

| # | Tarea | Hallazgos | Tests |
|---|---|---|---|
| 1 | El mensajero solo sube constancias de **sus** entregas pendientes (la API comprueba `canActOnDelivery` contra la entrega pendiente del trabajo) | UX4-01 | Servicio de adjuntos con fakes; ruta contra Postgres (403 si la entrega es ajena o no hay entrega) |
| 2 | Enlaces de la repetición de 44 px, pestañas de vistas que no se solapan, y el original avisa de que tiene repetición | UX4-02, UX4-03, UX4-25 | `accesibilidad.spec.ts`; E2E o test de pestañas (`scrollWidth ≤ clientWidth`) |
| 3 | El diálogo de entrega se cierra tras un 409, reutiliza la constancia ya subida en vez de crear otra, y avisa una sola vez | UX4-05, UX4-06 (web), UX4-15 | `deliver-dialog.test.tsx`, `delivery-card` con 409, `use-photo-upload` |
| 4 | Constancia ligada a la entrega: marcada en «Adjuntos», protegida al borrar si está ligada a una entrega hecha, e historial que dice el tipo de lo que falló y enlaza la constancia | UX4-06 (api), UX4-16 | Servicio de adjuntos; `case-history` |
| 5 | La ficha completa y la ficha corta muestran la entrega pendiente (fecha programada, mensajero, clínica, dirección y teléfono para el mensajero); la ficha corta del mensajero explica por qué no hay acción; la ficha completa dice con quién salió o quién lo entregó | UX4-07, UX4-08, UX4-09, UX4-24 | DTO en `shared`/API (enmascarado), `quick-case`, `production-panel` |
| 6 | «Vencen mañana»: rango hasta el siguiente día hábil y rótulo con el día | UX4-04 | Repo con reloj fijo (viernes y domingo), ADR 32; rótulo literal en `shared` |
| 7 | Aviso global sin conexión en las mutaciones, y «Entregas» no tapa la lista ya cargada al cambiar de día sin red | UX4-11, UX4-26 | Test con `onlineManager.setOnline(false)`; convención en §5 |
| 8 | «Recibido» solo para admin y recepción (decisión UX4-10) en shared, API y web; la tarjeta de recogida del mensajero sin «Recibido» | UX4-10 | Test literal de `CASE_TRANSITIONS.recibir`; servicio (mensajero → 403); `delivery-card` y `quick-case` |
| 9 | Pulido de «Entregas», sin la reasignación de mensajero:<br>• diálogos que nombran el trabajo y su clínica;<br>• chips de motivo en «No se pudo», sin foco automático;<br>• chip de estado sin partirse;<br>• trabajo cancelado;<br>• resumen del día;<br>• urgente arriba;<br>• alineación a 1280;<br>• mapa con la ciudad y aviso de que sale de la app;<br>• inicio de recepción;<br>• selector de día y estados vacíos | UX4-12, UX4-14, UX4-17, UX4-18, UX4-19, UX4-20, UX4-21, UX4-22, UX4-23 | Tests de `deliveries-day`, `delivery-card`, `fail-dialog`, `map-link`, `summary-cards` |
| 10 | Cierre:<br>• sección «Resultado de la ola» en el informe (hallazgo → commit);<br>• issue Post-MVP de UX4-13;<br>• barridos táctiles de lo nuevo;<br>• docs;<br>• verificación completa y E2E | — | E2E en escritorio y android |

Después: revisión final de la rama, ola de fixes y PR «Ola de fixes UI/UX de la Iteración 4» con `Closes #115`.
