# Adopción hexagonal pragmática — bloque 1 (cases, attachments, import, auth, web, ESLint)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar `cases`, `cases/import` y `attachments` a puertos + servicios con DI por factorías, exponer `ctxFrom` en auth, confinar `authClient` en la web y hacer cumplir las fronteras con ESLint, sin cambiar el comportamiento observable (los tests de integración y E2E actuales pasan sin modificar sus aserciones).

**Architecture:** `docs/architecture.md` §2, §3.2–§3.6 y ADR 17–21 son la spec. Por feature: `ports.ts` (interfaces), `service.ts` (casos de uso sin Hono/Drizzle), `errors.ts`, `repo.ts` como factoría `createXRepo(db | tx) satisfies XRepository`, `routes.ts` que solo valida, autoriza y traduce errores. `createApp` es la raíz de composición. Dos deltas decididos con Nelson el 2026-09-09 y que se anotan en `docs/architecture.md` dentro de este plan: (a) un `repo.ts` puede importar `schema.ts` de otra feature para joins (las tablas son detalle de persistencia compartido); (b) las fronteras se verifican con `@typescript-eslint/no-restricted-imports` por patrones, sin `eslint-plugin-import-x`; `ports.ts` puede importar **solo tipos** de `./schema.ts` para derivar las formas de fila.

**Tech Stack:** Hono 4, Drizzle 1.0 RC (relaciones v2), Vitest 4, typescript-eslint 8.69 (`no-restricted-imports` con `patterns` + `allowTypeImports`), React 19 + TanStack Router, Better Auth 1.7.

**Spec:** `docs/architecture.md` (§2, §3.2, §3.4, §3.5, §3.6, ADR 17–23) + issue #54.

**Entrega:** dos PR encadenados desde `main` (tras mergear #57). **PR A** = Tareas 1–6 (API + docs). **PR B** = Tareas 7–9 (web + ESLint + docs). Rama A: `refactor/hexagonal-api-cases-adjuntos`; rama B: `refactor/hexagonal-web-eslint` (desde A mergeada o encadenada sobre A).

## Global Constraints

- TDD en cada tarea: primero el test del servicio con fakes (RED), luego el código. Código sin test = Important en revisión.
- **Cero cambios de comportamiento**: los tests `cases.test.ts`, `attachments.test.ts`, `import.test.ts` y los E2E pasan sin tocar sus aserciones (se permite adaptar imports y helpers). `cases.repo.test.ts` se adapta a la factoría del repo manteniendo los mismos casos.
- `service.ts` y `ports.ts` no importan `hono`, `hono/*`, `drizzle-orm`, `**/db/**`, `./repo.ts`, `better-auth*`, `sharp`, `node:fs*`, `node:crypto` ni nada de otra feature salvo tipos de puertos. `ports.ts` solo puede importar **tipos** de `./schema.ts`.
- `routes.ts` no contiene `db.`, ni `drizzle-orm`, ni `new Date()`, ni `randomUUID()`.
- Un `repo.ts` puede importar `schema.ts` de otra feature (joins) pero nunca su `repo.ts`, `routes.ts` ni `service.ts`.
- Español y sentence case en mensajes; `Refs #54` en cada commit; trailers `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` y `Claude-Session: <url>`; nunca `--no-verify`.
- Verificación antes de cada commit: `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` (Postgres `dentalware_test` en 5433). E2E al cerrar cada PR: `pnpm e2e --project=escritorio --project=android` con puertos 3000/5173 libres.
- Node 24: `export PATH=$HOME/.nvm/versions/node/v24.19.0/bin:$PATH`.

## Rulings del controlador

- Los tipos de fila (`CaseDetail`, `CaseListRow`, `CaseEventRow`, `AttachmentRecord`) se declaran en `ports.ts` derivándolos con `import type` de `./schema.ts` (`typeof tabla.$inferSelect`) más las relaciones necesarias. No se duplican a mano ni se importan de `repo.ts`.
- `users` y `products` no se migran en este bloque: sus `routes.ts` quedan excluidos de las reglas por override en `eslint.config.js` con comentario `#54 boy-scout` (decisión de Nelson: excluir archivos, no `eslint-disable` en línea).
- `Storage` sigue en `lib/storage.ts` (ya es un puerto); `Clock` e `IdGenerator` van a `lib/clock.ts` y `lib/ids.ts` porque los usan varias features. `RequestContext` va a `lib/request-context.ts` (tipo puro) y `ctxFrom` a `features/auth/session.ts`.
- Sin spec nueva: los deltas van a `docs/architecture.md` en el mismo PR.

---

## Estructura de archivos resultante (PR A)

```
apps/api/src/
  lib/clock.ts                  Clock + systemClock
  lib/ids.ts                    IdGenerator + randomIds
  lib/request-context.ts        RequestContext
  features/auth/session.ts      + ctxFrom(c)
  features/cases/
    ports.ts                    CasesRepository, AttachmentsQuery, UnitOfWork, tipos de fila
    errors.ts                   CaseInputError, CaseStateError, CaseNotFoundError
    service.ts                  createCasesService
    service.test.ts             fakes en memoria
    repo.ts                     createCasesRepo(db | tx) satisfies CasesRepository; drizzleUnitOfWork(db)
    cases.repo.test.ts          adaptado a la factoría
    routes.ts                   casesRoutes(service, importRoutes)
    import.ports.ts             ImportCatalog
    import.service.ts           importCases({ catalog, uow, clock }), helpers puros
    import.service.test.ts      fakes
    import.repo.ts              createImportCatalog(db) satisfies ImportCatalog
    import.routes.ts            importRoutes(importService)
    (import.ts se elimina)
  features/attachments/
    ports.ts                    AttachmentsRepository, ImageProcessor, CasesQuery, CaseEventLog, AttachmentRecord
    errors.ts                   AttachmentNotFoundError, UnsupportedFileError, CaseNotFoundError (reexport)
    service.ts                  createAttachmentsService
    service.test.ts             fakes
    repo.ts                     createAttachmentsRepo(db) satisfies AttachmentsRepository (+ toDto)
    routes.ts                   attachmentsRoutes(service)
  lib/images.ts                 + sharpImages: ImageProcessor
  app.ts                        raíz de composición (clock, ids opcionales)
```

---

### Task 1: Cimientos transversales — `RequestContext`, `ctxFrom`, `Clock`, `IdGenerator`

**Files:**
- Create: `apps/api/src/lib/request-context.ts`, `apps/api/src/lib/clock.ts`, `apps/api/src/lib/ids.ts`
- Modify: `apps/api/src/features/auth/session.ts` (añadir `ctxFrom`)
- Test: `apps/api/src/lib/clock.test.ts`, `apps/api/src/features/auth/session.test.ts` (nuevo, sin BD: usa `app.request` sobre una `Hono` mínima)

**Interfaces:**
- Produces: `RequestContext = { userId: string; role: UserRole }`; `ctxFrom(c: Context<AppEnv>): RequestContext` (lanza `HTTPException(403, 'Sin permiso')` si no hay usuario); `Clock { today(): string; now(): Date }`, `systemClock`; `IdGenerator { next(): string }`, `randomIds`.

- [ ] **Step 1: Tests (RED)**

```ts
// apps/api/src/lib/clock.test.ts
import { describe, expect, it } from 'vitest'
import { systemClock } from './clock.ts'

describe('systemClock', () => {
  it('today devuelve la fecha ISO YYYY-MM-DD del momento actual', () => {
    expect(systemClock.today()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(systemClock.now()).toBeInstanceOf(Date)
  })
})
```

```ts
// apps/api/src/features/auth/session.test.ts
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import type { AppEnv } from './session.ts'
import { ctxFrom } from './session.ts'

const appWith = (user: AppEnv['Variables']['user']) =>
  new Hono<AppEnv>()
    .use(async (c, next) => {
      c.set('user', user)
      c.set('session', null)
      await next()
    })
    .get('/', (c) => c.json(ctxFrom(c)))

describe('ctxFrom', () => {
  it('construye el contexto de petición con id y rol del usuario en sesión', async () => {
    const res = await appWith({ id: 'u1', role: 'recepcion' } as never).request('/')
    expect(await res.json()).toEqual({ userId: 'u1', role: 'recepcion' })
  })
  it('responde 403 Sin permiso si no hay sesión', async () => {
    const res = await appWith(null).request('/')
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Correr** `pnpm --filter @dentalware/api exec vitest run src/lib/clock.test.ts src/features/auth/session.test.ts` → falla (módulos/exports inexistentes).

- [ ] **Step 3: Implementar**

```ts
// apps/api/src/lib/request-context.ts
import type { UserRole } from '@dentalware/shared'
/** Lo único que un caso de uso sabe de quién lo invoca. Nunca el Context de Hono. */
export type RequestContext = { userId: string; role: UserRole }
```

```ts
// apps/api/src/lib/clock.ts
import { toIsoDate } from '@dentalware/shared'
export interface Clock {
  today(): string // YYYY-MM-DD
  now(): Date
}
export const systemClock: Clock = { today: () => toIsoDate(new Date()), now: () => new Date() }
```

```ts
// apps/api/src/lib/ids.ts
import { randomUUID } from 'node:crypto'
export interface IdGenerator {
  next(): string
}
export const randomIds: IdGenerator = { next: () => randomUUID() }
```

En `session.ts` añadir:

```ts
import type { Context } from 'hono'
import type { RequestContext } from '../../lib/request-context.ts'

/** Traduce la sesión de Hono al contexto que reciben los servicios (ADR 20). */
export function ctxFrom(c: Context<AppEnv>): RequestContext {
  const user = c.var.user
  if (!user) throw new HTTPException(403, { message: 'Sin permiso' })
  return { userId: user.id, role: user.role as UserRole }
}
```

- [ ] **Step 4: Verificar** tests en verde; `pnpm typecheck`.
- [ ] **Step 5: Commit** `refactor(api): contexto de petición, reloj e identificadores como puertos transversales` (Refs #54).

---

### Task 2: `cases` — puertos, errores y repo como factoría

**Files:**
- Create: `apps/api/src/features/cases/ports.ts`, `apps/api/src/features/cases/errors.ts`
- Modify: `apps/api/src/features/cases/repo.ts` (factoría `createCasesRepo`, `drizzleUnitOfWork`; se eliminan `createCase`/`createCaseTx`/funciones sueltas), `apps/api/src/features/cases/cases.repo.test.ts` (mismos casos sobre la factoría), `apps/api/src/features/cases/import.ts` y `apps/api/src/features/attachments/routes.ts` (solo adaptar imports a la factoría para que compile; se reescriben en Tareas 4 y 5), `apps/api/src/features/cases/routes.ts` (idem, mínimo).
- Test: `cases.repo.test.ts` (adaptado, contra Postgres).

**Interfaces:**
- Produces:

```ts
// apps/api/src/features/cases/ports.ts
import type {
  CaseEventType,
  CaseInput,
  CaseListQuery,
  CasePriority,
  CaseStatus,
  PricingUnit,
} from '@dentalware/shared'
// Solo tipos: las formas de fila se derivan del schema (ruling del plan; ESLint allowTypeImports).
import type { caseEvents, caseItems, cases } from './schema.ts'

export type Named = { id: string; name: string }
export type CaseDetail = typeof cases.$inferSelect & {
  clinic: Named
  doctor: Named
  technician: Named | null
  stage: { id: string; name: string; color: string } | null
  items: (typeof caseItems.$inferSelect & {
    product: { id: string; code: string; name: string; pricingUnit: PricingUnit } | null
  })[]
}
export type CaseEventRow = typeof caseEvents.$inferSelect & { actor: Named | null }
export type CaseListRow = {
  id: string
  code: string
  boxNumber: string | null
  patientRef: string
  status: CaseStatus
  priority: CasePriority
  receivedAt: string
  dueDate: string | null
  promisedDate: string | null
  total: string | null
  clinic: Named
  doctor: Named
  stage: { name: string; color: string } | null
  technician: { name: string } | null
  itemsSummary: string
}
export type CaseListPage = { cases: CaseListRow[]; total: number; page: number; pageSize: number }
export type NewCaseEvent = {
  caseId: string
  type: CaseEventType
  fromValue?: string | null
  toValue?: string | null
  reason?: string | null
  actorId: string | null
}

export interface CasesRepository {
  /** Lanza CaseInputError si un producto no existe o está inactivo. */
  create(input: CaseInput, actorId: string): Promise<{ id: string; code: string }>
  /** false si no existe; lanza CaseStateError si el estado no es editable; CaseInputError por producto. */
  update(id: string, input: CaseInput, actorId: string): Promise<boolean>
  byId(id: string): Promise<CaseDetail | undefined>
  list(q: CaseListQuery, today: string): Promise<CaseListPage>
  events(caseId: string): Promise<CaseEventRow[]>
  addEvent(e: NewCaseEvent): Promise<void>
}

/** Puerto de OTRA feature (adjuntos): se inyecta en la raíz de composición. */
export interface AttachmentsQuery {
  hasDocument(caseId: string): Promise<boolean>
}

/** Atomicidad sin conocer db.transaction (ADR 19). */
export interface UnitOfWork {
  run<T>(fn: (repos: { cases: CasesRepository }) => Promise<T>): Promise<T>
}
```

```ts
// apps/api/src/features/cases/errors.ts
export class CaseInputError extends Error {
  path: string
  constructor(message: string, path = '') {
    super(message)
    this.path = path
  }
}
export class CaseStateError extends Error {}
export class CaseNotFoundError extends Error {
  constructor() {
    super('El trabajo no existe')
  }
}
```

- `repo.ts` exporta `createCasesRepo(db: Db | Tx): CasesRepository` (con `satisfies`), `drizzleUnitOfWork(db: Db): UnitOfWork`, y mantiene `stripPrices` **solo hasta la Tarea 3** (se mueve al servicio). `Tx` se exporta desde `db/index.ts`: `export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]`.

- [ ] **Step 1: Adaptar `cases.repo.test.ts` (RED)** — sustituir imports: `const repo = createCasesRepo(ctx.db)`; `createCase(ctx.db, input, actor)` → `(await repo.create(input, actor)).id`; `getCase(ctx.db, id)` → `repo.byId(id)`; `listCases(ctx.db, q, today)` → `repo.list(q, today)`; `listEvents` → `repo.events`; `addEvent(ctx.db, e)` → `repo.addEvent(e)`; `updateCase(ctx.db, ...)` → `repo.update(...)`; errores desde `./errors.ts`. Añadir un caso nuevo:

```ts
it('drizzleUnitOfWork crea varios trabajos en una sola transacción y revierte todos si uno falla', async () => {
  const uow = drizzleUnitOfWork(ctx.db)
  await expect(
    uow.run(async ({ cases }) => {
      await cases.create(input(), actor)
      await cases.create(input({ items: [{ productId: randomUUID(), quantity: 1 }] }), actor)
    }),
  ).rejects.toBeInstanceOf(CaseInputError)
  expect((await createCasesRepo(ctx.db).list(caseListQuerySchema.parse({}), '2026-09-09')).total).toBe(0)
})
```

- [ ] **Step 2: Correr** `pnpm --filter @dentalware/api exec vitest run src/features/cases/cases.repo.test.ts` → falla (exports inexistentes).

- [ ] **Step 3: Implementar la factoría** en `repo.ts`: envolver las funciones actuales conservando su SQL tal cual:

```ts
export function createCasesRepo(db: Db | Tx) {
  return {
    async create(input, actorId) {
      // cuerpo actual de createCaseTx usando `db` (funciona con Db o Tx)
    },
    update(id, input, actorId) {
      // cuerpo actual de updateCase: si `db` es Tx no abre otra transacción;
      // si es Db, abre db.transaction como hoy (ver nota)
    },
    byId: (id) => db.query.cases.findFirst({ /* igual que getCase */ }),
    list: (q, today) => listCasesWith(db, q, today),
    events: (caseId) => db.query.caseEvents.findMany({ /* igual */ }),
    addEvent: (e) => addEventWith(db, e),
  } satisfies CasesRepository
}

export const drizzleUnitOfWork = (db: Db): UnitOfWork => ({
  run: (fn) => db.transaction((tx) => fn({ cases: createCasesRepo(tx) })),
})
```

Nota sobre `update`: hoy abre `db.transaction` (con `FOR UPDATE`). Para no anidar transacciones, `update` **no** abre transacción: el servicio (Tarea 3) lo llama dentro de `uow.run`. En la factoría, `update` opera sobre `db` recibido (Db o Tx) tal cual. El test del repo lo llama a través de `drizzleUnitOfWork(ctx.db).run(({ cases }) => cases.update(...))`. `create` igual: sin transacción propia; el `nextCaseCode` con upsert sigue siendo atómico por fila.

- [ ] **Step 4: Adaptar mínimamente** `routes.ts`, `import.ts`, `attachments/routes.ts` para que compilen contra la factoría (`const repo = createCasesRepo(db)`; `createCase(db, …)` → `drizzleUnitOfWork(db).run(({ cases }) => cases.create(…))`), sin cambiar comportamiento. Tests de integración `cases.test.ts`, `import.test.ts`, `attachments.test.ts` deben seguir en verde.

- [ ] **Step 5: Verificar** `pnpm typecheck && pnpm --filter @dentalware/api test`.
- [ ] **Step 6: Commit** `refactor(api): repositorio de trabajos como factoría que cumple su puerto; unidad de trabajo sobre Drizzle` (Refs #54).

---

### Task 3: `cases` — servicio con fakes y rutas que solo traducen

**Files:**
- Create: `apps/api/src/features/cases/service.ts`, `apps/api/src/features/cases/service.test.ts`, `apps/api/src/features/cases/fakes.ts` (fakes reutilizables por otros tests de servicio; sin dependencias de BD)
- Modify: `apps/api/src/features/cases/routes.ts` (reescritura: `casesRoutes(service, importRoutes)`), `apps/api/src/features/cases/repo.ts` (quitar `stripPrices`; se muda al servicio), `apps/api/src/app.ts` (composición), `apps/api/src/features/attachments/routes.ts` (no toca aún la lógica; solo si necesita `createCasesRepo`).
- Test: `service.test.ts` (fakes), `cases.test.ts` (integración, sin cambios de aserciones).

**Interfaces:**
- Consumes: `CasesRepository`, `AttachmentsQuery`, `UnitOfWork`, `Clock` (Task 1–2).
- Produces:

```ts
export function createCasesService(deps: {
  cases: CasesRepository
  attachments: AttachmentsQuery
  uow: UnitOfWork
  clock: Clock
}): {
  list(q: CaseListQuery, ctx: RequestContext): Promise<CaseListPage>            // total: null para técnico/mensajero
  detail(id: string, ctx: RequestContext): Promise<{ case: CaseDetail; missing: string[] }> // CaseNotFoundError
  create(input: CaseInput, ctx: RequestContext): Promise<CaseDetail>            // CaseInputError
  update(id: string, input: CaseInput, ctx: RequestContext): Promise<CaseDetail> // CaseNotFoundError | CaseStateError | CaseInputError
  events(caseId: string, ctx: RequestContext): Promise<CaseEventRow[]>         // price_changed enmascarado
  comment(caseId: string, text: string, ctx: RequestContext): Promise<CaseEventRow> // CaseNotFoundError
}
export type CasesService = ReturnType<typeof createCasesService>
export function stripPrices<T extends Priced>(row: T): T   // se muda aquí desde repo.ts
export function maskPriceEvents<T extends { type: string; fromValue: string | null; toValue: string | null }>(events: T[], hide: boolean): T[]
```

El tipo de `missing` es el que devuelve `missingForAccept` de shared (usar `ReturnType<typeof missingForAccept>`).

- [ ] **Step 1: Fakes**

```ts
// apps/api/src/features/cases/fakes.ts
import type { CaseInput } from '@dentalware/shared'
import { CaseInputError, CaseStateError } from './errors.ts'
import type { CaseDetail, CaseEventRow, CasesRepository, NewCaseEvent, UnitOfWork } from './ports.ts'
import { isEditableStatus } from '@dentalware/shared'

export function caseDetailFixture(over: Partial<CaseDetail> = {}): CaseDetail {
  const base = {
    id: 'c1', code: '26-00001', boxNumber: null, clinicId: 'cl1', doctorId: 'd1',
    patientRef: 'Paciente 1', patientAge: null, patientSex: null, status: 'nuevo',
    currentStageId: null, assignedTechnicianId: null, priority: 'normal',
    receivedAt: '2026-09-09', dueDate: '2026-09-16', promisedDate: null,
    finishedAt: null, shippedAt: null, deliveredAt: null, paidAt: null,
    shade: 'A2', shadeSystem: null, reference: null,
    checklist: { antagonista: false, mordida: false, color: false, fotos: false },
    observations: null, prescription: 'Rx', internalNotes: 'nota interna', holdReason: null,
    parentCaseId: null, remakeReason: null, remakeResponsibility: null, remakeChargePct: null,
    total: '90.00', createdBy: 'u1', createdAt: new Date('2026-09-09T12:00:00Z'),
    updatedAt: new Date('2026-09-09T12:00:00Z'),
    clinic: { id: 'cl1', name: 'Sonrisa' }, doctor: { id: 'd1', name: 'Dr. Pérez' },
    technician: null, stage: null,
    items: [{
      id: 'i1', caseId: 'c1', productId: 'p1', description: null, quantity: 2, teeth: [11, 12],
      unitPrice: '45.00', discountPct: '0.00', lineTotal: '90.00', material: null, notes: null, sort: 0,
      product: { id: 'p1', code: 'ZR', name: 'Zirconio', pricingUnit: 'por_pieza' },
    }],
  } satisfies CaseDetail
  return { ...base, ...over }
}

/** Repositorio en memoria: suficiente para probar orquestación, enmascarado y errores. */
export function fakeCasesRepo(seed: CaseDetail[] = []) {
  const rows = new Map(seed.map((r) => [r.id, r]))
  const events: CaseEventRow[] = []
  let seq = seed.length
  const repo: CasesRepository = {
    async create(input, actorId) {
      if (input.items.some((i) => i.productId === 'inexistente'))
        throw new CaseInputError('El producto no existe o está inactivo', 'items.0.productId')
      seq += 1
      const id = `c${seq}`
      rows.set(id, caseDetailFixture({ id, code: `26-0000${seq}`, ...input, createdBy: actorId } as Partial<CaseDetail>))
      await repo.addEvent({ caseId: id, type: 'created', toValue: `26-0000${seq}`, actorId })
      return { id, code: `26-0000${seq}` }
    },
    async update(id, input, actorId) {
      const cur = rows.get(id)
      if (!cur) return false
      if (!isEditableStatus(cur.status)) throw new CaseStateError(`No se puede editar un trabajo en estado "${cur.status}"`)
      rows.set(id, { ...cur, ...input } as CaseDetail)
      await repo.addEvent({ caseId: id, type: 'edited', actorId })
      return true
    },
    byId: async (id) => rows.get(id),
    list: async (q) => ({
      cases: [...rows.values()].map((r) => ({
        id: r.id, code: r.code, boxNumber: r.boxNumber, patientRef: r.patientRef, status: r.status,
        priority: r.priority, receivedAt: r.receivedAt, dueDate: r.dueDate, promisedDate: r.promisedDate,
        total: r.total, clinic: r.clinic, doctor: r.doctor, stage: null, technician: null, itemsSummary: 'Zirconio ×2',
      })),
      total: rows.size, page: q.pagina, pageSize: 20,
    }),
    events: async (caseId) => events.filter((e) => e.caseId === caseId),
    async addEvent(e: NewCaseEvent) {
      events.push({
        id: `e${events.length + 1}`, caseId: e.caseId, type: e.type, fromValue: e.fromValue ?? null,
        toValue: e.toValue ?? null, reason: e.reason ?? null, actorId: e.actorId,
        createdAt: new Date(), actor: e.actorId ? { id: e.actorId, name: 'Actor' } : null,
      })
    },
  }
  return { repo, rows, events }
}

export const fakeUow = (cases: CasesRepository): UnitOfWork => ({ run: (fn) => fn({ cases }) })
export const fixedClock = (today = '2026-09-09') => ({ today: () => today, now: () => new Date(`${today}T12:00:00Z`) })
```

- [ ] **Step 2: Tests del servicio (RED)** — `service.test.ts`, nombres en español:

```ts
import { describe, expect, it } from 'vitest'
import { CaseNotFoundError, CaseStateError } from './errors.ts'
import { caseDetailFixture, fakeCasesRepo, fakeUow, fixedClock } from './fakes.ts'
import { createCasesService } from './service.ts'

const admin = { userId: 'u1', role: 'admin' } as const
const tecnico = { userId: 'u2', role: 'tecnico' } as const

function build(seed = [caseDetailFixture()], hasDocument = false) {
  const { repo, events } = fakeCasesRepo(seed)
  const service = createCasesService({
    cases: repo,
    attachments: { hasDocument: async () => hasDocument },
    uow: fakeUow(repo),
    clock: fixedClock(),
  })
  return { service, repo, events }
}

describe('createCasesService', () => {
  it('la lista oculta el total a técnico y mensajero y lo muestra a admin', async () => {
    const { service } = build()
    expect((await service.list({ pagina: 1 } as never, tecnico)).cases[0]!.total).toBeNull()
    expect((await service.list({ pagina: 1 } as never, admin)).cases[0]!.total).toBe('90.00')
  })
  it('el detalle oculta precios y notas internas al técnico y calcula lo que falta para aceptar', async () => {
    const { service } = build()
    const r = await service.detail('c1', tecnico)
    expect(r.case.total).toBeNull()
    expect(r.case.internalNotes).toBeNull()
    expect(r.case.items[0]!.unitPrice).toBeNull()
    expect(r.missing).toContain('documento')  // ajustar al nombre real que devuelve missingForAccept sin documento
  })
  it('el detalle no reclama el documento cuando existe un adjunto de tipo documento', async () => {
    const { service } = build([caseDetailFixture()], true)
    expect((await service.detail('c1', admin)).missing).not.toContain('documento')
  })
  it('lanza CaseNotFoundError si el trabajo no existe', async () => {
    const { service } = build()
    await expect(service.detail('nope', admin)).rejects.toBeInstanceOf(CaseNotFoundError)
  })
  it('crear devuelve el detalle recién creado y registra el evento created', async () => {
    const { service, events } = build([])
    const c = await service.create(caseInputFixture(), admin)
    expect(c.code).toMatch(/^26-/)
    expect(events.map((e) => e.type)).toEqual(['created'])
  })
  it('editar un trabajo en estado no editable lanza CaseStateError', async () => {
    const { service } = build([caseDetailFixture({ status: 'terminado' })])
    await expect(service.update('c1', caseInputFixture(), admin)).rejects.toBeInstanceOf(CaseStateError)
  })
  it('los eventos price_changed llegan enmascarados al técnico', async () => {
    const { service, repo } = build()
    await repo.addEvent({ caseId: 'c1', type: 'price_changed', fromValue: 'p1:45.00', toValue: 'p1:50.00', actorId: 'u1' })
    const ev = await service.events('c1', tecnico)
    expect(ev[0]).toMatchObject({ type: 'price_changed', fromValue: null, toValue: null })
    expect((await service.events('c1', admin))[0]!.toValue).toBe('p1:50.00')
  })
  it('comentar registra un evento comment y devuelve ese evento', async () => {
    const { service } = build()
    const e = await service.comment('c1', 'Hola', admin)
    expect(e).toMatchObject({ type: 'comment', toValue: 'Hola' })
  })
})
```

`caseInputFixture()` va en `fakes.ts`: `caseInputSchema.parse({ clinicId: 'cl1', doctorId: 'd1', patientRef: 'Paciente 1', receivedAt: '2026-09-09', items: [{ productId: 'p1', quantity: 1 }] })` (completar los campos obligatorios que exija el schema).

- [ ] **Step 3: Correr** → falla (`service.ts` no existe).

- [ ] **Step 4: Implementar `service.ts`** (mover aquí `stripPrices`, `maskPriceEvents`, `readiness` y `hidesPrices` desde `repo.ts`/`routes.ts`):

```ts
import { missingForAccept, type CaseInput, type CaseListQuery, type UserRole } from '@dentalware/shared'
import type { Clock } from '../../lib/clock.ts'
import type { RequestContext } from '../../lib/request-context.ts'
import { CaseNotFoundError } from './errors.ts'
import type { AttachmentsQuery, CaseDetail, CasesRepository, UnitOfWork } from './ports.ts'

const hidesPrices = (role: UserRole) => role === 'tecnico' || role === 'mensajero'

export function createCasesService(deps: { cases: CasesRepository; attachments: AttachmentsQuery; uow: UnitOfWork; clock: Clock }) {
  const mustGet = async (id: string) => {
    const found = await deps.cases.byId(id)
    if (!found) throw new CaseNotFoundError()
    return found
  }
  return {
    async list(q: CaseListQuery, ctx: RequestContext) {
      const page = await deps.cases.list(q, deps.clock.today())
      if (!hidesPrices(ctx.role)) return page
      return { ...page, cases: page.cases.map((r) => ({ ...r, total: null })) }
    },
    async detail(id: string, ctx: RequestContext) {
      const found = await mustGet(id)
      const hasDoc = await deps.attachments.hasDocument(id)
      return { case: hidesPrices(ctx.role) ? stripPrices(found) : found, missing: readiness(found, hasDoc) }
    },
    async create(input: CaseInput, ctx: RequestContext) {
      const { id } = await deps.uow.run(({ cases }) => cases.create(input, ctx.userId))
      return mustGet(id)
    },
    async update(id: string, input: CaseInput, ctx: RequestContext) {
      const ok = await deps.uow.run(({ cases }) => cases.update(id, input, ctx.userId))
      if (!ok) throw new CaseNotFoundError()
      return mustGet(id)
    },
    async events(caseId: string, ctx: RequestContext) {
      return maskPriceEvents(await deps.cases.events(caseId), hidesPrices(ctx.role))
    },
    async comment(caseId: string, text: string, ctx: RequestContext) {
      await mustGet(caseId)
      await deps.cases.addEvent({ caseId, type: 'comment', toValue: text, actorId: ctx.userId })
      const events = maskPriceEvents(await deps.cases.events(caseId), hidesPrices(ctx.role))
      return events[events.length - 1]!
    },
  }
}
export type CasesService = ReturnType<typeof createCasesService>
```

- [ ] **Step 5: Reescribir `routes.ts`**: `casesRoutes(service: CasesService, importRoutes: Hono<AppEnv>)`; `.route('/importar', importRoutes)`; cada handler llama al servicio con `ctxFrom(c)` y traduce con un helper local:

```ts
function toHttp(e: unknown): never {
  if (e instanceof CaseInputError)
    throw new HTTPException(422, { res: Response.json({ message: 'Datos inválidos', issues: [{ path: e.path, message: e.message }] }, { status: 422 }) })
  if (e instanceof CaseStateError) throw new HTTPException(409, { message: e.message })
  if (e instanceof CaseNotFoundError) throw new HTTPException(404, { message: e.message })
  throw e
}
```

Nota: si `HTTPException` con `res` no encaja con el `onError` global (`{ message }`), devolver directamente `c.json({ message: 'Datos inválidos', issues }, 422)` dentro de un `try/catch` como hoy. Mantener los códigos y cuerpos exactos que esperan `cases.test.ts` y la web (`ApiError`). Mantener `requireAuth`/`canWrite` iguales. Eliminar `todayIso`, `readiness`, `maskPriceEvents` y todo `db.` de la ruta.

- [ ] **Step 6: Composición en `app.ts`**:

```ts
export type AppDeps = { auth: Auth; db: Db; webOrigin: string; storage: Storage; clock?: Clock; ids?: IdGenerator }
// ...
const clock = deps.clock ?? systemClock
const casesRepo = createCasesRepo(db)
const attachmentsRepo = createAttachmentsRepo(db)   // Tarea 4; hasta entonces: { hasDocument: (id) => hasDocument(db, id) } en attachments/repo.ts
const casesService = createCasesService({ cases: casesRepo, attachments: attachmentsRepo, uow: drizzleUnitOfWork(db), clock })
// .route('/api/trabajos', casesRoutes(casesService, importRoutes(db)))   // importRoutes se sustituye en Tarea 5
```

- [ ] **Step 7: Verificar** `pnpm typecheck && pnpm --filter @dentalware/api test` (todos: servicio con fakes + integración sin cambios de aserciones). Corregir el nombre real del ítem de readiness en el test del paso 2 si difiere (`missingForAccept` en shared).
- [ ] **Step 8: Commit** `refactor(api): servicio de trabajos con enmascarado por rol y readiness; rutas que solo validan y traducen` (Refs #54).

---

### Task 4: `attachments` — puertos, servicio y rutas sin repo ajeno

**Files:**
- Create: `apps/api/src/features/attachments/ports.ts`, `errors.ts`, `service.ts`, `service.test.ts`, `fakes.ts`
- Modify: `apps/api/src/features/attachments/repo.ts` (factoría `createAttachmentsRepo(db) satisfies AttachmentsRepository & AttachmentsQuery`), `routes.ts` (reescritura: `attachmentsRoutes(service)`), `apps/api/src/lib/images.ts` (+ `sharpImages: ImageProcessor`), `apps/api/src/app.ts`, `apps/api/src/features/attachments/attachments.test.ts` (solo el import de `createCase` → `createCasesRepo(ctx.db).create(...)`).
- Test: `service.test.ts` (fakes: storage en memoria, image processor falso, ids fijos), `attachments.test.ts` (integración, aserciones intactas).

**Interfaces:**

```ts
// ports.ts
import type { AttachmentKind } from '@dentalware/shared'
import type { Readable } from 'node:stream'   // solo tipo
import type { attachments } from './schema.ts'  // solo tipo
export type AttachmentRecord = typeof attachments.$inferSelect & { uploader: { id: string; name: string } | null }
export type NewAttachment = Omit<typeof attachments.$inferInsert, 'createdAt'> & { id: string }

export interface AttachmentsRepository {
  insert(row: NewAttachment): Promise<AttachmentRecord>
  byId(id: string): Promise<AttachmentRecord | undefined>
  byCase(caseId: string): Promise<AttachmentRecord[]>
  remove(id: string): Promise<void>
}
export interface ImageProcessor {
  normalize(input: Uint8Array): Promise<{ data: Uint8Array; width: number; height: number }> // lanza si no es imagen
  thumbnail(input: Uint8Array): Promise<Uint8Array>
}
export interface CasesQuery { exists(caseId: string): Promise<boolean> }
export interface CaseEventLog {
  add(e: { caseId: string; type: 'attachment_added' | 'attachment_removed'; fromValue?: string | null; toValue?: string | null; actorId: string }): Promise<void>
}
export type UploadInput = { caseId: string; filename: string; mime: string; size: number; bytes: Uint8Array; kind: AttachmentKind | null }
export type OpenedFile = { stream: Readable; mime: string; filename: string }
```

```ts
// errors.ts
export class AttachmentNotFoundError extends Error { constructor(m = 'El adjunto no existe') { super(m) } }
export class UnsupportedFileError extends Error {}   // → 415
export class FileTooLargeError extends Error {}      // → 413
export { CaseNotFoundError } from '../cases/errors.ts'  // permitido: errores de dominio, no adaptadores
```

```ts
// service.ts
export function createAttachmentsService(deps: {
  attachments: AttachmentsRepository; cases: CasesQuery; events: CaseEventLog
  storage: Storage; images: ImageProcessor; ids: IdGenerator
}): {
  list(caseId: string): Promise<AttachmentRecord[]>
  upload(input: UploadInput, ctx: RequestContext): Promise<AttachmentRecord>   // CaseNotFoundError | FileTooLargeError | UnsupportedFileError
  open(id: string): Promise<OpenedFile>                                        // AttachmentNotFoundError
  openThumbnail(id: string): Promise<OpenedFile>                               // AttachmentNotFoundError ('Sin miniatura')
  remove(id: string, ctx: RequestContext): Promise<void>                       // AttachmentNotFoundError
}
```

`upload` reproduce exactamente el flujo actual de la ruta: comprobar trabajo, tamaño (`MAX_UPLOAD_BYTES`), MIME permitido, normalizar imagen (415 si falla), magic bytes PDF, nombres `${caseId}/${id}.${ext}` y `.thumb.webp`, `safeName`, kind por defecto, `insert`, evento `attachment_added`. `remove`: borrar fila, archivos y evento `attachment_removed`. `safeName`/`asciiSafeName` viven en `service.ts` (puros); `asciiSafeName` la usa la ruta para `Content-Disposition` (exportarla desde `service.ts` o moverla a `lib/filenames.ts`).

- [ ] **Step 1: Fakes** (`fakes.ts`): `memoryStorage()` (Map<string, Uint8Array> con `put/open/remove/exists`, `open` devuelve `Readable.from`), `fakeImages` (`normalize` devuelve `{ data: input, width: 100, height: 80 }` y lanza `new Error('no es imagen')` cuando el primer byte es `0x00`, para simular una imagen corrupta; `thumbnail` devuelve `input.subarray(0, 8)`), `fixedIds(['id-1','id-2'])`, `fakeAttachmentsRepo()` en memoria, `casesQueryWith(['c1'])`, `recordingEvents()`.
- [ ] **Step 2: Tests (RED)** — casos: «sube una imagen: normaliza, guarda miniatura y original, registra attachment_added»; «sube un PDF válido como documento»; «rechaza un PDF sin cabecera %PDF- con UnsupportedFileError»; «rechaza un MIME no permitido»; «rechaza un archivo mayor que el límite con FileTooLargeError»; «lanza CaseNotFoundError si el trabajo no existe»; «al borrar elimina archivo, miniatura y registra attachment_removed»; «open devuelve mime y nombre del adjunto»; «openThumbnail lanza si no hay miniatura».
- [ ] **Step 3: Implementar** `service.ts`, `repo.ts` como factoría (+ método `hasDocument(caseId)` para cumplir también `AttachmentsQuery` de `cases`), `sharpImages` en `lib/images.ts`, `routes.ts` (solo: `requireAuth`, `bodyLimit`, `parseBody`, `validate`, streaming con `stream(c, …)`, cabeceras, traducción de errores 404/413/415/422).
- [ ] **Step 4: Composición** en `app.ts`: `createAttachmentsService({ attachments: attachmentsRepo, cases: { exists: async (id) => (await casesRepo.byId(id)) !== undefined }, events: { add: (e) => casesRepo.addEvent(e) }, storage, images: sharpImages, ids })`. `attachments/routes.ts` ya no importa nada de `../cases/`.
- [ ] **Step 5: Verificar** `pnpm typecheck && pnpm --filter @dentalware/api test`.
- [ ] **Step 6: Commit** `refactor(api): servicio de adjuntos con puertos de almacenamiento, imágenes e identificadores; sin importar el repo de trabajos` (Refs #54).

---

### Task 5: `cases/import` — servicio con catálogo como puerto y ruta aparte

**Files:**
- Create: `apps/api/src/features/cases/import.ports.ts`, `import.service.ts`, `import.service.test.ts`, `import.repo.ts`, `import.routes.ts`
- Delete: `apps/api/src/features/cases/import.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/features/cases/routes.ts` (recibe `importRoutes`), `import.test.ts` (solo imports si los hubiera; las aserciones no cambian).

**Interfaces:**

```ts
// import.ports.ts
export type CatalogClinic = { id: string; name: string; active: boolean }
export type CatalogDoctor = { id: string; name: string; clinicId: string; active: boolean }
export type CatalogProduct = { id: string; code: string; name: string; active: boolean }
export interface ImportCatalog {
  clinics(): Promise<CatalogClinic[]>
  doctors(): Promise<CatalogDoctor[]>
  products(): Promise<CatalogProduct[]>
}
```

```ts
// import.service.ts
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024
export function buildTemplateCsv(): string
export function normalizeName(s: string): string
export function headerMatches(header: string[]): boolean
export function createImportService(deps: { catalog: ImportCatalog; uow: UnitOfWork; clock: Clock }): {
  run(opts: { rows: string[][]; commit: boolean }, ctx: RequestContext): Promise<ImportReport>
}
```

`run` = el `importCases` actual, sustituyendo las tres consultas `db.select(...)` por `deps.catalog.*()` (ajustar los campos que usa la resolución: comprobar en `import.ts:130-200` qué columnas lee y reflejarlas en los tipos del catálogo), `toIsoDate(new Date())` por `deps.clock.today()` y `db.transaction` + `createCaseTx` por `deps.uow.run(async ({ cases }) => { for … cases.create(input, ctx.userId) })`.

- [ ] **Step 1: Tests (RED)** — `import.service.test.ts` con `fakeCasesRepo`, `fakeUow`, `fixedClock` (de `./fakes.ts`) y un catálogo en memoria: «resuelve clínica, doctor y producto insensible a acentos y crea un trabajo por grupo con commit», «reporta en la misma pasada error de formato y de clínica inexistente» (mismo caso que hoy cubre `import.test.ts`, ahora sin Postgres), «sin commit no crea nada y devuelve el conteo», «con cualquier error no crea nada aunque commit sea true».
- [ ] **Step 2: Implementar** `import.service.ts` (mover helpers puros), `import.repo.ts`:

```ts
export const createImportCatalog = (db: Db): ImportCatalog => ({
  clinics: () => db.select({ id: clinics.id, name: clinics.name, active: clinics.active }).from(clinics),
  doctors: () => db.select({ id: doctors.id, name: doctors.name, clinicId: doctors.clinicId, active: doctors.active }).from(doctors),
  products: () => db.select({ id: products.id, code: products.code, name: products.name, active: products.active }).from(products),
})
```

`import.routes.ts`: `importRoutes(service: ImportService)` con `requireRole`, `bodyLimit`, parseo, cabecera y `service.run({ rows: rows.slice(1), commit }, ctxFrom(c))`.

- [ ] **Step 3: Composición**: `const importService = createImportService({ catalog: createImportCatalog(db), uow: drizzleUnitOfWork(db), clock })`; `casesRoutes(casesService, importRoutes(importService))`.
- [ ] **Step 4: Verificar** `pnpm typecheck && pnpm --filter @dentalware/api test` (incluye `import.test.ts` intacto).
- [ ] **Step 5: Commit** `refactor(api): importación como servicio con catálogo por puerto y ruta separada` (Refs #54).

---

### Task 6: Docs de arquitectura + cierre del PR A

**Files:**
- Modify: `docs/architecture.md` (§2 punto 4: la excepción `repo.ts → schema.ts` ajeno; §3.2: nota de que `ports.ts` deriva tipos de fila con `import type` de `./schema.ts`; §3.6: filas `cases`, `cases/import`, `attachments`, `auth/session` pasan a «migrada (PR #A)» con las líneas nuevas; ADR 24: «joins entre features en el repo» y ADR 25: «tipos de fila derivados del schema en ports.ts»), `docs/conventions.md` §3 (mismas dos excepciones en una línea cada una), `README.md` si describe la estructura de features.
- Test: ninguno nuevo; verificación completa + E2E.

- [ ] **Step 1: Editar docs** con las líneas reales (`grep -n` para cada archivo:línea citado).
- [ ] **Step 2: Verificación completa** `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` y `pnpm e2e --project=escritorio --project=android` (puertos libres).
- [ ] **Step 3: Commit** `docs(arquitectura): cases, importación y adjuntos migrados; excepciones de joins y tipos de fila` (Refs #54).
- [ ] **Step 4: Revisión final de rama + ola de fixes; PR A** contra `main` «Adopción hexagonal (1/2): trabajos, importación y adjuntos con puertos y servicios» con `Refs #54` (no cierra el issue). Tablero: #54 → En revisión.

---

### Task 7: Web — `authClient` confinado en `features/auth` con `useSession`

**Files:**
- Create: `apps/web/src/features/auth/session.ts` (funciones `getSession()`, `signOut()`), `apps/web/src/features/auth/use-session.ts` (hook `useSession()` sobre `authClient.useSession`), tests `session.test.ts` y `use-session.test.tsx` (mock de `./auth-client`).
- Modify: `apps/web/src/routes/_app.tsx` (`getSession`), `apps/web/src/routes/login.tsx` (`getSession`), `apps/web/src/components/app-shell.tsx` (`signOut`), `apps/web/src/features/auth/login-form.tsx` (`signIn` desde `session.ts`).

**Interfaces:**

```ts
// features/auth/session.ts
import type { UserRole } from '@dentalware/shared'
import { authClient } from './auth-client'
export type SessionUser = { id: string; name: string; email: string; role: UserRole }
export async function getSession(): Promise<SessionUser | null>
export async function signIn(values: { email: string; password: string }): Promise<{ ok: true } | { ok: false }>
export async function signOut(): Promise<void>
```

- [ ] **Step 1: Tests (RED)** — `session.test.ts`: con `vi.mock('./auth-client')`: «getSession devuelve el usuario con su rol tipado», «getSession devuelve null sin sesión», «signIn devuelve ok false cuando better-auth responde error», «signOut delega en el cliente».
- [ ] **Step 2: Implementar y sustituir** los cuatro usos. `grep -rn "auth-client" apps/web/src` solo debe listar `features/auth/*`.
- [ ] **Step 3: Verificar** `pnpm --filter @dentalware/web test && pnpm typecheck`; E2E de login (`pnpm e2e --project=escritorio -g "login|Inicio"`) si existe; en su defecto `pnpm e2e --project=escritorio`.
- [ ] **Step 4: Commit** `refactor(web): sesión de Better Auth confinada en features/auth` (Refs #54).

---

### Task 8: Reglas de frontera en ESLint

**Files:**
- Modify: `eslint.config.js`
- Test: `pnpm lint` en verde + prueba negativa manual (añadir temporalmente `import { Hono } from 'hono'` a `cases/service.ts` → `pnpm lint` falla; revertir) documentada en el reporte. Añadir además `scripts/check-boundaries.test.mjs`? **No** (YAGNI): la evidencia es el lint.

- [ ] **Step 1: Añadir bloques** (patrones sobre el especificador; `group` + `message` en español):

```js
const API = 'apps/api/src/features'
const noAdapters = (files, extra = []) => ({
  files,
  rules: {
    '@typescript-eslint/no-restricted-imports': [
      'error',
      {
        patterns: [
          { group: ['hono', 'hono/*', 'drizzle-orm', 'drizzle-orm/*', '**/db/**', 'better-auth', 'better-auth/*', 'sharp', 'node:fs', 'node:fs/*', 'node:crypto'],
            message: 'Los servicios y puertos no dependen de adaptadores: declara un puerto e inyéctalo (docs/architecture.md §2).' },
          { group: ['./repo', './repo.ts', './routes', './routes.ts', './import.repo.ts', './import.routes.ts'],
            message: 'Un servicio no importa su repo ni sus rutas.' },
          { group: ['../*/repo.ts', '../*/routes.ts', '../*/service.ts', '../*/import.*'],
            message: 'Entre features solo se comparten puertos e inyección en createApp.' },
          ...extra,
        ],
      },
    ],
  },
})

// … dentro de defineConfig([...]):
noAdapters([`${API}/*/service.ts`, `${API}/*/*.service.ts`], [
  { group: ['./schema', './schema.ts', '../*/schema.ts'], message: 'El servicio no conoce las tablas: usa el repo a través de su puerto.' },
]),
noAdapters([`${API}/*/ports.ts`, `${API}/*/*.ports.ts`], [
  { group: ['./schema', './schema.ts', '../*/schema.ts'], allowTypeImports: true, message: 'ports.ts solo deriva tipos del schema (import type).' },
]),
{
  files: [`${API}/*/routes.ts`, `${API}/*/*.routes.ts`],
  ignores: [`${API}/users/routes.ts`, `${API}/products/routes.ts`], // #54 boy-scout: se migran en Iteración 5
  rules: {
    '@typescript-eslint/no-restricted-imports': ['error', { patterns: [
      { group: ['drizzle-orm', 'drizzle-orm/*', '**/db/schema/**', './schema.ts', '../*/schema.ts', '../*/repo.ts'],
        message: 'La ruta solo valida, autoriza y traduce: los datos llegan por el servicio.' },
    ] }],
  },
},
{
  files: [`${API}/*/repo.ts`, `${API}/*/*.repo.ts`],
  rules: {
    '@typescript-eslint/no-restricted-imports': ['error', { patterns: [
      { group: ['hono', 'hono/*', '../*/repo.ts', '../*/routes.ts', '../*/service.ts'],
        message: 'El repo puede unir tablas de otra feature (schema.ts) pero no usar su repo, rutas ni servicio.' },
    ] }],
  },
},
{
  files: ['apps/web/src/**/*.{ts,tsx}'],
  ignores: ['apps/web/src/**/api.ts', 'apps/web/src/lib/api.ts', 'apps/web/src/features/auth/**'],
  rules: {
    'no-restricted-globals': ['error', { name: 'fetch', message: 'La red solo se toca en features/<f>/api.ts.' }],
    '@typescript-eslint/no-restricted-imports': ['error', { paths: [
      { name: 'hono/client', message: 'hc solo en src/lib/api.ts.' },
    ], patterns: [
      { group: ['better-auth', 'better-auth/*', '@/features/auth/auth-client'], message: 'Better Auth solo dentro de features/auth (usa getSession/useSession).' },
      { group: ['@dentalware/api', '@dentalware/api/*'], allowTypeImports: true, message: 'De la API solo se importan tipos.' },
    ] }],
  },
},
{
  files: ['apps/web/src/routes/**/*.tsx'],
  rules: {
    '@typescript-eslint/no-restricted-imports': ['error', { patterns: [
      { group: ['@/lib/*', '@/test/*', '@/features/*/api', '@/features/*/api.ts'], message: 'Las rutas solo importan de features/ (hooks y componentes) y components/.' },
    ] }],
  },
},
```

Ajustar `ignores` de web: `api.ts` de features y `lib/api.ts` pueden usar `fetch`/`hc`; `test/**` puede usar `fetch` en mocks (`msw` si lo hubiera). Si `@/lib/query-keys` u otros `@/lib/*` legítimos se usan en rutas, afinar el patrón a los módulos que realmente no deben verse (`@/lib/api`).

- [ ] **Step 2: Correr `pnpm lint`** y corregir violaciones reales que aparezcan en features migradas (ninguna debería quedar tras las Tareas 2–5 y 7). Prueba negativa: añadir `import { Hono } from 'hono'` en `features/cases/service.ts` → lint falla con el mensaje en español → revertir.
- [ ] **Step 3: Commit** `build(lint): fronteras hexagonales verificadas con no-restricted-imports` (Refs #54).

---

### Task 9: Docs finales + cierre del PR B

- [ ] **Step 1:** `docs/architecture.md` §3.5: sustituir la propuesta con `eslint-plugin-import-x` por las reglas reales de la Tarea 8; ADR 21 → «vigente (sin plugin externo: `no-restricted-imports` por patrones)»; §3.6 fila `apps/web` → migrada; fila `tooling` → hecha. `docs/conventions.md` §9: añadir «`pnpm lint` verifica las fronteras». `CLAUDE.md` regla 7 sin cambios.
- [ ] **Step 2:** Verificación completa + E2E escritorio/android. Recorrido rápido en Chrome (login, cerrar sesión, lista de trabajos, ficha con adjuntos, importar) a 1280 y 390 con consola limpia: son las pantallas cuyo backend cambió.
- [ ] **Step 3: Commit** `docs(arquitectura): fronteras verificadas por ESLint; web y tooling migrados` (Refs #54).
- [ ] **Step 4:** Revisión final de rama + fixes; PR B «Adopción hexagonal (2/2): sesión confinada en la web y fronteras en ESLint» con `Closes #54`. Tablero: #54 → En revisión → Hecho al mergear. Actualizar la memoria del proyecto.
