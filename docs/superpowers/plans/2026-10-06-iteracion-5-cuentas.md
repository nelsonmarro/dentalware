# Iteración 5 — Cuentas y cobro: plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** el laboratorio sabe cuánto le debe cada clínica y desde cuándo. Recepción registra pagos que cierran solos los trabajos cobrados, el administrador registra ajustes (también el saldo inicial) y anula pagos mal registrados, y se imprime el estado de cuenta.

**Architecture:**
- Feature nueva `accounts` en la API (`ports`/`service`/`repo`/`schema`/`routes`/`fakes`), con su `AccountsUnitOfWork`. Sus tablas: `account_adjustments`, `payments` y `payment_allocations`.
- El cargo de un trabajo **no** tiene tabla. Se deriva del trabajo entregado (`total`, o `total × remake_charge_pct / 100` si es repetición) más sus ajustes.
- Las reglas puras viven en `shared/accounts.ts`:
  - neto a cobrar, pendiente y «¿cubierto?»;
  - asignación sugerida;
  - antigüedad;
  - cuadre del estado de cuenta.
- `accounts` cambia el estado del trabajo (`entregado ⇄ cobrado`) y escribe sus eventos por un puerto de escritura `CaseSettlement`. `app.ts` lo cumple con el repo de `cases` sobre la misma `tx` (patrón de ADR 34).
- La web tiene una feature nueva `accounts`, con su pantalla «Cuentas», la cuenta de una clínica y el estado de cuenta imprimible.

**Tech Stack:** pnpm 11, Node 24, Hono + Drizzle + Postgres (5433), React 19 + TanStack Query/Router, Tailwind 4 + shadcn, Vitest y Playwright.

**Spec:**
- historias CTA-1, CTA-2, CTA-3 y CTA-5 en `docs/superpowers/specs/2026-09-12-historias-de-usuario-mvp.md` (issues #82, #83, #84 y #86; E2E #36; épica #6);
- §4 «Cuentas» y §5 de `docs/superpowers/specs/2026-09-01-dentalware-mvp-design.md`;
- ADR 33 de `docs/architecture.md`. CTA-4 (facturas del SRI) queda fuera del MVP.

Dos PR:
- **PR 1** = Tareas 1–6 (shared, BD y API), rama `feat/iteracion-5-cuentas-1`.
- **PR 2** = Tareas 7–10 (web, impresión, E2E y cierre), rama `feat/iteracion-5-cuentas-2`, desde `main` tras mergear el PR 1.

Ledger: `.superpowers/sdd/2026-10-06-iteracion-5-cuentas/progress.md`.

## Decisiones (no se re-litigan)

Nelson, 2026-10-06:
1. **El ajuste ligado a un trabajo cambia lo que se debe por él.** El neto de un trabajo es su cargo más la suma de sus ajustes; el trabajo pasa a `cobrado` cuando lo asignado cubre ese neto. Un ajuste sin trabajo (p. ej. «Saldo inicial») solo mueve el saldo de la clínica.
2. **Los pagos no se editan, se anulan.** Solo el administrador anula, con un motivo obligatorio. La anulación:
   - marca el pago (`voided_at`, `voided_by`, `void_reason`);
   - deshace sus asignaciones (deja de contarlas, no las borra);
   - devuelve a `entregado` los trabajos que había cerrado, con `paid_at = null`;
   - escribe un evento en cada trabajo afectado.

   Un pago anulado no cuenta en el saldo, pero se ve tachado en los movimientos, con quién lo anuló y por qué.
3. **Anticipo y pago de más quedan a favor.** Un pago puede asignar menos que su monto. El resto es **saldo a favor** de la clínica, que puede quedar en negativo, y se aplica después a trabajos entregados con «Aplicar saldo a favor», que crea asignaciones de ese mismo pago.

Del plan, por coherencia con la spec y las historias:

4. **Cargo de un trabajo** = `total` si no es repetición; `total × remake_charge_pct / 100` si lo es (ADR del modificador diferido, `docs/architecture.md` §5). **Neto** = cargo + Σ ajustes del trabajo. **Pendiente** = neto − Σ asignaciones vigentes. Todo en centavos (`money.ts`); en la API y la web, cadena decimal `"12.34"`.
5. **Cuándo un trabajo está cubierto.** `entregado` con pendiente ≤ 0 pasa a `cobrado`, con `paid_at = now` y un evento. `cobrado` con pendiente > 0 vuelve a `entregado`, con `paid_at = null` y un evento. Una sola regla en shared (`isSettled`) que se reevalúa:
   - al entregar;
   - al asignar un pago;
   - al registrar un ajuste del trabajo;
   - al anular un pago.

   Una repetición con 0 % (o un trabajo que queda en neto ≤ 0) pasa a `cobrado` en el mismo «Marcar entregado»: no hay nada que cobrar.
6. **`cobrado` es un estado** de `CASE_STATUSES` (ADR 16: llega con su historia), terminal y sin acciones. No se cancela, y ni `availableActions('cobrado')` ni ninguna acción manual lo alcanzan: solo `accounts`.
7. **Roles:**
   - «Cuentas», saldo, movimientos, estado de cuenta y registrar pagos o aplicar saldo a favor: `ACCOUNTS_ROLES` (admin, recepción; ya existe en `roles.ts`).
   - Ajustes y anular pagos: **solo admin** (`ACCOUNT_ADMIN_ROLES`, nueva).
   - Técnico y mensajero: 403 en la API y sin enlace en la web. Nunca ven importes; los nuevos campos de la ficha se enmascaran como los precios.
8. **Asignación sugerida.** Al registrar un pago, la web propone repartirlo entre los trabajos entregados con pendiente, de **la entrega más antigua a la más nueva** (`delivered_at`; a igualdad, por código), con `suggestAllocation` de shared. El usuario puede editar cada monto. La API valida:
   - Σ asignado ≤ monto del pago;
   - cada asignación ≤ pendiente de su trabajo;
   - solo trabajos `entregado` de **esa** clínica;
   - montos > 0.

   Si no, responde 422 con el campo.
9. **Antigüedad** (0–30, 31–60, 61–90 y más de 90 días):
   - Partidas que suman, cada una con su fecha:
     - el pendiente de cada trabajo `entregado`, por los días desde `delivered_at`;
     - cada ajuste **sin trabajo** con monto > 0, por su fecha.
   - Lo que resta: los ajustes sin trabajo con monto < 0 y el saldo a favor, que es lo no asignado de los pagos vigentes. Se descuentan **de la partida más antigua a la más nueva**.
   - Si lo que resta supera lo que suma, la antigüedad queda en cero y el saldo es negativo.

   Es una función pura de shared (`agingBuckets`) con reloj inyectado (`today`).
10. **Saldo de la clínica** = Σ cargos de los trabajos `entregado` y `cobrado` + Σ ajustes (con y sin trabajo) − Σ pagos vigentes. Se calcula, no se guarda (`docs/architecture.md` §5), y siempre debe dar lo mismo que Σ pendientes + Σ ajustes sin trabajo − saldo a favor. Ese cuadre lo prueba un test de propiedad.
11. **Eventos nuevos** en `case_event_type`, añadidos con `drizzle-kit generate`:
    - `payment_applied`: monto en `toValue` y método y referencia del pago en `reason`;
    - `payment_voided`: monto devuelto y motivo;
    - `adjustment_added`: monto con signo y motivo;
    - `status_changed`, que ya existe, de `entregado` a `cobrado` y de `cobrado` a `entregado`.

    Los importes van a `maskPriceEvents`: técnico y mensajero no los ven.
12. **Estado de cuenta** (CTA-5), por rango `[desde, hasta]` de fechas de negocio. Contiene:
    - saldo inicial (el saldo al cierre del día anterior a `desde`);
    - movimientos del rango:
      - cargos, por la fecha de entrega;
      - ajustes, por su fecha;
      - pagos vigentes, por su fecha de pago;
      - pagos anulados, tachados y fuera de la suma;
    - saldo final, que cuadra con saldo inicial + Σ movimientos y con el saldo de CTA-1 cuando `hasta` es hoy;
    - antigüedad a la fecha `hasta`;
    - «Por cobrar»: los trabajos con pendiente y los días desde su entrega.

    Encabezado con los datos del laboratorio (CFG-1). Vista HTML imprimible con `@page`, en `rem`, como la orden (`docs/conventions.md` §5), sin PDF del lado del servidor.

## Restricciones globales

- Lo de `CLAUDE.md`, `docs/conventions.md` y `docs/architecture.md`.
- TDD: RED visto → GREEN → al menos una mutación por comportamiento clave sobre código de producción.
- Contraseñas de prueba solo con `testPassword()`; nunca un literal.
- Migraciones solo con `drizzle-kit generate`.
- Español en sentence case. 44 px, contraste AA, nunca solo color; montos en monoespaciada y alineados a la derecha.
- `Record` exhaustivos y reglas en `shared` con tests literales. Mocks solo de `api.ts`.
- Verificación completa antes de cada commit.
- Commits con `Refs #N` de la historia.
- Chrome DevTools a 1280×800, 390×844 y 360×740 en la UI.
- Puertos 3000 y 5173 libres al terminar; nunca `pkill` ni `killall`.
- El tablero es el Project 2: mover cada historia al empezar, al abrir el PR y al mergear.

---

## PR 1 — dominio, BD y API

### Tarea 1: shared — estado `cobrado`, eventos y reglas de cuentas (#82, #83, #84)

**Files:**
- Modify:
  - `packages/shared/src/case-status.ts`: añadir `'cobrado'` después de `'entregado'`; `CANCELABLE` excluye `cobrado`; `availableActions('cobrado') = []`;
  - los `Record` exhaustivos por estado que dejen de compilar (rótulos, colores, fase…): decidir cada uno; `cobrado` usa el rótulo «Cobrado».
- Modify: `packages/shared/src/case-events.ts`, con los 3 tipos de evento de la decisión 11.
- Modify: `packages/shared/src/roles.ts`, con `ACCOUNT_ADMIN_ROLES = ['admin']`.
- Create:
  - `packages/shared/src/accounts.ts` y `accounts.test.ts`;
  - `packages/shared/src/schemas/accounts.ts` (zod) y su test.
- Modify: `packages/shared/src/index.ts`.

**Produces** (las usan las Tareas 2–10):
```ts
export const PAYMENT_METHODS = ['efectivo', 'transferencia', 'tarjeta', 'cheque', 'otro'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string>  // «Efectivo», «Transferencia»…
export const AGING_BUCKETS = ['0_30', '31_60', '61_90', '90_mas'] as const
export type AgingBucket = (typeof AGING_BUCKETS)[number]
export const AGING_BUCKET_LABEL: Record<AgingBucket, string>       // «0–30 días» … «Más de 90 días»

/** Cargo del trabajo en centavos (decisión 4). */
export function caseChargeCents(c: { totalCents: number; remakeChargePct: number | null }): number
/** Neto = cargo + ajustes del trabajo; pendiente = neto − asignado. */
export function caseOutstandingCents(chargeCents: number, adjustmentsCents: number, allocatedCents: number): number
/** ¿Cubierto? pendiente ≤ 0 (decisión 5). */
export function isSettled(outstandingCents: number): boolean
/** Reparto de `amountCents` de la entrega más antigua a la más nueva (decisión 8). */
export function suggestAllocation(
  amountCents: number,
  open: readonly { caseId: string; code: string; deliveredAt: string; outstandingCents: number }[],
): { caseId: string; amountCents: number }[]
/** Antigüedad a `today` (decisión 9). Devuelve centavos por cubo; ninguno es negativo. */
export function agingBuckets(input: {
  today: string // YYYY-MM-DD
  charges: readonly { date: string; cents: number }[] // pendientes por fecha de entrega + ajustes sin trabajo > 0
  credits: readonly { cents: number }[]                // ajustes sin trabajo < 0 (en positivo) + saldo a favor
}): Record<AgingBucket, number>
```
Zod:
- `paymentInputSchema`:
  - `{ clinicaId, monto, metodo, fecha, referencia?, notas?, asignaciones: { trabajoId, monto }[] }`;
  - `monto` > 0, con 2 decimales; `fecha` es `YYYY-MM-DD`.
- `applyCreditInputSchema`: `{ asignaciones }`.
- `voidPaymentInputSchema`: `{ motivo }`, obligatorio.
- `adjustmentInputSchema`:
  - `{ clinicaId, trabajoId?, monto, motivo, fecha }`;
  - `monto` ≠ 0 con signo; motivo obligatorio.
- `accountStatementQuerySchema`: `{ desde, hasta }`, con `desde ≤ hasta`.

Mensajes en español.

- [ ] Tests literales:
  - `PAYMENT_METHODS`, sus rótulos, `AGING_BUCKETS`, sus rótulos, `ACCOUNT_ADMIN_ROLES` y los tipos de evento nuevos;
  - `cobrado` en `CASE_STATUSES`, sin acciones y no cancelable.
- [ ] `caseChargeCents`:
  - no repetición → total;
  - repetición al 50 % de 10000 → 5000;
  - repetición al 0 % → 0;
  - redondeo, con `percentOfCents`.
- [ ] `caseOutstandingCents` e `isSettled`, con ajustes negativos que llevan el neto a 0.
- [ ] `suggestAllocation`:
  - orden por `deliveredAt` y luego por código;
  - corta en el monto;
  - nunca asigna más que el pendiente;
  - lista vacía;
  - monto mayor que el total (sobra, sin asignar).
- [ ] `agingBuckets`:
  - cada cubo en sus bordes (30/31, 60/61, 90/91 días);
  - crédito que consume la partida más antigua primero;
  - crédito mayor que todo → cubos en 0.
- [ ] Schemas con casos válidos e inválidos (`monto` 0, negativo en un pago, 3 decimales, motivo vacío, `desde > hasta`).
- [ ] `pnpm --filter @dentalware/shared build`, verificación completa y commit `feat: …` con `Refs #82` (y #83/#84 en el cuerpo).

### Tarea 2: BD — tablas de cuentas y enums (#82)

**Files:**
- Create: `apps/api/src/features/accounts/schema.ts`:
  - `account_adjustments`: `id`, `clinic_id` FK, `case_id` FK nullable, `amount` `numeric(12,2)` con signo y CHECK ≠ 0, `reason` not null, `date` de tipo date, `created_by` FK users, `created_at`;
  - `payments`: `id`, `clinic_id` FK, `amount` `numeric(12,2)` con CHECK > 0, `method` (enum desde `PAYMENT_METHODS`), `paid_on` de tipo date, `reference`, `notes`, `created_by`, `created_at`, `voided_at`, `voided_by`, `void_reason`;
  - `payment_allocations`: `id`, `payment_id` FK, `case_id` FK, `amount` `numeric(12,2)` con CHECK > 0, `created_by`, `created_at`;
  - índices por `clinic_id`, `case_id` y `payment_id`.
- Migración con `drizzle-kit generate --name cuentas`: tablas, enum de método, `cobrado` en `case_status` y los 3 valores nuevos de `case_event_type`. Revisa el SQL y pasa `drizzle-kit check`.
- Modify: el registro de schemas de `db/` que use la app, para que `truncateAll` limpie las tablas nuevas (búscalo con `git grep -n truncateAll`).

- [ ] Test de BD: insertar y leer cada tabla; que fallen los CHECK (pago de 0, ajuste de 0 y asignación negativa).
- [ ] Verificación completa y commit `feat: tablas de cuentas, estado cobrado y eventos de cobro` con `Refs #82`.

### Tarea 3: API — saldo, antigüedad y movimientos (CTA-1, #82)

**Files:**
- Create: `apps/api/src/features/accounts/{ports,service,repo,routes,errors,fakes}.ts` y sus tests (`service.test.ts` con fakes, `accounts.test.ts` contra Postgres y `repo.test.ts`).
- Modify: `apps/api/src/app.ts`, para componer la feature y montar `/api/cuentas`.

**Produces:**
- `GET /api/cuentas` (`ACCOUNTS_ROLES`): `{ clinics: { id, name, balance, aging: Record<AgingBucket,string>, oldestDays: number | null }[] }`. Solo clínicas con saldo ≠ 0 o con movimientos; con `?todas=1`, todas las activas. Orden por saldo, de mayor a menor.
- `GET /api/cuentas/:clinicaId` (`ACCOUNTS_ROLES`), con:
  - `balance`, `credit` (saldo a favor) y `aging`;
  - `openCases: { id, code, patientRef, deliveredAt, charge, adjustments, allocated, outstanding, days }[]` («Por cobrar»);
  - `movements`: cargos, ajustes y pagos, cada uno con fecha, tipo, monto, quién y motivo o referencia; los anulados llevan `voided`.

  Un `clinicaId` inexistente da 404.
- El repo lee `cases` (estado, `delivered_at`, `total`, `remake_charge_pct`) por join de solo lectura (ADR 24); los ajustes, pagos y asignaciones son suyos.

- [ ] Servicio con fakes y reloj fijo:
  - saldo = cargos + ajustes − pagos vigentes;
  - una repetición cuenta por su porcentaje;
  - un pago anulado no cuenta;
  - la antigüedad usa `agingBuckets`;
  - el cuadre de la decisión 10 se cumple en un escenario mixto.
- [ ] Rutas contra Postgres:
  - 401 sin sesión; 403 técnico y mensajero; 200 admin y recepción;
  - 404 en una clínica inexistente;
  - el saldo cambia al entregar un trabajo (por la acción `marcar_entregado` existente).
- [ ] Docs: `docs/architecture.md`:
  - §3, un párrafo «**Cuentas**» (feature, puerto `CaseSettlement` y reglas en shared);
  - §5, las tablas, quitando «Previstas»;
  - §8, ADR 35 con las decisiones 1–5 y 10.
- [ ] Verificación completa y commits con `Refs #82`.

### Tarea 4: API — pagos, asignación, saldo a favor y anulación (CTA-2, #83)

**Files:** `apps/api/src/features/accounts/*` y `apps/api/src/features/cases/{ports,repo,fakes}.ts`, para el puerto `CaseSettlement` que cumple `cases`. `app.ts` lo inyecta en el `AccountsUnitOfWork` sobre la misma `tx`.

**Interfaces:**
```ts
// accounts/ports.ts
export interface CaseSettlement {
  /** Cambia entregado⇄cobrado (paid_at) y escribe status_changed; nada si ya está en ese estado. */
  setPaid(caseId: string, paidAt: Date | null, actorId: string): Promise<void>
  addEvent(e: { caseId: string; type: 'payment_applied' | 'payment_voided' | 'adjustment_added'; toValue: string; reason: string | null; actorId: string }): Promise<void>
  /** Trabajos de la clínica con lo necesario para el pendiente, bloqueados FOR UPDATE. */
  lockOpenCases(clinicId: string, caseIds: readonly string[]): Promise<{ id: string; clinicId: string; status: CaseStatus; totalCents: number; remakeChargePct: number | null; deliveredAt: Date | null }[]>
}
```
- `POST /api/cuentas/pagos` (`ACCOUNTS_ROLES`, `paymentInputSchema`) → 201 `{ pago }`. Corre en `uow.run`:
  - crea el pago;
  - bloquea los trabajos;
  - valida la decisión 8 (422 con el `path` del campo);
  - crea las asignaciones;
  - escribe `payment_applied` en cada trabajo;
  - reevalúa `isSettled` y llama a `setPaid`.
- `POST /api/cuentas/pagos/:id/asignaciones` (`ACCOUNTS_ROLES`, `applyCreditInputSchema`): aplica lo no asignado de un pago vigente, con las mismas validaciones más Σ ≤ lo que queda del pago. 409 si el pago está anulado.
- `POST /api/cuentas/pagos/:id/anular` (`ACCOUNT_ADMIN_ROLES`, `voidPaymentInputSchema`):
  - marca el pago;
  - escribe `payment_voided` en cada trabajo con asignación;
  - reevalúa y devuelve a `entregado` lo que deje de estar cubierto.

  409 si ya estaba anulado.

- [ ] Servicio con fakes:
  - reparto que cubre un trabajo → `cobrado` con `paid_at`;
  - reparto parcial → sigue `entregado`;
  - sobrante → saldo a favor;
  - aplicar saldo a favor cierra un trabajo nuevo;
  - anular devuelve a `entregado` y quita el saldo a favor;
  - las validaciones de la decisión 8 dan 422 con su campo: asignar a un trabajo de otra clínica, a uno no entregado, más que su pendiente o más que el pago;
  - eventos con sus valores.
- [ ] Rutas contra Postgres:
  - roles: anular solo admin;
  - 422 y 409;
  - flujo completo con el detalle de la clínica antes y después;
  - concurrencia: dos pagos simultáneos al mismo trabajo no lo sobrepagan (`FOR UPDATE`; el segundo ve el pendiente nuevo y da 422).
- [ ] Verificación completa y commits con `Refs #83`.

### Tarea 5: API — ajustes y saldo inicial (CTA-3, #84)

- `POST /api/cuentas/ajustes` (`ACCOUNT_ADMIN_ROLES`, `adjustmentInputSchema`) → 201. Corre en `uow.run`:
  - con `trabajoId`, el trabajo debe ser de esa clínica y estar `entregado` o `cobrado` (si no, 422); se escribe `adjustment_added` y se reevalúa `isSettled`: un recargo devuelve un `cobrado` a `entregado` y un descuento puede cerrarlo;
  - sin trabajo, solo cuenta en el saldo y en la antigüedad por su fecha («Saldo inicial»).
- [ ] Servicio con fakes y rutas contra Postgres:
  - recepción → 403;
  - motivo vacío → 422;
  - descuento que cierra un trabajo;
  - recargo que lo reabre;
  - saldo inicial que suma y entra en la antigüedad por su fecha;
  - el movimiento lleva quién lo registró.
- [ ] Verificación completa y commits con `Refs #84`.

### Tarea 6: cases — «Marcar entregado» a `cobrado`, ficha y cierre del PR 1

- `marcar_entregado` (`cases/service.ts`): si el neto del trabajo es ≤ 0 (repetición al 0 %), queda `cobrado` en la misma transacción, con `paid_at`, `status_changed` y `delivered_at`, sin pasar por `accounts` (decisión 5; mismas funciones de shared).
- La ficha del trabajo trae `account: { charge, adjustments, allocated, outstanding, paidAt } | null` solo para `ACCOUNTS_ROLES`. Para técnico y mensajero, `null`, enmascarado en el servicio como los precios; test de que no lo reciben. La lee un puerto de lectura de `cases` que cumple `accounts` en `app.ts`.
- Listas y vistas de trabajos:
  - `cobrado` aparece en «Todos» y en el filtro de estado;
  - no aparece en vistas de trabajo activo («Listos», «Vencen…», etc.): revisa `viewCondition` y `ACTIVE_FOR_DATES_STATUSES`;
  - con su color y su chip.
- [ ] Tests:
  - entregar una repetición al 0 % → `cobrado`;
  - entregar uno normal → `entregado`;
  - ficha por rol;
  - `viewCondition` con `cobrado`.
- [ ] Docs:
  - `docs/conventions.md` §4: permisos de cuentas y enmascarado de `account`;
  - el estado `cobrado` en la descripción del ciclo de vida de `docs/architecture.md` §1.
- [ ] Verificación completa y E2E de escritorio y android (las vistas cambian). Commits con `Refs #83`.

Tras la Tarea 6: revisión final del PR 1, su ronda de fixes y el PR «Iteración 5 (1/2): cuentas, pagos y ajustes en la API» con `Refs #82 #83 #84`, **sin** `Closes`, porque la UI va en el PR 2.

---

## PR 2 — web, estado de cuenta y cierre

### Tarea 7: pantalla «Cuentas» (CTA-1, #82)

- Feature web `accounts`: `api.ts`, `use-accounts.ts` y `accounts-table.tsx` sobre `components/data-grid`, con orden por saldo y búsqueda por clínica.
  - **Escritorio:** tabla con clínica, saldo, los 4 cubos de antigüedad y «Más antiguo: N días».
  - **Móvil:** tarjetas.
  - Saldo negativo: «A favor $12.34», con texto y no solo color.
- `routes/_app/cuentas.tsx` (hoy es un marcador) con el `h1` «Cuentas», la lista y «Ver todas las clínicas» (`?todas=1` en la URL).
- La fila lleva a `/cuentas/$clinicaId`, que en esta tarea es un marcador con el nombre de la clínica.
- Estados vacío y de error con `LoadError`.
- [ ] Tests de la tabla (mock de `api.ts`), de la ruta (redirige a técnico y mensajero) y barrido táctil. Chrome a 1280, 390 y 360.

### Tarea 8: cuenta de una clínica — movimientos, pagos, ajustes y anulación (CTA-2, CTA-3; #83, #84)

- `/cuentas/$clinicaId`:
  - cabecera con saldo, saldo a favor y antigüedad;
  - pestañas «Por cobrar» (trabajos con pendiente y días) y «Movimientos» (cargos, ajustes y pagos; los anulados, tachados con «Anulado por {quién}: {motivo}»).
- **«Registrar pago»** (`FormDialog`):
  - monto, método (`Select`), fecha (hoy por omisión), referencia y notas;
  - al escribir el monto, la tabla de asignación se rellena con `suggestAllocation`; cada monto es editable (`inputmode="decimal"`);
  - muestra «Asignado $X · Queda a favor $Y»;
  - un 422 se pinta bajo su campo;
  - el toast dice cuántos trabajos quedaron cobrados.
- **«Aplicar saldo a favor»** (solo con `credit > 0`): mismo reparto sobre lo que queda.
- **«Registrar ajuste»** (solo admin, `hasRole(ACCOUNT_ADMIN_ROLES)`):
  - signo («Descuento o nota de crédito» / «Recargo»), monto, motivo obligatorio, fecha y trabajo opcional (`Combobox` de los trabajos entregados de la clínica);
  - atajo «Saldo inicial», que rellena el motivo.
- **«Anular pago»** (solo admin): `ConfirmDialog` con motivo obligatorio que nombra la consecuencia («Los trabajos que cerró este pago vuelven a «Entregado»»).
- Ficha del trabajo: para admin y recepción, una línea «Cobrado el dd/mm» o «Pendiente $X de $Y», con enlace a la cuenta de la clínica.
- Mutaciones con `mutationKey` por clínica; invalidan `['cuentas']` y `['trabajos']`.
- [ ] Tests: diálogos con su sugerencia, edición, validación y 422; rol que no ve ajustes ni anular; la línea de la ficha por rol. Barrido táctil. Chrome a 1280, 390 y 360.

### Tarea 9: estado de cuenta imprimible y «Por cobrar» (CTA-5, #86)

- `/cuentas/$clinicaId/estado?desde=&hasta=`:
  - por omisión, el mes en curso; `validateSearch` tolerante;
  - API `GET /api/cuentas/:clinicaId/estado?desde&hasta` en `accounts`, con test de ruta: saldo inicial, movimientos del rango, saldo final y antigüedad a `hasta`;
  - el cuadre con el saldo de CTA-1 cuando `hasta` = hoy lo protege un test de API.
- Vista imprimible al estilo de la orden impresa (`print-order`):
  - encabezado del laboratorio (CFG-1, `useLabSettings`) y de la clínica;
  - tabla de movimientos con saldo corrido;
  - totales, antigüedad y «Por cobrar» con días desde la entrega;
  - `@page` y `rem`; el botón «Imprimir» llama a `window.print()`;
  - los controles no se imprimen (`print:hidden`).
- [ ] Tests de la vista (cuadre y formato de montos); E2E que abre el estado de cuenta y comprueba el saldo final. Chrome a 1280 y en la vista de impresión.

### Tarea 10: cierre de la iteración

- **E2E `@clave`** (#36):
  - admin crea y entrega dos trabajos (flujo existente), carga un «Saldo inicial» y ve el saldo y la antigüedad;
  - recepción registra un pago que cubre el más antiguo (pasa a «Cobrado») y deja un resto a favor;
  - se aplica el saldo a favor;
  - admin anula el pago y el trabajo vuelve a «Entregado»;
  - técnico y mensajero no ven «Cuentas»;
  - se imprime el estado de cuenta.

  Cada contexto extra se cierra en `finally`.
- Barridos táctiles de las pantallas nuevas en `accesibilidad.spec.ts`.
- Docs: `docs/conventions.md` §5 (cuentas en la UI) y las historias CTA marcadas «_(Hecha en la Iteración 5.)_».
- Issue «Revisión UI/UX de la Iteración 5 con frontend-design» (regla 6 de `CLAUDE.md`), en el hito de la Iteración 7, con el checklist de siempre.
- Verificación completa y E2E de escritorio y android.
- Revisión final del PR 2, su ronda de fixes y el PR «Iteración 5 (2/2): pantalla Cuentas, pagos, ajustes y estado de cuenta» con `Closes #82 #83 #84 #86 #36`.
- Mover las historias a «Hecho» y cerrar la épica #6 y el hito 5.
