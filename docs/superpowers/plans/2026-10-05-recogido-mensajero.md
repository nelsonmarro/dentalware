# «Recogido» del mensajero y «En camino al laboratorio» (#118) — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** el mensajero marca «Recogido» en la clínica (cierra su recogida y queda en el historial), recepción ve lo que viene «En camino al laboratorio» y marca «Recibido» al llegar, sin estado nuevo del trabajo.

**Architecture:**
- «Recogido» es una acción de la **entrega**, no del trabajo: `DeliveriesService.pickUp`, hermana de `fail`, en su `DeliveriesUnitOfWork`. Escribe `picked_up` por el puerto `CaseEventLog` (ADR 34).
- «Recibido» sigue siendo la acción de estado `recibir` (solo admin y recepción, UX4-10). Cierra la recogida solo si sigue pendiente, y pasa a escribir su propio evento `received`.
- «En camino» se **deriva** (trabajo en `por_recoger` + recogida hecha), en `shared`.

**Tech Stack:** pnpm 11, Node 24, Hono + Drizzle + Postgres (5433), React 19 + TanStack Query/Router, Vitest, Playwright.

**Spec:**
- issue #118 (decisión de Nelson, 2026-10-05);
- ENT-2 en `docs/superpowers/specs/2026-09-12-historias-de-usuario-mvp.md`;
- UX4-10 y O-1 en `docs/superpowers/reviews/2026-10-04-revision-ui-ux-iteracion-4.md` y en el ledger de la ola (`.superpowers/sdd/2026-10-04-ola-fixes-ui-ux-it4/progress.md`).

Rama `feat/recogido-mensajero`. Ledger: `.superpowers/sdd/2026-10-05-recogido-mensajero/progress.md`.

## Decisiones (no se re-litigan)

1. **Sin estado nuevo** (ADR 16). El trabajo sigue en `por_recoger` hasta «Recibido». «En camino al laboratorio» = `status === 'por_recoger'` y la última recogida está `hecha`, sin recogida pendiente.
2. **Eventos**:
   - `picked_up` pasa a significar «el mensajero recogió en la clínica». Guarda el nombre del mensajero **asignado** en `reason` (copia en el momento, como `pickup_scheduled`); `toValue` y `fromValue` van a `null`. Rótulo en el historial: «Recogido por {reason}».
   - «Recibido» (`recibir`) escribe un tipo nuevo, **`received`**, con el rótulo «Recibido en el laboratorio». Hace falta añadir el valor al enum `case_event_type` con `drizzle-kit generate`; la migración no se escribe a mano.
   - Los `picked_up` viejos que escribió `recibir` son solo datos de desarrollo: se pintan «Recogido» sin nombre si `reason` está vacío.
3. **Permiso** (`canMarkPickedUp` en shared):
   - solo recogidas;
   - admin y recepción, en cualquiera;
   - el mensajero, solo en la suya (`isOwnDelivery`).
4. **Qué se muestra en la UI**:
   - Recogida pendiente:
     - el mensajero ve «Recogido» (primario) y «No se pudo»;
     - recepción y admin ven, como hoy, «Recibido» (primario) y «No se pudo». No se les muestra «Recogido», aunque la API se lo permita, para no poner tres botones; si el trabajo llega en mano, «Recibido» cierra la recogida.
   - Recogida hecha con el trabajo aún en `por_recoger`:
     - todos ven «En camino al laboratorio · Recogido por {mensajero} a las {HH:MM}»;
     - recepción y admin, además, «Recibido».
5. **«Entregas» de hoy** suma, como las pendientes atrasadas, las recogidas **hechas en días anteriores** cuyo trabajo sigue en `por_recoger` (en camino). Si no, recepción las pierde de vista al cambiar de día.
6. **Concurrencia**: `pickUp` cierra la recogida con el cierre condicional que ya existe (`markDone`). Si «Recibido», «Cancelar» o «No se pudo» la cerraron antes, responde 409 con `DELIVERY_NOT_PENDING_MESSAGE`. «Recibido» tras «Recogido» no encuentra recogida pendiente y pasa sin cerrar nada (la rama de tolerancia ya existe para admin y recepción).

## Restricciones globales

- TDD: RED visto → GREEN → al menos una mutación sobre producción por comportamiento clave.
- Contraseñas de prueba solo con `testPassword()`; nunca un literal.
- Español en sentence case. 44 px, contraste AA, nunca solo color.
- `Record` exhaustivos y reglas en `shared` con test literal. Mocks solo de `api.ts`.
- Verificación completa antes de cada commit: `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`.
- Commits con `Refs #118`.
- Chrome DevTools a 1280×800, 390×844 y 360×740, con consola limpia, en lo visual.
- Puertos 3000 y 5173 libres al terminar; nunca `pkill` ni `killall`.
- Técnico y mensajero no reciben dinero en ningún DTO nuevo.

---

### Tarea 1: shared + API — `pickUp`, evento `received`, «en camino» en la ficha y en «Entregas»

**Files:**
- Modify:
  - `packages/shared/src/case-events.ts` (añadir `'received'` a `CASE_EVENT_TYPES`);
  - `packages/shared/src/deliveries.ts`;
  - `packages/shared/src/index.ts` si hace falta.
- Test: `packages/shared/src/deliveries.test.ts`, `packages/shared/src/case-events.test.ts` (si existe).
- Migración: `apps/api/drizzle/<timestamp>_case_event_received/` con `pnpm --filter @dentalware/api exec drizzle-kit generate --name case_event_received` (comprueba antes el script en `apps/api/package.json`) y `drizzle-kit check`.
- Modify:
  - `apps/api/src/features/cases/service.ts:112`: `recibir` pasa a `'received'`;
  - `apps/api/src/features/cases/ports.ts:264` y `apps/api/src/features/deliveries/ports.ts:83`: `deliveryInfo` devuelve también `lastPickedUp`;
  - `apps/api/src/features/deliveries/repo.ts:218` y `apps/api/src/features/cases/fakes.ts:515`;
  - `apps/api/src/features/cases/service.ts:186-195`: la ficha trae `lastPickedUp`.
- Modify:
  - `apps/api/src/features/deliveries/{ports,service,repo,routes,fakes,errors}.ts`;
  - `apps/api/src/app.ts`, para el adaptador de `CaseEventLog` si su tipo cambia.
- Test:
  - `apps/api/src/features/deliveries/service.test.ts`, `deliveries.test.ts`, `repo.test.ts`;
  - `apps/api/src/features/cases/service.test.ts:1055` (hoy espera `picked_up` al recibir), `cases.test.ts`.

**Interfaces (Produces, las usa la Tarea 2):**
- shared:
  ```ts
  export function canMarkPickedUp(
    actor: { role: UserRole; userId: string },
    delivery: DeliveryAssignment,
  ): boolean // solo type 'recogida'; DELIVERY_MANAGE_ROLES en cualquiera; mensajero solo la suya

  export type LastPickedUp = { doneAt: string /* ISO UTC */; courierName: string }

  /** ¿Viene en camino al laboratorio? Recogida hecha y trabajo aún por recoger, sin pendiente. */
  export function isInTransitToLab(
    status: CaseStatus,
    pending: DeliveryAssignment | null | undefined,
    lastPickedUp: LastPickedUp | null | undefined,
  ): boolean

  export const IN_TRANSIT_TO_LAB = 'En camino al laboratorio'
  /** «Recogido por Luis a las 10:32»; `time` ya formateada por el cliente. */
  export function pickedUpLine(courierName: string, time: string): string
  ```
- API:
  - `POST /api/entregas/:id/recogido` (sin cuerpo, `requireRole(DELIVERY_ROLES)`) → 200 con la `DeliveryRow` cerrada.
    - 403 si `canMarkPickedUp` es falso.
    - 409 `DELIVERY_NOT_PENDING_MESSAGE` si no existe, no está pendiente o la cerró otra petición.
    - 422 si es una entrega (`type: 'entrega'`) y no una recogida: `DeliveryInputError('Solo una recogida se marca como recogida')`.
  - El detalle del trabajo (`GET /api/trabajos/:id` y la ficha corta) trae `lastPickedUp: LastPickedUp | null`: la última recogida `hecha` con el nombre de su mensajero.
  - `GET /api/entregas?dia=<hoy>` incluye las recogidas `hecha` de días anteriores cuyo trabajo sigue en `por_recoger`. El repo filtra por `cases.status`; es un join de solo lectura, ADR 24.
  - `CaseEventLog.addEvent` acepta también `{ type: 'picked_up'; fromValue: null; toValue: null; reason: string /* nombre del mensajero */; actorId }`.

**Pasos:**

- [ ] **1. Shared (RED → GREEN).** Tests literales:
  - `canMarkPickedUp`:
    - mensajero en su recogida → `true`; en la ajena → `false`; en su **entrega** → `false`;
    - recepción y admin en cualquier recogida → `true`;
    - técnico → `false`.
  - `isInTransitToLab`:
    - `por_recoger` sin pendiente y con `lastPickedUp` → `true`;
    - con recogida pendiente → `false`;
    - `nuevo` con `lastPickedUp` → `false`;
    - `por_recoger` sin nada → `false`.
  - `pickedUpLine('Luis', '10:32')` → `'Recogido por Luis a las 10:32'`.
  - `CASE_EVENT_TYPES` contiene `'received'`.
  - `pnpm --filter @dentalware/shared build`.
- [ ] **2. Migración.** `drizzle-kit generate` añade `received` al enum. Comprueba que el SQL generado es `ALTER TYPE "case_event_type" ADD VALUE 'received'` (o equivalente) y que `drizzle-kit check` sale limpio.
- [ ] **3. `recibir` escribe `received`.** Cambia el test de `service.test.ts:1055` («hay evento picked_up») a `received` (RED) y luego `EVENT_TYPE_FOR_ACTION.recibir`. Añade un test de servicio: «Recibido» tras «Recogido» (recogida ya `hecha`, sin pendiente) pasa el trabajo a `nuevo`, no toca la recogida y escribe un solo evento `received`.
- [ ] **4. `DeliveriesService.pickUp(id, ctx)`** con fakes (RED primero). Casos:
  - el mensajero, en la suya → recogida `hecha` con `doneAt = clock.now()` y `proofAttachmentId = null`, más el evento `picked_up` con `reason` = nombre del mensajero asignado y `actorId` = quien marca;
  - el mensajero, en la ajena → `DeliveryForbiddenError`;
  - recepción, en cualquiera → ok;
  - ya hecha o fallida → `DeliveryNotPendingError`;
  - `markDone` devuelve `false` (otra petición la cerró) → `DeliveryNotPendingError` y **sin evento**;
  - tipo `entrega` → `DeliveryInputError`.

  Todo dentro de `deps.uow.run`. El nombre del mensajero sale de una lectura dentro de la transacción. Elige la más simple y justifícala: `CouriersQuery` con un `courierName(id)` nuevo, o un `byIdWithCourier` en el repo. No se inventa a partir del actor.
- [ ] **5. Ruta** `POST /api/entregas/:id/recogido` contra Postgres (RED primero):
  - 401 sin sesión;
  - 403 técnico; 403 mensajero ajeno;
  - 200 mensajero propio, con la recogida `hecha` y el evento en `/api/trabajos/:id/eventos`;
  - 409 la segunda vez;
  - 422 sobre una entrega;
  - y que el trabajo sigue en `por_recoger`.
- [ ] **6. `lastPickedUp` en la ficha.** Repo (`createCaseDeliveryInfoQuery`): la última recogida `hecha` (`type = 'recogida'`, `doneAt` no nulo), con `users.name`; fake igual; el servicio la serializa a ISO como `lastDelivered`. Test de ruta: tras `recogido`, `GET /api/trabajos/:id` como recepción y como mensajero trae `lastPickedUp.courierName`, y sigue sin traer precios para el mensajero.
- [ ] **7. «En camino» en la lista de hoy.** Repo `listForDay` con `includeOverdue`: suma las recogidas `hecha` con `scheduledFor < day` y `cases.status = 'por_recoger'`. Test de repo con reloj fijo:
  - aparece hoy;
  - no aparece un día pasado concreto (`includeOverdue: false`);
  - deja de aparecer tras «Recibido».
- [ ] **8. Docs**:
  - en ADR 34 de `docs/architecture.md` §8, añadir «`picked_up` lo escribe «Recogido» (`DeliveriesService.pickUp`) con el nombre del mensajero en `reason`; `recibir` escribe `received`»;
  - en `docs/architecture.md` §3, en el párrafo de Entregas, la ruta nueva y las reglas del día;
  - en `docs/conventions.md` §4, en «No se pudo» y «Recibido», cómo encaja «Recogido» (`canMarkPickedUp`).
- [ ] **9. Verificación completa y commit(s)** `feat: …` con `Refs #118`. Pueden ser varios (shared+migración, API, docs).

### Tarea 2: web + E2E — botón «Recogido», «En camino al laboratorio», historial y docs

**Files:**
- Modify:
  - `apps/web/src/features/deliveries/api.ts`;
  - nuevo `apps/web/src/features/deliveries/use-pick-up.ts`.
- Modify:
  - `apps/web/src/features/deliveries/delivery-card.tsx`;
  - `delivery-status-chip.tsx`, o la línea de estado que use la tarjeta;
  - `apps/web/src/features/cases/quick-case.tsx`;
  - `DeliverySummary` (búscalo con `git grep -n "DeliverySummary"`);
  - `apps/web/src/features/cases/case-history.tsx:52-53,87-88,166`.
- Modify:
  - `packages/shared/src/deliveries.ts`: `DELIVERY_NEXT_STEP` y `courierNoActionReason`, para que el mensajero en su recogida pendiente ya no lea «Recepción lo marca…» sino que tenga su botón;
  - el texto tras recoger: «Recogido. Recepción lo marca como recibido al llegar al laboratorio.».
- Test:
  - los `*.test.tsx` de cada componente;
  - `apps/web/e2e/entregas.spec.ts`;
  - `apps/web/e2e/accesibilidad.spec.ts`.
- Docs:
  - `docs/conventions.md` §5, en «Entregas en la UI»;
  - ENT-2 en `docs/superpowers/specs/2026-09-12-historias-de-usuario-mvp.md`: versión mínima y criterios según #118.

**Interfaces (Consumes, de la Tarea 1):** `canMarkPickedUp`, `isInTransitToLab`, `IN_TRANSIT_TO_LAB`, `pickedUpLine`, `LastPickedUp`, `POST /api/entregas/:id/recogido`, `lastPickedUp` en el detalle, el tipo de evento `received`.

**Pasos:**

- [ ] **1. `pickUp` en `api.ts` y `usePickUp(caseId)`**:
  - `mutationKey: mutationKeys.case(caseId)`, para que `useCaseBusy` lo vea y no deje repetirlo sin red (M-4 de la ola);
  - `onSuccess` hace `await` de la invalidación de `['entregas']` y `['trabajos']`;
  - toast «Recogida registrada»;
  - 409 con `useConflictAwareError`: refresca y luego avisa.

  Test del hook con mock de `api.ts`.
- [ ] **2. Tarjeta de «Entregas»** (RED primero, Testing Library):
  - Recogida pendiente:
    - el mensajero propio ve «Recogido» (primario, `ACTION_EMPHASIS` o la variante por omisión del primario) y «No se pudo», y no ve «Recibido»;
    - recepción ve «Recibido» y «No se pudo», y no ve «Recogido»;
    - el mensajero ajeno no ve botones.
  - Recogida `hecha` con trabajo `por_recoger`:
    - texto «En camino al laboratorio» (chip o línea con texto, nunca solo color) y «Recogido por Luis a las 10:32»;
    - recepción ve «Recibido»; el mensajero no ve botones.
  - Tras «Recibido», con el trabajo ya `nuevo`, la recogida hecha se ve como hoy («Hecha»).
  - Todos los botones de 44 px.
- [ ] **3. Ficha corta del mensajero** (`quick-case.tsx`):
  - en su recogida pendiente, botón «Recogido» bajo «Recoger hoy en …»;
  - tras recogerla (`isInTransitToLab`), «Recogido. Recepción lo marca como recibido al llegar al laboratorio.» y sin botones;
  - el resto de motivos de `courierNoActionReason` no cambia.

  Tests.
- [ ] **4. Ficha completa** (`DeliverySummary` del panel «Recogida»): con `isInTransitToLab`, la línea «En camino al laboratorio · Recogido por {mensajero} a las {HH:MM}». La barra sigue ofreciendo «Recibido» a recepción. Test.
- [ ] **5. Historial**:
  - `picked_up` → título «Recogido», detalle «Por {reason}» si hay `reason`;
  - `received` → «Recibido en el laboratorio»;
  - icono para `received` (`PackageCheck`; mueve `picked_up` a `Truck` o similar).

  Los `Record` de rótulo e icono son exhaustivos: `received` no compila sin ellos. Actualiza el test literal de `case-history.test.tsx:150-156`.
- [ ] **6. E2E `@clave`** en `entregas.spec.ts`:
  - recepción crea un trabajo con recogida para un mensajero (`createCourier`);
  - el mensajero, en su contexto, marca «Recogido» en «Entregas»: la tarjeta pasa a «En camino al laboratorio» y ya no tiene «No se pudo»;
  - recepción ve «En camino al laboratorio» y marca «Recibido»: el trabajo queda «Nuevo» y el historial muestra «Recogido» y «Recibido en el laboratorio»;
  - cada contexto extra se cierra en `finally`.

  Barrido táctil: la tarjeta en camino y el botón «Recogido» en `accesibilidad.spec.ts`.
- [ ] **7. Chrome DevTools** a 390×844 y 360×740, como mensajero, y a 1280×800, como recepción: consola limpia, sin scroll horizontal, 44 px. Capturas en el scratchpad.
- [ ] **8. Docs**:
  - `docs/conventions.md` §5: «Recogido» solo para el mensajero en la UI; «En camino al laboratorio» derivado con `isInTransitToLab`;
  - ENT-2 en el doc de historias: versión mínima y criterios nuevos, más una nota de UX4-10 y #118.
- [ ] **9. Verificación completa y E2E** de escritorio y android (`pnpm e2e --project=escritorio --project=android`), con los puertos libres antes y después. Commits con `Refs #118`.

---

Después: revisión final de la rama, ronda de fixes si hace falta y PR «ENT-2: el mensajero marca «Recogido» y recepción ve lo que viene en camino» con `Closes #118`.
