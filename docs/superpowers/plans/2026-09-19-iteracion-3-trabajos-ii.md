# Iteración 3 — Trabajos II: plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usa `superpowers:subagent-driven-development` (recomendada) o `superpowers:executing-plans` para ejecutar este plan tarea a tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** cerrar el ciclo de vida del trabajo (aceptar, fases, pausas y pruebas, cancelar y repetir, asignar técnico), dar un panel de inicio con contadores y «Mis trabajos», y permitir imprimir la orden y abrirla escaneando su QR.

**Arquitectura:** todo lo nuevo de la API nace con `ports.ts` + `service.ts` + tests con fakes (obligatorio desde la Iteración 3, `docs/architecture.md` §3.4); `cases` ya está migrada, así que las acciones de estado se añaden a su servicio existente. Las reglas puras (qué transición es válida, qué fase sigue, qué falta para aceptar, cuántos días hábiles) viven en `packages/shared` y ya existen en su mayoría: esta iteración las consume, no las reescribe. La web añade una barra de acciones a la ficha, un panel de inicio y una vista de impresión; todas las tablas nuevas usan el `DataGrid` (#53, `docs/data-grid.md`).

**Stack:** pnpm 11 · Node 24 · TypeScript 6 strict · Hono + Drizzle + Postgres 17 + Better Auth · React 19 + Vite + TanStack Router/Query + Tailwind 4 + shadcn · Vitest 4 · Playwright 1.62.

**Historias:** `docs/superpowers/specs/2026-09-12-historias-de-usuario-mvp.md` §«Iteración 3» (CIC-1..5 #63–#67, INI-1 #68, INI-2 #69, FIC-1..3 #71–#73).
**Spec de producto:** `docs/superpowers/specs/2026-09-01-dentalware-mvp-design.md` (§5 orden en papel, §7 datos obligatorios).
**Fuera de este plan:** INI-3 (#70) se movió a la Iteración 4 porque necesita `deliveries`, que nace con ENT-5.

## Restricciones globales

Se aplican a **todas** las tareas. Vienen de `CLAUDE.md`, `docs/conventions.md` y `docs/architecture.md`.

- **TDD obligatorio**: RED → GREEN → refactor. Una tarea sin prueba es hallazgo _Important_ en revisión.
- **context7 antes de usar una librería nueva**; versión fijada en el `catalog:` de `pnpm-workspace.yaml`.
- **Español** en UI, validaciones, comentarios, commits y docs; **sentence case** («Avanzar fase», no «Avanzar Fase»).
- **Nunca `any`**; `unknown` + narrowing. `import type` (`verbatimModuleSyntax`). Sin `enum` ni namespaces en `shared` (`erasableSyntaxOnly`).
- **Fronteras** (`docs/architecture.md` §3.5, verificadas por `pnpm lint`): `service.ts`/`ports.ts` sin `hono`, `drizzle-orm`, `./repo.ts` ni `./schema.ts`; rutas sin `db.` directo; en la web, nada de `fetch`/`hc` fuera de `api.ts` ni `authClient` fuera de `features/auth/`; las rutas (`routes/`) solo importan de `features/` y `components/`.
- **Toda mutación de un trabajo escribe su `case_event` en la misma transacción**, vía `UnitOfWork.run` (ADR 19). Nunca `db.transaction` anidada.
- **Enmascarado por rol en el servicio, no en la UI**: técnico y mensajero nunca reciben precios ni notas internas; la lista devuelve `total: null`.
- **403** sin sesión y con rol incorrecto; **409** transición inválida; **422** `{ message: 'Datos inválidos', issues: [...] }`; **404** `{ message: 'No encontrado' }`.
- **Dinero** como cadena decimal `"12.34"`; cálculos en centavos (`money.ts`). Fechas de negocio `YYYY-MM-DD` (`isoDate`).
- **Toda tabla usa `components/data-grid`** y declara sus features (`docs/data-grid.md`), salvo listas simples sin orden, filtro ni paginación.
- **44 px** de objetivo táctil por defecto; `sm`/`icon-sm` de 36 px solo en tablas densas de escritorio.
- **Responsive**: una sola UI; tabla en ≥ `lg`, tarjetas en móvil; sin scroll horizontal de página en **1280 / 390 / 360**.
- **E2E**: cada test lleva **exactamente una** etiqueta (`@esencial` / `@clave` / `@extendida`); el criterio está en `docs/conventions.md` §7. `apps/web/src/test/e2e-tags.test.ts` lo verifica.
- **Verificación antes de cada commit**: `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`. Toda tarea de UI, además, verificada en Chrome DevTools a 1280×800, 390×844 y 360×740 con consola limpia. Nunca `--no-verify`.
- **Commits** pequeños, prefijo convencional en español, `Refs #N` y los trailers `Co-Authored-By` y `Claude-Session`.
- **Node 24 en cada shell**: `export PATH=$HOME/.nvm/versions/node/v24.19.0/bin:$PATH`. Postgres de desarrollo: `pnpm db:up` (5433). Puertos 3000 y 5173 libres antes de E2E.

## Lo que ya existe y este plan consume (no lo reescribas)

Verificado en el código el 2026-09-19:

- `packages/shared/src/case-status.ts`: `CASE_STATUSES`, `CASE_ACTIONS` (las 9 acciones), `CASE_TRANSITIONS` con roles, `ACTIONS_REQUIRING_REASON = ['pausar', 'cancelar']`, `applyAction(status, action)` y `canTransition`.
- `packages/shared/src/case-readiness.ts`: `missingForAccept(c: ReadinessInput): string[]` con la lista de la spec §7. **Ojo**: `ReadinessInput` declara `checklist` pero la función **no lo valida** — es deliberado (la lista registra lo recibido, no obliga a tenerlo todo: un trabajo puede no necesitar antagonista). La Tarea 3 lo documenta en el propio archivo.
- `packages/shared/src/business-days.ts`: `addBusinessDays(start, days, holidays = [])` y `toIsoDate`.
- `packages/shared/src/case-events.ts`: `CASE_EVENT_TYPES` ya incluye `status_changed`, `stage_changed`, `assigned`, `hold`, `resumed`, `tryin_sent`, `tryin_returned`, `cancelled`, `remake_created`.
- `packages/shared/src/schemas/cases.ts`: `checklistSchema`, `CHECKLIST_KEYS`, `caseListQuerySchema` (con `tecnicoId`, `orden`, `vista`), `CASE_VIEWS`, `CASE_PAGE_SIZE = 50`.
- `apps/api/src/features/cases/schema.ts`: la tabla `cases` **ya tiene** `currentStageId`, `assignedTechnicianId`, `holdReason`, `parentCaseId`, `remakeReason`, `remakeResponsibility`, `promisedDate`, `finishedAt`, `checklist` (jsonb) — creadas nullable por adelantado (ADR 12). **No hacen falta migraciones para ellas.**
- `apps/api/src/features/cases/{ports,service,repo,routes,fakes}.ts`: la feature está migrada a hexagonal (PR A). Las acciones nuevas se añaden a ese servicio.
- `apps/api/src/features/products/schema.ts`: `turnaroundDays` (default 5). `apps/api/src/features/stages/schema.ts`: `name`, `color`, `sort`, `active`.
- Web: la ficha `routes/_app/trabajos/$caseId.tsx` con pestañas Detalle / Fotos / Historial, `CaseHeader` (ya recibe `missing`), `CaseDetailTab`, `CaseHistory`, `PhotosTab`, `StatusChip`, `Odontogram`, `ChecklistField`.

## Decisiones tomadas al planificar (no las re-litigues)

1. **Feriados**: `lab_settings` no tiene tabla ni campo de feriados, y el MVP no lo pide. `addBusinessDays` se llama con `[]` (solo fines de semana). Queda anotado en el código y en el ADR; un calendario de feriados de Ecuador es post-MVP.
2. **Contador «en prueba» de INI-1**: el criterio de aceptación exige que cada contador coincida con el total de su vista rápida, y `CASE_VIEWS` no tiene `en_prueba`. Se **añade** `en_prueba` a `CASE_VIEWS` (Tarea 9) en vez de enlazar a `?estado=en_prueba`, para que contador y lista compartan definición.
3. **Una sola ruta para las transiciones de estado**: `POST /api/trabajos/:id/acciones` con `{ accion, motivo? }`, no un endpoint por acción. La máquina de estados ya es una tabla de datos; una ruta por acción la duplicaría en el enrutador.
4. **La fase no es una transición de estado**: va por `PUT /api/trabajos/:id/fase`, porque cambia `current_stage_id` sin cambiar `status` y tiene su propio evento (`stage_changed`).

---

# PR 1 — Ciclo de vida del trabajo (CIC-1..5, #63–#67)

Rama: `feat/iteracion-3-ciclo-vida`. Cierra #63, #64, #65, #66, #67.

### Tarea 1: `case_tryins` — tabla, migración y contrato

**Archivos:**
- Crear: `packages/shared/src/schemas/tryins.ts`, `packages/shared/src/schemas/tryins.test.ts`
- Modificar: `apps/api/src/features/cases/schema.ts`, `packages/shared/src/index.ts`
- Crear: migración en `apps/api/drizzle/` (generada por drizzle-kit)

**Interfaces:**
- Produce: `tryinInputSchema` (`{ sentAt: string; note?: string | null }`), `TryinInput`, y la tabla `caseTryins` con `{ id, caseId, sentAt, returnedAt, note, createdAt }`.

- [ ] **Paso 1: escribir el test que falla**

`packages/shared/src/schemas/tryins.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { tryinInputSchema } from './tryins.ts'

describe('tryinInputSchema', () => {
  it('acepta una fecha de envío a prueba con nota opcional', () => {
    const r = tryinInputSchema.parse({ sentAt: '2026-09-19', note: 'Prueba de metal' })
    expect(r).toEqual({ sentAt: '2026-09-19', note: 'Prueba de metal' })
  })

  it('normaliza la nota vacía a null', () => {
    expect(tryinInputSchema.parse({ sentAt: '2026-09-19', note: '' }).note).toBeNull()
  })

  it('rechaza una fecha que no existe en el calendario', () => {
    const r = tryinInputSchema.safeParse({ sentAt: '2026-02-31' })
    expect(r.success).toBe(false)
  })
})
```

- [ ] **Paso 2: correr el test y verlo fallar**

Run: `pnpm vitest run --project shared packages/shared/src/schemas/tryins.test.ts`
Expected: FAIL, no existe el módulo `./tryins.ts`.

- [ ] **Paso 3: implementar el schema**

`packages/shared/src/schemas/tryins.ts`:

```ts
import { z } from 'zod'
import { isoDate, textoOpcional } from './common.ts'

export const tryinInputSchema = z.object({
  sentAt: isoDate,
  note: textoOpcional(500),
})
export type TryinInput = z.infer<typeof tryinInputSchema>
```

Comprueba el nombre real del archivo de helpers (`isoDate`, `textoOpcional`) antes de importar: están en `packages/shared/src/schemas/`; si viven en otro módulo, importa del que sea. Exporta desde `packages/shared/src/index.ts`.

- [ ] **Paso 4: correr el test y verlo pasar**

Run: `pnpm vitest run --project shared packages/shared/src/schemas/tryins.test.ts`
Expected: PASS (3 tests).

- [ ] **Paso 5: añadir la tabla**

En `apps/api/src/features/cases/schema.ts`, junto a las demás tablas:

```ts
export const caseTryins = pgTable('case_tryins', {
  id: uuid().defaultRandom().primaryKey(),
  caseId: uuid('case_id')
    .notNull()
    .references(() => cases.id),
  sentAt: date('sent_at').notNull(),
  returnedAt: date('returned_at'),
  note: text(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
```

Añade la relación en `apps/api/src/db/relations.ts` siguiendo el patrón de las tablas existentes (`case_events`, `case_items`).

- [ ] **Paso 6: generar y aplicar la migración**

```bash
export PATH=$HOME/.nvm/versions/node/v24.19.0/bin:$PATH
pnpm --filter @dentalware/api db:generate
pnpm --filter @dentalware/api db:migrate
```

Comprueba el nombre real de los scripts en `apps/api/package.json` antes de correrlos. Revisa el SQL generado: debe crear solo `case_tryins`, sin tocar ninguna columna existente. Si drizzle-kit propone borrar o renombrar algo, **para y repórtalo**.

- [ ] **Paso 7: verificar y commitear**

```bash
pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
git add packages/shared apps/api/src/features/cases/schema.ts apps/api/src/db apps/api/drizzle
git commit -m "feat(shared): contrato y tabla de pruebas en boca

Refs #65"
```

---

### Tarea 2: reglas puras de fase (`shared`)

**Archivos:**
- Crear: `packages/shared/src/stages.ts`, `packages/shared/src/stages.test.ts`
- Modificar: `packages/shared/src/index.ts`

**Interfaces:**
- Produce: `type StageRef = { id: string; sort: number; active: boolean }`; `nextStage(stages, currentId)`, `previousStage(stages, currentId)`, `isLastStage(stages, currentId)`, `firstStage(stages)`. Todas ignoran las fases inactivas y ordenan por `sort`.
- Consume: nada.

- [ ] **Paso 1: escribir el test que falla**

`packages/shared/src/stages.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { firstStage, isLastStage, nextStage, previousStage } from './stages.ts'

const stages = [
  { id: 'b', sort: 2, active: true },
  { id: 'a', sort: 1, active: true },
  { id: 'x', sort: 3, active: false },
  { id: 'c', sort: 4, active: true },
]

describe('fases', () => {
  it('la primera fase es la activa de menor orden', () => {
    expect(firstStage(stages)?.id).toBe('a')
  })

  it('avanza saltándose las fases inactivas', () => {
    expect(nextStage(stages, 'b')?.id).toBe('c')
  })

  it('retrocede saltándose las fases inactivas', () => {
    expect(previousStage(stages, 'c')?.id).toBe('b')
  })

  it('no hay siguiente desde la última fase activa', () => {
    expect(nextStage(stages, 'c')).toBeUndefined()
    expect(isLastStage(stages, 'c')).toBe(true)
  })

  it('no hay anterior desde la primera fase activa', () => {
    expect(previousStage(stages, 'a')).toBeUndefined()
  })

  it('una fase desconocida o nula no tiene siguiente ni anterior', () => {
    expect(nextStage(stages, 'desconocida')).toBeUndefined()
    expect(previousStage(stages, null)).toBeUndefined()
    expect(isLastStage(stages, null)).toBe(false)
  })

  it('sin fases activas no hay primera fase', () => {
    expect(firstStage([{ id: 'x', sort: 1, active: false }])).toBeUndefined()
  })
})
```

- [ ] **Paso 2: correr el test y verlo fallar**

Run: `pnpm vitest run --project shared packages/shared/src/stages.test.ts`
Expected: FAIL, no existe `./stages.ts`.

- [ ] **Paso 3: implementar**

`packages/shared/src/stages.ts`:

```ts
export type StageRef = { id: string; sort: number; active: boolean }

/** Fases activas ordenadas por `sort`. Las inactivas no cuentan: una fase que el
 * laboratorio desactivó no debe aparecer al avanzar un trabajo que ya está en curso. */
const activos = (stages: readonly StageRef[]): StageRef[] =>
  stages.filter((s) => s.active).sort((a, b) => a.sort - b.sort)

export function firstStage(stages: readonly StageRef[]): StageRef | undefined {
  return activos(stages)[0]
}

export function nextStage(
  stages: readonly StageRef[],
  currentId: string | null,
): StageRef | undefined {
  if (!currentId) return undefined
  const lista = activos(stages)
  const i = lista.findIndex((s) => s.id === currentId)
  return i === -1 ? undefined : lista[i + 1]
}

export function previousStage(
  stages: readonly StageRef[],
  currentId: string | null,
): StageRef | undefined {
  if (!currentId) return undefined
  const lista = activos(stages)
  const i = lista.findIndex((s) => s.id === currentId)
  return i <= 0 ? undefined : lista[i - 1]
}

export function isLastStage(stages: readonly StageRef[], currentId: string | null): boolean {
  if (!currentId) return false
  const lista = activos(stages)
  const i = lista.findIndex((s) => s.id === currentId)
  return i !== -1 && i === lista.length - 1
}
```

Exporta las cuatro desde `packages/shared/src/index.ts`.

- [ ] **Paso 4: correr el test y verlo pasar**

Run: `pnpm vitest run --project shared packages/shared/src/stages.test.ts`
Expected: PASS (7 tests).

- [ ] **Paso 5: verificar y commitear**

```bash
pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
git add packages/shared
git commit -m "feat(shared): reglas de avance y retroceso de fase

Refs #64"
```

---

### Tarea 3: contratos de las acciones (`shared`)

**Archivos:**
- Modificar: `packages/shared/src/schemas/cases.ts`, `packages/shared/src/schemas/cases.test.ts`, `packages/shared/src/case-readiness.ts`

**Interfaces:**
- Produce: `caseActionSchema` (`{ accion: CaseAction; motivo?: string | null }`), `stageChangeSchema` (`{ direccion: 'avanzar' | 'retroceder'; motivo?: string | null }`), `assignTechnicianSchema` (`{ tecnicoId: string | null }`), `remakeSchema` (`{ motivo: string; responsabilidad: RemakeResponsibility; cobroPct: number }`), `REMAKE_RESPONSIBILITIES`.

- [ ] **Paso 1: escribir los tests que fallan**

Añade a `packages/shared/src/schemas/cases.test.ts`:

```ts
describe('caseActionSchema', () => {
  it('exige motivo en las acciones que lo requieren', () => {
    expect(caseActionSchema.safeParse({ accion: 'pausar' }).success).toBe(false)
    expect(caseActionSchema.safeParse({ accion: 'cancelar', motivo: '  ' }).success).toBe(false)
    expect(caseActionSchema.safeParse({ accion: 'pausar', motivo: 'Falta antagonista' }).success).toBe(true)
  })

  it('no exige motivo en las demás acciones y lo normaliza a null', () => {
    const r = caseActionSchema.parse({ accion: 'aceptar' })
    expect(r).toEqual({ accion: 'aceptar', motivo: null })
  })

  it('rechaza una acción que no existe', () => {
    expect(caseActionSchema.safeParse({ accion: 'inventada' }).success).toBe(false)
  })
})

describe('stageChangeSchema', () => {
  it('retroceder exige motivo; avanzar no', () => {
    expect(stageChangeSchema.safeParse({ direccion: 'retroceder' }).success).toBe(false)
    expect(stageChangeSchema.safeParse({ direccion: 'retroceder', motivo: 'Se rompió' }).success).toBe(true)
    expect(stageChangeSchema.safeParse({ direccion: 'avanzar' }).success).toBe(true)
  })
})

describe('remakeSchema', () => {
  it('exige motivo y responsabilidad, y acota el porcentaje de cobro a 0–100', () => {
    expect(remakeSchema.safeParse({ motivo: 'Fractura', responsabilidad: 'laboratorio', cobroPct: 0 }).success).toBe(true)
    expect(remakeSchema.safeParse({ motivo: '', responsabilidad: 'laboratorio', cobroPct: 0 }).success).toBe(false)
    expect(remakeSchema.safeParse({ motivo: 'x', responsabilidad: 'otra', cobroPct: 0 }).success).toBe(false)
    expect(remakeSchema.safeParse({ motivo: 'x', responsabilidad: 'clinica', cobroPct: 101 }).success).toBe(false)
  })
})
```

- [ ] **Paso 2: correr y ver fallar**

Run: `pnpm vitest run --project shared packages/shared/src/schemas/cases.test.ts`
Expected: FAIL, los schemas no existen.

- [ ] **Paso 3: implementar en `packages/shared/src/schemas/cases.ts`**

```ts
export const REMAKE_RESPONSIBILITIES = ['laboratorio', 'clinica', 'compartida'] as const
export type RemakeResponsibility = (typeof REMAKE_RESPONSIBILITIES)[number]

const motivoObligatorio = z.string().trim().min(1, { error: 'Escribe el motivo' }).max(500)

export const caseActionSchema = z
  .object({ accion: z.enum(CASE_ACTIONS, { error: 'Acción inválida' }), motivo: textoOpcional(500) })
  .superRefine((v, ctx) => {
    if (ACTIONS_REQUIRING_REASON.includes(v.accion) && !v.motivo)
      ctx.addIssue({ code: 'custom', path: ['motivo'], message: 'Escribe el motivo' })
  })
export type CaseActionInput = z.infer<typeof caseActionSchema>

export const stageChangeSchema = z
  .object({ direccion: z.enum(['avanzar', 'retroceder']), motivo: textoOpcional(500) })
  .superRefine((v, ctx) => {
    if (v.direccion === 'retroceder' && !v.motivo)
      ctx.addIssue({ code: 'custom', path: ['motivo'], message: 'Escribe el motivo' })
  })
export type StageChangeInput = z.infer<typeof stageChangeSchema>

export const assignTechnicianSchema = z.object({ tecnicoId: z.string().min(1).nullable() })
export type AssignTechnicianInput = z.infer<typeof assignTechnicianSchema>

export const remakeSchema = z.object({
  motivo: motivoObligatorio,
  responsabilidad: z.enum(REMAKE_RESPONSIBILITIES, { error: 'Responsabilidad inválida' }),
  cobroPct: z.coerce.number().int().min(0).max(100),
})
export type RemakeInput = z.infer<typeof remakeSchema>
```

`textoOpcional(n)` ya normaliza `''` a `null`: compruébalo antes de confiar en él (`packages/shared/src/schemas/`).

- [ ] **Paso 4: documentar el `checklist` no validado**

En `packages/shared/src/case-readiness.ts`, sobre el campo `checklist` de `ReadinessInput`, añade:

```ts
  /** La lista de la orden en papel registra **lo recibido**, no obliga a tenerlo todo: un
   * trabajo puede legítimamente no necesitar antagonista. Por eso `missingForAccept` la
   * recibe (la ficha la muestra) pero no la exige. Decidido al planificar la Iteración 3. */
```

- [ ] **Paso 5: correr y ver pasar**

Run: `pnpm vitest run --project shared`
Expected: PASS, sin regresiones.

- [ ] **Paso 6: verificar y commitear**

```bash
pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
git add packages/shared
git commit -m "feat(shared): contratos de acciones, fase, técnico y repetición

Refs #63 #64 #65 #66 #67"
```

---

### Tarea 4: servicio de acciones de estado (API, con fakes)

**Archivos:**
- Modificar: `apps/api/src/features/cases/ports.ts`, `service.ts`, `errors.ts`, `fakes.ts`, `service.test.ts`

**Interfaces:**
- Consume: `applyAction`, `missingForAccept`, `addBusinessDays`, `firstStage` (Tarea 2), `caseActionSchema` (Tarea 3).
- Produce: `CasesService.action(id, input: CaseActionInput, ctx: RequestContext)`. Puertos nuevos en `ports.ts`: `StagesQuery { active(): Promise<StageRef[]> }`, `TryinsRepository { open(caseId): Promise<TryinRow | undefined>; create(caseId, sentAt, note): Promise<void>; close(id, returnedAt): Promise<void> }`; `CasesRepository` gana `applyTransition(id, patch): Promise<void>` y `turnaroundFor(caseId): Promise<number>`.

**Reglas que implementa** (de CIC-1, CIC-3):
- `aceptar`: si `missingForAccept` devuelve algo → `CaseInputError` (422 con el detalle). Si no: `status = 'en_proceso'`, `promisedDate = addBusinessDays(hoy, maxTurnaround, [])`, `currentStageId = firstStage(...)`, evento `status_changed`.
- `pausar`: exige motivo (ya lo garantiza el schema), guarda `holdReason`, evento `hold`. `reanudar` limpia `holdReason`, evento `resumed`.
- `enviar_prueba`: crea un `case_tryin` con `sentAt = hoy`, evento `tryin_sent`. `recibir_prueba`: cierra la prueba abierta con `returnedAt = hoy`, evento `tryin_returned`.
- `finalizar`: fija `finishedAt`, evento `status_changed`.
- `cancelar`: evento `cancelled` con el motivo.
- Cualquier acción cuya transición no aplique → `CaseStateError` (409). Rol sin permiso para esa acción → `CaseForbiddenError` (403).
- Todo dentro de `uow.run`.

- [ ] **Paso 1: escribir los tests que fallan**

Añade a `apps/api/src/features/cases/service.test.ts` (usa los fakes existentes; amplíalos en `fakes.ts` con `stages` y `tryins`):

```ts
describe('acciones de estado', () => {
  it('aceptar fija la fecha comprometida en días hábiles y la fase inicial', async () => {
    // viernes 2026-09-18 + 5 días hábiles = viernes 2026-09-25
    const service = createCasesService({
      cases: fakeCasesRepo([completo({ id: '1', status: 'nuevo' })]),
      attachments: { hasDocument: async () => true },
      stages: { active: async () => [{ id: 'f1', sort: 1, active: true }] },
      tryins: fakeTryins(),
      uow: fakeUow(),
      clock: { today: () => '2026-09-18' },
    })
    await service.action('1', { accion: 'aceptar', motivo: null }, admin)
    const guardado = await service.detail('1', admin)
    expect(guardado.case.status).toBe('en_proceso')
    expect(guardado.case.promisedDate).toBe('2026-09-25')
    expect(guardado.case.currentStageId).toBe('f1')
  })

  it('aceptar con datos incompletos lanza CaseInputError con el detalle de lo que falta', async () => {
    const service = servicioCon(completo({ id: '1', status: 'nuevo', patientRef: '' }))
    await expect(service.action('1', { accion: 'aceptar', motivo: null }, admin)).rejects.toThrow(
      CaseInputError,
    )
  })

  it('un técnico no puede aceptar', async () => {
    const service = servicioCon(completo({ id: '1', status: 'nuevo' }))
    await expect(service.action('1', { accion: 'aceptar', motivo: null }, tecnico)).rejects.toThrow(
      CaseForbiddenError,
    )
  })

  it('pausar guarda el motivo y reanudar lo limpia', async () => {
    const service = servicioCon(completo({ id: '1', status: 'en_proceso' }))
    await service.action('1', { accion: 'pausar', motivo: 'Falta antagonista' }, admin)
    expect((await service.detail('1', admin)).case.holdReason).toBe('Falta antagonista')
    await service.action('1', { accion: 'reanudar', motivo: null }, admin)
    expect((await service.detail('1', admin)).case.holdReason).toBeNull()
  })

  it('enviar a prueba abre una prueba y recibirla la cierra', async () => {
    const tryins = fakeTryins()
    const service = servicioCon(completo({ id: '1', status: 'en_proceso' }), { tryins })
    await service.action('1', { accion: 'enviar_prueba', motivo: null }, admin)
    expect(await tryins.open('1')).toMatchObject({ sentAt: '2026-09-18', returnedAt: null })
    await service.action('1', { accion: 'recibir_prueba', motivo: null }, admin)
    expect(await tryins.open('1')).toBeUndefined()
  })

  it('una transición inválida lanza CaseStateError', async () => {
    const service = servicioCon(completo({ id: '1', status: 'nuevo' }))
    await expect(service.action('1', { accion: 'finalizar', motivo: null }, admin)).rejects.toThrow(
      CaseStateError,
    )
  })

  it('cada acción escribe su evento con el actor y el motivo', async () => {
    const service = servicioCon(completo({ id: '1', status: 'en_proceso' }))
    await service.action('1', { accion: 'pausar', motivo: 'Falta antagonista' }, admin)
    const eventos = await service.events('1', admin)
    expect(eventos.at(-1)).toMatchObject({
      type: 'hold',
      actorId: admin.userId,
      note: 'Falta antagonista',
    })
  })
})
```

Escribe los helpers `completo(...)`, `servicioCon(...)`, `fakeTryins()`, `admin`, `tecnico` junto a los que ya existen en el archivo, siguiendo su estilo. Comprueba primero cómo están escritos los fakes actuales (`fakes.ts`) para no duplicar.

- [ ] **Paso 2: correr y ver fallar**

Run: `pnpm vitest run --project api apps/api/src/features/cases/service.test.ts`
Expected: FAIL, `service.action` no existe.

- [ ] **Paso 3: implementar**

Amplía `ports.ts` con `StagesQuery`, `TryinsRepository` y los métodos nuevos de `CasesRepository`; añade `CaseForbiddenError` a `errors.ts` si no existe; implementa `action` en `service.ts` con las reglas de arriba, todo dentro de `deps.uow.run`. El servicio **no** importa Drizzle ni Hono (lo verifica `pnpm lint`).

- [ ] **Paso 4: correr y ver pasar**

Run: `pnpm vitest run --project api apps/api/src/features/cases/service.test.ts`
Expected: PASS.

- [ ] **Paso 5: verificar y commitear**

```bash
pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
git add apps/api/src/features/cases
git commit -m "feat(api): caso de uso de acciones de estado del trabajo

Refs #63 #65 #66"
```

---

### Tarea 5: ruta de acciones e integración contra Postgres

**Archivos:**
- Modificar: `apps/api/src/features/cases/repo.ts`, `routes.ts`, `cases.test.ts`, `apps/api/src/app.ts`

**Interfaces:**
- Consume: `CasesService.action` (Tarea 4).
- Produce: `POST /api/trabajos/:id/acciones` → `200 { case: { id, status } }`. Traducción: `CaseInputError` → 422 con `issues`, `CaseStateError` → 409, `CaseNotFoundError` → 404, `CaseForbiddenError` → 403.

- [ ] **Paso 1: escribir los tests de integración que fallan**

Añade a `apps/api/src/features/cases/cases.test.ts` (sigue el patrón del archivo: crea usuarios y autentica por rol en cada test):

```ts
describe('POST /api/trabajos/:id/acciones', () => {
  it('acepta un trabajo completo y fija fecha comprometida, fase y evento', async () => {
    const { id } = await crearTrabajoCompleto()
    const res = await comoAdmin().post(`/api/trabajos/${id}/acciones`, { accion: 'aceptar' })
    expect(res.status).toBe(200)
    const ficha = await (await comoAdmin().get(`/api/trabajos/${id}`)).json()
    expect(ficha.case.status).toBe('en_proceso')
    expect(ficha.case.promisedDate).not.toBeNull()
    expect(ficha.case.currentStageId).not.toBeNull()
    const eventos = await (await comoAdmin().get(`/api/trabajos/${id}/eventos`)).json()
    expect(eventos.some((e) => e.type === 'status_changed')).toBe(true)
  })

  it('responde 422 con el detalle cuando faltan datos obligatorios', async () => {
    const { id } = await crearTrabajoSinPrescripcion()
    const res = await comoAdmin().post(`/api/trabajos/${id}/acciones`, { accion: 'aceptar' })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.message).toBe('Datos inválidos')
    expect(JSON.stringify(body.issues)).toContain('Prescripción')
  })

  it('responde 409 ante una transición inválida', async () => {
    const { id } = await crearTrabajoCompleto()
    const res = await comoAdmin().post(`/api/trabajos/${id}/acciones`, { accion: 'finalizar' })
    expect(res.status).toBe(409)
  })

  it('responde 403 sin sesión y con rol técnico', async () => {
    const { id } = await crearTrabajoCompleto()
    expect((await sinSesion().post(`/api/trabajos/${id}/acciones`, { accion: 'aceptar' })).status).toBe(403)
    expect((await comoTecnico().post(`/api/trabajos/${id}/acciones`, { accion: 'aceptar' })).status).toBe(403)
  })

  it('responde 422 al pausar sin motivo', async () => {
    const { id } = await crearTrabajoEnProceso()
    expect((await comoAdmin().post(`/api/trabajos/${id}/acciones`, { accion: 'pausar' })).status).toBe(422)
  })

  it('responde 404 si el trabajo no existe', async () => {
    const res = await comoAdmin().post(`/api/trabajos/${crypto.randomUUID()}/acciones`, { accion: 'aceptar' })
    expect(res.status).toBe(404)
  })
})
```

Reutiliza los helpers que el archivo ya tenga para crear trabajos y autenticar; si no existen con esos nombres, usa los reales y ajusta.

- [ ] **Paso 2: correr y ver fallar**

Run: `pnpm vitest run --project api apps/api/src/features/cases/cases.test.ts`
Expected: FAIL, 404 en todas (la ruta no existe).

- [ ] **Paso 3: implementar**

Implementa en `repo.ts` los métodos nuevos del puerto (`applyTransition`, `turnaroundFor`) y `createTryinsRepo`/`createStagesQuery`; monta la ruta en `routes.ts` con `validate('param', idParamSchema)` + `validate('json', caseActionSchema)` y la traducción de errores; inyecta los puertos nuevos en `app.ts`. **Ni `db.` ni `drizzle-orm` dentro de la ruta.**

- [ ] **Paso 4: correr y ver pasar**

Run: `pnpm vitest run --project api apps/api/src/features/cases/cases.test.ts`
Expected: PASS.

- [ ] **Paso 5: verificar y commitear**

```bash
pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
git add apps/api/src
git commit -m "feat(api): endpoint de acciones de estado del trabajo

Refs #63 #65 #66"
```

---

### Tarea 6: fase y técnico responsable (API)

**Archivos:**
- Modificar: `apps/api/src/features/cases/{ports,service,repo,routes,fakes,service.test,cases.test}.ts`

**Interfaces:**
- Consume: `nextStage`/`previousStage`/`isLastStage` (Tarea 2), `stageChangeSchema`/`assignTechnicianSchema` (Tarea 3).
- Produce: `PUT /api/trabajos/:id/fase` → `200 { case: { id, currentStageId } }`; `PUT /api/trabajos/:id/tecnico` → `200 { case: { id, assignedTechnicianId } }`. Puerto nuevo: `UsersQuery { activeTechnicians(): Promise<{ id: string }[]> }`.

**Reglas** (CIC-2, CIC-5):
- Avanzar desde la última fase activa no cambia la fase: el cliente debe usar `finalizar`. Responde 409 con mensaje claro.
- `en_espera` y `en_prueba` **no** permiten cambiar de fase → 409.
- Retroceder exige motivo (garantizado por el schema) y lo guarda en el evento.
- Cada cambio escribe `stage_changed` con `fromStageId`, `toStageId`, actor y motivo.
- Asignar técnico: solo un usuario **activo con rol `tecnico`**; si no, 422. Evento `assigned` con antes y después. Técnico y mensajero no pueden asignar → 403.

- [ ] **Paso 1: tests de servicio con fakes (RED)**

```ts
describe('cambio de fase', () => {
  it('avanza a la siguiente fase activa y deja el evento con la fase anterior y la nueva', async () => {
    const service = servicioConFases(['f1', 'f2'], { status: 'en_proceso', currentStageId: 'f1' })
    await service.changeStage('1', { direccion: 'avanzar', motivo: null }, admin)
    expect((await service.detail('1', admin)).case.currentStageId).toBe('f2')
    expect((await service.events('1', admin)).at(-1)).toMatchObject({
      type: 'stage_changed',
      fromStageId: 'f1',
      toStageId: 'f2',
    })
  })

  it('no avanza desde la última fase: hay que finalizar', async () => {
    const service = servicioConFases(['f1'], { status: 'en_proceso', currentStageId: 'f1' })
    await expect(
      service.changeStage('1', { direccion: 'avanzar', motivo: null }, admin),
    ).rejects.toThrow(CaseStateError)
  })

  it('un trabajo en espera o en prueba no cambia de fase', async () => {
    for (const status of ['en_espera', 'en_prueba'] as const) {
      const service = servicioConFases(['f1', 'f2'], { status, currentStageId: 'f1' })
      await expect(
        service.changeStage('1', { direccion: 'avanzar', motivo: null }, admin),
      ).rejects.toThrow(CaseStateError)
    }
  })

  it('el técnico asignado puede avanzar la fase', async () => {
    const service = servicioConFases(['f1', 'f2'], { status: 'en_proceso', currentStageId: 'f1' })
    await expect(
      service.changeStage('1', { direccion: 'avanzar', motivo: null }, tecnico),
    ).resolves.toBeDefined()
  })
})

describe('técnico responsable', () => {
  it('asigna un técnico activo y deja el evento con antes y después', async () => {
    const service = servicioConTecnicos([{ id: 't1' }, { id: 't2' }], { assignedTechnicianId: 't1' })
    await service.assignTechnician('1', { tecnicoId: 't2' }, admin)
    expect((await service.detail('1', admin)).case.assignedTechnicianId).toBe('t2')
    expect((await service.events('1', admin)).at(-1)).toMatchObject({ type: 'assigned' })
  })

  it('rechaza un usuario que no es técnico activo', async () => {
    const service = servicioConTecnicos([{ id: 't1' }], {})
    await expect(service.assignTechnician('1', { tecnicoId: 'otro' }, admin)).rejects.toThrow(
      CaseInputError,
    )
  })

  it('acepta desasignar con null', async () => {
    const service = servicioConTecnicos([{ id: 't1' }], { assignedTechnicianId: 't1' })
    await service.assignTechnician('1', { tecnicoId: null }, admin)
    expect((await service.detail('1', admin)).case.assignedTechnicianId).toBeNull()
  })

  it('un técnico no puede asignar', async () => {
    const service = servicioConTecnicos([{ id: 't1' }], {})
    await expect(service.assignTechnician('1', { tecnicoId: 't1' }, tecnico)).rejects.toThrow(
      CaseForbiddenError,
    )
  })
})
```

- [ ] **Paso 2: correr y ver fallar**

Run: `pnpm vitest run --project api apps/api/src/features/cases/service.test.ts`
Expected: FAIL.

- [ ] **Paso 3: implementar servicio, repo y rutas**

`changeStage` y `assignTechnician` en `service.ts`, sus puertos en `ports.ts`, los adaptadores en `repo.ts` (incluido `createUsersQuery`, que consulta `users` por rol y `active` — **puerto inyectado**, no import del repo de `users`), y las dos rutas en `routes.ts`. Regístralo todo en `app.ts`.

- [ ] **Paso 4: tests de integración**

Añade a `cases.test.ts` la versión HTTP de los cuatro casos clave: avanzar fase (200 + evento), avanzar desde la última (409), estado `en_espera` (409), asignar técnico inexistente (422), y 403 sin sesión y con rol incorrecto en ambas rutas.

- [ ] **Paso 5: verificar y commitear**

```bash
pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
git add apps/api/src
git commit -m "feat(api): avance de fase y técnico responsable del trabajo

Refs #64 #67"
```

---

### Tarea 7: repetición (remake) — API

**Archivos:**
- Modificar: `apps/api/src/features/cases/{ports,service,repo,routes,fakes,service.test,cases.test}.ts`

**Interfaces:**
- Consume: `remakeSchema` (Tarea 3).
- Produce: `POST /api/trabajos/:id/repetir` → `201 { case: { id, code } }`. `CasesRepository.createRemake(parentId, input, actorId)`.

**Reglas** (CIC-4): solo desde `terminado`, `enviado` o `entregado`; copia líneas y odontograma del original; fija `parentCaseId`, `remakeReason`, `remakeResponsibility` y el porcentaje de cobro; evento `remake_created` en **ambas** fichas; el hijo nace en `nuevo`. Solo `admin` y `recepcion`.

- [ ] **Paso 1: tests de servicio (RED)**

```ts
describe('repetición', () => {
  it('crea un trabajo hijo con las líneas y el odontograma del original', async () => {
    const service = servicioCon(completo({ id: '1', status: 'terminado' }))
    const hijo = await service.createRemake('1', remake, admin)
    const ficha = await service.detail(hijo.id, admin)
    expect(ficha.case.status).toBe('nuevo')
    expect(ficha.case.parentCaseId).toBe('1')
    expect(ficha.case.items).toHaveLength(1)
    expect(ficha.case.items[0].teeth).toEqual([11, 12])
  })

  it('deja el evento «repetición creada» en el original y en el hijo', async () => {
    const service = servicioCon(completo({ id: '1', status: 'terminado' }))
    const hijo = await service.createRemake('1', remake, admin)
    expect((await service.events('1', admin)).some((e) => e.type === 'remake_created')).toBe(true)
    expect((await service.events(hijo.id, admin)).some((e) => e.type === 'remake_created')).toBe(true)
  })

  it('no se puede repetir un trabajo que aún está en proceso', async () => {
    const service = servicioCon(completo({ id: '1', status: 'en_proceso' }))
    await expect(service.createRemake('1', remake, admin)).rejects.toThrow(CaseStateError)
  })

  it('un técnico no puede crear repeticiones', async () => {
    const service = servicioCon(completo({ id: '1', status: 'terminado' }))
    await expect(service.createRemake('1', remake, tecnico)).rejects.toThrow(CaseForbiddenError)
  })
})
```

- [ ] **Paso 2: correr y ver fallar** — `pnpm vitest run --project api apps/api/src/features/cases/service.test.ts`. Expected: FAIL.

- [ ] **Paso 3: implementar** servicio + repo (`createRemake` dentro de `uow.run`: inserta el hijo con `nextCaseCode`, copia `case_items`, escribe los dos eventos) + ruta.

- [ ] **Paso 4: test de integración** en `cases.test.ts`: repetir un trabajo entregado devuelve 201 con código nuevo; el hijo enlaza al padre; repetir desde `nuevo` responde 409; 403 sin sesión y con técnico.

- [ ] **Paso 5: verificar y commitear**

```bash
pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
git add apps/api/src
git commit -m "feat(api): repetición de un trabajo con líneas y odontograma copiados

Refs #66"
```

---

### Tarea 8: barra de acciones en la ficha (web)

**Archivos:**
- Crear: `apps/web/src/features/cases/case-actions.tsx`, `case-actions.test.tsx`, `case-action-dialog.tsx`
- Modificar: `apps/web/src/features/cases/api.ts`, `use-cases.ts`, `apps/web/src/routes/_app/trabajos/$caseId.tsx`

**Interfaces:**
- Consume: `POST /api/trabajos/:id/acciones` (Tarea 5); `CASE_TRANSITIONS`, `ACTIONS_REQUIRING_REASON`, `canTransition` de `shared`.
- Produce: `<CaseActions case={c} role={role} />`; hook `useCaseAction(caseId)` que invalida `queryKeys.cases`, el detalle y los eventos.

**Reglas de UI:** solo se muestran las acciones válidas para el estado **y** el rol (se derivan de `CASE_TRANSITIONS`, no se escriben a mano). «Aceptar» aparece deshabilitada con la lista de lo que falta si `missing` no está vacío. Las acciones con motivo abren un diálogo con `<textarea>` obligatorio. Botones de 44 px; en móvil, a ancho completo.

- [ ] **Paso 1: escribir los tests que fallan**

`apps/web/src/features/cases/case-actions.test.tsx`:

```tsx
describe('CaseActions', () => {
  it('en un trabajo nuevo y completo ofrece Aceptar y Cancelar a recepción', async () => {
    renderWithProviders(<CaseActions case={caso({ status: 'nuevo' })} missing={[]} role="recepcion" />)
    expect(await screen.findByRole('button', { name: 'Aceptar' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cancelar trabajo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Finalizar' })).not.toBeInTheDocument()
  })

  it('deshabilita Aceptar y dice qué falta cuando el trabajo está incompleto', async () => {
    renderWithProviders(
      <CaseActions case={caso({ status: 'nuevo' })} missing={['Color', 'Prescripción']} role="recepcion" />,
    )
    expect(await screen.findByRole('button', { name: 'Aceptar' })).toBeDisabled()
    expect(screen.getByText(/Falta: Color, Prescripción/)).toBeInTheDocument()
  })

  it('a un técnico no le ofrece Aceptar ni Cancelar', async () => {
    renderWithProviders(<CaseActions case={caso({ status: 'nuevo' })} missing={[]} role="tecnico" />)
    expect(screen.queryByRole('button', { name: 'Aceptar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar trabajo' })).not.toBeInTheDocument()
  })

  it('pausar pide motivo y no envía hasta que se escribe', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CaseActions case={caso({ status: 'en_proceso' })} missing={[]} role="recepcion" />)
    await user.click(await screen.findByRole('button', { name: 'Pausar' }))
    const confirmar = screen.getByRole('button', { name: 'Confirmar' })
    await user.click(confirmar)
    expect(await screen.findByText('Escribe el motivo')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Motivo'), 'Falta antagonista')
    await user.click(confirmar)
    await waitFor(() => expect(postAccion).toHaveBeenCalledWith('c1', { accion: 'pausar', motivo: 'Falta antagonista' }))
  })

  it('un trabajo entregado no ofrece ninguna acción de estado', async () => {
    renderWithProviders(<CaseActions case={caso({ status: 'entregado' })} missing={[]} role="recepcion" />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
```

Mockea solo `api.ts` (`vi.mock('./api')`), nunca los hooks internos (`docs/conventions.md` §7).

- [ ] **Paso 2: correr y ver fallar** — `pnpm vitest run --project web apps/web/src/features/cases/case-actions.test.tsx`. Expected: FAIL, no existe el componente.

- [ ] **Paso 3: implementar** `case-actions.tsx` (deriva las acciones disponibles de `CASE_TRANSITIONS` filtrando por `status` y `role`), `case-action-dialog.tsx` (reutiliza `ConfirmDialog`/`FormDialog` si encajan), `postCaseAction` en `api.ts` y `useCaseAction` en `use-cases.ts` con las invalidaciones. Monta `<CaseActions />` en `CaseHeader` o bajo él en `$caseId.tsx`.

- [ ] **Paso 4: correr y ver pasar** — mismo comando. Expected: PASS.

- [ ] **Paso 5: verificar en Chrome** a 1280×800, 390×844 y 360×740: recorre nuevo → aceptar → pausar → reanudar → enviar a prueba → recibir → finalizar, con la consola limpia y los botones a 44 px. Capturas en el reporte.

- [ ] **Paso 6: verificar y commitear**

```bash
pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
git add apps/web/src
git commit -m "feat(web): acciones de estado en la ficha del trabajo

Refs #63 #65 #66"
```

---

### Tarea 9: fase, técnico y repetición en la ficha (web) + E2E del ciclo

**Archivos:**
- Crear: `apps/web/src/features/cases/stage-control.tsx`, `stage-control.test.tsx`, `technician-select.tsx`, `technician-select.test.tsx`, `remake-dialog.tsx`, `remake-dialog.test.tsx`
- Modificar: `apps/web/src/features/cases/{api,use-cases}.ts`, `case-detail-tab.tsx`, `apps/web/e2e/trabajos.spec.ts`

**Interfaces:**
- Consume: `PUT /:id/fase`, `PUT /:id/tecnico`, `POST /:id/repetir` (Tareas 6 y 7).
- Produce: `<StageControl />`, `<TechnicianSelect />`, `<RemakeDialog />`.

- [ ] **Paso 1: tests (RED)**

```tsx
describe('StageControl', () => {
  it('muestra la fase actual y avanza a la siguiente', async () => {
    const user = userEvent.setup()
    renderWithProviders(<StageControl case={caso({ status: 'en_proceso', currentStageId: 'f1' })} stages={fases} role="tecnico" />)
    expect(await screen.findByText('Modelado')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Avanzar fase' }))
    await waitFor(() => expect(putFase).toHaveBeenCalledWith('c1', { direccion: 'avanzar', motivo: null }))
  })

  it('retroceder pide motivo', async () => {
    const user = userEvent.setup()
    renderWithProviders(<StageControl case={caso({ status: 'en_proceso', currentStageId: 'f2' })} stages={fases} role="tecnico" />)
    await user.click(screen.getByRole('button', { name: 'Retroceder fase' }))
    expect(await screen.findByLabelText('Motivo')).toBeRequired()
  })

  it('en la última fase ofrece Finalizar en vez de Avanzar', async () => {
    renderWithProviders(<StageControl case={caso({ status: 'en_proceso', currentStageId: 'f3' })} stages={fases} role="tecnico" />)
    expect(await screen.findByRole('button', { name: 'Finalizar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Avanzar fase' })).not.toBeInTheDocument()
  })

  it('un trabajo en espera no deja cambiar de fase', async () => {
    renderWithProviders(<StageControl case={caso({ status: 'en_espera', currentStageId: 'f1' })} stages={fases} role="tecnico" />)
    expect(await screen.findByText(/pausado/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Avanzar fase' })).not.toBeInTheDocument()
  })
})

describe('TechnicianSelect', () => {
  it('lista solo técnicos activos y guarda el cambio', async () => {
    const user = userEvent.setup()
    renderWithProviders(<TechnicianSelect case={caso({})} role="recepcion" />)
    await user.selectOptions(await screen.findByLabelText('Técnico responsable'), 't2')
    await waitFor(() => expect(putTecnico).toHaveBeenCalledWith('c1', { tecnicoId: 't2' }))
  })

  it('un técnico ve el nombre pero no puede cambiarlo', async () => {
    renderWithProviders(<TechnicianSelect case={caso({ assignedTechnicianId: 't1' })} role="tecnico" />)
    expect(await screen.findByText('Ana Técnica')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})

describe('RemakeDialog', () => {
  it('exige motivo y responsabilidad antes de crear la repetición', async () => {
    const user = userEvent.setup()
    renderWithProviders(<RemakeDialog case={caso({ status: 'entregado' })} />)
    await user.click(await screen.findByRole('button', { name: 'Repetir' }))
    await user.click(screen.getByRole('button', { name: 'Crear repetición' }))
    expect(await screen.findByText('Escribe el motivo')).toBeInTheDocument()
  })
})
```

- [ ] **Paso 2: correr y ver fallar** — `pnpm vitest run --project web apps/web/src/features/cases`. Expected: FAIL.

- [ ] **Paso 3: implementar** los tres componentes, sus llamadas en `api.ts` y sus hooks en `use-cases.ts` con las invalidaciones correctas. Móntalos en `CaseDetailTab`. Un componente por archivo (`docs/conventions.md` §1).

- [ ] **Paso 4: correr y ver pasar** — mismo comando. Expected: PASS.

- [ ] **Paso 5: E2E `@esencial` del ciclo completo**

En `apps/web/e2e/trabajos.spec.ts`, dentro de `describe('Trabajos')`:

```ts
test('acepta un trabajo, avanza la fase y lo finaliza', { tag: '@esencial' }, async ({ page }) => {
  const { clinic, doctor } = await createClinicWithDoctor(page)
  const product = await createProduct(page)
  const trabajo = await createCase(page, { clinicId: clinic.id, doctorId: doctor.id, productId: product.id })
  await page.goto(`/trabajos/${trabajo.id}`)
  await page.getByRole('button', { name: 'Aceptar' }).click()
  await expect(page.getByText('En proceso')).toBeVisible()
  await page.getByRole('button', { name: 'Avanzar fase' }).click()
  await page.getByRole('button', { name: 'Finalizar' }).click()
  await expect(page.getByText('Terminado')).toBeVisible()
})
```

Adapta `createCase` para que deje el trabajo **completo** (con prescripción), o crea un helper nuevo; si el trabajo está incompleto, «Aceptar» sale deshabilitada y el test fallaría por la razón equivocada.

Run: `pnpm e2e:pr`. Expected: verde.

- [ ] **Paso 6: Chrome** en los tres viewports (avanzar fase, asignar técnico, repetir), consola limpia, 44 px.

- [ ] **Paso 7: verificar y commitear**

```bash
pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
pnpm e2e --project=escritorio --project=android
git add apps/web
git commit -m "feat(web): fase, técnico responsable y repetición en la ficha

Refs #64 #66 #67"
```

- [ ] **Paso 8: cerrar el PR 1** — revisión final de rama, ola de fixes y PR «Iteración 3 (1/3): ciclo de vida del trabajo» con `Closes #63 #64 #65 #66 #67`.

---

# PR 2 — Panel de inicio y listas (INI-1 #68, INI-2 #69, #56)

Rama: `feat/iteracion-3-inicio`. Cierra #68, #69, #56.

### Tarea 10: vista `en_prueba` y contrato del resumen (`shared`)

**Archivos:**
- Modificar: `packages/shared/src/schemas/cases.ts`, `cases.test.ts`, `apps/web/src/features/cases/case-views.ts` y su test

**Interfaces:**
- Produce: `CASE_VIEWS` con `en_prueba` añadida entre `atrasados` y `listos`; `CASE_VIEW_LABELS`; `type CaseSummary = Record<CaseView, number>`.

**Por qué** (decisión 2 del encabezado): INI-1 exige que cada contador coincida con el total de su vista rápida, así que contador y lista deben compartir definición.

- [ ] **Paso 1: test (RED)**

```ts
describe('CASE_VIEWS', () => {
  it('incluye la vista en prueba y conserva el orden de las pestañas', () => {
    expect(CASE_VIEWS).toEqual(['nuevos', 'en_curso', 'vencen_hoy', 'atrasados', 'en_prueba', 'listos', 'todos'])
  })

  it('cada vista tiene etiqueta en español en sentence case', () => {
    for (const v of CASE_VIEWS) {
      const label = CASE_VIEW_LABELS[v]
      expect(label).toBeTruthy()
      expect(label[0]).toBe(label[0].toUpperCase())
      expect(label.slice(1)).toBe(label.slice(1).toLowerCase() === label.slice(1) ? label.slice(1) : label.slice(1))
    }
  })
})
```

- [ ] **Paso 2: correr y ver fallar** — `pnpm vitest run --project shared`. Expected: FAIL.

- [ ] **Paso 3: implementar** la vista nueva y sus etiquetas; propaga el filtro SQL de `en_prueba` (estado `en_prueba`, sin cancelados) donde `repo.ts` traduce las vistas. Comprueba que las pestañas de la lista de trabajos y `parseCasesSearch` siguen funcionando con la vista nueva.

- [ ] **Paso 4: correr y ver pasar** — `pnpm test`. Expected: PASS, sin regresiones en `case-views.test.ts`.

- [ ] **Paso 5: verificar y commitear**

```bash
pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
git add packages/shared apps/web/src/features/cases
git commit -m "feat(shared): vista rápida de trabajos en prueba

Refs #68"
```

---

### Tarea 11: resumen del día (API)

**Archivos:**
- Modificar: `apps/api/src/features/cases/{ports,service,repo,routes,fakes,service.test,cases.test}.ts`

**Interfaces:**
- Produce: `GET /api/trabajos/resumen` → `200 { resumen: CaseSummary }`. `CasesRepository.summary(today: string, ctx): Promise<CaseSummary>`.

**Reglas:** un solo viaje a la BD (una consulta con agregados condicionales, no seis consultas). El resumen **no** lleva dinero, así que no necesita enmascarado; un técnico ve el resumen global (los contadores del laboratorio) y además su propia lista en INI-2.

- [ ] **Paso 1: tests de servicio (RED)**

```ts
describe('resumen del día', () => {
  it('cuenta cada vista con la misma definición que la lista', async () => {
    const repo = fakeCasesRepo([
      completo({ id: '1', status: 'nuevo' }),
      completo({ id: '2', status: 'en_proceso', promisedDate: '2026-09-18' }),
      completo({ id: '3', status: 'en_proceso', promisedDate: '2026-09-10' }),
      completo({ id: '4', status: 'en_prueba' }),
      completo({ id: '5', status: 'terminado' }),
      completo({ id: '6', status: 'cancelado' }),
    ])
    const service = servicioCon(repo, { clock: { today: () => '2026-09-18' } })
    const r = await service.summary(admin)
    expect(r).toMatchObject({ nuevos: 1, vencen_hoy: 1, atrasados: 1, en_prueba: 1, listos: 1 })
  })

  it('los cancelados no cuentan en ninguna vista salvo todos', async () => {
    const service = servicioCon(fakeCasesRepo([completo({ id: '6', status: 'cancelado' })]), {})
    const r = await service.summary(admin)
    expect(r.en_curso).toBe(0)
    expect(r.todos).toBe(1)
  })
})
```

- [ ] **Paso 2: correr y ver fallar** — Expected: FAIL.

- [ ] **Paso 3: implementar** servicio, repo (una consulta con `count(*) filter (where …)` por vista) y ruta con `requireAuth`.

- [ ] **Paso 4: test de integración** en `cases.test.ts`: crea trabajos en varios estados y comprueba que **cada contador coincide con el `total` de la lista de esa misma vista** (es el criterio de aceptación de INI-1, pruébalo así y no con números escritos a mano). Más 403 sin sesión.

- [ ] **Paso 5: verificar y commitear**

```bash
pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
git add apps/api/src
git commit -m "feat(api): resumen de trabajos del día por vista

Refs #68"
```

---

### Tarea 12: panel de inicio (web, INI-1 + INI-2)

**Archivos:**
- Crear: `apps/web/src/features/cases/summary-cards.tsx` + test, `apps/web/src/features/cases/my-cases.tsx` + test, `apps/web/src/features/cases/use-summary.ts`
- Modificar: `apps/web/src/features/cases/api.ts`, `apps/web/src/routes/_app/index.tsx`

**Interfaces:**
- Consume: `GET /api/trabajos/resumen` (Tarea 11), `GET /api/trabajos?tecnicoId=<yo>&orden=entrega` (ya existe).
- Produce: `<SummaryCards />`, `<MyCases />`, `useSummary()`.

**Reglas de UI:** cada tarjeta es un enlace a `/trabajos?vista=<vista>`. «Mis trabajos» solo aparece con rol `tecnico` y nunca muestra precios. A 390 px las tarjetas caben sin scroll horizontal (grid de 2 columnas en móvil, 3 o 6 en escritorio).

- [ ] **Paso 1: tests (RED)**

```tsx
describe('SummaryCards', () => {
  it('muestra un contador por vista y enlaza a su lista', async () => {
    renderWithRouter(<SummaryCards />)
    const nuevos = await screen.findByRole('link', { name: /Nuevos 3/ })
    expect(nuevos).toHaveAttribute('href', expect.stringContaining('vista=nuevos'))
  })

  it('un contador en cero se ve, no se esconde', async () => {
    renderWithRouter(<SummaryCards />)
    expect(await screen.findByRole('link', { name: /Atrasados 0/ })).toBeInTheDocument()
  })
})

describe('MyCases', () => {
  it('lista los trabajos del técnico ordenados por fecha comprometida y sin precios', async () => {
    renderWithRouter(<MyCases />)
    const filas = await screen.findAllByRole('link', { name: /26-000/ })
    expect(filas[0]).toHaveTextContent('26-00002') // el que vence antes
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
  })

  it('marca los trabajos vencidos', async () => {
    renderWithRouter(<MyCases />)
    expect(await screen.findByText('Atrasado')).toBeInTheDocument()
  })

  it('sin trabajos asignados muestra un vacío con texto propio', async () => {
    renderWithRouter(<MyCases />)
    expect(await screen.findByText('No tienes trabajos asignados.')).toBeInTheDocument()
  })
})
```

- [ ] **Paso 2: correr y ver fallar** — Expected: FAIL.

- [ ] **Paso 3: implementar** los componentes y montarlos en `routes/_app/index.tsx` según el rol (`recepcion`/`admin` ven los contadores; `tecnico` ve contadores y «Mis trabajos»). La ruta solo compone: nada de lógica de negocio ahí (`docs/architecture.md` §3.3).

- [ ] **Paso 4: correr y ver pasar** — Expected: PASS.

- [ ] **Paso 5: Chrome** a 1280×800, 390×844 y **360×740** comprobando explícitamente que las tarjetas no provocan scroll horizontal (criterio de INI-1). Capturas.

- [ ] **Paso 6: verificar y commitear**

```bash
pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
git add apps/web/src
git commit -m "feat(web): panel de inicio con contadores del día y mis trabajos

Refs #68 #69"
```

---

### Tarea 13: paginación y combobox con buscador (#56)

**Archivos:**
- Crear: `apps/web/src/components/combobox.tsx` + test
- Modificar: `apps/web/src/features/clinics/clinics-table.tsx`, `apps/web/src/features/products/clinic-prices-table.tsx`, `apps/web/src/features/cases/clinic-patient-fields.tsx`, `case-items-editor.tsx`

**Interfaces:**
- Produce: `<Combobox items={[{ value, label }]} value onChange placeholder searchPlaceholder emptyMessage />`.

**Contexto:** la paginación de Clínicas y Precios especiales ya la da el `DataGrid` — comprueba primero si esas dos tablas ya registran `pagination()` (`docs/data-grid.md`, tabla «qué tabla usa qué feature»); si ya la tienen, esa mitad del issue está hecha y solo hay que decirlo en el reporte. El combobox es lo que falta: los selects de Clínica y Producto crecen y hoy no se pueden buscar.

- [ ] **Paso 1: context7** — confirma la API vigente del primitivo que uses (shadcn `Command` sobre `cmdk`, ya presente en el proyecto o por añadir). Fija la versión en el `catalog:` si añades dependencia.

- [ ] **Paso 2: tests (RED)**

```tsx
describe('Combobox', () => {
  it('filtra las opciones al escribir y selecciona con teclado', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithProviders(<Combobox items={items} value={null} onChange={onChange} placeholder="Clínica" />)
    await user.click(screen.getByRole('combobox', { name: 'Clínica' }))
    await user.type(screen.getByRole('textbox'), 'sonr')
    expect(screen.getAllByRole('option')).toHaveLength(1)
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('c1')
  })

  it('sin coincidencias muestra el mensaje de vacío', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Combobox items={items} value={null} onChange={vi.fn()} placeholder="Clínica" />)
    await user.click(screen.getByRole('combobox', { name: 'Clínica' }))
    await user.type(screen.getByRole('textbox'), 'zzz')
    expect(screen.getByText('Sin resultados')).toBeInTheDocument()
  })

  it('el disparador mide al menos 44 px', async () => {
    renderWithProviders(<Combobox items={items} value={null} onChange={vi.fn()} placeholder="Clínica" />)
    expect(screen.getByRole('combobox')).toHaveClass(expect.stringContaining('h-11'))
  })
})
```

Ajusta la última aserción a como el proyecto exprese los 44 px en sus primitivas (mira `components/ui/button.tsx`); si allí se expresa con otra clase o variable, usa esa y no inventes `h-11`.

- [ ] **Paso 3: implementar** el componente y sustituir los dos selects. Mantén el `<label>` visible y el `aria-label`.

- [ ] **Paso 4: correr y ver pasar**; añade paginación a las tablas que no la tengan.

- [ ] **Paso 5: Chrome** en los tres viewports: buscar una clínica con teclado y con toque; foco visible; el desplegable no se sale de la pantalla a 360 px.

- [ ] **Paso 6: verificar y commitear**

```bash
pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
git add apps/web/src
git commit -m "feat(web): combobox con buscador para clínica y producto, y paginación en configuración

Refs #56"
```

- [ ] **Paso 7: cerrar el PR 2** — revisión final de rama, ola de fixes y PR «Iteración 3 (2/3): panel de inicio y listas» con `Closes #68 #69 #56`.

---

# PR 3 — Orden imprimible, QR, deuda de seguridad y cierre (FIC-1..3 #71–#73, #20, #21, #34)

Rama: `feat/iteracion-3-ficha-qr`. Cierra #71, #72, #73, #20, #21, #34.

### Tarea 14: orden de trabajo imprimible (FIC-1, #71)

**Archivos:**
- Crear: `apps/web/src/routes/_app/trabajos/$caseId_.imprimir.tsx`, `apps/web/src/features/cases/print-order.tsx` + test, `apps/web/src/features/cases/qr-code.tsx` + test
- Modificar: `apps/web/src/index.css` (bloque `@media print`), `apps/web/src/features/cases/case-header.tsx` (botón «Imprimir»)

**Interfaces:**
- Produce: `<PrintOrder case={c} settings={s} hidePrices={b} />`, `<QrCode value={url} size={n} />`.

**Reglas** (spec §5 y criterios de FIC-1): reproduce los bloques de la hoja en papel y **en su orden**: encabezado del laboratorio (nombre, RUC, dirección, teléfono, logo) · código y QR · clínica, doctor y fecha · paciente (referencia, edad, sexo) · odontograma marcado · líneas (producto, cantidad, piezas, precio) · color y sistema · lista de verificación · observaciones. **Sin precios cuando la imprime un técnico o un mensajero.** El QR codifica la URL absoluta de `/t/:code`.

- [ ] **Paso 1: context7 y dependencia del QR**

Confirma con context7 la API vigente de la librería de QR antes de usarla y fija la versión en el `catalog:` de `pnpm-workspace.yaml`. Candidata: `qrcode` (`toString(value, { type: 'svg' })`, sin dependencias de DOM). Si context7 no está disponible, verifica la API contra los `.d.ts` instalados y **dilo en el reporte** para que el revisor lo juzgue.

- [ ] **Paso 2: tests (RED)**

```tsx
describe('PrintOrder', () => {
  it('reproduce los bloques de la orden en papel y en su orden', async () => {
    renderWithProviders(<PrintOrder case={casoCompleto} settings={labSettings} hidePrices={false} />)
    const titulos = (await screen.findAllByRole('heading')).map((h) => h.textContent)
    expect(titulos).toEqual([
      'Arte Dental', 'Trabajo 26-00123', 'Paciente', 'Odontograma', 'Líneas',
      'Color', 'Lista de verificación', 'Observaciones',
    ])
  })

  it('no muestra precios ni el total cuando la imprime un técnico', async () => {
    renderWithProviders(<PrintOrder case={casoCompleto} settings={labSettings} hidePrices />)
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Total/)).not.toBeInTheDocument()
  })

  it('muestra los precios y el total para recepción', async () => {
    renderWithProviders(<PrintOrder case={casoCompleto} settings={labSettings} hidePrices={false} />)
    expect(await screen.findByText('$ 147.00')).toBeInTheDocument()
  })

  it('marca en el odontograma solo las piezas del trabajo', async () => {
    renderWithProviders(<PrintOrder case={casoCompleto} settings={labSettings} hidePrices={false} />)
    expect(await screen.findByTestId('pieza-11')).toHaveAttribute('data-marcada', 'true')
    expect(screen.getByTestId('pieza-21')).toHaveAttribute('data-marcada', 'false')
  })
})

describe('QrCode', () => {
  it('codifica la URL de la ficha corta del trabajo', async () => {
    renderWithProviders(<QrCode value="https://dentalware.ec/t/26-00123" size={96} />)
    const svg = await screen.findByRole('img', { name: /Código QR del trabajo/ })
    expect(svg).toBeInTheDocument()
  })
})
```

Ajusta los títulos esperados a los bloques reales de la orden en papel según la spec §5; si la spec nombra los bloques de otra forma, manda la spec y corriges el test, no al revés.

- [ ] **Paso 3: correr y ver fallar** — Expected: FAIL.

- [ ] **Paso 4: implementar** la vista, el QR y el CSS de impresión (`@media print`: oculta la navegación y el app-shell, fuerza fondo blanco, evita cortes dentro de una línea con `break-inside: avoid`). La ruta usa el layout `_app` pero oculta el shell al imprimir.

- [ ] **Paso 5: correr y ver pasar** — Expected: PASS.

- [ ] **Paso 6: verificar la impresión en Chrome**

Con Chrome DevTools, abre la vista y usa `emulate` + `Emulation.setEmulatedMedia` con `media: 'print'` para ver el resultado real, y comprueba en **A4 y A5** (criterio de FIC-1) que no se corta ningún bloque y que el QR se lee. Capturas en el reporte.

- [ ] **Paso 7: verificar y commitear**

```bash
pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
git add apps/web pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat(web): orden de trabajo imprimible con QR

Refs #71"
```

---

### Tarea 15: ruta corta `/t/:code` con acciones en el puesto (FIC-2 #72, FIC-3 #73)

**Archivos:**
- Crear: `apps/web/src/routes/t.$code.tsx`, `apps/web/src/features/cases/quick-case.tsx` + test
- Modificar: `apps/web/src/features/cases/api.ts`, `apps/web/src/routes/login.tsx`, `apps/api/src/features/cases/{ports,service,repo,routes,cases.test}.ts`

**Interfaces:**
- Produce: `GET /api/trabajos/codigo/:code` → `200 { case }` | 404; ruta web `/t/:code`.

**Reglas:** sin sesión, `beforeLoad` redirige a `/login?redirect=/t/:code` y **vuelve** ahí tras entrar (criterio de FIC-2). Un código inexistente muestra «No encontrado», no un error crudo. La pantalla es móvil primero: código, paciente, fase actual, y dos botones grandes — «Avanzar fase» y «Añadir foto» (cámara, `<input capture>`) — con las mismas reglas y eventos que CIC-2 y TRA-4. Sin precios.

- [ ] **Paso 1: tests (RED)**

API, en `cases.test.ts`:

```ts
describe('GET /api/trabajos/codigo/:code', () => {
  it('devuelve el trabajo por su código', async () => {
    const { code } = await crearTrabajoCompleto()
    const res = await comoTecnico().get(`/api/trabajos/codigo/${code}`)
    expect(res.status).toBe(200)
    expect((await res.json()).case.code).toBe(code)
  })

  it('responde 404 con un código inexistente', async () => {
    expect((await comoTecnico().get('/api/trabajos/codigo/26-99999')).status).toBe(404)
  })

  it('responde 403 sin sesión', async () => {
    const { code } = await crearTrabajoCompleto()
    expect((await sinSesion().get(`/api/trabajos/codigo/${code}`)).status).toBe(403)
  })

  it('no devuelve precios a un técnico', async () => {
    const { code } = await crearTrabajoCompleto()
    const body = await (await comoTecnico().get(`/api/trabajos/codigo/${code}`)).json()
    expect(body.case.total).toBeNull()
    expect(body.case.items.every((i) => i.price === null)).toBe(true)
  })
})
```

Web, en `quick-case.test.tsx`:

```tsx
describe('QuickCase', () => {
  it('muestra código, paciente y fase, y deja avanzar la fase', async () => {
    const user = userEvent.setup()
    renderWithRouter(<QuickCase code="26-00123" />)
    expect(await screen.findByRole('heading', { name: '26-00123' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Avanzar fase' }))
    await waitFor(() => expect(putFase).toHaveBeenCalled())
  })

  it('un código inexistente muestra No encontrado', async () => {
    renderWithRouter(<QuickCase code="26-99999" />)
    expect(await screen.findByText('No encontrado')).toBeInTheDocument()
  })

  it('no muestra precios', async () => {
    renderWithRouter(<QuickCase code="26-00123" />)
    await screen.findByRole('heading', { name: '26-00123' })
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
  })

  it('los dos botones miden al menos 44 px', async () => {
    renderWithRouter(<QuickCase code="26-00123" />)
    for (const nombre of ['Avanzar fase', 'Añadir foto']) {
      expect(await screen.findByRole('button', { name: nombre })).toBeInTheDocument()
    }
  })
})
```

- [ ] **Paso 2: correr y ver fallar** — Expected: FAIL en ambos proyectos.

- [ ] **Paso 3: implementar** el endpoint por código (servicio + repo + ruta, con el mismo enmascarado por rol que `detail`), la ruta web con su `beforeLoad` y el `redirect` de vuelta en `login.tsx`, y el componente.

- [ ] **Paso 4: correr y ver pasar** — Expected: PASS.

- [ ] **Paso 5: E2E `@clave`**

```ts
test('abre un trabajo por su código corto y avanza la fase', { tag: '@clave' }, async ({ page }) => {
  const { clinic, doctor } = await createClinicWithDoctor(page)
  const product = await createProduct(page)
  const trabajo = await createCaseAceptado(page, { clinicId: clinic.id, doctorId: doctor.id, productId: product.id })
  await page.goto(`/t/${trabajo.code}`)
  await expect(page.getByRole('heading', { name: trabajo.code })).toBeVisible()
  await page.getByRole('button', { name: 'Avanzar fase' }).click()
  await expect(page.getByText('Fase actualizada')).toBeVisible()
})
```

Y un segundo test `@clave` que compruebe la vuelta tras el login: `context.clearCookies()`, ir a `/t/:code`, ver el login, entrar y acabar en `/t/:code`.

- [ ] **Paso 6: Chrome** a 390×844 y 360×740 con guantes en mente: botones grandes, sin gestos finos, consola limpia.

- [ ] **Paso 7: verificar y commitear**

```bash
pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
pnpm e2e --project=escritorio --project=android
git add apps
git commit -m "feat(web): ficha corta por código QR con avance de fase y foto

Refs #72 #73"
```

---

### Tarea 16: validar el rol al cruzar la frontera de datos (#21)

**Archivos:**
- Modificar: `apps/api/src/features/auth/session.ts`, `apps/web/src/features/auth/session.ts` y sus tests

**El problema** (del issue): `c.var.user.role` se castea a `UserRole` sin validar, y la web confía en el rol que llega. Un rol desconocido (una fila manipulada, una migración a medias) pasaría silenciosamente y podría caer en la rama permisiva de un `if`.

**Regla:** el rol se valida con el schema de `shared` (`roles.ts`) **en el punto donde cruza la frontera**: al construir el `RequestContext` en la API y al leer la sesión en la web. Un rol desconocido es un error explícito, nunca un permiso.

- [ ] **Paso 1: tests (RED)**

```ts
describe('ctxFrom', () => {
  it('construye el contexto con un rol válido', () => {
    expect(ctxFrom(contextoCon({ id: 'u1', role: 'recepcion' }))).toEqual({ userId: 'u1', role: 'recepcion' })
  })

  it('rechaza un rol desconocido en vez de dejarlo pasar', () => {
    expect(() => ctxFrom(contextoCon({ id: 'u1', role: 'superadmin' }))).toThrow()
  })
})
```

Y en la web, un test de que una sesión con rol desconocido se trata como sin permisos (no como admin).

- [ ] **Paso 2: correr y ver fallar** — Expected: FAIL (hoy el cast lo acepta).

- [ ] **Paso 3: implementar** la validación con el schema de `shared` en ambos lados, devolviendo 403 en la API.

- [ ] **Paso 4: correr y ver pasar**; comprueba que ningún test existente se rompe (los usuarios de prueba usan roles válidos).

- [ ] **Paso 5: verificar y commitear**

```bash
pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
git add apps
git commit -m "fix(api): valida el rol al construir el contexto de la petición

Refs #21"
```

---

### Tarea 17: endurecer login y navegación (#20)

**Archivos:**
- Modificar: `apps/web/src/routes/login.tsx`, `apps/web/src/components/app-shell.tsx` y sus tests

**Del issue:** `aria-invalid` en los campos del login con error, `aria-label` en la navegación, y redirección tras iniciar sesión al destino pedido (`?redirect=`) en vez de siempre a «Inicio» — que además es lo que FIC-2 necesita (Tarea 15).

- [ ] **Paso 1: tests (RED)**

```tsx
describe('Login', () => {
  it('marca los campos con aria-invalid cuando la validación falla', async () => {
    const user = userEvent.setup()
    renderWithRouter(<LoginPage />)
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByLabelText('Correo')).toHaveAttribute('aria-invalid', 'true')
  })

  it('tras entrar vuelve al destino pedido', async () => {
    // con ?redirect=/t/26-00123
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ to: '/t/26-00123' })))
  })

  it('sin destino pedido va a Inicio', async () => {
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ to: '/' })))
  })

  it('un destino externo no se obedece', async () => {
    // ?redirect=https://malo.example — debe ir a '/' y no redirigir fuera
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ to: '/' })))
  })
})

describe('AppShell', () => {
  it('la navegación principal tiene nombre accesible', async () => {
    renderWithRouter(<AppShell />)
    expect(await screen.findByRole('navigation', { name: 'Principal' })).toBeInTheDocument()
  })
})
```

El cuarto test del login es importante: un `redirect` que no sea una ruta interna (empiece por `/` y no por `//`) **no** debe obedecerse.

- [ ] **Paso 2–4:** correr y ver fallar, implementar, correr y ver pasar.

- [ ] **Paso 5: verificar y commitear**

```bash
pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
git add apps/web/src
git commit -m "fix(web): aria-invalid en el login, nombre de la navegación y redirección al destino pedido

Refs #20"
```

---

### Tarea 18: E2E de la iteración y cierre (#34)

**Archivos:**
- Modificar: `apps/web/e2e/trabajos.spec.ts`, `apps/web/e2e/accesibilidad.spec.ts`, `docs/architecture.md`, `docs/conventions.md`

- [ ] **Paso 1: E2E del flujo principal de la iteración** (`@clave`): recepción acepta un trabajo, le asigna técnico, el técnico avanza la fase desde su inicio («Mis trabajos»), recepción lo pausa con motivo y lo reanuda, y lo finaliza. Una sola etiqueta por test.

- [ ] **Paso 2: barrido táctil** en `accesibilidad.spec.ts` (`@extendida`) de las pantallas nuevas: inicio con contadores, ficha con la barra de acciones, `/t/:code`. Toda pantalla nueva entra ahí (`docs/conventions.md` §7).

- [ ] **Paso 3: documentar** en `docs/architecture.md` el ADR de los feriados (decisión 1 del encabezado: `addBusinessDays` con `[]`, calendario de feriados post-MVP) y cualquier convención nueva que haya salido en los rulings de la iteración.

- [ ] **Paso 4: verificación completa**

```bash
pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
pnpm e2e --project=escritorio --project=android
```

- [ ] **Paso 5: issue de revisión UI/UX** (regla 6 de `CLAUDE.md`): crea «Revisión UI/UX de la Iteración 3 con frontend-design» con etiquetas `historia`, `area:web`, hito de la Iteración 4 y el checklist de los tres viewports.

- [ ] **Paso 6: commit y cerrar el PR 3**

```bash
git add apps/web/e2e docs
git commit -m "test(e2e): flujo del ciclo de vida del trabajo y barrido táctil de la iteración

Refs #34"
```

Revisión final de rama, ola de fixes y PR «Iteración 3 (3/3): orden imprimible, QR y cierre» con `Closes #71 #72 #73 #20 #21 #34`.

---

## Autorrevisión (hecha al escribir el plan)

- **Cobertura de las historias**: CIC-1 → T3 (readiness documentada), T4 (aceptar con días hábiles y fase inicial), T5 (422 con detalle), T8 (botón deshabilitado con lo que falta). CIC-2 → T2 (reglas de fase), T6 (avanzar/retroceder/finalizar, bloqueo en espera y prueba), T9 (control en la ficha). CIC-3 → T1 (`case_tryins`), T4 (pausar/reanudar/prueba con motivo), T8. CIC-4 → T3 (`remakeSchema`), T7 (hijo con líneas y odontograma, evento en ambas fichas), T9. CIC-5 → T6 (solo técnicos activos, evento con antes y después), T9, y la lista del técnico en T12. INI-1 → T10 (vista `en_prueba`), T11 (resumen, probado contra el total de cada vista), T12 (tarjetas a 360 px). INI-2 → T12. FIC-1 → T14. FIC-2 → T15 + T17 (la redirección con destino). FIC-3 → T15. #56 → T13. #21 → T16. #20 → T17. #34 → T18.
- **Sin marcadores de posición**: cada paso trae el código o el comando concreto. Donde el plan no puede saber un nombre real del repo (helpers de test, scripts de drizzle, la clase de 44 px) lo dice explícitamente y manda comprobarlo en el código, en vez de inventarlo.
- **Consistencia de nombres**: `action` / `changeStage` / `assignTechnician` / `createRemake` / `summary` en el servicio; `caseActionSchema` / `stageChangeSchema` / `assignTechnicianSchema` / `remakeSchema` en shared; `firstStage` / `nextStage` / `previousStage` / `isLastStage` en `stages.ts`; rutas `POST /:id/acciones`, `PUT /:id/fase`, `PUT /:id/tecnico`, `POST /:id/repetir`, `GET /resumen`, `GET /codigo/:code`. Los mismos nombres se usan en las tareas que los consumen.
- **Riesgo mayor**: la Tarea 7 (repetición) copia líneas y odontograma, y es la única que escribe dos entidades en una transacción con datos derivados del padre. Si algo se complica, es ahí.
