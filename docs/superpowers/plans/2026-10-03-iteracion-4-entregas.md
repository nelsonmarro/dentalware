# Iteración 4 — Entregas: plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usa `superpowers:subagent-driven-development` (recomendada) o `superpowers:executing-plans` para ejecutar este plan tarea a tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** que el laboratorio coordine con el mensajero el viaje de cada trabajo: recoger en la clínica (`por_recoger` → recibido), enviar lo terminado con mensajero y fecha, y confirmar la entrega con foto de constancia. El mensajero tiene su lista del día, su inicio y su ficha corta. Recepción ve en el inicio lo que vence mañana.

**Arquitectura:** nace la feature `deliveries` en la API, con `ports.ts`, `service.ts`, `repo.ts`, `routes.ts`, `fakes.ts` y la tabla `deliveries`. Las transiciones de estado siguen en el servicio de `cases` (ADR 27). Cuando una transición abre o cierra una entrega, lo hace en la **misma transacción**: la unidad de trabajo de `cases` gana un tercer repositorio, `deliveries`, declarado como puerto en `cases/ports.ts` e inyectado como factoría desde `app.ts` (ADR 19 y 24; `cases/repo.ts` nunca importa `deliveries/repo.ts`). Las reglas puras viven en `shared`: estado `por_recoger`, acción `recibir`, carga útil de cada acción, roles de entregas y la vista `vencen_manana`. La web añade el diálogo de envío con mensajero y fecha, el de entrega con foto, la pantalla «Entregas», el inicio del mensajero y su ficha corta.

**Stack:** pnpm 11 · Node 24 · TypeScript 6 strict · Hono + Drizzle (rc) + Postgres 17 + Better Auth 1.7.2 · React 19 + Vite + TanStack Router/Query + Tailwind 4 + shadcn · Vitest 4 · Playwright 1.62.

**Historias:** `docs/superpowers/specs/2026-09-12-historias-de-usuario-mvp.md` §«Iteración 4»:
- ENT-1..ENT-5 (#74–#78);
- CAL-2 (#80, recortada a la vista «Vencen mañana», ADR 33);
- INI-3 (#70).

**Tareas enlazadas:** #105 (ficha corta e inicio del mensajero, UX3-09), #35 (E2E de la iteración), #96 (repeticiones desde el padre), #97 (bloqueo de fila en acciones).
**Spec de producto:** `docs/superpowers/specs/2026-09-01-dentalware-mvp-design.md` §4 (`deliveries`), §6 (tabla de transiciones), §8 (pantallas).
**Fuera de este plan (ADR 33):**
- calendario (CAL-1) e ICS (CAL-3);
- correos al mensajero o a la clínica (AVI-1 a AVI-3);
- nota de entrega imprimible: no hay historia que la pida.

## Restricciones globales

Se aplican a **todas** las tareas (`CLAUDE.md`, `docs/conventions.md`, `docs/architecture.md`):

- **TDD**: RED → GREEN → refactor, y una mutación por comportamiento clave **sobre código de producción**. Los tests que protegen una constante usan literales.
- **context7** antes de usar una API de librería que no se haya usado aún en el repo.
- **Idioma**: español en sentence case; vocabulario del laboratorio («trabajo», «recogida», «entrega», «mensajero»).
- **TypeScript**:
  - nunca `any`;
  - `import type`;
  - en `shared`, sin `enum` ni namespaces;
  - toda clasificación por acción o estado es un `Record` **exhaustivo**.
- **Fronteras** (`docs/architecture.md` §4, verificadas por `pnpm lint`):
  - `service.ts` y `ports.ts` sin adaptadores;
  - rutas sin `db.`;
  - un `repo.ts` no importa el `repo.ts` de otra feature (sí su `schema.ts` para lecturas, ADR 24);
  - en la web, nada de `fetch`/`hc` fuera de `api.ts`.
- **Transacciones**: toda mutación de un trabajo escribe su `case_event` en la misma transacción, vía `UnitOfWork.run` (ADR 19).
- **Precios**: técnico y mensajero nunca reciben precios ni notas internas. La API de entregas **no devuelve ningún importe**.
- **Roles**: cada ruta usa **su** constante de `shared` (ADR 31), y el servicio vuelve a comprobar el rol. Nada de `role === …` para permisos (sí para identidad).
- **Códigos HTTP**:
  - 401 sin sesión con `requireAuth`;
  - 403 «Sin permiso»;
  - 404 `{ message: 'No encontrado' }`;
  - 409 con el texto de `blockedByStatusMessage`;
  - 422 `{ message: 'Datos inválidos', issues }`.
- **Fechas**: de negocio `YYYY-MM-DD`; el «hoy» sale del puerto `Clock`, nunca de `new Date()` en la lógica.
- **Interfaz**:
  - 44 px por defecto;
  - chips con texto;
  - un solo primario por contexto (`ACTION_EMPHASIS`);
  - confirmación por reversibilidad;
  - sin scroll horizontal a 1280 / 390 / 360.
- **Errores en la web**: un fallo de red se muestra con `LoadError` (`isNotFoundError`), nunca como vacío. Un 409 de acción invalida y luego avisa (`useConflictAwareError`).
- **E2E**:
  - una etiqueta por test;
  - `uniqueSuffix()`;
  - sin `waitForTimeout`;
  - `trackConsoleErrors`;
  - pantallas nuevas en `accesibilidad.spec.ts`.
- **Verificación antes de cada commit**: `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`. Toda tarea de UI se verifica en Chrome DevTools a 1280×800, 390×844 y 360×740 con consola limpia. Puertos 3000 y 5173 libres al terminar.
- **Commits**: pequeños, en español, con `Refs #N` y los trailers `Co-Authored-By` y `Claude-Session`. **Node 24** en cada shell: `export PATH=$HOME/.nvm/versions/node/v24.19.0/bin:$PATH`.
- **Recompilar `shared`**: la API y la web lo leen desde `dist`. Tras tocarlo, `pnpm --filter @dentalware/shared build` antes de correr tests de api/web (también para que una mutación en `shared` se note).

## Lo que ya existe y este plan consume (no lo reescribas)

Verificado en el código el 2026-10-03:

- **`packages/shared/src/case-status.ts`:**
  - `CASE_STATUSES` (sin `por_recoger`) y `CASE_ACTIONS` (9 acciones).
  - `CASE_TRANSITIONS`: `marcar_enviado` desde `terminado` y `marcar_entregado` desde `enviado`, ambas con roles admin/recepción/mensajero.
  - Reglas de motivo: `REASON_REQUIRED_FOR_ACTION`, `requiresReason`.
  - Rótulos: `CASE_STATUS_LABEL`, `CASE_ACTION_LABEL`.
  - Mensajes: `blockedByStatusMessage` (privada), `notEditableMessage`.
  - Listas de estados: `EDITABLE_CASE_STATUSES = ['nuevo','en_proceso']`, `ACTIVE_FOR_DATES_STATUSES`, `EN_CURSO_STATUSES`.
  - Roles: `CASE_WRITE_ROLES`, `CASE_ACTION_ROLES` (derivada de las transiciones).
- **`packages/shared/src/roles.ts`:** `hasRole`, `hidesPrices`, `USER_ADMIN_ROLES`, `SETTINGS_ROLES`, `ACCOUNTS_ROLES`, `TECHNICIAN_FILTER_ROLES`.
- **`packages/shared/src/case-events.ts`:** `CASE_EVENT_TYPES`, que ya tiene `shipped` y `delivered`.
- **`packages/shared/src/schemas/cases.ts`:** `ATTACHMENT_KINDS = ['photo','document','scan']`, `CASE_VIEWS`, `CaseSummary`, `caseActionSchema` (`{ accion, motivo }` con `superRefine` de motivo), `caseInputSchema`, `isoDate`.
- **`apps/api/src/features/cases`:**
  - `schema.ts`: `cases` ya tiene `shippedAt` y `deliveredAt`; los enums `case_status` y `case_event_type` salen de `pgEnum` sobre las listas de `shared`.
  - `service.ts`: `action()` con `switch` por acción y `EVENT_TYPE_FOR_ACTION: Record<…>`.
  - `ports.ts`: `UnitOfWork { run(fn({ cases, tryins })) }`, `UsersQuery`.
  - `repo.ts`: `drizzleUnitOfWork(db)`, `createUsersQuery` (`activeTechnicians` ordenado por nombre), `viewCondition(view, today)` con su `Record<CaseView, …>` (ADR 32).
  - `fakes.ts`: `matchesView`.
- **`apps/api/src/features/attachments`:** `POST /api/adjuntos/trabajo/:caseId` solo exige `requireAuth`, con `kind` opcional. Hoy el mensajero puede subir cualquier adjunto.
- **`apps/api/src/features/clinics/schema.ts`:** `address`, `phone`, `whatsapp`, `email`.
- **Web:**
  - `features/cases`: `case-actions.tsx` (barra de acciones, `CONFIRM_DIALOG` y `REASON_DIALOG`), `case-action-dialog.tsx`, `action-emphasis.ts`, `production-panel.tsx`, `quick-case.tsx`, `use-cases.ts` (`useCaseAction` con `useConflictAwareError`), `use-photo-upload.ts` (compresión en el cliente), `attachment-kind.ts` (`isPhoto`), `summary-cards.tsx`, `home-summary.tsx`, `my-cases.tsx`, `case-views.ts` (`dueBadge`), `status-chip.tsx` (`STATUS_COLOR: Record<CaseStatus, …>`).
  - `components/combobox.tsx`, `components/load-error.tsx`, `lib/format-money.ts`.
  - `routes/_app/entregas.tsx` es hoy un marcador con solo un `h1`. La navegación ya tiene «Entregas» para todos los roles (`components/app-shell.tsx`).
- **E2E:** `apps/web/e2e/helpers.ts` con `uniqueSuffix`, `trackConsoleErrors`, `toasts(page)` y los helpers de creación por API. El test de trabajos que finaliza y marca enviado o entregado **cambiará**: esas acciones piden ahora datos (Tarea 4).

## Decisiones tomadas al planificar (no se re-litigan)

1. **`por_recoger` es un estado nuevo, el primero de `CASE_STATUSES`**, y **`recibir`** es una acción nueva (`por_recoger → nuevo`, roles admin, recepción y mensajero), tal como dice la spec §6.
   - Rótulos: estado «Por recoger», acción «Recibido».
   - Color del chip: `#6B7C93` (spec §6).
   - Un trabajo `por_recoger` se puede editar: `EDITABLE_CASE_STATUSES` lo incluye, porque recepción completa los datos cuando llega.
   - Se puede cancelar, porque `CANCELABLE` ya lo incluye solo.
   - No es «activo para fechas»: todavía no tiene fecha comprometida.
2. **«Programar recogida» no es otra pantalla**: es una sección opcional del formulario de nuevo trabajo. `POST /api/trabajos` acepta `recogida?: { mensajeroId, fecha }`. Con `recogida`, el servicio crea el trabajo en `por_recoger` y la entrega tipo `recogida` en la misma transacción, con los eventos `created` y `pickup_scheduled`.
3. **La carga útil de cada acción la define `shared`** con un `Record<CaseAction, 'ninguna' | 'motivo' | 'envio' | 'constancia'>` exhaustivo (`ACTION_PAYLOAD`):
   - `marcar_enviado` exige `envio: { mensajeroId, fecha }`;
   - `marcar_entregado` exige `constanciaId` (uuid de un adjunto);
   - `pausar` y `cancelar` siguen exigiendo `motivo`.

   `caseActionSchema` valida con `superRefine` contra ese `Record`.
4. **El mensajero solo actúa sobre lo suyo**:
   - En `marcar_enviado`, el `mensajeroId` debe ser él mismo.
   - En `recibir` y `marcar_entregado`, la entrega pendiente del trabajo debe estar asignada a él.
   - Si no, el servicio responde 403.
   - Admin y recepción actúan sobre cualquiera.
5. **La constancia es un adjunto de tipo nuevo, `constancia`** (en `ATTACHMENT_KINDS`). Se sube con el endpoint de adjuntos que ya existe.
   - El mensajero **solo** puede subir adjuntos `constancia`: nueva constante `ATTACHMENT_UPLOAD_ROLES = ['admin','recepcion','tecnico']` para el resto de tipos. Así se cierra el hueco anotado en la Tarea 5 de la ola.
   - `marcar_entregado` comprueba que la constancia es del mismo trabajo, de tipo `constancia` e imagen.
   - La constancia es obligatoria para **todos** los roles: lo dice ENT-4.
   - `isPhoto` la cuenta como foto, porque es `image/*`. Es correcto: se ve en «Adjuntos».
6. **Fallida y reprogramar es una sola operación**: `POST /api/entregas/:id/fallida { motivo, nuevaFecha }`.
   - Cierra la entrega como `fallida` con su motivo.
   - Crea una entrega nueva **pendiente** del mismo tipo y mensajero para `nuevaFecha`.
   - Escribe el evento `delivery_failed` en el trabajo.
   - El estado del trabajo no cambia.

   Vale para entregas y para recogidas.
7. **«Mis entregas del día»** (`GET /api/entregas?dia=YYYY-MM-DD&mensajeroId=`):
   - El mensajero ve solo las suyas; el parámetro se ignora y se fuerza su id.
   - Admin y recepción ven todas, o las de un mensajero.
   - El día de **hoy** incluye también las pendientes atrasadas (`scheduled_for < hoy`), marcadas «Atrasada», para que nada quede fuera de la ruta.
   - Sin dinero.
8. **Lista de mensajeros para los selectores**: `GET /api/entregas/mensajeros` devuelve `{ id, name }` de los mensajeros activos, ordenados por nombre, solo para `DELIVERY_MANAGE_ROLES`. Es el mismo patrón que `GET /api/trabajos/tecnicos` (ADR 29). La lectura de `users` es de solo lectura (ADR 24).
9. **CAL-2**: nueva vista `vencen_manana` en `CASE_VIEWS`. Incluye trabajos activos para fechas con `promised_date` = siguiente día hábil, calculado con `addBusinessDays(hoy, 1, [])` (ADR 30). Comparte `viewCondition` con el resumen (ADR 32), y el inicio de admin y recepción gana su tarjeta.
10. **Inicio del mensajero** (INI-3, #105): las entregas y recogidas de hoy agrupadas por clínica, con enlace a «Entregas». Sustituye a las tarjetas de resumen. El técnico conserva «Mis trabajos» y las tarjetas.
11. **Ficha corta del mensajero** (#105): botón grande con la acción de entrega disponible («Recibido», «Marcar enviado» o «Marcar entregado») y los **mismos** diálogos de la ficha completa. No ve «Añadir foto» genérico: la foto del mensajero es la constancia, dentro del diálogo de entrega.
12. **#97 entra en esta iteración**: con dos personas (recepción y mensajero) moviendo el mismo trabajo, la carrera deja de ser teórica.
13. **#96 entra en esta iteración**: es un endpoint y un bloque en la ficha. Recepción lo necesita antes de las cuentas (Iteración 5).

## Estructura de archivos

**shared** (`packages/shared/src/`):
- `case-status.ts`: modificar. `por_recoger`, `recibir`, `ACTION_PAYLOAD`, rótulos, listas.
- `case-events.ts`: modificar. Añadir `pickup_scheduled`, `picked_up` y `delivery_failed`.
- `deliveries.ts`: crear. Tipos de entrega, estados, rótulos, roles y `isOverdueDelivery`.
- `schemas/deliveries.ts`: crear. `deliveryListQuerySchema`, `deliveryFailSchema`, `pickupInputSchema`, `shipmentInputSchema`.
- `schemas/cases.ts`: modificar. `ATTACHMENT_KINDS` con `constancia`, `caseActionSchema` con su carga útil, `caseInputSchema` con `recogida`, `CASE_VIEWS` con `vencen_manana`.
- `index.ts`: exportar lo nuevo.

**API** (`apps/api/src/`):
- `features/deliveries/schema.ts`: crear. Tabla `deliveries` y sus enums.
- `features/deliveries/ports.ts`: crear. `DeliveriesRepository`, `DeliveryRow`, `DeliveryListItem`, `CouriersQuery`.
- `features/deliveries/repo.ts`: crear. `createDeliveriesRepo(db | tx)`, `createCouriersQuery(db)`.
- `features/deliveries/service.ts`: crear. `list`, `fail`, `couriers`.
- `features/deliveries/routes.ts`: crear. `/api/entregas`.
- `features/deliveries/fakes.ts`, `service.test.ts` y `deliveries.test.ts`: crear.
- `features/cases/ports.ts`: modificar. `UnitOfWork` gana `deliveries: DeliveryLog`; nuevo `byIdForUpdate` (#97); `repeticiones` (#96).
- `features/cases/service.ts`: modificar. `create` con recogida y `action` con `recibir`, envío y constancia.
- `features/cases/repo.ts`: modificar. `drizzleUnitOfWork(db, deps)`, `byIdForUpdate`, `remakesOf`, `viewCondition` con `vencen_manana`.
- `features/cases/fakes.ts`: modificar en paralelo.
- `features/attachments/service.ts`: modificar. Regla de `ATTACHMENT_UPLOAD_ROLES` y `constancia`.
- `app.ts`: modificar. Composición de `deliveries` y ruta `/api/entregas`.
- `drizzle/`: migración generada por drizzle-kit.

**Web** (`apps/web/src/`):
- `features/deliveries/`: crear.
  - `api.ts`, `use-deliveries.ts`;
  - `deliveries-day.tsx`: lista agrupada por clínica;
  - `delivery-card.tsx`;
  - `fail-dialog.tsx`;
  - `courier-select.tsx`;
  - `my-deliveries-today.tsx`: inicio del mensajero;
  - con sus tests.
- `features/cases/ship-dialog.tsx`: crear. Mensajero y fecha.
- `features/cases/deliver-dialog.tsx`: crear. Foto de constancia.
- `features/cases/pickup-fields.tsx`: crear. Sección «Recogida» del formulario.
- `features/cases/remakes-list.tsx`: crear. #96.
- Modificar:
  - `case-actions.tsx`: `recibir`, `marcar_enviado` y `marcar_entregado` abren sus diálogos;
  - `action-emphasis.ts`;
  - `case-action-done.ts`;
  - `status-chip.tsx`;
  - `quick-case.tsx`;
  - `home-summary.tsx`;
  - `summary-cards.tsx`;
  - `case-form.tsx`;
  - `cases-filters.tsx`: si lista las vistas a mano.
- `routes/_app/entregas.tsx`: modificar. Usa `DeliveriesDay`.
- `e2e/entregas.spec.ts`: crear. Además, modificar `trabajos.spec.ts`, `ficha-corta.spec.ts`, `accesibilidad.spec.ts` y `helpers.ts`.

---

# PR 1 — Recogidas, envíos y entregas con constancia (ENT-1..ENT-4, #97)

Rama: `feat/iteracion-4-entregas` (este plan va en su primer commit). Cierra #74, #75, #76, #77 y #97.

### Tarea 1: contratos en `shared` (estado, acción, carga útil, entregas, roles)

**Archivos:**
- Modificar: `packages/shared/src/case-status.ts`, `case-events.ts`, `schemas/cases.ts`, `index.ts`
- Crear: `packages/shared/src/deliveries.ts`, `schemas/deliveries.ts`
- Tests: `case-status.test.ts`, `deliveries.test.ts`, `schemas/deliveries.test.ts`, `schemas/cases.test.ts`

**Interfaces:**
- Produce:
  - `CASE_STATUSES` con `'por_recoger'` primero; `CASE_ACTIONS` con `'recibir'` primero.
  - `CASE_TRANSITIONS.recibir = { from: ['por_recoger'], to: 'nuevo', roles: ['admin','recepcion','mensajero'] }`.
  - Rótulos: `CASE_STATUS_LABEL.por_recoger = 'Por recoger'`, `CASE_ACTION_LABEL.recibir = 'Recibido'`.
  - `EDITABLE_CASE_STATUSES = ['por_recoger','nuevo','en_proceso']`.
  - `ActionPayload = 'ninguna' | 'motivo' | 'envio' | 'constancia'`, `ACTION_PAYLOAD: Record<CaseAction, ActionPayload>`. `REASON_REQUIRED_FOR_ACTION` se deriva de él (motivo ⇔ `'motivo'`), y `requiresReason` y `ActionRequiringReason` siguen funcionando igual.
  - `CASE_EVENT_TYPES` con `'pickup_scheduled'`, `'picked_up'` y `'delivery_failed'`.
  - `ATTACHMENT_KINDS = ['photo','document','scan','constancia']`.
  - `CASE_VIEWS` con `'vencen_manana'` (después de `'vencen_hoy'`).
  - En `deliveries.ts`:
    - `DELIVERY_TYPES = ['recogida','entrega']`, `DELIVERY_STATUSES = ['pendiente','hecha','fallida']`;
    - rótulos `DELIVERY_TYPE_LABEL` y `DELIVERY_STATUS_LABEL` (Records);
    - roles `DELIVERY_MANAGE_ROLES = ['admin','recepcion']`, `DELIVERY_ROLES = ['admin','recepcion','mensajero']`, `ATTACHMENT_UPLOAD_ROLES = ['admin','recepcion','tecnico']`;
    - `isOverdueDelivery(d: { status: DeliveryStatus; scheduledFor: string }, today: string): boolean`.
  - En `schemas/deliveries.ts`:
    - `shipmentInputSchema = { mensajeroId: uuid, fecha: isoDate }`;
    - `pickupInputSchema`, con la misma forma;
    - `deliveryListQuerySchema = { dia: isoDate, mensajeroId?: uuid }`;
    - `deliveryFailSchema = { motivo: string (1..500), nuevaFecha: isoDate }`.
  - `caseActionSchema = { accion, motivo?, envio?: shipmentInputSchema, constanciaId?: uuid }`, con `superRefine` según `ACTION_PAYLOAD`: falta `envio` → path `['envio']`, «Elige mensajero y fecha»; falta `constanciaId` → «Añade la foto de constancia».
  - `caseInputSchema` gana `recogida: pickupInputSchema.optional()`.

- [ ] **Paso 1: tests que fallan (literales, no derivados de las constantes)**

`packages/shared/src/case-status.test.ts` (añadir):

```ts
it('recibir lleva de por recoger a nuevo y lo pueden hacer admin, recepción y mensajero', () => {
  expect(applyAction('por_recoger', 'recibir')).toEqual({ ok: true, status: 'nuevo' })
  expect(applyAction('nuevo', 'recibir').ok).toBe(false)
  expect(canPerform('mensajero', 'recibir')).toBe(true)
  expect(canPerform('tecnico', 'recibir')).toBe(false)
})

it('un trabajo por recoger no se puede aceptar y sí cancelar', () => {
  expect(applyAction('por_recoger', 'aceptar').ok).toBe(false)
  expect(applyAction('por_recoger', 'cancelar')).toEqual({ ok: true, status: 'cancelado' })
})

it('carga útil de cada acción', () => {
  expect(ACTION_PAYLOAD).toEqual({
    recibir: 'ninguna',
    aceptar: 'ninguna',
    pausar: 'motivo',
    reanudar: 'ninguna',
    enviar_prueba: 'ninguna',
    recibir_prueba: 'ninguna',
    finalizar: 'ninguna',
    marcar_enviado: 'envio',
    marcar_entregado: 'constancia',
    cancelar: 'motivo',
  })
  expect(ACTIONS_REQUIRING_REASON).toEqual(['pausar', 'cancelar'])
})

it('rótulos de por recoger y recibir', () => {
  expect(CASE_STATUS_LABEL.por_recoger).toBe('Por recoger')
  expect(CASE_ACTION_LABEL.recibir).toBe('Recibido')
})

it('se edita por recoger, nuevo y en proceso', () => {
  expect(EDITABLE_CASE_STATUSES).toEqual(['por_recoger', 'nuevo', 'en_proceso'])
})
```

`packages/shared/src/deliveries.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  ATTACHMENT_UPLOAD_ROLES,
  DELIVERY_MANAGE_ROLES,
  DELIVERY_ROLES,
  DELIVERY_STATUS_LABEL,
  DELIVERY_TYPE_LABEL,
  isOverdueDelivery,
} from './deliveries.ts'

describe('entregas', () => {
  it('rótulos', () => {
    expect(DELIVERY_TYPE_LABEL).toEqual({ recogida: 'Recogida', entrega: 'Entrega' })
    expect(DELIVERY_STATUS_LABEL).toEqual({
      pendiente: 'Pendiente',
      hecha: 'Hecha',
      fallida: 'Fallida',
    })
  })
  it('roles', () => {
    expect(DELIVERY_MANAGE_ROLES).toEqual(['admin', 'recepcion'])
    expect(DELIVERY_ROLES).toEqual(['admin', 'recepcion', 'mensajero'])
    expect(ATTACHMENT_UPLOAD_ROLES).toEqual(['admin', 'recepcion', 'tecnico'])
  })
  it('atrasada solo si sigue pendiente y su fecha ya pasó', () => {
    expect(isOverdueDelivery({ status: 'pendiente', scheduledFor: '2026-10-02' }, '2026-10-03')).toBe(true)
    expect(isOverdueDelivery({ status: 'pendiente', scheduledFor: '2026-10-03' }, '2026-10-03')).toBe(false)
    expect(isOverdueDelivery({ status: 'hecha', scheduledFor: '2026-10-01' }, '2026-10-03')).toBe(false)
  })
})
```

`packages/shared/src/schemas/cases.test.ts` (añadir):

```ts
it('marcar enviado exige mensajero y fecha', () => {
  const r = caseActionSchema.safeParse({ accion: 'marcar_enviado' })
  expect(r.success).toBe(false)
  expect(r.error?.issues[0]).toMatchObject({ path: ['envio'], message: 'Elige mensajero y fecha' })
  expect(
    caseActionSchema.safeParse({
      accion: 'marcar_enviado',
      envio: { mensajeroId: '11111111-1111-4111-8111-111111111111', fecha: '2026-10-05' },
    }).success,
  ).toBe(true)
})

it('marcar entregado exige la foto de constancia', () => {
  const r = caseActionSchema.safeParse({ accion: 'marcar_entregado' })
  expect(r.error?.issues[0]).toMatchObject({
    path: ['constanciaId'],
    message: 'Añade la foto de constancia',
  })
})

it('el trabajo puede nacer con una recogida programada', () => {
  // usa el mismo input mínimo válido que ya usan los tests de caseInputSchema de este archivo
  const r = caseInputSchema.safeParse({
    ...validCaseInput,
    recogida: { mensajeroId: '11111111-1111-4111-8111-111111111111', fecha: '2026-10-05' },
  })
  expect(r.success).toBe(true)
})

it('vencen mañana es una vista rápida', () => {
  expect(CASE_VIEWS).toEqual([
    'nuevos',
    'en_curso',
    'vencen_hoy',
    'vencen_manana',
    'atrasados',
    'en_prueba',
    'listos',
    'todos',
  ])
})

it('la constancia es un tipo de adjunto', () => {
  expect(ATTACHMENT_KINDS).toEqual(['photo', 'document', 'scan', 'constancia'])
})
```

(Si el archivo no tiene un `validCaseInput`, créalo con el mínimo que ya acepte `caseInputSchema` en los tests existentes.)

- [ ] **Paso 2:** `pnpm --filter @dentalware/shared test`. Deben fallar por no existir `recibir`, `ACTION_PAYLOAD`, `deliveries.ts`…

- [ ] **Paso 3: implementar.** Puntos clave:

```ts
// case-status.ts
export type ActionPayload = 'ninguna' | 'motivo' | 'envio' | 'constancia'
/** Qué datos exige cada acción además de `accion` (Iteración 4). `Record` exhaustivo: una
 * acción nueva no compila sin decidir su carga útil. De aquí se derivan el motivo obligatorio
 * y la validación de `caseActionSchema`. */
export const ACTION_PAYLOAD = {
  recibir: 'ninguna',
  aceptar: 'ninguna',
  pausar: 'motivo',
  reanudar: 'ninguna',
  enviar_prueba: 'ninguna',
  recibir_prueba: 'ninguna',
  finalizar: 'ninguna',
  marcar_enviado: 'envio',
  marcar_entregado: 'constancia',
  cancelar: 'motivo',
} as const satisfies Record<CaseAction, ActionPayload>
```

`REASON_REQUIRED_FOR_ACTION` pasa a derivarse: `ActionRequiringReason = { [A in CaseAction]: (typeof ACTION_PAYLOAD)[A] extends 'motivo' ? A : never }[CaseAction]` y `requiresReason = (a) => ACTION_PAYLOAD[a] === 'motivo'`.

Cosas que **no** cambian aunque se añada `por_recoger`:
- `ACTIVE_FOR_DATES_STATUSES` y `EN_CURSO_STATUSES`.
- `STAGE_CHANGE_BLOCKED_REASON`: gana una entrada `por_recoger: 'El trabajo todavía no llegó al laboratorio: recíbelo y acéptalo primero.'`.

Cualquier otro `Record<CaseStatus, …>` o `Record<CaseAction, …>` del repo deja de compilar. Arréglalos **en esta tarea** con decisiones explícitas:

| Record | Archivo | Valor nuevo |
|---|---|---|
| `EVENT_TYPE_FOR_ACTION.recibir` | `cases/service.ts` | `'picked_up'` |
| `STATUS_COLOR.por_recoger` | web `status-chip.tsx` | `'#6B7C93'` |
| `ACTION_EMPHASIS.recibir` | web | `'primary'` |
| `CASE_ACTION_DONE.recibir` | web | `'Trabajo recibido'` |
| `CONFIRM_DIALOG` | web | `recibir: null`: no se confirma, porque es reversible (se puede cancelar después) y lo hace el mensajero con guantes |
| `print-copies` y demás | — | según lo que pidan |

`pnpm typecheck` te lista todos.

- [ ] **Paso 4:** `pnpm --filter @dentalware/shared build && pnpm test` en verde. Mutación: `recibir.from: ['nuevo']` → cae el primer test.
- [ ] **Paso 5:** commit `feat(shared): estado por recoger, acción recibir y carga útil de cada acción` (Refs #74 #75 #76 #77).

### Tarea 2: tabla `deliveries`, migración, puertos y repositorio

**Archivos:**
- Crear: `apps/api/src/features/deliveries/{schema,ports,repo,fakes}.ts`, `repo.test.ts` (integración contra Postgres)
- Modificar: `apps/api/src/db/` (registrar el schema y las relaciones como el resto de features), migración en `apps/api/drizzle/`

**Interfaces:**
- Consume: `DELIVERY_TYPES`, `DELIVERY_STATUSES` (Tarea 1).
- Produce:

```ts
// ports.ts
import type { DeliveryStatus, DeliveryType } from '@dentalware/shared'
import type { deliveries } from './schema.ts'

export type DeliveryRow = typeof deliveries.$inferSelect

export type NewDelivery = {
  caseId: string
  type: DeliveryType
  courierId: string
  scheduledFor: string // YYYY-MM-DD
}

/** Una fila de «Mis entregas del día»: sin dinero (decisión 7). */
export type DeliveryListItem = {
  id: string
  type: DeliveryType
  status: DeliveryStatus
  scheduledFor: string
  doneAt: Date | null
  failedReason: string | null
  case: { id: string; code: string; patientRef: string | null; status: CaseStatus; priority: CasePriority }
  clinic: { id: string; name: string; address: string | null; phone: string | null }
  courier: { id: string; name: string }
}

export interface DeliveriesRepository {
  create(d: NewDelivery): Promise<DeliveryRow>
  byId(id: string): Promise<DeliveryRow | undefined>
  /** La entrega pendiente de un tipo para un trabajo (como mucho una). */
  pendingFor(caseId: string, type: DeliveryType): Promise<DeliveryRow | undefined>
  markDone(id: string, doneAt: Date, proofAttachmentId: string | null): Promise<void>
  markFailed(id: string, reason: string, at: Date): Promise<void>
  /** Las del día; con `includeOverdue`, también las pendientes de días anteriores. */
  listForDay(q: { day: string; courierId?: string; includeOverdue: boolean }): Promise<DeliveryListItem[]>
}

export type Named = { id: string; name: string }
export interface CouriersQuery {
  activeCouriers(): Promise<Named[]>
}
```

Tabla (`schema.ts`):

```ts
export const deliveryTypeEnum = pgEnum('delivery_type', DELIVERY_TYPES)
export const deliveryStatusEnum = pgEnum('delivery_status', DELIVERY_STATUSES)

export const deliveries = pgTable(
  'deliveries',
  {
    id: uuid().primaryKey().defaultRandom(),
    caseId: uuid('case_id').notNull().references(() => cases.id, { onDelete: 'cascade' }),
    type: deliveryTypeEnum().notNull(),
    status: deliveryStatusEnum().notNull().default('pendiente'),
    courierId: text('courier_id').notNull().references(() => users.id),
    scheduledFor: date('scheduled_for', { mode: 'string' }).notNull(),
    doneAt: timestamp('done_at', { withTimezone: true }),
    proofAttachmentId: uuid('proof_attachment_id').references(() => attachments.id, {
      onDelete: 'set null',
    }),
    failedReason: text('failed_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('deliveries_day_idx').on(t.scheduledFor, t.status),
    index('deliveries_case_idx').on(t.caseId),
    // Como mucho una pendiente por trabajo y tipo (integridad de `pendingFor`).
    uniqueIndex('deliveries_one_pending_idx')
      .on(t.caseId, t.type)
      .where(sql`${t.status} = 'pendiente'`),
  ],
)
```

Los tipos de columna (`text` frente a `uuid` en `users.id`) se copian de cómo `cases.assignedTechnicianId` referencia a `users`. `clinic_id` no se guarda: se obtiene del trabajo, para evitar una fuente doble.

- [ ] **Paso 1: tests de integración que fallan** (`repo.test.ts`, contra `dentalware_test`, con `truncateAll`):
  - `create` + `pendingFor` devuelven la pendiente.
  - Una segunda pendiente del mismo tipo para el mismo trabajo viola el índice único.
  - `markDone` fija `doneAt`, `status = 'hecha'` y la constancia.
  - `markFailed` fija `fallida` y el motivo.
  - `listForDay`:
    - filtra por día y por mensajero;
    - con `includeOverdue`, trae las pendientes de ayer y no las hechas de ayer;
    - devuelve el código, el alias del paciente, la dirección y el teléfono de la clínica, y el nombre del mensajero;
    - **no** devuelve ningún campo de dinero: el test comprueba `Object.keys(item)` y `Object.keys(item.case)` con una lista literal.
  - `activeCouriers`: solo mensajeros no bloqueados, ordenados por nombre (mismo criterio que `activeTechnicians`).
- [ ] **Paso 2:** `pnpm --filter @dentalware/api exec drizzle-kit generate`. Revisa la migración: `CREATE TYPE delivery_type/delivery_status`, `CREATE TABLE deliveries` y los `ALTER TYPE … ADD VALUE` de `case_status` (`por_recoger`), `case_event_type` (los tres nuevos) y `attachment_kind` (`constancia`). Con un `ADD VALUE` de Postgres, el valor nuevo no puede usarse en la misma transacción de la migración, así que no añadas defaults ni datos que lo usen ahí.
- [ ] **Paso 3:** implementar `repo.ts` (`createDeliveriesRepo(db | Tx) satisfies DeliveriesRepository`, `createCouriersQuery(db) satisfies CouriersQuery`) y `fakes.ts` con el mismo comportamiento en memoria. `listForDay` hace una sola consulta con joins a `cases`, `clinics` y `users` (ADR 24), sin N+1, y ordena por clínica y por código.
- [ ] **Paso 4:** tests en verde. Mutación: quitar el filtro `status = 'pendiente'` de `includeOverdue` → cae «no trae las hechas de ayer».
- [ ] **Paso 5:** commit `feat(api): tabla de entregas y su repositorio` (Refs #74 #76 #78).

### Tarea 3: recoger un trabajo (ENT-1, ENT-2) y la unidad de trabajo con entregas

**Archivos:**
- Modificar: `apps/api/src/features/cases/{ports,service,repo,fakes,routes}.ts`, `apps/api/src/app.ts`
- Tests: `cases/service.test.ts` (fakes), `cases/cases.test.ts` (integración)

**Interfaces:**
- Consume: `DeliveriesRepository` (Tarea 2), `pickupInputSchema` y `ACTION_PAYLOAD` (Tarea 1).
- Produce:

```ts
// cases/ports.ts — puerto propio de cases (ADR 24/26): solo lo que el ciclo de vida necesita
// de las entregas. Lo implementa `createDeliveriesRepo` (estructuralmente compatible).
export interface DeliveryLog {
  create(d: { caseId: string; type: DeliveryType; courierId: string; scheduledFor: string }): Promise<{ id: string }>
  pendingFor(caseId: string, type: DeliveryType): Promise<{ id: string; courierId: string } | undefined>
  markDone(id: string, doneAt: Date, proofAttachmentId: string | null): Promise<void>
}

export interface UnitOfWork {
  run<T>(
    fn: (repos: { cases: CasesRepository; tryins: TryinsRepository; deliveries: DeliveryLog }) => Promise<T>,
  ): Promise<T>
}

/** Quién puede ser mensajero de una entrega (valida `mensajeroId`). */
export interface CouriersLookup {
  isActiveCourier(userId: string): Promise<boolean>
}
```

```ts
// cases/repo.ts — la factoría de entregas llega de app.ts: este archivo no importa deliveries/repo.ts
export const drizzleUnitOfWork = (
  db: Db,
  deps: { deliveries: (tx: Tx) => DeliveryLog },
): UnitOfWork => ({
  run: (fn) =>
    db.transaction((tx) =>
      fn({ cases: createCasesRepo(tx), tryins: createTryinsRepo(tx), deliveries: deps.deliveries(tx) }),
    ),
})
```

Comportamiento:
- **`create(input, ctx)` con `input.recogida`:**
  - comprueba que `fecha >= clock.today()`; si no, `CaseInputError('La fecha de recogida no puede ser anterior a hoy.')` → 422;
  - comprueba que `isActiveCourier(mensajeroId)`; si no, `CaseInputError('Elige un mensajero activo.')`;
  - dentro de `uow.run`: crea el trabajo con `status = 'por_recoger'`, crea la entrega `recogida` pendiente y escribe el evento `pickup_scheduled`, con `toValue` = fecha y `reason` = nombre del mensajero (o su id; decide con el historial, que muestra nombres).

  Sin `recogida`, nada cambia: el trabajo nace en `nuevo`.
- **`action('recibir')`:**
  - si `ctx.role` es mensajero y `pendingFor(id,'recogida').courierId !== ctx.userId` → `CaseForbiddenError`;
  - si hay pendiente, `markDone(pending.id, clock.now(), null)`;
  - transición a `nuevo` con evento `picked_up`.

  Un trabajo `por_recoger` sin entrega pendiente (datos viejos) se recibe igual: tolerancia deliberada, como `recibir_prueba`.
- **`#97`**: `action` y `changeStage` leen el trabajo con `cases.byIdForUpdate(id)` (`.for('update')`) dentro de `uow.run`.

- [ ] **Paso 1: tests con fakes que fallan** (`service.test.ts`):
  - Crear con recogida deja `por_recoger`, una entrega pendiente con mensajero y fecha, y los eventos `created` y `pickup_scheduled`.
  - Fecha de ayer → `CaseInputError` con el texto literal.
  - Mensajero inexistente o no mensajero → `CaseInputError`.
  - El mensajero asignado recibe: estado `nuevo`, entrega hecha y evento `picked_up`.
  - Otro mensajero → `CaseForbiddenError`; recepción recibe la de cualquiera.
  - `aceptar` desde `por_recoger` → `CaseStateError` con `No se puede "Aceptar": el trabajo está en estado "Por recoger". Puede que otra persona lo haya cambiado.`
- [ ] **Paso 2: tests de integración que fallan** (`cases.test.ts`):
  - `POST /api/trabajos` con `recogida` → 201 y `status: 'por_recoger'`.
  - `POST /api/trabajos/:id/acciones { accion: 'recibir' }`: el mensajero dueño recibe 200; otro mensajero recibe 403; el técnico recibe 403 (lo para la ruta).
  - **#97:** dos `POST …/acciones` en paralelo sobre el mismo trabajo (`pausar` y `finalizar` desde `en_proceso`) → exactamente una 200 y una 409, y `case_events` tiene una sola transición desde `en_proceso`.
- [ ] **Paso 3:** implementar.
  - `ports.ts`: `DeliveryLog`, `CouriersLookup`, `byIdForUpdate`.
  - `service.ts`: `create` y `action`, con `deps.couriers: CouriersLookup`.
  - `repo.ts`: `byIdForUpdate`, nueva firma de `drizzleUnitOfWork`, y `por_recoger` como estado inicial cuando hay recogida (añade un parámetro `initialStatus` a `create` del repo o un `status` en su input interno; **no** lo expongas en `caseInputSchema`).
  - `fakes.ts`: `fakeUnitOfWork` con un `DeliveryLog` en memoria.
  - `app.ts`: `drizzleUnitOfWork(db, { deliveries: createDeliveriesRepo })` y `couriers` desde `createCouriersQuery(db)`, adaptado a `isActiveCourier`.
- [ ] **Paso 4:** tests en verde. Mutaciones:
  - quitar el chequeo de mensajero dueño en `recibir` → cae «otro mensajero → 403»;
  - leer con `byId` en vez de `byIdForUpdate` → el test de concurrencia debe caer. Si no cae siempre, lanza las dos peticiones en un bucle de 20 intentos y comprueba que nunca hay dos 200.
- [ ] **Paso 5:** commits:
  - `feat(api): programar la recogida de un trabajo y recibirlo` (Refs #74 #75);
  - `fix(api): las acciones bloquean la fila del trabajo` (Closes #97 en el PR).

### Tarea 4: enviar con mensajero (ENT-3) y entregar con constancia (ENT-4) en la API

**Archivos:**
- Modificar: `apps/api/src/features/cases/{service,ports,fakes}.ts`, `apps/api/src/features/attachments/{service,routes}.ts`
- Tests: `cases/service.test.ts`, `cases/cases.test.ts`, `attachments/service.test.ts`, `attachments/attachments.test.ts`

**Interfaces:**
- Consume: `DeliveryLog`, `CouriersLookup` (Tarea 3), `ATTACHMENT_UPLOAD_ROLES` (Tarea 1).
- Produce:
  - `AttachmentsQuery` de `cases` gana `constancia(caseId: string, attachmentId: string): Promise<{ mime: string; kind: AttachmentKind } | undefined>`; lo implementa el repo de adjuntos.
  - El mensaje de error `CONSTANCIA_INVALIDA = 'La foto de constancia no es de este trabajo.'` se exporta desde `shared` (`deliveries.ts`), con test literal.

Comportamiento:
- **`marcar_enviado` con `envio`:**
  - mensajero activo; si no, 422;
  - `fecha >= hoy`; si no, 422 con `'La fecha de entrega no puede ser anterior a hoy.'`;
  - si el rol es mensajero, `envio.mensajeroId === ctx.userId`; si no, 403;
  - en la misma transacción: crea la entrega `entrega` pendiente, fija `shippedAt` y escribe el evento `shipped` (`toValue` = fecha).
- **`marcar_entregado` con `constanciaId`:**
  - la constancia existe, es de **este** trabajo, `kind === 'constancia'` y `mime` empieza por `image/`; si no, 422 `CONSTANCIA_INVALIDA`;
  - si el rol es mensajero, la entrega pendiente debe ser suya; si no, 403;
  - `markDone(pending.id, now, constanciaId)`, `deliveredAt` y evento `delivered`.

  Un trabajo `enviado` sin entrega pendiente (enviado antes de esta iteración) se entrega igual y solo guarda la constancia en el evento. Tolerancia deliberada, porque hay datos de la Iteración 3.
- **Adjuntos:**
  - `upload` con `kind === 'constancia'` lo puede hacer cualquier rol de `DELIVERY_ROLES`;
  - cualquier otro `kind`, o sin `kind`, exige `ATTACHMENT_UPLOAD_ROLES`; si no, `AttachmentForbiddenError` → 403;
  - una constancia que no sea imagen → 415, igual que hoy con el MIME.

- [ ] **Paso 1: tests que fallan** (servicio con fakes y rutas):
  - `marcar_enviado` sin `envio` → 422 con path `envio`.
  - Envío con fecha de ayer → 422 literal.
  - Mensajero que se asigna a sí mismo → 200, con la entrega creada y `shippedAt`.
  - Mensajero que asigna a otro → 403.
  - `marcar_entregado` sin `constanciaId` → 422.
  - Con un adjunto de **otro** trabajo → 422 `CONSTANCIA_INVALIDA`.
  - Con un PDF `document` del mismo trabajo → 422.
  - Con una imagen `constancia` del mismo trabajo, por el mensajero asignado → 200, la entrega hecha con `proof_attachment_id` y `deliveredAt`.
  - Por otro mensajero → 403.
  - Adjuntos: el mensajero sube `photo` → 403; sube `constancia` imagen → 201. El técnico sube `photo` → 201, sin regresión.
  - **Enmascarado:** la respuesta de `action` para el mensajero sigue sin precios (`total: null`).
- [ ] **Paso 2:** implementar. En `service.ts`, el `switch` de `action` gana los dos casos, con la validación en `shared` (Tarea 1) y la de negocio aquí.
- [ ] **Paso 3:** tests en verde. Mutaciones:
  - aceptar una constancia de otro trabajo → cae su test;
  - quitar la restricción del mensajero en `upload` → cae «el mensajero sube `photo` → 403».
- [ ] **Paso 4:** los E2E existentes que marcan enviado o entregado (`trabajos.spec.ts`) **fallarán** hasta la Tarea 5. Márcalos en el reporte; se arreglan allí. No uses `test.skip`.
- [ ] **Paso 5:** commit `feat(api): enviar con mensajero y entregar con foto de constancia` (Refs #76 #77).

### Tarea 5: web — programar recogida, recibir, enviar y entregar (ENT-1..ENT-4) y ficha corta del mensajero (#105)

**Archivos:**
- Crear:
  - `apps/web/src/features/cases/pickup-fields.tsx`
  - `apps/web/src/features/cases/ship-dialog.tsx`
  - `apps/web/src/features/cases/deliver-dialog.tsx`
  - `apps/web/src/features/deliveries/{api.ts, use-couriers.ts, courier-select.tsx}`
  - sus tests
- Modificar: `case-form.tsx`, `case-actions.tsx`, `quick-case.tsx`, `use-cases.ts` (tipo de `CaseActionInput`), `use-photo-upload.ts` (`kind` opcional), los E2E de `trabajos.spec.ts` y `ficha-corta.spec.ts`

**Interfaces:**
- Consume:
  - `GET /api/entregas/mensajeros`. Si la Tarea 6 todavía no existe, este endpoint **se adelanta aquí** con su ruta mínima en `deliveries/routes.ts` (solo `GET /mensajeros`, `requireRole(...DELIVERY_MANAGE_ROLES)`), y la Tarea 6 lo completa.
  - `caseActionSchema` (Tarea 1).
- Produce:
  - `<CourierSelect value onChange />`: `Select` de mensajeros, que muestra el nombre del ya elegido aunque la lista cargue (lección de la Tarea 4 de la ola);
  - `<ShipDialog case />`;
  - `<DeliverDialog case />`;
  - `usePhotoUpload({ kind?: AttachmentKind })`.

Comportamiento:
- **Formulario de nuevo trabajo** (solo admin y recepción): sección plegable «Programar recogida» con `CourierSelect` y una fecha (por omisión, hoy). Si se rellena, el trabajo nace `por_recoger` y el aviso dice «Recogida programada».
- **Barra de acciones:**
  - «Recibido» es el primario en `por_recoger` y se ejecuta sin diálogo.
  - «Marcar enviado» abre `ShipDialog`: mensajero (para el mensajero, fijo en él mismo y no editable) y fecha (por omisión, hoy). El botón «Marcar enviado» va con la descripción «El trabajo sale del laboratorio con {mensajero} el {fecha}.».
  - «Marcar entregado» abre `DeliverDialog`:
    - tiene un botón grande «Tomar foto de constancia», con `<input capture="environment" accept="image/*">` y compresión en el cliente vía `usePhotoUpload({ kind: 'constancia' })`;
    - muestra la miniatura y la opción «Cambiar foto»;
    - «Marcar entregado» queda deshabilitado hasta que la foto suba;
    - el texto dice que fija la fecha de entrega y que pasa a la cuenta de la clínica.
  - Sigue siendo un `Record` exhaustivo: en `CONFIRM_DIALOG`, `marcar_enviado` y `marcar_entregado` pasan a un `Record` nuevo, `FORM_DIALOG: Record<'marcar_enviado' | 'marcar_entregado', …>`, derivado de `ACTION_PAYLOAD` (`'envio' | 'constancia'`).
- **Ficha corta del mensajero (#105):**
  - su acción disponible (`availableActions` ∩ `canPerform`) es un botón grande de ancho completo que abre el **mismo** diálogo;
  - «Añadir foto» genérico **no** se muestra al mensajero (decisión 11);
  - técnico y admin no cambian.
- **409:** `useConflictAwareError` ya cubre estas acciones.

- [ ] **Paso 1: tests que fallan** (Testing Library, mocks solo de `api.ts`):
  - `case-form`: con la recogida rellenada, el `POST` lleva `recogida`; sin ella, no.
  - `ShipDialog`:
    - sin mensajero, «Marcar enviado» está deshabilitado;
    - para el mensajero, el campo muestra su nombre y no es editable;
    - envía `{ accion: 'marcar_enviado', envio: { mensajeroId, fecha } }`.
  - `DeliverDialog`:
    - deshabilitado hasta que la foto termine de subir;
    - sube con `kind: 'constancia'`;
    - envía `constanciaId`;
    - un fallo de subida muestra el aviso y no habilita el botón.
  - `case-actions`: en `por_recoger`, «Recibido» es el único primario y no abre diálogo.
  - `quick-case` como mensajero: en `terminado` ve «Marcar enviado» grande; en `enviado`, «Marcar entregado»; no ve «Añadir foto».
- [ ] **Paso 2:** implementar. Revisa `CourierSelect` contra la lección de la ola: no mostrar «Sin asignar» mientras carga si ya hay un valor.
- [ ] **Paso 3: E2E.**
  - Actualiza los tests de `trabajos.spec.ts` que marcan enviado o entregado, para que elijan mensajero y suban la constancia (`apps/web/e2e/fixtures/foto.png`). Crea el mensajero en `helpers.ts` (`createCourier`) con la contraseña de prueba `Mensajero1!` (ya en `.gitguardian.yaml`).
  - Nuevo `@clave` en `ficha-corta.spec.ts`: el mensajero abre `/t/:code` de un trabajo `enviado` que tiene asignado, toma la foto, marca entregado, y la ficha dice «Entregado».
  - `pnpm e2e --project=escritorio --project=android` en verde, con los puertos libres antes y después.
- [ ] **Paso 4: Chrome** a 1280, 390 y 360:
  - formulario con recogida;
  - los tres diálogos;
  - ficha corta del mensajero, en contexto aislado con un mensajero de prueba.

  Consola limpia y 44 px.
- [ ] **Paso 5:** commits por bloque:
  - `feat(web): programar la recogida desde el formulario de trabajo` (Refs #74);
  - `feat(web): enviar con mensajero y entregar con foto de constancia` (Refs #76 #77);
  - `feat(web): ficha corta del mensajero con su acción de entrega` (Refs #105).

**Fin del PR 1:** revisión final de la rama del PR 1 + ola de fixes; PR «Iteración 4 (1/2): recogidas, envíos y entregas con constancia» con `Closes #74 #75 #76 #77 #97` y `Refs #105`.

---

# PR 2 — Pantalla «Entregas», inicio del mensajero, «Vencen mañana» y repeticiones (ENT-5, INI-3, CAL-2, #96, #105, #35)

Rama: `feat/iteracion-4-entregas-2`, desde `main` después de mergear el PR 1. Cierra #78, #70, #80, #96, #105 y #35.

### Tarea 6: API de entregas — lista del día, fallida y reprogramar (ENT-4, ENT-5)

**Archivos:**
- Crear: `apps/api/src/features/deliveries/{service.ts, service.test.ts, routes.ts, deliveries.test.ts}`; completar `routes.ts` si la Tarea 5 adelantó `/mensajeros`
- Modificar: `apps/api/src/app.ts` (`.route('/api/entregas', deliveriesRoutes(deliveriesService))`), y `cases` si el evento `delivery_failed` se escribe por un puerto (ver abajo)

**Interfaces:**

```ts
// deliveries/ports.ts (añadir)
/** Escribe en el historial del trabajo (puerto propio; lo implementa el repo de cases). */
export interface CaseEventLog {
  addEvent(e: { caseId: string; type: 'delivery_failed'; toValue: string; reason: string; actorId: string }): Promise<void>
}
export interface DeliveriesUnitOfWork {
  run<T>(fn: (r: { deliveries: DeliveriesRepository; events: CaseEventLog }) => Promise<T>): Promise<T>
}

// deliveries/service.ts
export function createDeliveriesService(deps: {
  deliveries: DeliveriesRepository
  couriers: CouriersQuery
  uow: DeliveriesUnitOfWork
  clock: Clock
}) {
  return {
    list(q: DeliveryListQuery, ctx: RequestContext): Promise<DeliveryListItem[]>,
    fail(id: string, input: DeliveryFailInput, ctx: RequestContext): Promise<DeliveryRow>,
    couriers(): Promise<Named[]>,
  }
}
```

El `uow` de entregas se compone en `app.ts`:
- con `createDeliveriesRepo(tx)`;
- con un `CaseEventLog` sobre `createCasesRepo(tx).addEvent`, adaptado allí. `deliveries/` nunca importa nada de `cases/`.

Rutas:

| Ruta | Guarda | Respuesta |
|---|---|---|
| `GET /api/entregas?dia&mensajeroId` | `requireRole(...DELIVERY_ROLES)` | `{ entregas: DeliveryListItem[] }` |
| `POST /api/entregas/:id/fallida` | `requireRole(...DELIVERY_ROLES)` | `{ entrega }` (la nueva pendiente) |
| `GET /api/entregas/mensajeros` | `requireRole(...DELIVERY_MANAGE_ROLES)` | `{ mensajeros: Named[] }` |

Reglas del servicio:
- **`list`:**
  - el mensajero, siempre `courierId = ctx.userId` (ignora el `mensajeroId` que llegue);
  - `includeOverdue = (q.dia === clock.today())`.
- **`fail`:**
  - la entrega existe y está `pendiente`; si no, 409 `'Esta entrega ya no está pendiente.'`, texto en `shared`;
  - el mensajero solo las suyas; si no, 403;
  - `nuevaFecha >= hoy`; si no, 422;
  - en una transacción: `markFailed`, crea la nueva pendiente (mismo trabajo, tipo y mensajero, `nuevaFecha`) y escribe el evento `delivery_failed` (`toValue` = nueva fecha, `reason` = motivo).

- [ ] **Paso 1: tests con fakes que fallan:**
  - el mensajero no ve las de otro aunque pida su `mensajeroId`;
  - hoy incluye las atrasadas y otro día no;
  - `fail` crea la nueva pendiente y el evento, y deja la vieja `fallida`;
  - `fail` de una hecha → 409 literal;
  - `fail` de otro mensajero → 403;
  - fecha pasada → 422.
- [ ] **Paso 2: tests de integración que fallan:**
  - técnico → 403 en las tres rutas;
  - sin sesión → 401;
  - `mensajeros` como mensajero → 403;
  - la lista no trae dinero (`JSON.stringify(body)` no contiene `"total"` ni `"price"`);
  - `dia` inválido → 422.
- [ ] **Paso 3:** implementar y componer en `app.ts`.
- [ ] **Paso 4:** mutaciones:
  - no forzar el `courierId` del mensajero → cae su test;
  - `includeOverdue: true` siempre → cae «otro día no trae atrasadas».
- [ ] **Paso 5:** commit `feat(api): lista de entregas del día y entrega fallida con nueva fecha` (Refs #77 #78).

### Tarea 7: pantalla «Entregas» (ENT-5) e inicio del mensajero (INI-3, #105)

**Archivos:**
- Crear:
  - `apps/web/src/features/deliveries/{use-deliveries.ts, deliveries-day.tsx, delivery-card.tsx, fail-dialog.tsx, my-deliveries-today.tsx, map-link.ts}`
  - sus tests
- Modificar: `routes/_app/entregas.tsx`, `features/cases/home-summary.tsx`, `apps/web/src/lib/query-keys.ts`, `e2e/accesibilidad.spec.ts`

**Interfaces:**
- Consume: las rutas de la Tarea 6, `ShipDialog` y `DeliverDialog` (Tarea 5) y `useCaseAction`.
- Produce:
  - `mapUrl(address: string): string`, que devuelve `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  - `telUrl(phone: string): string`, que devuelve `tel:` más el número sin espacios;
  - `<DeliveriesDay day courierId? />` y `<MyDeliveriesToday />`;
  - claves `queryKeys.deliveries.day(dia, mensajeroId)`.

Comportamiento:
- **`/entregas`:**
  - `h1` «Entregas»;
  - selector de día con «Hoy», flechas de día anterior y siguiente, y una fecha, guardado en la URL con `validateSearch` tolerante;
  - para admin y recepción, un `CourierSelect` «Todos los mensajeros».
- **Grupos por clínica**, cada uno con:
  - el nombre;
  - la dirección como enlace al mapa (`target="_blank"` y `rel="noreferrer"`);
  - el teléfono como enlace `tel:`, con botones de 44 px.
- **Cada tarjeta:**
  - el chip de tipo («Recogida» o «Entrega»), con texto;
  - el código, como enlace a `/t/:code`;
  - el alias del paciente;
  - «Urgente» con `AlertChip` si aplica;
  - «Atrasada» con `AlertChip` ámbar si `isOverdueDelivery`;
  - la acción:
    - recogida pendiente → «Recibido» (acción `recibir`);
    - entrega pendiente → «Marcar entregado» (abre `DeliverDialog`);
    - las dos → «No se pudo» (abre `FailDialog`: motivo y nueva fecha, por omisión el siguiente día hábil).
- **Hechas y fallidas** quedan al final del grupo, atenuadas y con su chip de estado.
- **Vacío:** «No hay entregas ni recogidas este día.», y para el mensajero hoy, «No tienes entregas hoy».
- **Error:** `LoadError`.
- **Al actuar** se invalidan las entregas y `['trabajos']`.
- **Inicio** (`home-summary.tsx`): el mensajero ve `MyDeliveriesToday` (los grupos de hoy, compactos, con «Ver todas» → `/entregas`) en lugar de las tarjetas de resumen. Comparar `role === 'mensajero'` está permitido: es identidad.

- [ ] **Paso 1: tests que fallan:**
  - `map-link` con literales, incluido un texto con tildes y `#`;
  - `deliveries-day`:
    - agrupa por clínica en orden alfabético;
    - el `tel:` y el mapa llevan el `href` literal;
    - la acción correcta por tipo y estado;
    - «Atrasada» con una fecha de ayer y el reloj fijo (`vi.setSystemTime`);
    - vacío con el texto literal;
    - error → «Reintentar»;
  - `fail-dialog`: el motivo es obligatorio y la fecha por omisión es el siguiente día hábil (con el reloj fijo un viernes, debe salir el lunes);
  - `home-summary`: el mensajero ve «Entregas de hoy» y no ve las tarjetas; admin no cambia.
- [ ] **Paso 2:** implementar con `frontend-design`. Es una lista simple sin orden ni paginación, así que no usa `DataGrid` (`docs/data-grid.md`): grupos con tarjetas, igual en escritorio y en móvil.
- [ ] **Paso 3:** `accesibilidad.spec.ts`: barrido `@extendida` de `/entregas` en android, que espera el `h1` y un grupo, con los enlaces `tel:` y de mapa y los botones de acción.
- [ ] **Paso 4: Chrome** a 1280, 390 y 360, como mensajero (contexto aislado) y como recepción, sin scroll horizontal y con la consola limpia.
- [ ] **Paso 5:** commits:
  - `feat(web): pantalla de entregas del día agrupada por clínica` (Refs #78);
  - `feat(web): el inicio del mensajero muestra sus entregas de hoy` (Refs #70 #105).

### Tarea 8: «Vencen mañana» (CAL-2)

**Archivos:**
- Modificar:
  - `apps/api/src/features/cases/repo.ts` (`viewCondition`) y `fakes.ts` (`matchesView`);
  - web `summary-cards.tsx`, `cases-filters.tsx` (si lista vistas), `case-views.ts` (rótulo de la vista, si vive ahí)
- Tests: `cases/cases.test.ts` (los dos tests del ADR 32), `service.test.ts`, `summary-cards.test.tsx`

**Interfaces:**
- Consume: `CASE_VIEWS` con `vencen_manana` (Tarea 1), `addBusinessDays` y `toIsoDate`.
- Produce: la condición `vencen_manana` = `status IN ACTIVE_FOR_DATES_STATUSES AND promised_date = <siguiente día hábil>`. El siguiente día hábil se calcula en JS (`toIsoDate(addBusinessDays(new Date(`${today}T00:00:00`), 1, []))`) y se pasa como parámetro, no en SQL.

- [ ] **Paso 1: tests que fallan.**
  - Con reloj fijo en **viernes** 2026-10-02:
    - un trabajo `en_proceso` con `promised_date` 2026-10-05 (lunes) está en `vencen_manana`;
    - uno con 2026-10-03 (sábado) no;
    - uno `terminado` con 2026-10-05 no.
  - El contador del resumen coincide con el total de su lista (ADR 32).
  - Web: la tarjeta «Vencen mañana» enlaza a `/trabajos?vista=vencen_manana` y muestra el número.
- [ ] **Paso 2:** implementar en el repo, en el fake y en la web (tarjeta e ítem del filtro de vistas, si el filtro las lista).
- [ ] **Paso 3:** mutación: `addBusinessDays(…, 1)` → `+1 día natural` → cae el caso del viernes.
- [ ] **Paso 4: Chrome:** inicio de recepción a 1280 y 390, con la tarjeta alineada con las demás.
- [ ] **Paso 5:** commit `feat: vista rápida «Vencen mañana» en el inicio y en la lista` (Refs #80).

### Tarea 9: repeticiones desde la ficha del padre (#96)

**Archivos:**
- Modificar:
  - `apps/api/src/features/cases/{ports,repo,fakes,service,routes}.ts` (`remakesOf`, `GET /:id/repeticiones`);
  - web `features/cases/api.ts`, `use-cases.ts`, `production-panel.tsx` o `case-detail-tab.tsx` (donde encaje en la ficha)
- Crear: `apps/web/src/features/cases/remakes-list.tsx` y su test

**Interfaces:**
- `CasesRepository.remakesOf(parentId: string): Promise<{ id: string; code: string; status: CaseStatus; receivedAt: string; remakeReason: string | null }[]>`: solo hijos directos, ordenados del más reciente al más antiguo.
- `GET /api/trabajos/:id/repeticiones` con `requireAuth` devuelve `{ repeticiones }`, sin dinero. Responde 404 si el padre no existe.
- Web: en la ficha del padre, bloque «Repeticiones» con cada hijo como enlace: código, chip de estado, fecha y motivo. No se monta si no hay ninguna. En la ficha del hijo, «Repetición de {código del padre}» como enlace; el `parentCaseId` ya viene en el detalle.

- [ ] **Paso 1: tests que fallan:**
  - servicio con fakes: dos hijos y un nieto → solo los dos hijos;
  - integración: técnico → 200 sin campos de dinero; padre inexistente → 404;
  - web: el bloque lista los hijos y no se monta sin ninguno.
- [ ] **Paso 2:** implementar.
- [ ] **Paso 3:** mutación: devolver todos los descendientes → cae el test del nieto.
- [ ] **Paso 4: Chrome:** ficha de un trabajo repetido a 1280 y 390.
- [ ] **Paso 5:** commit `feat: la ficha de un trabajo lista sus repeticiones` (Refs #96).

### Tarea 10: E2E de la iteración (#35) y cierre

**Archivos:**
- Crear: `apps/web/e2e/entregas.spec.ts`
- Modificar: `apps/web/e2e/helpers.ts`, `accesibilidad.spec.ts`, `docs/architecture.md`, `docs/conventions.md` (si salió alguna convención), las historias

**Tests E2E** (datos con `uniqueSuffix()`, `trackConsoleErrors`, una etiqueta cada uno):
1. **`@esencial`**, recorrido completo:
   1. recepción programa la recogida con el mensajero para hoy;
   2. el mensajero la ve en su inicio y en `/entregas` y marca «Recibido»;
   3. recepción acepta y finaliza (por API para abreviar) y marca enviado con el mensajero;
   4. el mensajero lo ve en `/entregas`, toma la foto y marca entregado;
   5. la ficha dice «Entregado» y la pestaña «Adjuntos» tiene la constancia.
2. **`@clave`**: entrega fallida. El mensajero marca «No se pudo» con motivo y fecha de mañana; hoy desaparece de pendientes y mañana aparece; el historial tiene el evento.
3. **`@clave`**: un mensajero no ve las entregas de otro mensajero.
4. **`@clave`**: «Vencen mañana». El contador del inicio coincide con la lista.

**Cierre:**
- [ ] `docs/architecture.md`:
  - §3: la feature `deliveries`;
  - §5 Datos: `deliveries` ya no está «prevista»;
  - un ADR nuevo, en una línea, «Entregas en su feature; las transiciones que abren o cierran una entrega escriben por un puerto de `cases` en la misma transacción (factoría inyectada en `drizzleUnitOfWork`)».
- [ ] Historias: marcar ENT-1..5, CAL-2 e INI-3 como hechas.
- [ ] #35: renombrar a «E2E Iteración 4 — Entregas» (sin calendario, ADR 33).
- [ ] **Regla 6 de `CLAUDE.md`**: crear el issue «Revisión UI/UX de la Iteración 4 (Entregas) con frontend-design» (`historia`, `area:web`, hito «Iteración 5 — Cuentas y cobro»), con la checklist de siempre:
  - recorrer a 1280×800, 390×844 y 360 px las pantallas nuevas (Entregas, inicio del mensajero, diálogos de envío y entrega, ficha corta del mensajero, formulario con recogida, «Vencen mañana», repeticiones);
  - jerarquía visual;
  - 44 px, foco, teclado y contraste AA;
  - que lo entiendan recepción y mensajero.
- [ ] Verificación completa y `pnpm e2e --project=escritorio --project=android`, con los puertos libres.
- [ ] Commits:
  - `test(e2e): recorrido de recogida, envío y entrega con constancia` (Refs #35);
  - `docs: entregas en la arquitectura y en las historias`.

**Fin del PR 2:** revisión final de la rama + ola de fixes; PR «Iteración 4 (2/2): entregas del día, inicio del mensajero y vencen mañana» con `Closes #78 #70 #80 #96 #105 #35`. Después, la revisión UI/UX de la iteración (regla 6) antes de construir la Iteración 5.

---

## Autorrevisión del plan

- **Cobertura:**

  | Historia o issue | Tareas |
  |---|---|
  | ENT-1 | 1, 3, 5 |
  | ENT-2 | 3, 5, 7 |
  | ENT-3 | 4, 5 |
  | ENT-4 | 4, 5, 6, 7 |
  | ENT-5 | 6, 7 |
  | CAL-2 | 8 |
  | INI-3 | 7 |
  | #105 | 5, 7 |
  | #96 | 9 |
  | #97 | 3 |
  | #35 | 10 |

  Que el trabajo entregado pase a ser cargo de la clínica (criterio de ENT-4) es responsabilidad de CTA-1, en la Iteración 5: aquí solo se fija `deliveredAt`, que es lo que la cuenta leerá.
- **Coherencia de nombres:**
  - `DeliveryLog`, el puerto de `cases`, es un subconjunto estructural de `DeliveriesRepository`, el de `deliveries`;
  - `pendingFor`, `markDone`, `create` y `listForDay` se usan con la misma firma en las Tareas 2, 3, 4 y 6;
  - `ACTION_PAYLOAD` se define en la Tarea 1 y se consume en las Tareas 4 y 5;
  - `DELIVERY_ROLES`, `DELIVERY_MANAGE_ROLES` y `ATTACHMENT_UPLOAD_ROLES` se definen en la Tarea 1 y se usan en las Tareas 4, 5 y 6.
- **Riesgos a vigilar en revisión:**
  - el `ALTER TYPE … ADD VALUE` dentro de la migración (Tarea 2);
  - los E2E existentes que marcan enviado o entregado, que se rompen entre las Tareas 4 y 5 (anotado);
  - el mensajero, que nunca debe ver dinero en `/entregas` ni en su ficha corta.
