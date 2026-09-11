# Arquitectura — Dentalware

Arquitectura de referencia del sistema: lo que siempre debe cumplirse al añadir código, y el registro de decisiones tomadas para este producto. Complementa `docs/conventions.md` (cómo se escribe) y las specs en `docs/superpowers/specs/` (qué se construye). Se actualiza en el mismo PR que cambia una frontera o toma una decisión nueva.

## 1. Contexto y alcance

- **Producto**: gestión interna de un solo laboratorio dental (Arte Dental, Ecuador), 3–15 usuarios, uso en PC y móvil (PWA instalable). Roles: `admin`, `recepcion`, `tecnico`, `mensajero`.
- **Núcleo del dominio**: el **trabajo** (orden de la clínica) con su ciclo de vida (`nuevo → en_proceso ⇄ en_espera | en_prueba → terminado → enviado → entregado`, `cancelado`), sus líneas (producto × cantidad × piezas FDI × precio), fases de producción, adjuntos, historial/auditoría, entregas y cuenta por clínica.
- **Fuera de alcance del MVP** (decidido): facturación electrónica SRI (solo se anota el número), portal del doctor, integración con escáneres/CAD, inventario con lotes, notificaciones push nativas, avisos por WhatsApp (las alertas del MVP van por correo con Resend, ADR 22), producción por persona y sistema de puntos (ADR 23), multi-laboratorio, microservicios.
- **Restricciones reales**: un desarrollador, despliegue en un VPS Hostinger con Docker, datos de pacientes minimizados (LOPDP: alias/referencia, no nombre completo), técnicos con celular y guantes (objetivos táctiles de 44 px), conectividad normal (sin escritura offline).

Estas restricciones mandan sobre el estilo: se toma de la arquitectura hexagonal lo que aísla el dominio y hace el código sustituible y testeable, y se deja fuera todo lo que solo aportaría ceremonia (contenedores de DI, DDD táctico completo, CQRS, event sourcing).

## 2. Estilo arquitectónico: hexagonal pragmática (ports & adapters)

**Monolito modular en un monorepo, organizado por features, con el dominio en el centro y toda la infraestructura detrás de puertos.** El hexágono son `packages/shared` (dominio puro: reglas y contratos) y la **capa de aplicación por feature** (`apps/api/src/features/<f>/service.ts`, casos de uso). Todo lo demás es adaptador: Hono, Drizzle, Better Auth, `sharp`, el disco, React.

```
                        adaptadores driving (entran)
        routes.ts (Hono) · scripts/seed · componentes y rutas de React
                                  │  llaman a casos de uso
                                  ▼
   ┌──────────────────────────────────────────────────────────┐
   │  APLICACIÓN   features/<f>/service.ts  (orquesta, sin I/O)│
   │  ┌────────────────────────────────────────────────────┐  │
   │  │  DOMINIO   packages/shared: máquina de estados,    │  │
   │  │  dinero, FDI, readiness, schemas zod (contratos)   │  │
   │  └────────────────────────────────────────────────────┘  │
   │  declara PUERTOS: features/<f>/ports.ts                  │
   └──────────────────────────────────────────────────────────┘
                                  ▲  implementan los puertos
        repo.ts (Drizzle) · LocalStorage · sharp · Better Auth · Clock
                        adaptadores driven (salen)
```

Flujo de dependencias, único y verificable:

1. `routes.ts → service.ts → ports.ts ← repo.ts / storage / auth`. **Las flechas nunca se invierten**: un servicio no importa `hono`, `drizzle-orm`, `./repo.ts` ni `./schema.ts`; conoce solo interfaces.
2. `shared` no depende de nada salvo `zod` y no hace I/O. Es la **única fuente de verdad** de DTOs, enums y reglas puras (transiciones, días hábiles, totales, código de trabajo, readiness).
3. `api` depende de `shared`; nunca de `web`. `web` depende de `shared` y solo de **tipos** de `api` (`@dentalware/api/app` para `hc<AppType>`); nunca de su runtime.
4. Una feature puede depender de **puertos** de otra (declarados en su propio `ports.ts` e inyectados en la raíz de composición), **nunca de sus adaptadores** (`repo.ts`, `schema.ts`, `routes.ts`) — con dos excepciones acotadas: el `repo.ts` de una feature puede importar el `schema.ts` de otra para joins y lecturas de solo lectura (ADR 24; ejemplo real: `apps/api/src/features/cases/import.repo.ts` lee `clinics`/`doctors`/`products`); y `errors.ts` puede reexportar una clase de error de dominio de otra feature, nunca un adaptador (ADR 26; ejemplo real: `apps/api/src/features/attachments/errors.ts` reexporta `CaseNotFoundError` de `../cases/errors.ts`). Esto ya no se incumple en `attachments/routes.ts` ni en `cases/routes.ts`: ambas se migraron en el PR A (ver §3.6).
5. Las rutas de la web (`apps/web/src/routes`) son adaptadores de UI: componen features y componentes, no contienen lógica de negocio.

## 3. Capas y patrones por aplicación

### 3.1 `packages/shared` — dominio puro (el centro del hexágono)

- **Schema-first / contratos compartidos**: cada entidad tiene su schema zod (`caseInputSchema`, `clinicSchema`, `importRowSchema`…) del que derivan `z.input` (formulario) y `z.output` (API).
- **Máquina de estados** (`case-status.ts:33`): tabla de transiciones válidas con roles; API y UI preguntan `canTransition(from, to, role)`; la UI solo muestra acciones válidas; la API responde 409 ante transiciones inválidas.
- **Value objects funcionales**: dinero en centavos (`money.ts`), piezas FDI (`fdi.ts`), fechas ISO (`isoDate`), código anual (`case-code.ts`). Sin clases: funciones puras y `as const` (`erasableSyntaxOnly`).
- **Readiness** (`case-readiness.ts:17`): `missingForAccept(case)` centraliza qué falta para aceptar un trabajo; lo consumen el formulario, la ficha y el servicio de trabajos.
- Regla: si una regla se puede escribir sin BD ni reloj ni red, **vive aquí** con su test unitario, no en el servicio ni en el repo.

### 3.2 `apps/api` — aplicación, puertos y adaptadores

Estructura objetivo de una feature:

```
apps/api/src/features/<f>/
  ports.ts     interfaces que necesita el caso de uso (repositorios, Storage, Clock, IdGenerator…)
  service.ts   casos de uso: orquesta reglas de shared + puertos. Sin Hono, sin Drizzle, sin process.env
  errors.ts    errores de dominio (CaseInputError, CaseStateError, CaseNotFoundError)
  repo.ts      adaptador driven: Drizzle. `createXRepo(db) satisfies XRepository`
  routes.ts    adaptador driving: Hono (validate, roles, códigos HTTP, traducción de errores)
  schema.ts    tablas Drizzle (detalle de persistencia; la importa repo.ts, y ports.ts solo para tipos)
  fakes.ts     implementaciones en memoria de los puertos, usadas por *.test.ts
  *.test.ts    servicio con fakes en memoria (rápido) + rutas contra Postgres real (integración)
```

**Puertos** (`ports.ts`) — solo interfaces TypeScript y tipos de `shared`:

```ts
import type { CaseInput, CaseListQuery, UserRole } from '@dentalware/shared'

export type RequestContext = { userId: string; role: UserRole }

export interface CasesRepository {
  create(input: CaseInput, actorId: string): Promise<{ id: string; code: string }>
  update(id: string, input: CaseInput, actorId: string): Promise<boolean>
  byId(id: string): Promise<CaseDetail | undefined>
  list(q: CaseListQuery, today: string): Promise<CaseListPage>
  events(caseId: string): Promise<CaseEventRow[]>
  addEvent(e: NewCaseEvent): Promise<void>
}

/** Puerto de OTRA feature (adjuntos). Se inyecta en la raíz de composición: nunca se importa su repo. */
export interface AttachmentsQuery {
  hasDocument(caseId: string): Promise<boolean>
}

/** Unidad de trabajo: el servicio pide atomicidad sin saber que existe `db.transaction`. */
export interface UnitOfWork {
  run<T>(fn: (repos: { cases: CasesRepository }) => Promise<T>): Promise<T>
}

export interface Clock {
  today(): string // YYYY-MM-DD
}
```

`ports.ts` no declara sus tipos de fila a mano: los deriva con `import type` de `./schema.ts` (`typeof tabla.$inferSelect` + relaciones necesarias, p. ej. `CaseDetail`/`CaseEventRow` en `features/cases/ports.ts` o `AttachmentRecord` en `features/attachments/ports.ts`), **nunca de `repo.ts`** (ADR 25). Es el único import que `ports.ts` hace de `schema.ts`: sigue sin importar Hono, Drizzle en ejecución (`drizzle-orm`) ni el propio `repo.ts`.

**Caso de uso** (`service.ts`) — factoría, sin clases ni decoradores; recibe el `RequestContext` como parámetro (nunca `c.var`):

```ts
export function createCasesService(deps: {
  cases: CasesRepository
  attachments: AttachmentsQuery
  uow: UnitOfWork
  clock: Clock
}) {
  const hidesPrices = (role: UserRole) => role === 'tecnico' || role === 'mensajero'

  return {
    async list(query: CaseListQuery, ctx: RequestContext) {
      const page = await deps.cases.list(query, deps.clock.today())
      if (!hidesPrices(ctx.role)) return page
      return { ...page, cases: page.cases.map((r) => ({ ...r, total: null })) }
    },
    async detail(id: string, ctx: RequestContext) {
      const found = await deps.cases.byId(id)
      if (!found) throw new CaseNotFoundError('El trabajo no existe')
      const missing = missingForAccept(toReadiness(found, await deps.attachments.hasDocument(id)))
      return { case: hidesPrices(ctx.role) ? stripPrices(found) : found, missing }
    },
    create(input: CaseInput, ctx: RequestContext) {
      return deps.uow.run(({ cases }) => cases.create(input, ctx.userId))
    },
  }
}
export type CasesService = ReturnType<typeof createCasesService>
```

**Adaptador de persistencia** (`repo.ts`) — repositorio Drizzle, con la misma factoría para `db` y para `tx`, lo que sustituyó al par `createCaseTx` / `createCase` de antes (hoy `createCasesRepo`/`drizzleUnitOfWork` en `features/cases/repo.ts:198,281`):

```ts
export const createCasesRepo = (db: Db | Tx): CasesRepository => ({
  async create(input, actorId) { /* nextCaseCode + priceItems + insert + addEvent */ },
  byId: (id) => db.query.cases.findFirst({ /* … */ }),
  // …
})

export const drizzleUnitOfWork = (db: Db): UnitOfWork => ({
  run: (fn) => db.transaction((tx) => fn({ cases: createCasesRepo(tx) })),
})
```

**Adaptador HTTP** (`routes.ts`) — validación, roles, códigos y traducción de errores de dominio; ni una consulta:

```ts
const ctxFrom = (c: Context<AppEnv>): RequestContext => ({
  userId: c.var.user!.id,
  role: c.var.user!.role as UserRole,
})

export const casesRoutes = (service: CasesService) =>
  new Hono<AppEnv>()
    .get('/', requireAuth, validate('query', caseListQuerySchema), async (c) =>
      c.json(await service.list(c.req.valid('query'), ctxFrom(c)), 200),
    )
    .post('/', canWrite, validate('json', caseInputSchema), async (c) => {
      try {
        return c.json({ case: await service.create(c.req.valid('json'), ctxFrom(c)) }, 201)
      } catch (e) {
        throw toHttp(e) // CaseInputError → 422, CaseStateError → 409, CaseNotFoundError → 404
      }
    })
```

**Raíz de composición** (`app.ts:43`, hoy ya existe y solo cambia de contenido): construye adaptadores, arma servicios y monta rutas. `main.ts:9-14` es lo único que toca el mundo real (config, pool, disco).

```ts
export type AppDeps = {
  auth: Auth
  db: Db
  webOrigin: string
  storage: Storage
  clock?: Clock
  ids?: IdGenerator
}

const clock = deps.clock ?? systemClock
const attachmentsRepo = createAttachmentsRepo(db)
const casesRepo = createCasesRepo(db)
const cases = createCasesService({
  cases: casesRepo, attachments: attachmentsRepo, uow: drizzleUnitOfWork(db), clock,
})
const attachments = createAttachmentsService({
  attachments: attachmentsRepo, cases: casesRepo, storage, images: sharpImages, ids: randomUUIDs,
})
const routes = app.route('/api/trabajos', casesRoutes(cases)).route('/api/adjuntos', attachmentsRoutes(attachments))
```

**Prueba del caso de uso con fakes** — sin Postgres, sin Hono, milisegundos; complementa (no sustituye) la integración contra Postgres real de `test/setup.ts:20`:

```ts
const service = createCasesService({
  cases: fakeCasesRepo([{ id: '1', total: '80.00' }]),
  attachments: { hasDocument: async () => false },
  uow: { run: (fn) => fn({ cases: repo }) },
  clock: { today: () => '2026-09-07' },
})

it('oculta el total a un técnico', async () => {
  const { cases } = await service.list({ pagina: 1 }, { userId: 'u1', role: 'tecnico' })
  expect(cases[0]!.total).toBeNull()
})
```

Se conservan tal cual: **cadena de middlewares** (`sessionMiddleware` → `requireAuth`/`requireRole`, `bodyLimit` antes de parsear, `validate()` con schemas de shared), **forma única de error** (`{ message, issues? }` en `app.ts:113`), **enmascarado por rol** (que pasa a ser responsabilidad del servicio), **event log** (`case_events` escritos en la misma transacción que la mutación), **persistencia** (Postgres 17 + Drizzle relations v2, migraciones versionadas, secuencia anual con `FOR UPDATE`, borrado lógico en catálogos) y **Better Auth** como adaptador de identidad con su superficie admin bloqueada (`app.ts:88`).

### 3.3 `apps/web` — hexagonal-lite

- **`features/<f>/api.ts` = puerto + adaptador HTTP**: única frontera con la red. Es la implementación del contrato con la API (`hc<AppType>` tipado end-to-end, `throwIfNotOk` → `ApiError`). **Prohibido `fetch` o `hc` fuera de `api.ts`** (verificado por ESLint, §3.5); ejemplo mínimo: `features/health/api.ts` (`fetchHealth`) + `features/health/use-health.ts`, que sustituyó el `api.api.health.$get()` que `routes/_app/index.tsx` llamaba directo.
- **`use-*.ts` = capa de aplicación**: TanStack Query orquesta caché, invalidación y avisos (`use-cases.ts:26`). Un hook por caso de uso de la UI; nunca llama a `fetch` directo ni contiene reglas de dominio.
- **Componentes y rutas = adaptadores de UI**: formularios (react-hook-form + zod de shared), tablas/tarjetas, `beforeLoad` como guardia de sesión y rol. Sin cálculos de negocio: los totales, estados y readiness vienen de `shared`.
- **Puerto de identidad**: `authClient` (Better Auth) es un adaptador confinado en `features/auth/auth-client.ts`; el resto de la web lo consume por `getSession()`/`signIn()`/`signOut()` (`features/auth/session.ts`) o por el hook `useSession()` (`features/auth/use-session.ts`) — nunca lo importa directo (verificado por ESLint, §3.5). `routes/_app.tsx` y `routes/login.tsx` llaman `getSession()` en su `beforeLoad`; `components/app-shell.tsx` llama `signOut()`.
- **Estado**: el servidor es la fuente de verdad; la URL guarda vista/filtros/página (`validateSearch`); el estado de UI vive en el componente. Sin store global.
- **Componentes**: compound components y hooks headless para lo transversal (`FormDialog`, `ConfirmDialog`, `DataTable` → futuro `DataGrid` #53), variantes por `cva`, una sola UI responsive (tabla ↔ tarjetas por `useMediaQuery`).
- **PWA**: shell y assets cacheados (Workbox, `autoUpdate`); sin escritura offline. Cámara vía `<input capture>`; compresión de imagen en el navegador.

### 3.4 Flexibilidad: qué es obligatorio y qué no

**Obligatorio en toda feature nueva** (a partir de la Iteración 3): `ports.ts` con las interfaces que consume, adaptadores que las cumplen (`satisfies`), inyección por factoría, cero `db.`/`hono` dentro de la lógica y su test de servicio con fakes.

**`service.ts` es obligatorio** si la feature cumple **cualquiera** de estas: usa más de un puerto; tiene reglas de negocio o de autorización más allá de `requireRole`; necesita transacción; enmascara datos por rol; orquesta varios pasos (subir archivo + registrar evento). En la práctica: trabajos, adjuntos, entregas, cuentas/pagos, notificaciones, usuarios.

**`service.ts` puede omitirse** en un CRUD simple: un solo repositorio, sin transacción, sin enmascarado, la ruta valida con zod y llama a una función del repo. Es el caso de `clinics`, `doctors`, `stages` y `lab-settings`. Aun así el repo debe cumplir un puerto declarado si otra feature lo consume. En cuanto un CRUD gana la primera regla, se le crea el servicio en ese mismo PR.

**Migración incremental, sin big-bang**: nada se reescribe «porque sí». Regla del boy-scout: la feature se migra **cuando se la toca** para construir algo encima, y ese PR incluye la migración (§3.6). Mientras tanto, el estilo viejo (`routes.ts` llamando al `repo.ts`) sigue siendo válido y compilando: las dos formas conviven.

### 3.5 Cómo se hace cumplir

No basta con la revisión: la frontera se verifica en `pnpm lint`. La implementación real vive en `eslint.config.js` (**PR B**, issue de adopción #54) y usa exclusivamente `@typescript-eslint/no-restricted-imports` (por `patterns`/`paths`) y `no-restricted-globals`, **sin `eslint-plugin-import-x`**: el mismo mecanismo que ya prohibía adaptadores dentro de una feature también verifica las fronteras entre features y en `apps/web`, así que no hace falta sumar un plugin de rutas de import. Todo bloque acepta pruebas negativas (introducir temporalmente el import prohibido, confirmar el error, revertir); las de esta ronda están documentadas en `task-8-report.md`.

**`apps/api/src/features/*/service.ts`, `*.service.ts` y `errors.ts`** (helper `noAdapters` en `eslint.config.js`, con `errors.ts` sumado al mismo `files` que `service.ts` — ronda de fixes #54): prohíben `hono`/`hono/*`, `drizzle-orm`/`drizzle-orm/*`, `**/db/**`, `better-auth`/`better-auth/*`, `sharp`, `node:fs`/`node:fs/*`, `node:crypto`; el propio `./repo.ts`/`./routes.ts`/`./import.repo.ts`/`./import.routes.ts`; y de otra feature `../*/repo.ts`, `../*/routes.ts`, `../*/service.ts` (más las variantes `import.*` y, para cerrar rutas relativas profundas, `**/features/*/repo.ts`, `**/features/*/routes.ts`, `**/features/*/service.ts`). Además prohíben `./schema.ts` y `../*/schema.ts` sin excepción: el servicio no ve tablas, ni siquiera como tipo. `errors.ts` queda así protegido de los mismos adaptadores sin ganar una regla nueva: como no importa su propio `repo.ts`/`routes.ts` ni el `schema.ts` de nadie, solo la reexportación legítima de `../*/errors.ts` (ADR 26, ver más abajo) pasa el lint.

Un caso particular del primer grupo: `lib/images.ts`, `lib/storage.ts`, `lib/ids.ts` y `lib/clock.ts` son adaptadores (cargan `sharp`, tocan disco o `node:crypto`) que **no** aparecían en la lista de especificadores prohibidos, así que un servicio podía importarlos en runtime sin que el lint lo viera — se coló así una fuga transitiva de `sharp` en `attachments/service.ts` (hallazgo I-1 de la revisión de #54). El `noAdapters` añade un segundo grupo con esos cuatro módulos y `allowTypeImports: true`: el servicio puede seguir importando `import type { Storage }`/`{ Clock }`/`{ IdGenerator }` de ellos (la forma correcta, ya usada en todas partes salvo el caso de arriba), pero no su implementación. La política pura de subida (`ALLOWED_MIME`, `MAX_UPLOAD_BYTES`, `isImage`) se separó a `apps/api/src/lib/upload-policy.ts` (sin `sharp`); `lib/images.ts` la reexporta para no romper a `attachments/routes.ts` y sus tests, pero `attachments/service.ts` importa la política directo de `upload-policy.ts`.

**`apps/api/src/features/*/ports.ts` y `*.ports.ts`**: mismo bloque base (`hono`, `drizzle-orm`, `**/db/**`, `better-auth`, `sharp`, `node:fs*`, `node:crypto`, los adaptadores de `lib/` solo como tipo, repos/rutas/servicios propios y ajenos) más dos reglas propias de puertos: `./schema.ts` **con `allowTypeImports: true`** (ADR 25: un puerto solo puede derivar tipos de fila del schema propio, nunca de `repo.ts`) y `../*/schema.ts` prohibido sin excepción, ni siquiera como tipo (un puerto no depende del detalle de persistencia de otra feature). `../*/ports.ts`, `../*/*.ports.ts` y `../*/errors.ts` **no están prohibidos**: son la única vía legítima entre features (puertos inyectados en `createApp` y errores de dominio reexportados, ADR 26).

**`apps/api/src/features/*/routes.ts` y `*.routes.ts`** (override explícito con comentario `// #54 boy-scout`, no `eslint-disable`, en `users/routes.ts` y `products/routes.ts` hasta que se migren, §3.6): prohíbe `drizzle-orm`/`drizzle-orm/*`, `**/db/schema/**`, `./schema.ts`, `../*/schema.ts` y `../*/repo.ts` sin excepción, y `**/db/**` **con `allowTypeImports: true`** (ronda de fixes #54, hallazgo I-2): la ruta no toca `db` en runtime, pero el CRUD simple de §3.4 (`clinics`, `doctors`, `stages`, `lab-settings`) sigue recibiendo `import type { Db }` de `../../db/index.ts` para construir su repo. El propio `./repo.ts` **no** está prohibido: es la excepción del CRUD simple — esas mismas cuatro features llaman a su repo desde la ruta legítimamente.

**`apps/api/src/features/*/repo.ts` y `*.repo.ts`** (ADR 24): prohíbe `hono`/`hono/*` y el `repo.ts`/`routes.ts`/`service.ts` de otra feature; `../*/schema.ts` **queda permitido** para que un repo pueda unir tablas de otra feature en joins de solo lectura (ejemplo real: `cases/import.repo.ts` lee `clinics`/`doctors`/`products`).

**`apps/web/src/**`** — tres bloques:

1. `no-restricted-globals: fetch` fuera de `**/api.ts`, con dos excepciones (`ignores`): `features/cases/attachments-api.ts` (sube con `fetch` directo porque `hc` no tipa `form`, documentado en el propio archivo) y `test/**` (harness de pruebas). Mismo bloque, `no-restricted-properties` con `{ object: 'window', property: 'fetch' }` y `{ object: 'globalThis', property: 'fetch' }` (ronda de fixes #54, hallazgo M-2): `no-restricted-globals` solo ve la referencia libre `fetch(...)`, no `window.fetch(...)` ni `globalThis.fetch(...)`.
2. `no-restricted-imports` general (fuera de `src/lib/api.ts` y `features/auth/**`): `hono/client` solo en `src/lib/api.ts`; `better-auth`/`better-auth/*` y `@/features/auth/auth-client` solo dentro de `features/auth/**` (usar `getSession`/`signIn`/`signOut`/`useSession`); `@dentalware/api`/`@dentalware/api/*` solo con `allowTypeImports: true`.
3. `apps/web/src/routes/**/*.tsx` — repite el bloque 2 completo (ESLint flat config reemplaza, no fusiona, dos bloques que matchean el mismo archivo con la misma regla) y añade `@/lib/api`, `@/features/*/api`, `@/features/*/api.ts` con `allowTypeImports: true`: las rutas solo importan **tipos** de `api.ts`, nunca el cliente en runtime; el resto de la lógica viene de `features/` (hooks, componentes) y `components/`.

**Excepción implícita — tests y `fakes.ts`, distinta en `apps/api` y `apps/web`**: en `apps/api` ninguno de los bloques anteriores incluye `*.test.ts` ni `fakes.ts` en sus `files` (sus globs son `service.ts`, `ports.ts`, `errors.ts`, `routes.ts`, `repo.ts`), así que las pruebas de integración de rutas pueden seguir usando `db`/`createApp` reales y `fakes.ts` puede construir implementaciones en memoria de los puertos sin disparar ninguna regla — es una ausencia deliberada de cobertura, no una excepción con `ignores`. En `apps/web`, en cambio, los tres bloques usan el glob `apps/web/src/**/*.{ts,tsx}` (o `apps/web/src/routes/**/*.tsx`), que **sí** cubre `*.test.ts`/`*.test.tsx`; solo `apps/web/src/test/**` está en `ignores`. Un test web tampoco puede llamar a `fetch`/`window.fetch` ni importar `authClient` fuera de su sitio: si un test necesita espiar la red global, va en `src/test/**` o usa un mock de `api.ts`, nunca `vi.spyOn(window, 'fetch')` dentro de la feature (corrección del hallazgo I-3 de la revisión de #54, que documentaba lo contrario).

Checklist de revisión (también en `docs/conventions.md` §9): ¿el servicio importa solo puertos y `shared`? ¿el repo cumple el puerto con `satisfies`? ¿la ruta solo valida, autoriza y traduce? ¿hay un test del servicio con fakes? ¿alguna dependencia oculta (`new Date()`, `randomUUID()`, `process.env`) quedó dentro de la lógica en vez de ser puerto?

### 3.6 Estado actual vs objetivo y plan de migración incremental

Lo que **ya está bien** y no se toca: raíz de composición explícita (`app.ts:43`, `main.ts:9-14`), `Storage` como puerto con `LocalStorage` (`lib/storage.ts:6`), sustitución real de dependencias en tests (`test/setup.ts:20-28`), contratos y reglas puras en `shared`, `validate()`/`onError` como frontera única, y la web sin `fetch` fuera de `api.ts`.

| Feature | Estado | Qué quedó (PR A) / qué falta | Cuándo |
|---|---|---|---|
| `cases` | **migrada** (PR A) | `ports.ts` (`CasesRepository`, `AttachmentsQuery`, `UnitOfWork`, `Clock`), `service.ts` con enmascarado (`stripPrices`/`maskPriceEvents`) y readiness, `errors.ts` (`CaseInputError`, `CaseStateError`, `CaseNotFoundError`), `repo.ts` (`createCasesRepo(db \| tx) satisfies CasesRepository`, `drizzleUnitOfWork`), `fakes.ts`, 12 tests de servicio con fakes (`service.test.ts`) | hecho |
| `cases/import` | **migrada** (PR A) | `import.ports.ts` (`ImportCatalog`), `import.service.ts`, `import.repo.ts` (lee `schema.ts` de `clinics`/`doctors`/`products` por la excepción de joins, ADR 24), `import.routes.ts` separado de `cases/routes.ts`, 4 tests de servicio con fakes (`import.service.test.ts`) | hecho |
| `attachments` | **migrada** (PR A) | `ports.ts` (`AttachmentsRepository`, `ImageProcessor`, `CasesQuery`, `CaseEventLog`), `service.ts`, `errors.ts`, `repo.ts` (`createAttachmentsRepo` cumple su propio puerto y `AttachmentsQuery` de `cases`, sin importar el repo de `cases`), `fakes.ts`, 13 tests de servicio con fakes (`service.test.ts`). Ruling de la migración: `POST /api/adjuntos/trabajo/:caseId` sin archivo y con trabajo inexistente ahora responde **422** (antes 404) porque la ruta valida el archivo antes de que el servicio compruebe el trabajo; con archivo adjunto sigue siendo 404 | hecho |
| `users` | sin `repo.ts`: Drizzle directo en la ruta (`routes.ts:47,65,99,120`); Better Auth acoplado al handler | `repo.ts` + `ports.ts` (`UsersRepository`, `AccountProvider`) y `service.ts` con las reglas propias (nadie se bloquea ni se degrada a sí mismo, borrado lógico) | boy-scout: al primer cambio funcional; a más tardar Iteración 5 |
| `products` | reglas de negocio en la ruta (`routes.ts:40-47`: `assertCategory`, `assertCodeFree`) | `service.ts` ligero al añadir listas de precios por clínica | Iteración 5 — Cuentas y cobro |
| `clinics`, `doctors`, `stages`, `lab-settings` | CRUD limpio, sin reglas | nada: se acogen a la excepción de §3.4; solo declarar el puerto cuando otra feature los consuma | — |
| `auth/session` | **migrada** (PR A) | `ctxFrom(c): RequestContext` en `features/auth/session.ts`, usado por `cases/routes.ts` y `attachments/routes.ts` en vez de construir el contexto a mano en cada ruta | hecho |
| `deliveries` (It. 4), `payments`/`accounts` (It. 5), `notifications` (It. 6: puerto `Mailer`, adaptador Resend, ADR 22) | no existen | nacen ya con `ports.ts` + `service.ts` + tests con fakes (obligatorio) | al construirlas |
| `apps/web` | **migrada** (PR B) | `authClient` confinado en `features/auth/auth-client.ts`; el resto de la web usa `getSession()`/`signIn()`/`signOut()` (`features/auth/session.ts`) o `useSession()` (`features/auth/use-session.ts`) — `grep -rn "auth-client" apps/web/src` solo lista archivos dentro de `features/auth/`; de paso se corrigió `routes/_app/index.tsx`, que llamaba `@/lib/api` directo, extrayendo `features/health/{api,use-health}.ts` | hecho |
| tooling | **hecho** (PR B) | `eslint.config.js` con las reglas de §3.5 (`@typescript-eslint/no-restricted-imports` + `no-restricted-globals` por patrones, sin `eslint-plugin-import-x`); `pnpm lint` en verde con pruebas negativas documentadas en `task-8-report.md` | hecho |

Criterio de aceptación de cada migración: la feature migrada compila, sus tests de integración existentes siguen pasando **sin cambios de comportamiento**, y se añade al menos un test de servicio con fakes que antes era imposible de escribir sin BD.

## 4. Datos (resumen)

Configuración: `lab_settings`, `users` (+ tablas de Better Auth), `clinics`, `doctors`, `product_categories`, `products`, `clinic_product_prices`, `stages`. Operación: `cases`, `case_items`, `case_events`, `attachments`, `case_sequences` (código anual); previstas: `case_tryins`, `deliveries`, `account_adjustments`, `payments`, `invoice_refs`. Saldo de clínica = Σ trabajos entregados + Σ ajustes − Σ pagos (calculado, no almacenado). Detalle en la spec §4. Las tablas son un detalle de persistencia: solo las importa el `repo.ts` de su feature.

## 5. Seguridad y privacidad

- Autorización en cada ruta (403 uniforme) y **reglas de visibilidad en el servicio**: precios y notas internas ocultos a técnico/mensajero antes de salir del hexágono, no en la UI. Validación zod en la frontera, límites de tamaño y MIME real en subidas, archivos servidos solo con sesión y nombrados por UUID, cookies HttpOnly/SameSite, rate limit en login, audit trail en `case_events`.
- Datos mínimos del paciente (referencia/alias, edad, sexo). Backups cifrables con retención (infra/backup.sh). Secretos fuera del repo y solo leídos en `config.ts`.

## 6. Despliegue y operación

- `infra/docker-compose.yml`: `caddy` (TLS automático, sirve `apps/web/dist`, proxy `/api`), `api` (Node 24 alpine, migra al arrancar), `postgres` (volumen), volumen `uploads`. Desarrollo: `docker-compose.dev.yml` con Postgres en 5433 y BD `dentalware_test` para pruebas.
- CI (GitHub Actions): job `quality` (build, lint, format, typecheck, unit) y job `e2e` (Playwright con Postgres efímero `dentalware_test`, tres proyectos). Deploy manual por SSH (`git pull && docker compose up -d --build`).

## 7. Pruebas (pirámide)

Unit en `shared` (reglas puras) → **unit de servicios con fakes en memoria** (casos de uso, enmascarado por rol, orquestación; sin BD ni HTTP) → integración de API contra Postgres real (rutas, permisos, transacciones, SQL) → componentes web con Testing Library → E2E Playwright del flujo principal por iteración (escritorio + android; iphone en CI) + barrido de accesibilidad táctil. TDD obligatorio en todas las capas. El nivel de servicios es el que habilita la arquitectura: si un caso de uso no se puede probar sin Postgres, es que un adaptador se coló dentro del hexágono.

## 8. Registro de decisiones (ADR resumido)

| # | Decisión | Motivo | Estado |
|---|---|---|---|
| 1 | TypeScript en todo el stack, monorepo pnpm | un solo lenguaje para un solo desarrollador; tipado end-to-end sin codegen (`hc<AppType>`) | vigente |
| 2 | PWA responsive (React) en vez de app nativa; Capacitor opcional post-MVP | una sola UI para PC y móvil; iOS sin push en PWA se acepta en el MVP | vigente |
| 3 | Hono + Drizzle + Postgres + Better Auth | ligeros, tipados, sin magia; Better Auth cubre sesiones y admin | vigente |
| 4 | Monolito modular por features, sin microservicios ni DDD pesado | tamaño del equipo y del sistema | vigente (matizado por 17) |
| 5 | Contratos zod en `shared` como única fuente de verdad | evita duplicar validación y tipos entre API y web | vigente |
| 6 | Dinero como cadena decimal transportada y centavos enteros en cálculo | evita flotantes; precios por clínica con fallback al precio base | vigente |
| 7 | Precios y notas internas enmascarados en la API por rol | la seguridad no depende de la UI | vigente (pasa al servicio, 17) |
| 8 | Auditoría con `case_events` en la misma transacción que la mutación | historial y trazabilidad sin infraestructura extra (event log, no event sourcing) | vigente |
| 9 | Notación FDI; odontograma por selección táctil (sin arrastre para puentes) | estándar en Ecuador; el arrastre no aporta y complica móvil | vigente |
| 10 | Adjuntos en disco del VPS tras interfaz `Storage`; S3/R2 después (#48) | simple hoy, migrable sin tocar features | vigente |
| 11 | Importación solo CSV (plantilla descargable), sin XLSX | evita dependencias pesadas; Excel exporta CSV | vigente |
| 12 | Columnas de iteraciones futuras creadas ya como `nullable` | no repetir migraciones sobre `cases` | vigente |
| 13 | E2E contra `dentalware_test` con `.env.test` y reset antes del seed | los E2E no ensucian la BD de desarrollo | vigente |
| 14 | Objetivos táctiles de 44 px por defecto; 36 px solo en tablas densas de escritorio | técnicos con guantes; regla de la dirección de diseño | vigente |
| 15 | Tablas sobre un `DataGrid` modular con TanStack Table | homogeneizar 7 tablas y las que vienen (#53) | pendiente |
| 16 | Estados `por_recoger`/`cobrado`, avisos a clínicas, `requires_shade` en productos | diferidos a iteraciones 3–6 | diferido |
| 17 | **Arquitectura hexagonal pragmática**: `ports.ts` + `service.ts` por feature, adaptadores fuera; `service.ts` opcional en CRUD simple (§3.4); migración por boy-scout, empezando por `cases` en la Iteración 3 | aísla el dominio de Hono/Drizzle/Better Auth, permite probar casos de uso sin BD y cambiar infraestructura (S3, WhatsApp, SRI) sin tocar reglas; la excepción del CRUD evita ceremonia donde no aporta | vigente |
| 18 | **DI explícita por factorías, sin contenedor ni decoradores** (`createCasesService({ repo, storage, clock })`), raíz de composición en `createApp`/`main.ts` | `erasableSyntaxOnly` prohíbe decoradores; un contenedor añadiría magia y arranque implícito a un sistema de un solo despliegue; las factorías dan el mismo desacoplamiento con tipos exactos | vigente |
| 19 | **Unidad de trabajo como puerto** `UnitOfWork.run(fn)` con repos re-creados sobre `tx`, en vez del par `xTx(tx)`/`x(db)` | el servicio pide atomicidad sin conocer Drizzle; desaparece la API duplicada de cada operación transaccional | vigente (se aplica al migrar cada feature) |
| 20 | **Contexto de petición como parámetro** (`RequestContext { userId, role }`) y errores de dominio traducidos a HTTP en `routes.ts` | el servicio no depende de Hono ni de `HTTPException`; los mismos casos de uso servirán a un job o a un script de importación | vigente |
| 21 | **Fronteras verificadas por ESLint** (`@typescript-eslint/no-restricted-imports` + `no-restricted-globals`), no solo por revisión | con un desarrollador, la regla que no falla en `pnpm lint` se erosiona | vigente (sin plugin externo: `no-restricted-imports` por patrones; pruebas negativas en `task-8-report.md`) |
| 22 | **Alertas por correo con Resend en el MVP; WhatsApp post-MVP.** La feature `notifications` (It. 6) declara un puerto `Mailer { send(msg) }` con adaptador Resend en `lib/mail/` y fake en tests; la tabla `notifications` guarda `canal` (`email` hoy, `whatsapp` después) | Nelson ya dispone de Resend; Meta exige cuenta verificada y plantillas aprobadas con tiempos ajenos al proyecto; el puerto deja el canal sustituible sin tocar los casos de uso (decidido el 2026-09-07) | vigente |
| 23 | **Producción por persona y sistema de puntos fuera del MVP** | no los usa recepción ni el mensajero a diario; `case_events` ya registra actor y fecha de cada cambio de fase, así que se pueden derivar después sin cambiar el modelo; acorta el MVP en una iteración (decidido el 2026-09-07) | vigente |
| 24 | **Joins entre features permitidos en el `repo.ts`**: el `repo.ts` de una feature puede importar el `schema.ts` de otra para joins y lecturas de solo lectura (nunca su `repo.ts` ni su `routes.ts`); ejemplo real: `apps/api/src/features/cases/import.repo.ts` lee `clinics`/`doctors`/`products` para el `ImportCatalog` | evita un puerto artificial solo para un `select` de solo lectura entre tablas ya relacionadas por FK; el límite se mantiene: nunca escritura cruzada ni lógica de negocio dentro del join, y el `service.ts` sigue sin ver `schema.ts` (decidido el 2026-09-11, PR A) | vigente |
| 25 | **Tipos de fila derivados del `schema.ts` en `ports.ts`**: `ports.ts` deriva sus tipos de fila (`CaseDetail`, `CaseEventRow`, `AttachmentRecord`…) con `import type` de `./schema.ts` (`typeof tabla.$inferSelect` + relaciones), nunca de `repo.ts` | evita duplicar a mano la forma de la fila y mantiene `ports.ts` sin depender de la implementación del repo; el import es solo de tipos (`verbatimModuleSyntax`), no arrastra runtime de Drizzle a la capa de aplicación (decidido el 2026-09-11, PR A) | vigente |
| 26 | **Errores de dominio reexportados entre features**: `errors.ts` puede reexportar una clase de error de dominio de otra feature (nunca un adaptador); ejemplo real: `apps/api/src/features/attachments/errors.ts` reexporta `CaseNotFoundError` de `../cases/errors.ts` porque la ruta de adjuntos también traduce a HTTP el caso de trabajo inexistente | un error de dominio es parte del contrato del caso de uso, no un adaptador; reexportarlo evita duplicar la clase o inventar un puerto solo para comparar con `instanceof` (decidido el 2026-09-11, PR A) | vigente |

## 9. Cómo evolucionar sin romper la arquitectura

- **Nueva entidad/feature**: schema zod en `shared` → tabla + migración → `ports.ts` (qué necesita) → `service.ts` con su test de fakes (RED primero) → `repo.ts` que cumple el puerto → `routes.ts` con `validate`/roles → test de integración contra Postgres → registrar el servicio en la raíz de composición → `api.ts` + hooks + componentes en `web` → E2E del flujo.
- **Nueva regla de negocio**: si es pura (no necesita datos), va a `shared` con test unitario; si necesita datos o coordina varios pasos, al `service.ts`; si es una consulta SQL, al `repo.ts`; **nunca en la ruta ni en la UI**.
- **Nueva integración externa** (S3/R2, correo con Resend, WhatsApp post-MVP, SRI): interfaz en el `ports.ts` de la feature que la usa (o en `lib/` si es transversal), implementación en `lib/` o `features/<f>/<adaptador>.ts`, inyectada en `createApp`, fake en tests. Ninguna feature cambia.
- **Nuevo rol o permiso**: `roles.ts` en shared, `requireRole` en la ruta, decisión de visibilidad en el servicio, `beforeLoad` en la web, test de 403 y de enmascarado.
- **Dependencia entre features**: se declara un puerto en la feature consumidora y se inyecta la implementación de la otra en la raíz de composición. Si aparece un ciclo (A necesita B y B necesita A), la pieza compartida se extrae a `shared` o a un módulo propio.
- **Señales de que algo está mal ubicado** (hallazgos de revisión): una ruta con `db.` directo; un `service.ts` que importa `hono`, `drizzle-orm`, `./repo.ts` o `./schema.ts`; un `repo` importado desde otra feature; `new Date()`, `randomUUID()`, `process.env` o rutas de disco dentro de la lógica en vez de un puerto; un caso de uso que solo se puede probar levantando Postgres; una regla de negocio duplicada en la ruta y en el componente; un componente que calcula un total; una lista de estados escrita a mano fuera de `shared`; un precio visible que no pasó por el enmascarado del servicio.
