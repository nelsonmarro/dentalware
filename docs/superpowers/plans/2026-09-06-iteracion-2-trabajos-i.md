# Iteración 2 — Trabajos I: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Every task starts by invoking `superpowers:test-driven-development`** (regla de Nelson del 2026-09-05): test que falla → implementación mínima → refactor.

**Goal:** Crear, editar, listar y consultar trabajos del laboratorio con odontograma FDI, líneas de producto con precio automático por clínica, lista de verificación de la orden en papel, fotos y comentarios, e importación desde una plantilla CSV; con la capa de tests unitarios del frontend montada y todo cubierto por pruebas.

**Architecture:** La feature `cases` vive en `apps/api/src/features/cases/` (tablas `cases`, `case_items`, `case_events`, `case_sequences`; repo transaccional que genera el código `AA-NNNNN`, resuelve precios por clínica y escribe eventos; rutas Hono `/api/trabajos`) y `apps/api/src/features/attachments/` (tabla `attachments`, adaptador de almacenamiento con driver de disco local y procesamiento de imágenes con `sharp`; rutas `/api/adjuntos`). En `packages/shared` se añaden los schemas zod de trabajos, los helpers de dinero en centavos, la lista de datos obligatorios para aceptar y un parser CSV. En `apps/web/src/features/cases/` van la lista con vistas rápidas y chips de estado, el odontograma, el formulario de trabajo (página completa), la ficha con pestañas y la importación; las rutas `routes/_app/trabajos*.tsx` solo componen features. Los precios nunca llegan a `tecnico` ni `mensajero`: la API devuelve `null` en `unitPrice`, `lineTotal`, `discountPct` y `total` para esos roles.

**Tech Stack:** pnpm 11.25 · Node 24 · TypeScript 6.0.3 · Hono 4.13.5 + @hono/zod-validator 0.9.1 · Drizzle ORM/Kit 1.0.0-rc.4 · pg 8.23 · Better Auth 1.7.2 · zod 4.5.4 · sharp 0.35.4 · React 19.2 · TanStack Router 1.170 / Query 5.102 · react-hook-form 7.87 · Tailwind 4.3 + shadcn 4.19 · Vitest 4.1.11 · **nuevos (verificados el 2026-09-06 en npm y context7):** `@testing-library/react 16.3.3`, `@testing-library/dom 10.4.1`, `@testing-library/jest-dom 7.0.1`, `@testing-library/user-event 14.6.7`, `jsdom 30.0.1`.

**Spec:** `docs/superpowers/specs/2026-09-01-dentalware-mvp-design.md` (§4 modelo de datos, §5 ciclo de vida y orden en papel e importación, §6 pantallas 3-5, §7 datos obligatorios, §8 pruebas, §10 iteración 2) y `docs/superpowers/specs/2026-09-01-dentalware-design-direction.md` (§4 pestaña de color del ticket, odontograma). Issues: épica #3, épica de pruebas #29 (#31 harness web, #33 E2E de la iteración), hito "Iteración 2 — Trabajos I".

## Global Constraints

- **TDD obligatorio** (Nelson, 2026-09-05): cada tarea invoca `superpowers:test-driven-development` antes de escribir código; el test va primero (RED), luego la implementación mínima (GREEN), luego refactor. Ninguna tarea se cierra sin su prueba; el revisor marca como *Important* el código sin test. Capas: shared → Vitest; api → Vitest contra Postgres real (`dentalware_test`, 5433); web → Vitest + jsdom + Testing Library (desde la Tarea 1); flujos → Playwright (`escritorio` y `android` en local; `iphone` en CI).
- **context7 antes de instalar o usar una librería** (regla de alta prioridad). Los únicos paquetes nuevos de la iteración son los de Testing Library y jsdom (Tarea 1). No se añaden librerías para CSV, compresión de imágenes en cliente, odontograma ni selector de fechas: se escriben a mano y se prueban.
- **Organización por features**: `apps/api/src/features/<feature>/{schema.ts,repo.ts,routes.ts,*.test.ts}` y `apps/web/src/features/<feature>/{api.ts,use-*.ts,*.tsx,*.test.tsx}`. Un componente o hook por archivo; las rutas (`routes/`) solo importan de `features/` y `components/`. Componentes transversales nuevos en `apps/web/src/components/`.
- TypeScript `strict`, ESM; UI, validación y commits en **español**, sentence case. Tablas plural snake_case, ids `uuid` salvo auth (text), `created_at`/`updated_at` con zona horaria.
- Roles: crear/editar trabajos e importar: `admin | recepcion`. Ver lista, ficha, historial, comentar y subir fotos: cualquier rol con sesión. Borrar adjuntos: `admin | recepcion`. **Precios nunca a `tecnico` ni `mensajero`** (la API devuelve `null` en `unitPrice`, `lineTotal`, `discountPct`, `total`).
- Dinero: cadenas `'12.50'` en la API y en la base (`numeric`), aritmética en centavos enteros (`packages/shared/src/money.ts`), redondeo half-up.
- Estados en esta iteración: los trabajos se crean en `nuevo`; la máquina de estados no cambia (se amplía en la Iteración 3). Solo se editan trabajos en `nuevo` o `en_proceso`; el resto responde 409.
- Validación: `validate()` con 422 `{ message: 'Datos inválidos', issues }`; transición o estado inválido → 409; no encontrado → 404. Toda mutación de un trabajo escribe su `case_event` en la misma transacción.
- Archivos: adaptador `Storage` con driver de disco local (`UPLOAD_DIR`, por defecto `./data/uploads`; en producción el compose ya monta `/data/uploads`). Imágenes: máximo 25 MB, tipos `image/jpeg|png|webp` y `application/pdf`; las imágenes se re-codifican (rotación EXIF, ≤1600 px, JPEG q82) y llevan miniatura WebP de 320 px. Driver S3/R2 fuera de esta iteración (issue aparte; Nelson decide proveedor).
- Nada de `drizzle-kit push`; migraciones con `pnpm --filter @dentalware/api db:generate` y aplicadas por `runMigrations()`. `truncateAll` se amplía con las tablas nuevas.
- Cada tarea de UI se verifica en Chrome DevTools (1280×800 y 390×844: flujo, capturas, consola sin errores) y respeta la dirección de diseño: pestaña de 4 px del color de estado en filas y tarjetas, código en `font-mono`, chip + texto para estados, targets ≥ 44 px en controles nuevos, `aria-label` en botones de solo icono, foco visible.
- Commits pequeños en español con prefijo convencional y `Refs #N` (épica #3; #31 y #33 para tests; #29 para el harness), trailers `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` y `Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi`. Pre-commit: lint-staged + typecheck (Node 24: `export PATH=$HOME/.nvm/versions/node/v24.19.0/bin:$PATH`).
- Entorno: Postgres dev en Docker (5433, `pnpm db:up`); puertos 3000/5173 libres al terminar cada tarea; Playwright arranca la API con `NODE_ENV=test`.

---

## Estructura de archivos resultante

```
packages/shared/src/
  money.ts, money.test.ts                       ← Task 2: centavos, totales de línea y de trabajo
  case-events.ts                                ← Task 2: CASE_EVENT_TYPES
  schemas/cases.ts, schemas/cases.test.ts       ← Task 2: caseInputSchema, caseItemSchema, caseListQuerySchema, commentSchema, checklist
  case-readiness.ts, case-readiness.test.ts     ← Task 2: missingForAccept()
  csv.ts, csv.test.ts                           ← Task 11: parseCsv / toCsv
  schemas/import.ts, schemas/import.test.ts     ← Task 11: importRowSchema, IMPORT_COLUMNS
apps/api/src/
  config.ts                                     ← Task 6: UPLOAD_DIR
  lib/storage.ts, lib/storage.test.ts           ← Task 6: Storage + LocalStorage
  lib/images.ts, lib/images.test.ts             ← Task 6: normalizeImage(), makeThumbnail()
  features/cases/schema.ts                      ← Task 3: cases, case_items, case_events, case_sequences (+ enums)
  features/cases/repo.ts, cases.repo.test.ts    ← Task 4: nextCaseCode, createCase, updateCase, getCase, listCases, addComment
  features/cases/routes.ts, cases.test.ts       ← Task 5: /api/trabajos
  features/cases/import.ts, import.test.ts      ← Task 11: importCases() + rutas /api/trabajos/importar
  features/attachments/schema.ts                ← Task 3
  features/attachments/repo.ts, routes.ts, attachments.test.ts  ← Task 6: /api/adjuntos
  db/relations.ts, db/schema/index.ts           ← Task 3
  test/setup.ts                                 ← Task 3 (truncateAll) y Task 6 (storage temporal)
  drizzle/<ts>_<name>/                          ← Task 3: migración
apps/web/
  vitest.config.ts, src/test/setup.ts, src/test/render.tsx, src/test/match-media.ts   ← Task 1
  src/components/*.test.tsx, src/lib/use-media-query.test.ts                          ← Task 1
  src/lib/query-keys.ts                         ← Task 7 (claves de trabajos)
  src/lib/image-compress.ts (+test)             ← Task 10
  src/features/cases/api.ts                     ← Task 7
  src/features/cases/use-cases.ts               ← Task 7
  src/features/cases/status-chip.tsx (+test)    ← Task 7
  src/features/cases/case-views.ts (+test)      ← Task 7: etiquetas de vistas rápidas
  src/features/cases/cases-table.tsx (+test)    ← Task 7
  src/features/cases/cases-filters.tsx          ← Task 7
  src/features/cases/odontogram.tsx (+test)     ← Task 8
  src/features/cases/teeth-dialog.tsx           ← Task 8
  src/features/cases/case-form.tsx (+test)      ← Task 9
  src/features/cases/case-items-editor.tsx      ← Task 9
  src/features/cases/checklist-field.tsx        ← Task 9
  src/features/cases/case-totals.ts (+test)     ← Task 9
  src/features/cases/case-header.tsx            ← Task 10
  src/features/cases/case-detail-tab.tsx        ← Task 10
  src/features/cases/case-history.tsx (+test)   ← Task 10
  src/features/cases/comment-form.tsx           ← Task 10
  src/features/cases/photos-tab.tsx, photo-uploader.tsx (+test), use-attachments.ts, attachments-api.ts  ← Task 10
  src/features/cases/import-dialog.tsx (+test), use-import.ts  ← Task 11
  src/routes/_app/trabajos.tsx (layout) / trabajos/index.tsx / trabajos/nuevo.tsx / trabajos/$caseId.tsx / trabajos/$caseId.editar.tsx  ← Tasks 7, 9, 10
  e2e/trabajos.spec.ts, e2e/fixtures/foto.png   ← Task 12
README.md                                       ← Task 12
```

---

### Task 1: Harness de tests unitarios del frontend (Refs #31, #29)

**Files:**
- Create: `apps/web/vitest.config.ts`, `apps/web/src/test/setup.ts`, `apps/web/src/test/render.tsx`, `apps/web/src/test/match-media.ts`, `apps/web/src/components/empty-state.test.tsx`, `apps/web/src/components/active-badge.test.tsx`, `apps/web/src/components/confirm-dialog.test.tsx`, `apps/web/src/components/data-table.test.tsx`, `apps/web/src/lib/use-media-query.test.ts`
- Modify: `pnpm-workspace.yaml` (catalog), `apps/web/package.json` (devDependencies + script `test`), `vitest.config.ts` (raíz: añadir el proyecto web), `apps/web/tsconfig.json` (types de vitest/jest-dom)

**Interfaces:**
- Produces: `renderWithProviders(ui)` (QueryClientProvider con `retry: false`), `setMatchMedia(matches: boolean)` para simular escritorio/móvil, matchers de jest-dom en todos los tests web, `pnpm --filter @dentalware/web test`.

- [ ] **Step 1: Consultar context7 y fijar versiones**

Verificado el 2026-09-06: `@testing-library/react` 16.3.3 (peer `@testing-library/dom ^10`, React 18/19), `@testing-library/jest-dom` 7.0.1 (`import '@testing-library/jest-dom/vitest'`), `@testing-library/user-event` 14.6.7, `jsdom` 30.0.1. Añadir al `catalog:` de `pnpm-workspace.yaml`:

```yaml
  # web tests
  '@testing-library/react': 16.3.3
  '@testing-library/dom': 10.4.1
  '@testing-library/jest-dom': 7.0.1
  '@testing-library/user-event': 14.6.7
  jsdom: 30.0.1
```

y en `apps/web/package.json` (devDependencies con `catalog:` los cinco) más el script `"test": "vitest run"`. Instalar con `pnpm install`.

- [ ] **Step 2: Configuración**

`apps/web/vitest.config.ts`:
```ts
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  test: {
    name: 'web',
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
```

`apps/web/src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { setMatchMedia } from './match-media'

setMatchMedia(true) // escritorio por defecto
afterEach(() => cleanup())
```

`apps/web/src/test/match-media.ts`:
```ts
import { vi } from 'vitest'

/** Simula window.matchMedia: `matches` indica si el media query de escritorio coincide. */
export function setMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>()
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  return { notify: () => listeners.forEach((cb) => cb()) }
}
```

`apps/web/src/test/render.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'

export function renderWithProviders(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return {
    user: userEvent.setup(),
    client,
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
  }
}
```

Raíz `vitest.config.ts`: `projects: ['packages/*/vitest.config.ts', 'apps/api/vitest.config.ts', 'apps/web/vitest.config.ts']`. En `apps/web/tsconfig.json` añadir `"vitest/globals"` no (no se usan globals); añadir `"@testing-library/jest-dom"` a `types` para que `toBeInTheDocument` tipe en los tests.

- [ ] **Step 3: Tests de los componentes transversales (RED → GREEN)**

`apps/web/src/components/empty-state.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from './empty-state'

describe('EmptyState', () => {
  it('muestra título, descripción y acción', () => {
    render(<EmptyState title="Sin datos" description="Nada aquí" action={<button>Crear</button>} />)
    expect(screen.getByText('Sin datos')).toBeInTheDocument()
    expect(screen.getByText('Nada aquí')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear' })).toBeInTheDocument()
  })
})
```

`apps/web/src/components/active-badge.test.tsx`: `ActiveBadge active` → texto "Activo"; `active={false}` → "Inactivo".

`apps/web/src/components/confirm-dialog.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './confirm-dialog'

describe('ConfirmDialog', () => {
  it('llama onConfirm al confirmar y muestra Guardando… cuando pending', async () => {
    const onConfirm = vi.fn()
    const { rerender } = render(
      <ConfirmDialog open onOpenChange={() => {}} title="¿Bloquear?" description="Se cerrará la sesión." confirmLabel="Bloquear" onConfirm={onConfirm} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Bloquear' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    rerender(
      <ConfirmDialog open onOpenChange={() => {}} title="¿Bloquear?" description="Se cerrará la sesión." confirmLabel="Bloquear" onConfirm={onConfirm} pending />,
    )
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
  })
})
```

`apps/web/src/components/data-table.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { DataTable } from './data-table'

const rows = [{ id: '1', name: 'Zirconio' }, { id: '2', name: 'Acrílico' }]
const columns = [{ key: 'name', header: 'Producto', cell: (r: (typeof rows)[number]) => r.name }]

describe('DataTable', () => {
  it('en escritorio renderiza una tabla y ninguna tarjeta', () => {
    setMatchMedia(true)
    render(<DataTable rows={rows} columns={columns} getRowId={(r) => r.id} emptyMessage="Vacío" renderMobile={(r) => <span data-testid="card">{r.name}</span>} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.queryAllByTestId('card')).toHaveLength(0)
    expect(screen.getAllByText('Zirconio')).toHaveLength(1)
  })
  it('en móvil renderiza tarjetas y ninguna tabla', () => {
    setMatchMedia(false)
    render(<DataTable rows={rows} columns={columns} getRowId={(r) => r.id} emptyMessage="Vacío" renderMobile={(r) => <span data-testid="card">{r.name}</span>} />)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('card')).toHaveLength(2)
  })
  it('muestra el estado vacío con su acción', () => {
    render(<DataTable rows={[]} columns={columns} getRowId={(r) => r.id} emptyMessage="Aún no hay filas" emptyAction={<button>Crear</button>} renderMobile={() => null} />)
    expect(screen.getByText('Aún no hay filas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear' })).toBeInTheDocument()
  })
})
```

`apps/web/src/lib/use-media-query.test.ts`: `renderHook(() => useMediaQuery('(min-width: 1024px)'))` devuelve `true` con `setMatchMedia(true)`, y cambia a `false` tras `setMatchMedia(false)` + `act(() => notify())` (re-render por `useSyncExternalStore`; usar el `notify` devuelto por el primer `setMatchMedia` y hacer que el mock lea `matches` de una variable mutable, ajustando `match-media.ts` si hace falta para que el mismo mock cambie de valor).

- [ ] **Step 4: Ejecutar y commit**

```bash
pnpm --filter @dentalware/web test      # 5 archivos, ≥ 9 tests
pnpm test                                # shared + api + web
pnpm typecheck && pnpm lint && pnpm format:check
git add pnpm-workspace.yaml pnpm-lock.yaml apps/web vitest.config.ts
git commit -m "test(web): harness de Vitest + Testing Library y tests de componentes transversales

Refs #31, #29"
```

---

### Task 2: Shared — schemas de trabajos, dinero y datos obligatorios (Refs #3)

**Files:**
- Create: `packages/shared/src/money.ts`, `money.test.ts`, `case-events.ts`, `schemas/cases.ts`, `schemas/cases.test.ts`, `case-readiness.ts`, `case-readiness.test.ts`
- Modify: `packages/shared/src/index.ts` (exports), `packages/shared/src/schemas/config.ts` (exportar `textoOpcional` y `uuid`)

**Interfaces:**
- Produces: `toCents('12.50') → 1250`, `fromCents(1250) → '12.50'`, `lineTotalCents(unitCents, quantity, discountPct)`, `sumCents(number[])`; `CASE_PRIORITIES`, `PATIENT_SEXES`, `SHADE_SYSTEMS`, `CHECKLIST_KEYS`, `CHECKLIST_LABEL`, `CASE_VIEWS`, `CASE_PAGE_SIZE = 50`, `CASE_EVENT_TYPES`; `caseItemSchema`, `caseInputSchema` (`CaseInput`), `caseListQuerySchema` (`CaseListQuery`), `commentSchema`, `checklistSchema` (`Checklist`); `missingForAccept(input): string[]`.

- [ ] **Step 1: Tests de dinero (RED)**

`packages/shared/src/money.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { fromCents, lineTotalCents, sumCents, toCents } from './money.ts'

describe('money', () => {
  it('convierte cadenas a centavos y de vuelta', () => {
    expect(toCents('12.50')).toBe(1250)
    expect(toCents('7')).toBe(700)
    expect(toCents('0.05')).toBe(5)
    expect(fromCents(1250)).toBe('12.50')
    expect(fromCents(5)).toBe('0.05')
    expect(fromCents(0)).toBe('0.00')
  })
  it('rechaza cadenas inválidas', () => {
    expect(() => toCents('12,50')).toThrow()
    expect(() => toCents('abc')).toThrow()
    expect(() => toCents('1.234')).toThrow()
  })
  it('calcula el total de línea con descuento y redondeo half-up', () => {
    expect(lineTotalCents(4500, 2, 0)).toBe(9000)
    expect(lineTotalCents(4500, 1, 10)).toBe(4050)
    expect(lineTotalCents(1001, 1, 50)).toBe(501) // 500.5 → 501
    expect(lineTotalCents(333, 3, 33.33)).toBe(666) // 999 × 0.6667 = 666.03
  })
  it('suma centavos', () => {
    expect(sumCents([100, 250, 5])).toBe(355)
    expect(sumCents([])).toBe(0)
  })
})
```

- [ ] **Step 2: Implementar `money.ts` (GREEN)**

```ts
const MONEY = /^\d{1,10}(\.\d{1,2})?$/

export function toCents(value: string): number {
  if (!MONEY.test(value)) throw new Error(`Monto inválido: ${value}`)
  const [int, dec = ''] = value.split('.')
  return Number(int) * 100 + Number((dec + '00').slice(0, 2))
}

export function fromCents(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) throw new Error(`Centavos inválidos: ${cents}`)
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

/** quantity × unit × (1 − discount%) en centavos, redondeo half-up. */
export function lineTotalCents(unitCents: number, quantity: number, discountPct: number): number {
  const gross = unitCents * quantity
  const factor = 1 - discountPct / 100
  return Math.floor(gross * factor + 0.5)
}

export function sumCents(list: readonly number[]): number {
  return list.reduce((a, b) => a + b, 0)
}
```

- [ ] **Step 3: Tipos de evento**

`packages/shared/src/case-events.ts`:
```ts
export const CASE_EVENT_TYPES = [
  'created', 'status_changed', 'stage_changed', 'assigned', 'hold', 'resumed', 'tryin_sent',
  'tryin_returned', 'comment', 'attachment_added', 'attachment_removed', 'shipped', 'delivered',
  'cancelled', 'remake_created', 'edited', 'price_changed',
] as const
export type CaseEventType = (typeof CASE_EVENT_TYPES)[number]
```

- [ ] **Step 4: Tests de schemas (RED)**

`packages/shared/src/schemas/cases.test.ts` — casos mínimos:
```ts
import { describe, expect, it } from 'vitest'
import { caseInputSchema, caseListQuerySchema, commentSchema } from './cases.ts'

const clinicId = '11111111-1111-4111-8111-111111111111'
const doctorId = '22222222-2222-4222-8222-222222222222'
const productId = '33333333-3333-4333-8333-333333333333'
const base = () => ({
  clinicId, doctorId, patientRef: '  Paciente 12 ', receivedAt: '2026-09-06',
  items: [{ productId, quantity: 1, teeth: [12, 11] }],
})

describe('caseInputSchema', () => {
  it('acepta un trabajo mínimo, aplica valores por defecto y normaliza', () => {
    const r = caseInputSchema.parse(base())
    expect(r.patientRef).toBe('Paciente 12')
    expect(r.priority).toBe('normal')
    expect(r.checklist).toEqual({ antagonista: false, mordida: false, color: false, fotos: false })
    expect(r.items[0]).toMatchObject({ quantity: 1, discountPct: 0, teeth: [11, 12], unitPrice: null })
    expect(r.dueDate).toBeNull()
    expect(r.shade).toBeNull()
  })
  it('rechaza sin líneas, piezas inválidas, cantidad 0 y descuento > 100', () => {
    expect(caseInputSchema.safeParse({ ...base(), items: [] }).success).toBe(false)
    expect(caseInputSchema.safeParse({ ...base(), items: [{ productId, quantity: 1, teeth: [19] }] }).success).toBe(false)
    expect(caseInputSchema.safeParse({ ...base(), items: [{ productId, quantity: 0 }] }).success).toBe(false)
    expect(caseInputSchema.safeParse({ ...base(), items: [{ productId, quantity: 1, discountPct: 101 }] }).success).toBe(false)
  })
  it('mensajes en español', () => {
    const r = caseInputSchema.safeParse({ ...base(), patientRef: '', items: [] })
    const msgs = r.success ? [] : r.error.issues.map((i) => i.message)
    expect(msgs).toContain('La referencia del paciente es obligatoria')
    expect(msgs).toContain('Agrega al menos una línea de trabajo')
  })
  it('acepta unitPrice explícito y fechas ISO', () => {
    const r = caseInputSchema.parse({ ...base(), dueDate: '2026-09-15', items: [{ productId, quantity: 2, unitPrice: '40.00' }] })
    expect(r.items[0]!.unitPrice).toBe('40.00')
    expect(r.dueDate).toBe('2026-09-15')
    expect(caseInputSchema.safeParse({ ...base(), dueDate: '15/09/2026' }).success).toBe(false)
  })
})

describe('caseListQuerySchema', () => {
  it('valores por defecto y coerción de página', () => {
    expect(caseListQuerySchema.parse({})).toEqual({ vista: 'todos', pagina: 1 })
    expect(caseListQuerySchema.parse({ pagina: '3', vista: 'atrasados' })).toMatchObject({ pagina: 3, vista: 'atrasados' })
    expect(caseListQuerySchema.safeParse({ vista: 'x' }).success).toBe(false)
  })
})

describe('commentSchema', () => {
  it('exige texto', () => {
    expect(commentSchema.safeParse({ text: '   ' }).success).toBe(false)
    expect(commentSchema.parse({ text: ' hola ' })).toEqual({ text: 'hola' })
  })
})
```

- [ ] **Step 5: Implementar `schemas/cases.ts` (GREEN)**

Primero, en `schemas/config.ts`, exportar los helpers `textoOpcional` y `uuid` (añadir `export` delante; sin cambiar su comportamiento).

```ts
import { z } from 'zod'
import { CASE_STATUSES } from '../case-status.ts'
import { fdiTeethSchema } from '../fdi.ts'
import { priceString, textoOpcional, uuid } from './config.ts'

export const CASE_PRIORITIES = ['normal', 'urgente'] as const
export type CasePriority = (typeof CASE_PRIORITIES)[number]
export const PATIENT_SEXES = ['M', 'F'] as const
export type PatientSex = (typeof PATIENT_SEXES)[number]
export const SHADE_SYSTEMS = ['vita_classical', 'vita_3d_master', 'otro'] as const
export type ShadeSystem = (typeof SHADE_SYSTEMS)[number]
export const SHADE_SYSTEM_LABEL: Record<ShadeSystem, string> = {
  vita_classical: 'VITA Classical', vita_3d_master: 'VITA 3D-Master', otro: 'Otro',
}
export const CHECKLIST_KEYS = ['antagonista', 'mordida', 'color', 'fotos'] as const
export type ChecklistKey = (typeof CHECKLIST_KEYS)[number]
export const CHECKLIST_LABEL: Record<ChecklistKey, string> = {
  antagonista: 'Antagonista', mordida: 'Mordida', color: 'Color', fotos: 'Fotos',
}
export const CASE_VIEWS = ['nuevos', 'en_curso', 'vencen_hoy', 'atrasados', 'listos', 'todos'] as const
export type CaseView = (typeof CASE_VIEWS)[number]
export const CASE_PAGE_SIZE = 50

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Fecha inválida (AAAA-MM-DD)' })
const nullable = <T extends z.ZodTypeAny>(s: T) => s.nullish().transform((v) => v ?? null)

export const checklistSchema = z
  .object({
    antagonista: z.boolean(), mordida: z.boolean(), color: z.boolean(), fotos: z.boolean(),
  })
  .default({ antagonista: false, mordida: false, color: false, fotos: false })
export type Checklist = z.infer<typeof checklistSchema>

export const caseItemSchema = z.object({
  productId: uuid,
  description: textoOpcional(200),
  quantity: z.coerce
    .number({ error: 'Cantidad inválida' })
    .int({ error: 'Cantidad inválida' })
    .min(1, { error: 'La cantidad mínima es 1' })
    .max(99, { error: 'La cantidad máxima es 99' }),
  teeth: fdiTeethSchema.default([]),
  unitPrice: nullable(priceString), // null → la API resuelve el precio de la clínica
  discountPct: z.coerce
    .number({ error: 'Descuento inválido' })
    .min(0, { error: 'El descuento no puede ser negativo' })
    .max(100, { error: 'El descuento máximo es 100 %' })
    .default(0),
  material: textoOpcional(120),
  notes: textoOpcional(500),
})
export type CaseItemInput = z.infer<typeof caseItemSchema>

export const caseInputSchema = z.object({
  clinicId: uuid,
  doctorId: uuid,
  patientRef: z
    .string()
    .trim()
    .min(1, { error: 'La referencia del paciente es obligatoria' })
    .max(120, { error: 'Máximo 120 caracteres' }),
  patientAge: nullable(z.coerce.number().int().min(0).max(120)),
  patientSex: nullable(z.enum(PATIENT_SEXES)),
  boxNumber: textoOpcional(30),
  priority: z.enum(CASE_PRIORITIES).default('normal'),
  receivedAt: isoDate,
  dueDate: nullable(isoDate),
  shade: textoOpcional(30),
  shadeSystem: nullable(z.enum(SHADE_SYSTEMS)),
  reference: textoOpcional(120),
  checklist: checklistSchema,
  observations: textoOpcional(2000),
  prescription: textoOpcional(2000),
  internalNotes: textoOpcional(2000),
  assignedTechnicianId: nullable(z.string().min(1)),
  items: z.array(caseItemSchema).min(1, { error: 'Agrega al menos una línea de trabajo' }),
})
export type CaseInput = z.infer<typeof caseInputSchema>

export const caseListQuerySchema = z.object({
  vista: z.enum(CASE_VIEWS).default('todos'),
  estado: z.enum(CASE_STATUSES).optional(),
  clinicId: uuid.optional(),
  doctorId: uuid.optional(),
  tecnicoId: z.string().min(1).optional(),
  q: z.string().trim().max(60).optional(),
  desde: isoDate.optional(),
  hasta: isoDate.optional(),
  pagina: z.coerce.number().int().min(1).default(1),
})
export type CaseListQuery = z.infer<typeof caseListQuerySchema>

export const commentSchema = z.object({
  text: z.string().trim().min(1, { error: 'Escribe un comentario' }).max(2000, { error: 'Máximo 2000 caracteres' }),
})
export type CommentInput = z.infer<typeof commentSchema>
```

- [ ] **Step 6: Datos obligatorios para aceptar (RED → GREEN)**

`packages/shared/src/case-readiness.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { missingForAccept } from './case-readiness.ts'

const ok = () => ({
  clinicId: 'c', doctorId: 'd', patientRef: 'P1', dueDate: '2026-09-15', shade: 'A2',
  prescription: 'Corona', hasPrescriptionDocument: false,
  checklist: { antagonista: true, mordida: true, color: true, fotos: false },
  items: [{ pricingUnit: 'por_pieza' as const, teeth: [11] }],
})

describe('missingForAccept', () => {
  it('no falta nada en un trabajo completo', () => {
    expect(missingForAccept(ok())).toEqual([])
  })
  it('lista lo que falta en español', () => {
    expect(missingForAccept({ ...ok(), doctorId: null, patientRef: '', dueDate: null })).toEqual([
      'Doctor', 'Referencia del paciente', 'Fecha deseada',
    ])
  })
  it('exige piezas en líneas por pieza, no en arcada ni trabajo', () => {
    expect(missingForAccept({ ...ok(), items: [{ pricingUnit: 'por_pieza', teeth: [] }] })).toEqual(['Piezas de la línea 1'])
    expect(missingForAccept({ ...ok(), items: [{ pricingUnit: 'por_arcada', teeth: [] }] })).toEqual([])
    expect(missingForAccept({ ...ok(), items: [] })).toEqual(['Al menos una línea de trabajo'])
  })
  it('acepta prescripción en texto o como documento adjunto', () => {
    expect(missingForAccept({ ...ok(), prescription: null })).toEqual(['Prescripción (texto o documento)'])
    expect(missingForAccept({ ...ok(), prescription: null, hasPrescriptionDocument: true })).toEqual([])
  })
  it('exige color cuando el trabajo lo requiere', () => {
    expect(missingForAccept({ ...ok(), shade: null, requiresShade: true })).toEqual(['Color'])
    expect(missingForAccept({ ...ok(), shade: null })).toEqual([])
  })
})
```

`packages/shared/src/case-readiness.ts`:
```ts
import type { PricingUnit } from './schemas/config.ts'

export type ReadinessInput = {
  clinicId: string | null
  doctorId: string | null
  patientRef: string | null
  dueDate: string | null
  shade: string | null
  prescription: string | null
  hasPrescriptionDocument: boolean
  requiresShade?: boolean
  checklist: { antagonista: boolean; mordida: boolean; color: boolean; fotos: boolean }
  items: { pricingUnit: PricingUnit; teeth: readonly number[] }[]
}

/** Datos obligatorios para Aceptar (spec §7). Devuelve etiquetas en español de lo que falta. */
export function missingForAccept(c: ReadinessInput): string[] {
  const missing: string[] = []
  if (!c.clinicId) missing.push('Clínica')
  if (!c.doctorId) missing.push('Doctor')
  if (!c.patientRef?.trim()) missing.push('Referencia del paciente')
  if (c.items.length === 0) missing.push('Al menos una línea de trabajo')
  c.items.forEach((it, i) => {
    if (it.pricingUnit === 'por_pieza' && it.teeth.length === 0) missing.push(`Piezas de la línea ${i + 1}`)
  })
  if (!c.dueDate) missing.push('Fecha deseada')
  if (c.requiresShade && !c.shade?.trim()) missing.push('Color')
  if (!c.prescription?.trim() && !c.hasPrescriptionDocument) missing.push('Prescripción (texto o documento)')
  return missing
}
```
(La lista de verificación de la orden en papel no bloquea: lo no marcado queda registrado como pendiente y se muestra en la ficha; los avisos a la clínica llegan en la Iteración 6.)

- [ ] **Step 7: Exportar, ejecutar y commit**

`index.ts`: añadir `export * from './money.ts'`, `'./case-events.ts'`, `'./schemas/cases.ts'`, `'./case-readiness.ts'`.

```bash
pnpm --filter @dentalware/shared test   # +≈20 tests
pnpm --filter @dentalware/shared build
git add packages/shared && git commit -m "feat(shared): schemas de trabajos, dinero en centavos, tipos de evento y datos obligatorios para aceptar

Refs #3"
```

---

### Task 3: API — tablas de trabajos y adjuntos, relaciones y migración (Refs #3)

**Files:**
- Create: `apps/api/src/features/cases/schema.ts`, `apps/api/src/features/attachments/schema.ts`, migración `apps/api/drizzle/<ts>_<name>/`
- Modify: `apps/api/src/db/schema/index.ts`, `apps/api/src/db/relations.ts`, `apps/api/src/test/setup.ts` (`truncateAll`), `apps/api/src/db/schema.test.ts`

**Interfaces:**
- Produces: tablas `cases`, `case_items`, `case_events`, `case_sequences`, `attachments`; enums `case_status`, `case_priority`, `patient_sex`, `shade_system`, `case_event_type`, `attachment_kind`; relaciones `cases.{clinic,doctor,technician,stage,creator,items,events,attachments}`, `caseItems.{case,product}`, `caseEvents.{case,actor}`, `attachments.{case,uploader}`.

- [ ] **Step 1: Test de esquema (RED)** — en `db/schema.test.ts` añadir: insertar clínica, doctor, categoría, producto y un `cases` mínimo con dos `case_items` y un `case_events`, y comprobar `db.query.cases.findFirst({ with: { items: { with: { product: true } }, clinic: true, events: true } })` devuelve las relaciones; comprobar que `case_sequences` acepta `insert … on conflict (year) do update set last = case_sequences.last + 1 returning last` dos veces → 1 y 2.

- [ ] **Step 2: Schema (GREEN)**

`apps/api/src/features/cases/schema.ts`:
```ts
import {
  CASE_EVENT_TYPES, CASE_PRIORITIES, CASE_STATUSES, PATIENT_SEXES, SHADE_SYSTEMS,
} from '@dentalware/shared'
import { sql } from 'drizzle-orm'
import {
  boolean, date, index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uuid,
} from 'drizzle-orm/pg-core'
import { clinics } from '../clinics/schema.ts'
import { doctors } from '../doctors/schema.ts'
import { products } from '../products/schema.ts'
import { stages } from '../stages/schema.ts'
import { users } from '../../db/schema/auth.ts'

export const caseStatusEnum = pgEnum('case_status', CASE_STATUSES)
export const casePriorityEnum = pgEnum('case_priority', CASE_PRIORITIES)
export const patientSexEnum = pgEnum('patient_sex', PATIENT_SEXES)
export const shadeSystemEnum = pgEnum('shade_system', SHADE_SYSTEMS)
export const caseEventTypeEnum = pgEnum('case_event_type', CASE_EVENT_TYPES)

/** Secuencia por año para el código AA-NNNNN; se incrementa con upsert atómico. */
export const caseSequences = pgTable('case_sequences', {
  year: integer().primaryKey(),
  last: integer().notNull().default(0),
})

export type Checklist = { antagonista: boolean; mordida: boolean; color: boolean; fotos: boolean }

export const cases = pgTable(
  'cases',
  {
    id: uuid().defaultRandom().primaryKey(),
    code: text().notNull().unique(),
    boxNumber: text('box_number'),
    clinicId: uuid('clinic_id').notNull().references(() => clinics.id),
    doctorId: uuid('doctor_id').notNull().references(() => doctors.id),
    patientRef: text('patient_ref').notNull(),
    patientAge: integer('patient_age'),
    patientSex: patientSexEnum('patient_sex'),
    status: caseStatusEnum().notNull().default('nuevo'),
    currentStageId: uuid('current_stage_id').references(() => stages.id),
    assignedTechnicianId: text('assigned_technician_id').references(() => users.id),
    priority: casePriorityEnum().notNull().default('normal'),
    receivedAt: date('received_at').notNull(),
    dueDate: date('due_date'),
    promisedDate: date('promised_date'),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    shippedAt: timestamp('shipped_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    shade: text(),
    shadeSystem: shadeSystemEnum('shade_system'),
    reference: text(),
    checklist: jsonb().$type<Checklist>().notNull().default(sql`'{"antagonista":false,"mordida":false,"color":false,"fotos":false}'::jsonb`),
    observations: text(),
    prescription: text(),
    internalNotes: text('internal_notes'),
    holdReason: text('hold_reason'),
    parentCaseId: uuid('parent_case_id'),
    remakeReason: text('remake_reason'),
    remakeResponsibility: text('remake_responsibility'),
    remakeChargePct: numeric('remake_charge_pct', { precision: 5, scale: 2 }),
    total: numeric({ precision: 12, scale: 2 }).notNull().default('0.00'),
    createdBy: text('created_by').notNull().references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('cases_status_idx').on(t.status),
    index('cases_clinic_idx').on(t.clinicId),
    index('cases_due_idx').on(t.promisedDate, t.dueDate),
  ],
)

export const caseItems = pgTable(
  'case_items',
  {
    id: uuid().defaultRandom().primaryKey(),
    caseId: uuid('case_id').notNull().references(() => cases.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').notNull().references(() => products.id),
    description: text(),
    quantity: integer().notNull().default(1),
    teeth: integer().array().notNull().default(sql`'{}'::integer[]`),
    unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
    discountPct: numeric('discount_pct', { precision: 5, scale: 2 }).notNull().default('0.00'),
    lineTotal: numeric('line_total', { precision: 12, scale: 2 }).notNull(),
    material: text(),
    notes: text(),
    sort: integer().notNull().default(0),
  },
  (t) => [index('case_items_case_idx').on(t.caseId)],
)

export const caseEvents = pgTable(
  'case_events',
  {
    id: uuid().defaultRandom().primaryKey(),
    caseId: uuid('case_id').notNull().references(() => cases.id, { onDelete: 'cascade' }),
    type: caseEventTypeEnum().notNull(),
    fromValue: text('from_value'),
    toValue: text('to_value'),
    reason: text(),
    actorId: text('actor_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('case_events_case_idx').on(t.caseId, t.createdAt)],
)
```

`apps/api/src/features/attachments/schema.ts`:
```ts
import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from '../../db/schema/auth.ts'
import { cases } from '../cases/schema.ts'

export const ATTACHMENT_KINDS = ['photo', 'document', 'scan'] as const
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number]
export const attachmentKindEnum = pgEnum('attachment_kind', ATTACHMENT_KINDS)

export const attachments = pgTable(
  'attachments',
  {
    id: uuid().defaultRandom().primaryKey(),
    caseId: uuid('case_id').notNull().references(() => cases.id, { onDelete: 'cascade' }),
    kind: attachmentKindEnum().notNull(),
    filename: text().notNull(),
    mime: text().notNull(),
    size: integer().notNull(),
    width: integer(),
    height: integer(),
    storagePath: text('storage_path').notNull(),
    thumbPath: text('thumb_path'),
    uploadedBy: text('uploaded_by').notNull().references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('attachments_case_idx').on(t.caseId)],
)
```
(`ATTACHMENT_KINDS` se duplica en `packages/shared/src/schemas/cases.ts` como `ATTACHMENT_KINDS` exportado si el web lo necesita en la Tarea 10; el schema de Drizzle importa el de shared para no tener dos fuentes: mover la constante a shared en esta tarea.)

`db/schema/index.ts`: añadir `export * from '../../features/cases/schema.ts'` y `'../../features/attachments/schema.ts'` (después de los catálogos).

`db/relations.ts` — añadir dentro de `defineRelations`:
```ts
  cases: {
    clinic: r.one.clinics({ from: r.cases.clinicId, to: r.clinics.id }),
    doctor: r.one.doctors({ from: r.cases.doctorId, to: r.doctors.id }),
    technician: r.one.users({ from: r.cases.assignedTechnicianId, to: r.users.id }),
    stage: r.one.stages({ from: r.cases.currentStageId, to: r.stages.id }),
    creator: r.one.users({ from: r.cases.createdBy, to: r.users.id }),
    items: r.many.caseItems(),
    events: r.many.caseEvents(),
    attachments: r.many.attachments(),
  },
  caseItems: {
    case: r.one.cases({ from: r.caseItems.caseId, to: r.cases.id }),
    product: r.one.products({ from: r.caseItems.productId, to: r.products.id }),
  },
  caseEvents: {
    case: r.one.cases({ from: r.caseEvents.caseId, to: r.cases.id }),
    actor: r.one.users({ from: r.caseEvents.actorId, to: r.users.id }),
  },
  attachments: {
    case: r.one.cases({ from: r.attachments.caseId, to: r.cases.id }),
    uploader: r.one.users({ from: r.attachments.uploadedBy, to: r.users.id }),
  },
```
(`users` viene del schema de auth incluido en `schema/index.ts`; si `r.users` no tipa por la mezcla con `defineRelationsPart`, definir las relaciones que tocan `users` en `authRelations`… no: la alternativa válida es referenciar `r.one.users` desde `appRelations`, ya que `defineRelations(schema, …)` recibe todo `schema/index.ts` incluidas las tablas de auth. Si aun así falla el tipado, BLOCKED: reportar con el error exacto.)

`test/setup.ts` → `truncateAll`: `truncate table "attachments", "case_events", "case_items", "cases", "case_sequences", "clinic_product_prices", …` (las nuevas primero).

- [ ] **Step 3: Migración y verificación**

```bash
pnpm --filter @dentalware/api db:generate     # crea drizzle/<ts>_<name>/ con las 5 tablas y 6 enums
pnpm --filter @dentalware/api test src/db     # schema.test.ts en verde (runMigrations aplica la nueva)
pnpm typecheck
git add apps/api && git commit -m "feat(api): tablas de trabajos, líneas, eventos, secuencias y adjuntos con relaciones y migración

Refs #3"
```

---

### Task 4: API — repositorio de trabajos (código, precios, totales, eventos) (Refs #3)

**Files:**
- Create: `apps/api/src/features/cases/repo.ts`, `apps/api/src/features/cases/cases.repo.test.ts`

**Interfaces:**
- Consumes: `formatCaseCode`, `toCents/fromCents/lineTotalCents/sumCents`, `CaseInput`, `CaseListQuery`, `CASE_PAGE_SIZE`, `toIsoDate`; `resolvePrice` no se usa (se resuelven todos los precios de una vez).
- Produces:
  - `class CaseInputError extends Error { constructor(message: string, public path = '') }` (→ 422 en rutas).
  - `nextCaseCode(tx, year): Promise<string>`
  - `createCase(db, input: CaseInput, actorId: string): Promise<string>` (id)
  - `updateCase(db, id, input: CaseInput, actorId): Promise<boolean>` (false si no existe; lanza `CaseStateError` si el estado no permite editar)
  - `getCase(db, id)` → `CaseDetail | null` con `clinic {id,name}`, `doctor {id,name}`, `technician {id,name} | null`, `stage {id,name,color} | null`, `items[] (+ product {id,code,name,pricingUnit})`, ordenados por `sort`.
  - `listCases(db, query: CaseListQuery, today: string)` → `{ cases: CaseListRow[], total: number, page: number, pageSize: number }` donde `CaseListRow = { id, code, boxNumber, clinic: {id,name}, doctor: {id,name}, patientRef, status, priority, receivedAt, dueDate, promisedDate, stage: {name,color}|null, technician: {name}|null, total, itemsSummary: string }`.
  - `listEvents(db, caseId)` → `{ id, type, fromValue, toValue, reason, createdAt, actor: {id,name}|null }[]` ascendente.
  - `addEvent(tx, { caseId, type, fromValue?, toValue?, reason?, actorId })`.
  - `stripPrices<T>(row)` → mismo objeto con `total`, `items[].unitPrice`, `items[].lineTotal`, `items[].discountPct` en `null`.

- [ ] **Step 1: Tests del repo (RED)**

`cases.repo.test.ts` (usa `setupTestDb`, `truncateAll`; crea clínica, doctor, categoría, dos productos ZR `45.00` por_pieza y AC `80.00` por_arcada, y precio especial ZR→`40.00` para la clínica; usuario admin con `createUser` para `actorId`):

```ts
it('genera códigos AA-NNNNN consecutivos por año', async () => {
  const a = await createCase(ctx.db, input({ receivedAt: '2026-09-06' }), actor)
  const b = await createCase(ctx.db, input({ receivedAt: '2026-09-07' }), actor)
  const c = await createCase(ctx.db, input({ receivedAt: '2027-01-02' }), actor)
  expect((await getCase(ctx.db, a))!.code).toBe('26-00001')
  expect((await getCase(ctx.db, b))!.code).toBe('26-00002')
  expect((await getCase(ctx.db, c))!.code).toBe('27-00001')
})
it('resuelve precio especial de la clínica, calcula totales y escribe el evento created', async () => {
  const id = await createCase(ctx.db, input({ items: [
    { productId: zr, quantity: 2, teeth: [11, 12], discountPct: 10 },
    { productId: ac, quantity: 1, unitPrice: '75.00' },
  ] }), actor)
  const c = (await getCase(ctx.db, id))!
  expect(c.items.map((i) => [i.unitPrice, i.lineTotal])).toEqual([['40.00', '72.00'], ['75.00', '75.00']])
  expect(c.total).toBe('147.00')
  expect(c.status).toBe('nuevo')
  expect((await listEvents(ctx.db, id)).map((e) => e.type)).toEqual(['created'])
})
it('rechaza productos inexistentes o inactivos con CaseInputError', async () => {
  await expect(createCase(ctx.db, input({ items: [{ productId: randomUUID(), quantity: 1 }] }), actor)).rejects.toBeInstanceOf(CaseInputError)
})
it('updateCase reemplaza líneas, recalcula total y registra edited y price_changed', async () => {
  const id = await createCase(ctx.db, input(), actor)
  await updateCase(ctx.db, id, input({ items: [{ productId: zr, quantity: 1, unitPrice: '30.00' }] }), actor)
  const c = (await getCase(ctx.db, id))!
  expect(c.items).toHaveLength(1)
  expect(c.total).toBe('30.00')
  expect((await listEvents(ctx.db, id)).map((e) => e.type)).toEqual(['created', 'edited', 'price_changed'])
})
it('updateCase lanza CaseStateError fuera de nuevo/en_proceso', async () => {
  const id = await createCase(ctx.db, input(), actor)
  await ctx.db.update(schema.cases).set({ status: 'terminado' }).where(eq(schema.cases.id, id))
  await expect(updateCase(ctx.db, id, input(), actor)).rejects.toBeInstanceOf(CaseStateError)
})
it('listCases aplica vistas rápidas, búsqueda y paginación', async () => {
  // hoy = '2026-09-06'; crea: nuevo con dueDate hoy, en_proceso con dueDate ayer, terminado, cancelado
  const r = await listCases(ctx.db, caseListQuerySchema.parse({ vista: 'vencen_hoy' }), '2026-09-06')
  expect(r.cases.map((x) => x.code)).toEqual(['26-00001'])
  expect((await listCases(ctx.db, caseListQuerySchema.parse({ vista: 'atrasados' }), '2026-09-06')).cases.map((x) => x.code)).toEqual(['26-00002'])
  expect((await listCases(ctx.db, caseListQuerySchema.parse({ vista: 'listos' }), '2026-09-06')).total).toBe(1)
  expect((await listCases(ctx.db, caseListQuerySchema.parse({ q: 'Paciente 2' }), '2026-09-06')).cases).toHaveLength(1)
  expect((await listCases(ctx.db, caseListQuerySchema.parse({ q: '26-00003' }), '2026-09-06')).cases).toHaveLength(1)
  expect((await listCases(ctx.db, caseListQuerySchema.parse({}), '2026-09-06')).pageSize).toBe(50)
})
it('stripPrices anula precios y totales', () => {
  const s = stripPrices({ total: '10.00', items: [{ unitPrice: '1.00', lineTotal: '1.00', discountPct: '0.00', quantity: 1 }] })
  expect(s.total).toBeNull()
  expect(s.items[0]).toMatchObject({ unitPrice: null, lineTotal: null, discountPct: null, quantity: 1 })
})
```

- [ ] **Step 2: Implementar `repo.ts` (GREEN)**

```ts
import type { CaseInput, CaseListQuery, CaseEventType } from '@dentalware/shared'
import { CASE_PAGE_SIZE, formatCaseCode, fromCents, lineTotalCents, sumCents, toCents } from '@dentalware/shared'
import { and, asc, desc, eq, ilike, inArray, isNull, lt, or, sql, count } from 'drizzle-orm'
import type { Db } from '../../db/index.ts'
import { users } from '../../db/schema/auth.ts'
import { clinics } from '../clinics/schema.ts'
import { doctors } from '../doctors/schema.ts'
import { clinicProductPrices, products } from '../products/schema.ts'
import { stages } from '../stages/schema.ts'
import { caseEvents, caseItems, cases, caseSequences } from './schema.ts'

export class CaseInputError extends Error {
  constructor(message: string, public path = '') { super(message) }
}
export class CaseStateError extends Error {}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
const EDITABLE = ['nuevo', 'en_proceso'] as const

export async function nextCaseCode(tx: Tx | Db, year: number): Promise<string> {
  const [row] = await tx
    .insert(caseSequences)
    .values({ year, last: 1 })
    .onConflictDoUpdate({ target: caseSequences.year, set: { last: sql`${caseSequences.last} + 1` } })
    .returning({ last: caseSequences.last })
  return formatCaseCode(year, row!.last)
}

/** Resuelve precio (explícito → especial de la clínica → base) y totales de cada línea. */
async function priceItems(tx: Tx | Db, clinicId: string, items: CaseInput['items']) {
  const ids = [...new Set(items.map((i) => i.productId))]
  const found = await tx
    .select({ id: products.id, basePrice: products.basePrice, active: products.active, special: clinicProductPrices.price })
    .from(products)
    .leftJoin(clinicProductPrices, and(eq(clinicProductPrices.productId, products.id), eq(clinicProductPrices.clinicId, clinicId)))
    .where(inArray(products.id, ids))
  const byId = new Map(found.map((p) => [p.id, p]))
  return items.map((it, sort) => {
    const p = byId.get(it.productId)
    if (!p || !p.active) throw new CaseInputError('El producto no existe o está inactivo', `items.${sort}.productId`)
    const unitPrice = it.unitPrice ?? p.special ?? p.basePrice
    const lineTotal = fromCents(lineTotalCents(toCents(unitPrice), it.quantity, it.discountPct))
    return {
      productId: it.productId, description: it.description, quantity: it.quantity, teeth: it.teeth,
      unitPrice, discountPct: it.discountPct.toFixed(2), lineTotal, material: it.material, notes: it.notes, sort,
    }
  })
}
const totalOf = (items: { lineTotal: string }[]) => fromCents(sumCents(items.map((i) => toCents(i.lineTotal))))

function caseColumns(input: CaseInput) {
  const { items: _items, ...rest } = input
  return rest
}

export async function addEvent(tx: Tx | Db, e: { caseId: string; type: CaseEventType; fromValue?: string | null; toValue?: string | null; reason?: string | null; actorId: string | null }) {
  await tx.insert(caseEvents).values({ caseId: e.caseId, type: e.type, fromValue: e.fromValue ?? null, toValue: e.toValue ?? null, reason: e.reason ?? null, actorId: e.actorId })
}

export function createCase(db: Db, input: CaseInput, actorId: string): Promise<string> {
  return db.transaction(async (tx) => {
    const year = Number(input.receivedAt.slice(0, 4))
    const code = await nextCaseCode(tx, year)
    const items = await priceItems(tx, input.clinicId, input.items)
    const [row] = await tx.insert(cases).values({ ...caseColumns(input), code, total: totalOf(items), createdBy: actorId }).returning({ id: cases.id })
    await tx.insert(caseItems).values(items.map((i) => ({ ...i, caseId: row!.id })))
    await addEvent(tx, { caseId: row!.id, type: 'created', toValue: code, actorId })
    return row!.id
  })
}

export function updateCase(db: Db, id: string, input: CaseInput, actorId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [current] = await tx.select({ status: cases.status }).from(cases).where(eq(cases.id, id)).for('update')
    if (!current) return false
    if (!(EDITABLE as readonly string[]).includes(current.status)) throw new CaseStateError(`No se puede editar un trabajo en estado "${current.status}"`)
    const before = await tx.select({ productId: caseItems.productId, unitPrice: caseItems.unitPrice }).from(caseItems).where(eq(caseItems.caseId, id))
    const items = await priceItems(tx, input.clinicId, input.items)
    await tx.update(cases).set({ ...caseColumns(input), total: totalOf(items), updatedAt: new Date() }).where(eq(cases.id, id))
    await tx.delete(caseItems).where(eq(caseItems.caseId, id))
    await tx.insert(caseItems).values(items.map((i) => ({ ...i, caseId: id })))
    await addEvent(tx, { caseId: id, type: 'edited', actorId })
    const beforeMap = new Map(before.map((b) => [b.productId, b.unitPrice]))
    const changed = items.filter((i) => beforeMap.has(i.productId) && beforeMap.get(i.productId) !== i.unitPrice)
    if (changed.length) {
      await addEvent(tx, { caseId: id, type: 'price_changed', fromValue: changed.map((c) => `${c.productId}:${beforeMap.get(c.productId)}`).join(','), toValue: changed.map((c) => `${c.productId}:${c.unitPrice}`).join(','), actorId })
    }
    return true
  })
}

export function getCase(db: Db, id: string) {
  return db.query.cases.findFirst({
    where: { id },
    with: {
      clinic: { columns: { id: true, name: true } },
      doctor: { columns: { id: true, name: true } },
      technician: { columns: { id: true, name: true } },
      stage: { columns: { id: true, name: true, color: true } },
      items: { orderBy: { sort: 'asc' }, with: { product: { columns: { id: true, code: true, name: true, pricingUnit: true } } } },
    },
  })
}
export type CaseDetail = NonNullable<Awaited<ReturnType<typeof getCase>>>

const ACTIVE_FOR_DATES = ['nuevo', 'en_proceso', 'en_espera', 'en_prueba'] as const
const effectiveDate = sql<string | null>`coalesce(${cases.promisedDate}, ${cases.dueDate})`

export async function listCases(db: Db, q: CaseListQuery, today: string) {
  const conds = []
  if (q.vista === 'nuevos') conds.push(eq(cases.status, 'nuevo'))
  if (q.vista === 'en_curso') conds.push(inArray(cases.status, ['en_proceso', 'en_espera', 'en_prueba']))
  if (q.vista === 'vencen_hoy') conds.push(and(inArray(cases.status, [...ACTIVE_FOR_DATES]), sql`${effectiveDate} = ${today}::date`)!)
  if (q.vista === 'atrasados') conds.push(and(inArray(cases.status, [...ACTIVE_FOR_DATES]), sql`${effectiveDate} < ${today}::date`)!)
  if (q.vista === 'listos') conds.push(inArray(cases.status, ['terminado', 'enviado']))
  if (q.estado) conds.push(eq(cases.status, q.estado))
  if (q.clinicId) conds.push(eq(cases.clinicId, q.clinicId))
  if (q.doctorId) conds.push(eq(cases.doctorId, q.doctorId))
  if (q.tecnicoId) conds.push(eq(cases.assignedTechnicianId, q.tecnicoId))
  if (q.desde) conds.push(sql`${cases.receivedAt} >= ${q.desde}::date`)
  if (q.hasta) conds.push(sql`${cases.receivedAt} <= ${q.hasta}::date`)
  if (q.q) {
    const like = `%${q.q}%`
    conds.push(or(ilike(cases.code, like), ilike(cases.patientRef, like), ilike(cases.boxNumber, like))!)
  }
  const where = conds.length ? and(...conds) : undefined
  const tech = db.$with ? undefined : undefined // (sin CTE; alias abajo)
  const [{ total }] = await db.select({ total: count() }).from(cases).where(where)
  const rows = await db
    .select({
      id: cases.id, code: cases.code, boxNumber: cases.boxNumber, patientRef: cases.patientRef, status: cases.status,
      priority: cases.priority, receivedAt: cases.receivedAt, dueDate: cases.dueDate, promisedDate: cases.promisedDate,
      total: cases.total,
      clinic: { id: clinics.id, name: clinics.name }, doctor: { id: doctors.id, name: doctors.name },
      stageName: stages.name, stageColor: stages.color, technicianName: users.name,
      itemsSummary: sql<string>`(select string_agg(p.name || case when ci.quantity > 1 then ' ×' || ci.quantity else '' end, ', ' order by ci.sort) from case_items ci join products p on p.id = ci.product_id where ci.case_id = ${cases.id})`,
    })
    .from(cases)
    .innerJoin(clinics, eq(clinics.id, cases.clinicId))
    .innerJoin(doctors, eq(doctors.id, cases.doctorId))
    .leftJoin(stages, eq(stages.id, cases.currentStageId))
    .leftJoin(users, eq(users.id, cases.assignedTechnicianId))
    .where(where)
    .orderBy(desc(sql`${cases.priority} = 'urgente'`), sql`${effectiveDate} asc nulls last`, desc(cases.code))
    .limit(CASE_PAGE_SIZE)
    .offset((q.pagina - 1) * CASE_PAGE_SIZE)
  return {
    cases: rows.map(({ stageName, stageColor, technicianName, ...r }) => ({
      ...r,
      stage: stageName ? { name: stageName, color: stageColor! } : null,
      technician: technicianName ? { name: technicianName } : null,
    })),
    total, page: q.pagina, pageSize: CASE_PAGE_SIZE,
  }
}
export type CaseListRow = Awaited<ReturnType<typeof listCases>>['cases'][number]

export function listEvents(db: Db, caseId: string) {
  return db.query.caseEvents.findMany({
    where: { caseId },
    orderBy: { createdAt: 'asc' },
    with: { actor: { columns: { id: true, name: true } } },
  })
}

type Priced = { total: string | null; items: { unitPrice: string | null; lineTotal: string | null; discountPct: string | null }[] }
export function stripPrices<T extends Priced>(row: T): T {
  return { ...row, total: null, items: row.items.map((i) => ({ ...i, unitPrice: null, lineTotal: null, discountPct: null })) }
}
```
Quitar la línea `const tech = …` (residuo): el listado no necesita CTE. Si `orderBy` con `sql` mixto no tipa en rc.4, usar `sql` para las tres claves. Si `.for('update')` no existe en rc.4, usar `sql\`select status from cases where id = ${id} for update\``.

- [ ] **Step 3: Ejecutar y commit**

```bash
pnpm --filter @dentalware/api test src/features/cases   # repo 7/7
git add apps/api && git commit -m "feat(api): repositorio de trabajos con código anual, precios por clínica, totales y eventos

Refs #3"
```

---

### Task 5: API — rutas `/api/trabajos` (Refs #3)

**Files:**
- Create: `apps/api/src/features/cases/routes.ts`, `apps/api/src/features/cases/cases.test.ts`
- Modify: `apps/api/src/app.ts` (`.route('/api/trabajos', casesRoutes(db))`)

**Interfaces:**
- Produces (todas exigen sesión; `hidePrices = role ∈ {tecnico, mensajero}`):
  - `GET /api/trabajos?vista&estado&clinicId&doctorId&tecnicoId&q&desde&hasta&pagina` → 200 `{ cases, total, page, pageSize }` (con `total` de cada fila en `null` si hidePrices).
  - `GET /api/trabajos/:id` → 200 `{ case: CaseDetail, missing: string[] }` (`missing` = `missingForAccept`) · 404.
  - `POST /api/trabajos` (admin|recepcion) → 201 `{ case }` · 422 (validación o `CaseInputError` con `issues: [{ path, message }]`).
  - `PUT /api/trabajos/:id` (admin|recepcion) → 200 `{ case }` · 404 · 409 (`CaseStateError.message`).
  - `GET /api/trabajos/:id/eventos` → 200 `{ events }`.
  - `POST /api/trabajos/:id/comentarios` → 201 `{ event }` (tipo `comment`, `toValue = text`).
  - Helper exportado `todayIso()` = `toIsoDate(new Date())` (TZ del proceso: `America/Guayaquil` en producción).

- [ ] **Step 1: Tests de rutas (RED)** — `cases.test.ts` con admin, recepción, técnico y mensajero; catálogo mínimo:
  - `crea un trabajo (201) y lo devuelve con código, líneas con precio y total` (recepción).
  - `técnico y mensajero no crean (403)`; `sin sesión 403`.
  - `422 con issues en español si faltan líneas o el producto no existe` (path `items.0.productId`).
  - `técnico ve la ficha sin precios (null) pero con piezas y productos`.
  - `PUT reemplaza líneas y devuelve 409 si el trabajo está terminado`.
  - `listado por vista y búsqueda; total de fila null para mensajero`.
  - `comentario: técnico comenta (201) y aparece en eventos con su nombre; texto vacío 422`.
  - `GET /:id devuelve missing con "Fecha deseada" cuando falta`.

- [ ] **Step 2: Implementar `routes.ts` (GREEN)**

```ts
import { caseInputSchema, caseListQuerySchema, commentSchema, idParamSchema, missingForAccept, toIsoDate } from '@dentalware/shared'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { Db } from '../../db/index.ts'
import { validate } from '../../lib/validate.ts'
import type { AppEnv } from '../auth/session.ts'
import { requireAuth, requireRole } from '../auth/session.ts'
import { addEvent, CaseInputError, CaseStateError, createCase, getCase, listCases, listEvents, stripPrices, updateCase } from './repo.ts'

export const todayIso = () => toIsoDate(new Date())
const canWrite = requireRole('admin', 'recepcion')
const hidesPrices = (role: string | undefined) => role === 'tecnico' || role === 'mensajero'

function readiness(c: NonNullable<Awaited<ReturnType<typeof getCase>>>, hasPrescriptionDocument: boolean) {
  return missingForAccept({
    clinicId: c.clinicId, doctorId: c.doctorId, patientRef: c.patientRef, dueDate: c.dueDate, shade: c.shade,
    prescription: c.prescription, hasPrescriptionDocument, checklist: c.checklist,
    items: c.items.map((i) => ({ pricingUnit: i.product.pricingUnit, teeth: i.teeth })),
  })
}

export const casesRoutes = (db: Db) =>
  new Hono<AppEnv>()
    .use(requireAuth)
    .get('/', validate('query', caseListQuerySchema), async (c) => {
      const result = await listCases(db, c.req.valid('query'), todayIso())
      const hide = hidesPrices(c.var.user?.role)
      return c.json({ ...result, cases: result.cases.map((r) => (hide ? { ...r, total: null } : r)) }, 200)
    })
    .get('/:id', validate('param', idParamSchema), async (c) => {
      const found = await getCase(db, c.req.valid('param').id)
      if (!found) throw new HTTPException(404, { message: 'El trabajo no existe' })
      const hasDoc = (await db.query.attachments.findFirst({ where: { caseId: found.id, kind: 'document' }, columns: { id: true } })) !== undefined
      const view = hidesPrices(c.var.user?.role) ? stripPrices(found) : found
      return c.json({ case: view, missing: readiness(found, hasDoc) }, 200)
    })
    .post('/', canWrite, validate('json', caseInputSchema), async (c) => {
      try {
        const id = await createCase(db, c.req.valid('json'), c.var.user!.id)
        return c.json({ case: (await getCase(db, id))! }, 201)
      } catch (e) {
        if (e instanceof CaseInputError) return c.json({ message: 'Datos inválidos', issues: [{ path: e.path, message: e.message }] }, 422)
        throw e
      }
    })
    .put('/:id', canWrite, validate('param', idParamSchema), validate('json', caseInputSchema), async (c) => {
      const { id } = c.req.valid('param')
      try {
        if (!(await updateCase(db, id, c.req.valid('json'), c.var.user!.id))) throw new HTTPException(404, { message: 'El trabajo no existe' })
      } catch (e) {
        if (e instanceof CaseInputError) return c.json({ message: 'Datos inválidos', issues: [{ path: e.path, message: e.message }] }, 422)
        if (e instanceof CaseStateError) throw new HTTPException(409, { message: e.message })
        throw e
      }
      return c.json({ case: (await getCase(db, id))! }, 200)
    })
    .get('/:id/eventos', validate('param', idParamSchema), async (c) =>
      c.json({ events: await listEvents(db, c.req.valid('param').id) }, 200),
    )
    .post('/:id/comentarios', validate('param', idParamSchema), validate('json', commentSchema), async (c) => {
      const { id } = c.req.valid('param')
      if (!(await getCase(db, id))) throw new HTTPException(404, { message: 'El trabajo no existe' })
      await addEvent(db, { caseId: id, type: 'comment', toValue: c.req.valid('json').text, actorId: c.var.user!.id })
      const events = await listEvents(db, id)
      return c.json({ event: events[events.length - 1]! }, 201)
    })
```
Nota: `db.query.attachments` existe desde la Tarea 3; hasta la Tarea 6 no hay filas. `stripPrices` devuelve `total: null` y precios `null`: el tipo de respuesta de `GET /:id` es la unión de ambas formas; en `hc` el web trata `unitPrice: string | null`.

- [ ] **Step 3: Montar en `app.ts`, ejecutar y commit**

```bash
pnpm --filter @dentalware/api test src/features/cases   # rutas ≥ 9 tests + repo
pnpm typecheck
git add apps/api && git commit -m "feat(api): rutas de trabajos: listado con vistas, ficha, creación, edición y comentarios

Refs #3"
```

---

### Task 6: API — adjuntos: almacenamiento, imágenes y rutas `/api/adjuntos` (Refs #3)

**Files:**
- Create: `apps/api/src/lib/storage.ts`, `storage.test.ts`, `apps/api/src/lib/images.ts`, `images.test.ts`, `apps/api/src/features/attachments/repo.ts`, `routes.ts`, `attachments.test.ts`
- Modify: `apps/api/src/config.ts` (`UPLOAD_DIR`), `apps/api/package.json` (dependencia `sharp: catalog:` — ya está en el catalog para el web; la API la usa en runtime), `apps/api/src/app.ts` (`AppDeps.storage`, `.route('/api/adjuntos', attachmentsRoutes(db, storage))`), `apps/api/src/main.ts` (crear `LocalStorage(config.UPLOAD_DIR)`), `apps/api/src/test/setup.ts` (storage en `fs.mkdtemp`), `apps/api/.env.example` (`UPLOAD_DIR=./data/uploads`), `apps/api/Dockerfile` si `sharp` necesita `libvips` en alpine (usar la imagen `node:24-alpine` + `apk add --no-cache vips` solo si `pnpm install` no trae el binario prebuilt; verificar con `docker compose build api`).

**Interfaces:**
- Produces:
  - `interface Storage { put(key: string, data: Uint8Array): Promise<void>; open(key: string): Promise<Readable>; remove(key: string): Promise<void>; exists(key: string): Promise<boolean> }` y `class LocalStorage implements Storage` (raíz; rechaza claves con `..` o absolutas; crea directorios).
  - `normalizeImage(buf): Promise<{ data: Buffer; width: number; height: number }>` (rotación EXIF, ≤ 1600 px, JPEG q82, sin metadatos) y `makeThumbnail(buf): Promise<Buffer>` (320 px, WebP).
  - `ALLOWED_MIME = ['image/jpeg','image/png','image/webp','application/pdf']`, `MAX_UPLOAD_BYTES = 25 * 1024 * 1024`.
  - Rutas (sesión obligatoria):
    - `POST /api/adjuntos/trabajo/:caseId` multipart `file` (+ `kind` opcional `photo|document|scan`, por defecto `photo` para imágenes y `document` para PDF) → 201 `{ attachment }` · 413 si excede · 415 si el tipo no está permitido · 404 si el trabajo no existe. Escribe evento `attachment_added` (`toValue = filename`).
    - `GET /api/adjuntos/trabajo/:caseId` → 200 `{ attachments }`.
    - `GET /api/adjuntos/:id` → stream con `Content-Type`, `Content-Disposition: inline; filename="…"`, `Cache-Control: private, max-age=86400`.
    - `GET /api/adjuntos/:id/miniatura` → WebP (404 si no tiene).
    - `DELETE /api/adjuntos/:id` (admin|recepcion) → 204; borra archivo(s) y fila; evento `attachment_removed`.
  - `AttachmentDto = { id, caseId, kind, filename, mime, size, width, height, createdAt, uploadedBy: { id, name }, url: '/api/adjuntos/:id', thumbUrl: '/api/adjuntos/:id/miniatura' | null }`.

- [ ] **Step 1: Tests de storage e imágenes (RED)**

`storage.test.ts`: `LocalStorage` en `mkdtemp`: `put` + `exists` + `open` (leer el stream y comparar bytes) + `remove`; `put('../x')` y `put('/etc/x')` rechazan con error.
`images.test.ts`: generar con `sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#0f766e' } }).jpeg().toBuffer()` → `normalizeImage` devuelve ≤ 1600 de ancho y `metadata().format === 'jpeg'`; `makeThumbnail` devuelve WebP de 320 px; un PNG pequeño no se agranda.

- [ ] **Step 2: Implementar `storage.ts` e `images.ts` (GREEN)**

```ts
// lib/storage.ts
import { createReadStream } from 'node:fs'
import { access, mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Readable } from 'node:stream'

export interface Storage {
  put(key: string, data: Uint8Array): Promise<void>
  open(key: string): Promise<Readable>
  remove(key: string): Promise<void>
  exists(key: string): Promise<boolean>
}

export class LocalStorage implements Storage {
  constructor(private readonly root: string) {}
  private resolve(key: string) {
    if (path.isAbsolute(key) || key.split(/[\\/]/).includes('..')) throw new Error(`Clave de almacenamiento inválida: ${key}`)
    return path.join(this.root, key)
  }
  async put(key: string, data: Uint8Array) {
    const file = this.resolve(key)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, data)
  }
  async open(key: string) { return createReadStream(this.resolve(key)) }
  async remove(key: string) { await rm(this.resolve(key), { force: true }) }
  async exists(key: string) { try { await access(this.resolve(key)); return true } catch { return false } }
}
```
```ts
// lib/images.ts
import sharp from 'sharp'
export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
export const isImage = (mime: string) => mime.startsWith('image/')

export async function normalizeImage(input: Uint8Array) {
  const { data, info } = await sharp(input).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}
export function makeThumbnail(input: Uint8Array) {
  return sharp(input).rotate().resize({ width: 320, height: 320, fit: 'inside', withoutEnlargement: true }).webp({ quality: 75 }).toBuffer()
}
```
(`sharp` 0.35.4 ya está fijado en el catalog; consultar context7 solo si la API de `resize`/`rotate` difiere: ambas existen desde 0.2x.)

- [ ] **Step 3: Tests de rutas de adjuntos (RED)** — `attachments.test.ts`: crea un trabajo por repo; sube una imagen JPEG de 3000×2000 generada con sharp (`FormData` + `new File`) como técnico → 201 con `width ≤ 1600`, `thumbUrl` no nulo y evento `attachment_added`; `GET /:id` devuelve `image/jpeg` con bytes; `GET /:id/miniatura` `image/webp`; PDF pequeño (`%PDF-1.4\n…`) → `kind: 'document'` sin miniatura; `text/plain` → 415; 26 MB (`Buffer.alloc`) → 413; técnico `DELETE` → 403; admin `DELETE` → 204 y el archivo ya no existe en storage; `GET` de un id borrado → 404.

- [ ] **Step 4: Implementar `repo.ts` y `routes.ts` (GREEN)**

`repo.ts`: `insertAttachment(db, row)`, `listAttachments(db, caseId)` (con `uploader {id,name}`), `getAttachment(db, id)`, `deleteAttachment(db, id)`; `toDto(a)` añade `url`/`thumbUrl`.

`routes.ts`:
```ts
import { idParamSchema } from '@dentalware/shared'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { stream } from 'hono/streaming'
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import { z } from 'zod'
import type { Db } from '../../db/index.ts'
import { ALLOWED_MIME, isImage, makeThumbnail, MAX_UPLOAD_BYTES, normalizeImage } from '../../lib/images.ts'
import type { Storage } from '../../lib/storage.ts'
import { validate } from '../../lib/validate.ts'
import type { AppEnv } from '../auth/session.ts'
import { requireAuth, requireRole } from '../auth/session.ts'
import { addEvent, getCase } from '../cases/repo.ts'
import { ATTACHMENT_KINDS } from './schema.ts'
import { deleteAttachment, getAttachment, insertAttachment, listAttachments, toDto } from './repo.ts'

const caseParam = z.object({ caseId: z.uuid({ error: 'Identificador inválido' }) })
const safeName = (n: string) => n.replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ ]/g, '_').slice(0, 120) || 'archivo'

export const attachmentsRoutes = (db: Db, storage: Storage) =>
  new Hono<AppEnv>()
    .use(requireAuth)
    .get('/trabajo/:caseId', validate('param', caseParam), async (c) =>
      c.json({ attachments: (await listAttachments(db, c.req.valid('param').caseId)).map(toDto) }, 200),
    )
    .post('/trabajo/:caseId', validate('param', caseParam), async (c) => {
      const { caseId } = c.req.valid('param')
      if (!(await getCase(db, caseId))) throw new HTTPException(404, { message: 'El trabajo no existe' })
      const body = await c.req.parseBody()
      const file = body['file']
      if (!(file instanceof File)) return c.json({ message: 'Datos inválidos', issues: [{ path: 'file', message: 'Adjunta un archivo' }] }, 422)
      if (file.size > MAX_UPLOAD_BYTES) throw new HTTPException(413, { message: 'El archivo supera los 25 MB' })
      if (!(ALLOWED_MIME as readonly string[]).includes(file.type)) throw new HTTPException(415, { message: 'Solo se admiten imágenes JPEG, PNG, WebP o PDF' })
      const requestedKind = typeof body['kind'] === 'string' && (ATTACHMENT_KINDS as readonly string[]).includes(body['kind']) ? (body['kind'] as (typeof ATTACHMENT_KINDS)[number]) : null
      const raw = new Uint8Array(await file.arrayBuffer())
      const id = randomUUID()
      let data: Uint8Array = raw, mime = file.type, width: number | null = null, height: number | null = null, thumbPath: string | null = null, ext = 'pdf'
      if (isImage(file.type)) {
        const img = await normalizeImage(raw)
        data = img.data; width = img.width; height = img.height; mime = 'image/jpeg'; ext = 'jpg'
        thumbPath = `${caseId}/${id}.thumb.webp`
        await storage.put(thumbPath, await makeThumbnail(raw))
      }
      const storagePath = `${caseId}/${id}.${ext}`
      await storage.put(storagePath, data)
      const row = await insertAttachment(db, {
        id, caseId, kind: requestedKind ?? (isImage(file.type) ? 'photo' : 'document'), filename: safeName(file.name),
        mime, size: data.byteLength, width, height, storagePath, thumbPath, uploadedBy: c.var.user!.id,
      })
      await addEvent(db, { caseId, type: 'attachment_added', toValue: row.filename, actorId: c.var.user!.id })
      return c.json({ attachment: toDto(row) }, 201)
    })
    .get('/:id', validate('param', idParamSchema), async (c) => {
      const a = await getAttachment(db, c.req.valid('param').id)
      if (!a) throw new HTTPException(404, { message: 'El adjunto no existe' })
      c.header('Content-Type', a.mime)
      c.header('Content-Disposition', `inline; filename="${encodeURIComponent(a.filename)}"`)
      c.header('Cache-Control', 'private, max-age=86400')
      const readable = await storage.open(a.storagePath)
      return stream(c, (s) => s.pipe(Readable.toWeb(readable) as ReadableStream))
    })
    .get('/:id/miniatura', validate('param', idParamSchema), async (c) => {
      const a = await getAttachment(db, c.req.valid('param').id)
      if (!a?.thumbPath) throw new HTTPException(404, { message: 'Sin miniatura' })
      c.header('Content-Type', 'image/webp')
      c.header('Cache-Control', 'private, max-age=86400')
      const readable = await storage.open(a.thumbPath)
      return stream(c, (s) => s.pipe(Readable.toWeb(readable) as ReadableStream))
    })
    .delete('/:id', requireRole('admin', 'recepcion'), validate('param', idParamSchema), async (c) => {
      const a = await getAttachment(db, c.req.valid('param').id)
      if (!a) throw new HTTPException(404, { message: 'El adjunto no existe' })
      await deleteAttachment(db, a.id)
      await storage.remove(a.storagePath)
      if (a.thumbPath) await storage.remove(a.thumbPath)
      await addEvent(db, { caseId: a.caseId, type: 'attachment_removed', fromValue: a.filename, actorId: c.var.user!.id })
      return c.body(null, 204)
    })
```
`config.ts`: `UPLOAD_DIR: z.string().min(1).default('./data/uploads')`. `main.ts`: `const storage = new LocalStorage(config.UPLOAD_DIR)` y pasarlo a `createApp`. `test/setup.ts`: `setupTestDb` crea `storage: new LocalStorage(await mkdtemp(join(tmpdir(), 'dentalware-'))))` y lo devuelve; todos los `createApp({...})` de tests existentes reciben `storage: ctx.storage` (actualizar los 8 archivos de test).

- [ ] **Step 5: Ejecutar, Docker y commit**

```bash
pnpm --filter @dentalware/api test                       # api completa (≈ 42 + 7 + 9 + 8)
docker compose -f infra/docker-compose.yml build api     # sharp en alpine: si falla, añadir `apk add --no-cache vips-dev` al Dockerfile y repetir
git add apps/api && git commit -m "feat(api): adjuntos con almacenamiento local, normalización de imágenes y miniaturas

Refs #3"
```

---

### Task 7: Web — lista de trabajos con vistas rápidas, filtros y chips de estado (Refs #3)

**Files:**
- Create: `apps/web/src/features/cases/api.ts`, `use-cases.ts`, `status-chip.tsx`, `status-chip.test.tsx`, `case-views.ts`, `case-views.test.ts`, `cases-table.tsx`, `cases-table.test.tsx`, `cases-filters.tsx`, `date-format.ts` (+test), `apps/web/src/routes/_app/trabajos/index.tsx`
- Modify: `apps/web/src/routes/_app/trabajos.tsx` (pasa a layout con `<Outlet />`), `apps/web/src/lib/query-keys.ts`

**Interfaces:**
- Consumes: `GET /api/trabajos` (Task 5), `useClinics(false)`, `useDoctors(clinicId)`, `useUsers` (solo admin/recepción para el filtro de técnico: si el rol no puede, no se muestra).
- Produces: `fetchCases(query)`, `fetchCase(id)`, `createCase(input)`, `updateCase(id,input)`, `fetchEvents(id)`, `postComment(id, text)`; hooks `useCases(query)`, `useCase(id)`, `useCreateCase()`, `useUpdateCase()`, `useEvents(id)`, `useAddComment(id)`; `queryKeys.cases(query)`, `queryKeys.case(id)`, `queryKeys.caseEvents(id)`, `queryKeys.attachments(caseId)`; `<StatusChip status />` con `STATUS_LABEL` y `STATUS_COLOR` (hex del spec §5); `CASE_VIEW_LABEL: Record<CaseView,string>` = `{ nuevos: 'Nuevos', en_curso: 'En curso', vencen_hoy: 'Vencen hoy', atrasados: 'Atrasados', listos: 'Listos', todos: 'Todos' }`; `formatDate('2026-09-06') → '06/09/2026'`, `dueBadge(date, today, status)` → `'hoy' | 'atrasado' | null`; `<CasesTable rows hidePrices />` (fila con pestaña de 4 px del color de estado, código `font-mono`, clínica · doctor, paciente, líneas, fecha con semáforo, chip de estado, total si no se ocultan) y tarjeta móvil equivalente; `<CasesFilters value onChange clinics doctors technicians? />` (búsqueda con debounce 300 ms, clínica, doctor, técnico, estado, rango de fechas).
- Ruta `/trabajos` con `validateSearch` (zod `caseListQuerySchema.partial()`): las vistas son pestañas (`Tabs`) que escriben `vista` en la URL; paginación "Anterior / Siguiente" con `pagina`.

- [ ] **Step 1: Tests (RED)**

`status-chip.test.tsx`: renderiza texto "En proceso" para `en_proceso` y aplica `style="--chip: #0F766E"` (o la clase equivalente) — comprobar `screen.getByText('En proceso')` y que el elemento tenga `data-status="en_proceso"`.
`case-views.test.ts`: `CASE_VIEW_LABEL` cubre `CASE_VIEWS`; `dueBadge('2026-09-06','2026-09-06','nuevo') === 'hoy'`, `dueBadge('2026-09-01','2026-09-06','en_proceso') === 'atrasado'`, `dueBadge('2026-09-01','2026-09-06','entregado') === null`, `dueBadge(null, …) === null`.
`date-format.test.ts`: `formatDate('2026-09-06') === '06/09/2026'`; `formatDate(null) === '—'`.
`cases-table.test.tsx`: con `setMatchMedia(true)` y dos filas (una `urgente` atrasada) muestra el código como enlace a `/trabajos/$caseId`, el chip de estado, "Atrasado" y el total; con `hidePrices` no renderiza la columna "Total"; en móvil (`setMatchMedia(false)`) renderiza tarjetas con el mismo código. Envolver en un `RouterProvider` de prueba: crear `apps/web/src/test/router.tsx` con `createMemoryRouter`-equivalente de TanStack (`createRouter({ routeTree: createRootRoute({ component: () => ui }) , history: createMemoryHistory() })`) y exportar `renderWithRouter(ui)`.

- [ ] **Step 2: Implementación (GREEN)**

`status-chip.tsx`:
```tsx
import type { CaseStatus } from '@dentalware/shared'

export const STATUS_LABEL: Record<CaseStatus, string> = {
  nuevo: 'Nuevo', en_proceso: 'En proceso', en_espera: 'En espera', en_prueba: 'En prueba',
  terminado: 'Terminado', enviado: 'Enviado', entregado: 'Entregado', cancelado: 'Cancelado',
}
/** Colores del spec §5 (chip + texto, nunca solo color). */
export const STATUS_COLOR: Record<CaseStatus, string> = {
  nuevo: '#0F766E', en_proceso: '#0F766E', en_espera: '#D99A16', en_prueba: '#7C5CBF',
  terminado: '#8CC9A6', enviado: '#2F6FB0', entregado: '#2F8F5B', cancelado: '#D6453D',
}
export function StatusChip({ status }: { status: CaseStatus }) {
  return (
    <span
      data-status={status}
      style={{ '--chip': STATUS_COLOR[status] } as React.CSSProperties}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--chip)]/40 bg-[color:var(--chip)]/10 px-2 py-0.5 text-xs font-medium text-[color:var(--chip)]"
    >
      <span aria-hidden className="size-1.5 rounded-full bg-[color:var(--chip)]" />
      {STATUS_LABEL[status]}
    </span>
  )
}
```
(`nuevo` usa fondo `--teal-lab-soft` y texto `--teal-lab`: el mismo par que el chip genera con `#0F766E` al 10 %.)

`api.ts` (mismo patrón que `features/products/api.ts`, con `api.api.trabajos`): `fetchCases(query: CaseListQueryInput)` serializa solo las claves definidas a `query: Record<string,string>`; `fetchCase(id)` devuelve `{ case, missing }`; `createCase`/`updateCase` devuelven `case`; `fetchEvents`; `postComment`. Tipos exportados `CaseListRow`, `CaseDetail`, `CaseEvent` derivados de `Awaited<ReturnType<…>>`.

`use-cases.ts`: `useCases(query)` con `placeholderData: keepPreviousData`; mutaciones invalidan `['trabajos']`; toasts "Trabajo creado" / "Trabajo actualizado" / "Comentario publicado".

`cases-table.tsx`: `DataTable` con columnas Código (enlace `font-mono`), Clínica / Doctor (dos líneas), Paciente, Trabajo (`itemsSummary`), Entrega (`formatDate(promisedDate ?? dueDate)` + badge "Hoy" ámbar / "Atrasado" rojo), Estado (`StatusChip`), Total (`$ 147.00`, oculta si `hidePrices`). La celda del código lleva `borderLeft: 4px solid STATUS_COLOR[status]` vía `className="border-l-4"` + `style={{ borderLeftColor }}` en la primera celda; en móvil la tarjeta entera lleva la pestaña. Prioridad `urgente` muestra un `Badge variant="destructive"` "Urgente" junto al código.

`cases-filters.tsx`: `Input` de búsqueda (`aria-label="Buscar por código, paciente o caja"`), `Select` de clínica (opción "Todas"), `Select` de doctor dependiente, `Select` de estado, dos `Input type="date"` (Desde/Hasta) y botón "Limpiar". Todo `h-11`. En móvil los filtros van en un `details`/botón "Filtros" plegable; la búsqueda siempre visible.

`routes/_app/trabajos.tsx`:
```tsx
import { createFileRoute, Outlet } from '@tanstack/react-router'
export const Route = createFileRoute('/_app/trabajos')({ component: () => <Outlet /> })
```
`routes/_app/trabajos/index.tsx`: `validateSearch: (s) => caseListQuerySchema.partial().parse(s)`; `PageHeader` "Trabajos" con acción "Nuevo trabajo" (`Link to="/trabajos/nuevo"`, solo admin/recepción; el rol viene de `Route.useRouteContext().user.role` del layout `_app`) y botón secundario "Importar" (Task 11, deshabilitado hasta entonces); `Tabs` con las seis vistas; `CasesFilters`; `CasesTable`; paginación. `hidePrices = role === 'tecnico' || role === 'mensajero'`.

- [ ] **Step 3: Verificación en Chrome DevTools**

Arrancar API y web; con datos de la Iteración 1 crear 3 trabajos vía `POST /api/trabajos` con `curl` (uno urgente atrasado, uno con fecha de hoy, uno sin fecha); comprobar a 1280×800: pestañas cambian la URL (`?vista=atrasados`), búsqueda filtra, pestaña de color y chips; a 390×844: tarjetas, filtros plegados, sin scroll horizontal; consola limpia. Iniciar sesión como técnico (crear uno en /configuracion/usuarios) y confirmar que no aparece la columna Total ni el botón "Nuevo trabajo".

- [ ] **Step 4: Ejecutar y commit**

```bash
pnpm --filter @dentalware/web test && pnpm typecheck && pnpm lint && pnpm format:check
git add apps/web && git commit -m "feat(web): lista de trabajos con vistas rápidas, filtros, chips de estado y pestaña de color

Refs #3"
```

---

### Task 8: Web — odontograma FDI interactivo (Refs #3)

**Files:**
- Create: `apps/web/src/features/cases/odontogram.tsx`, `odontogram.test.tsx`, `teeth-dialog.tsx`

**Interfaces:**
- Consumes: `FDI_TEETH`, `FDI_QUADRANTS`, `toothLabel`.
- Produces: `<Odontogram value: number[] onChange?: (teeth: number[]) => void readOnly? size?: 'sm'|'md' />` — 32 botones (`role="button"`, `aria-pressed`, `aria-label={toothLabel(n)}`, mínimo 44×44 en `md`, 28 en `sm`) dispuestos como en la orden en papel: fila superior 18…11 | 21…28, fila inferior 48…41 | 31…38, con un separador vertical en la línea media y etiquetas "Superior"/"Inferior". Botones "Arcada superior" / "Arcada inferior" / "Limpiar" que seleccionan/deseleccionan en bloque. Piezas seleccionadas en `--teal-lab` (fondo) con número en blanco. Cada botón contiene el número en `font-mono` y un pequeño SVG de diente (path único de 16×20, relleno según selección). `readOnly` desactiva interacción y muestra las piezas seleccionadas (para la ficha).
- `<TeethDialog open onOpenChange value onSave title />` envuelve el odontograma en `Dialog` con botones "Guardar" / "Cancelar" y contador "N piezas".

- [ ] **Step 1: Tests (RED)** — `odontogram.test.tsx`:
  - renderiza 32 botones con `aria-pressed="false"` y etiquetas FDI en orden `18…11, 21…28, 48…41, 31…38`.
  - clic en `11` llama `onChange([11])`; con `value=[11]`, clic en `11` llama `onChange([])`; clic en `12` con `value=[11]` llama `onChange([11, 12])` (ordenado).
  - "Arcada superior" selecciona las 16 superiores; "Limpiar" llama `onChange([])`.
  - `readOnly`: botones `disabled` y `aria-pressed` refleja `value`.
  - teclado: `Enter`/`Space` sobre un botón alterna (nativo de `<button>`: basta comprobar con `user.keyboard('{Enter}')` tras `focus`).

- [ ] **Step 2: Implementación (GREEN)**

```tsx
import { FDI_QUADRANTS, toothLabel, type FdiTooth } from '@dentalware/shared'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const UPPER: readonly FdiTooth[] = [...FDI_QUADRANTS[1], ...FDI_QUADRANTS[2]]
const LOWER: readonly FdiTooth[] = [...FDI_QUADRANTS[4], ...FDI_QUADRANTS[3]]
const TOOTH_PATH = 'M8 1c3 0 6 2 6 6 0 3-1 5-1 9 0 2-1 3-2 3s-1-3-3-3-2 3-3 3-2-1-2-3c0-4-1-6-1-9 0-4 3-6 6-6z'

export function Odontogram({ value, onChange, readOnly = false, size = 'md' }: {
  value: readonly number[]; onChange?: (teeth: number[]) => void; readOnly?: boolean; size?: 'sm' | 'md'
}) {
  const selected = new Set(value)
  const toggle = (n: FdiTooth) => {
    if (readOnly || !onChange) return
    const next = new Set(selected)
    next.has(n) ? next.delete(n) : next.add(n)
    onChange([...next].sort((a, b) => a - b))
  }
  const setMany = (teeth: readonly FdiTooth[], on: boolean) => {
    if (readOnly || !onChange) return
    const next = new Set(selected)
    teeth.forEach((t) => (on ? next.add(t) : next.delete(t)))
    onChange([...next].sort((a, b) => a - b))
  }
  const allOn = (teeth: readonly FdiTooth[]) => teeth.every((t) => selected.has(t))
  const cell = size === 'md' ? 'size-11' : 'size-7 text-[10px]'
  const row = (teeth: readonly FdiTooth[], label: string) => (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="grid grid-cols-[repeat(8,minmax(0,1fr))_4px_repeat(8,minmax(0,1fr))] gap-1">
        {teeth.map((n, i) => (
          <>
            {i === 8 && <span key="mid" aria-hidden className="w-1 self-stretch rounded bg-border" />}
            <button
              key={n} type="button" disabled={readOnly} aria-pressed={selected.has(n)} aria-label={toothLabel(n)}
              onClick={() => toggle(n)}
              className={cn('flex flex-col items-center justify-center rounded-md border text-xs font-mono transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default', cell,
                selected.has(n) ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-accent/60')}
            >
              <svg viewBox="0 0 16 20" className={size === 'md' ? 'h-4 w-3' : 'h-3 w-2'} aria-hidden><path d={TOOTH_PATH} fill={selected.has(n) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.2" /></svg>
              {n}
            </button>
          </>
        ))}
      </div>
    </div>
  )
  return (
    <div className="flex flex-col gap-3" data-testid="odontogram">
      {row(UPPER, 'Superior')}
      {row(LOWER, 'Inferior')}
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setMany(UPPER, !allOn(UPPER))}>Arcada superior</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setMany(LOWER, !allOn(LOWER))}>Arcada inferior</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange?.([])}>Limpiar</Button>
        </div>
      )}
    </div>
  )
}
```
(Sustituir el fragmento `<>…</>` con `key` por un `Fragment key={n}` explícito para que React no avise.) `teeth-dialog.tsx`: estado local `draft` inicializado con `value`, `Odontogram` + contador `${draft.length} piezas` + footer Guardar/Cancelar; al guardar `onSave(draft)`.

- [ ] **Step 3: Verificación en Chrome** — montar temporalmente el odontograma en una ruta de prueba no es necesario: se verifica en la Tarea 9 dentro del formulario. Ejecutar tests, typecheck, lint; commit `feat(web): odontograma FDI interactivo y diálogo de piezas` (Refs #3).

---

### Task 9: Web — formulario de trabajo (crear y editar) (Refs #3)

**Files:**
- Create: `apps/web/src/features/cases/case-form.tsx`, `case-form.test.tsx`, `case-items-editor.tsx`, `checklist-field.tsx`, `case-totals.ts`, `case-totals.test.ts`, `apps/web/src/routes/_app/trabajos/nuevo.tsx`, `apps/web/src/routes/_app/trabajos/$caseId.editar.tsx`
- Modify: `apps/web/src/features/products/api.ts` (nada), `apps/web/src/features/clinics/use-clinics.ts` (nada) — se reutilizan `useClinics`, `useDoctors(clinicId)`, `useProducts(false)`, `useClinicPrices(clinicId)`, `useUsers` (técnicos).

**Interfaces:**
- Produces: `<CaseForm initial?: CaseDetail onSubmit(input: CaseInput, andNew: boolean) pending role />` página completa (no diálogo) con secciones: **Clínica y paciente** (Clínica → Doctor dependiente, Referencia del paciente, Edad, Sexo M/F, Nº de caja, Prioridad, Fecha de ingreso (hoy por defecto), Fecha deseada), **Trabajo** (`CaseItemsEditor`: filas con Producto (`Select` con código y nombre), Cantidad, Piezas (botón "Piezas (N)" que abre `TeethDialog`; para `por_arcada` muestra "Arcada"), Precio unitario (auto desde `useClinicPrices` + `basePrice`; editable solo admin/recepción), Descuento %, Material, Nota; botón "Agregar línea"; total por línea y total del trabajo con `case-totals.ts`), **Color** (Color, Sistema `Select`, Referencia), **Lista de verificación** (`ChecklistField`: 4 `Switch` con `CHECKLIST_LABEL` — "Antagonista", "Mordida", "Color", "Fotos"), **Notas** (Observaciones, Prescripción, Notas internas), y al pie "Guardar", "Guardar y nuevo" (solo al crear) y "Cancelar". Panel lateral (PC) / bloque superior (móvil) "Para aceptar falta: …" alimentado por `missingForAccept` con los valores actuales del formulario (`useWatch`).
- `computeTotals(items: { unitPrice: string | null; quantity: number; discountPct: number }[])` → `{ lines: string[]; total: string }` usando `money.ts` (líneas sin precio cuentan `'0.00'`).
- Rutas: `/trabajos/nuevo` (`beforeLoad`: solo admin|recepcion → si no, `redirect({ to: '/trabajos' })`), `/trabajos/$caseId/editar` (carga `useCase`, redirige a la ficha con toast si el estado no es editable).

- [ ] **Step 1: Tests (RED)**

`case-totals.test.ts`: dos líneas `['45.00'×2 −10 %, '75.00'×1]` → `lines ['81.00','75.00']`, `total '156.00'`; línea sin precio → `'0.00'`.
`case-form.test.tsx` (con `renderWithProviders` + `renderWithRouter`, y `vi.mock('@/features/cases/api')`, `vi.mock('@/features/clinics/api')`, `vi.mock('@/features/doctors/api')`, `vi.mock('@/features/products/api')` devolviendo catálogos fijos):
  - enviar vacío muestra "La referencia del paciente es obligatoria" y "Agrega al menos una línea de trabajo" (`role="alert"`), y no llama `onSubmit`.
  - elegir clínica habilita doctores de esa clínica; elegir producto ZR con precio especial `40.00` rellena "Precio unitario" con `40.00` y el total muestra `$ 40.00`; cantidad 2 → `$ 80.00`.
  - el panel "Para aceptar falta" lista "Fecha deseada" hasta que se llena la fecha.
  - con `role='tecnico'` el campo de precio no se renderiza (el formulario nunca se abre para técnico, pero el componente lo respeta).
  - "Guardar y nuevo" llama `onSubmit(input, true)` con `items[0].teeth` = las piezas guardadas desde el diálogo (abrir "Piezas", pulsar 11 y 12, Guardar).

- [ ] **Step 2: Implementación (GREEN)**

`case-form.tsx` usa `useForm<z.input<typeof caseInputSchema>, unknown, CaseInput>({ resolver: zodResolver(caseInputSchema), defaultValues })` y `useFieldArray({ name: 'items' })`; `defaultValues` desde `initial` (mapear `null` → `''` en textos, `teeth` tal cual, `unitPrice` tal cual, `discountPct: Number(i.discountPct)`) o valores de nuevo (`receivedAt: toIsoDate(new Date())`, `priority: 'normal'`, `checklist` en falso, `items: []`). Al cambiar la clínica se limpia el doctor y se recalculan precios automáticos de las líneas cuyo precio no fue editado a mano (flag local `manualPrice[index]`). `CaseItemsEditor` recibe `products`, `prices` (Map productId→precio efectivo), `canEditPrice`, y usa `Controller` por campo; cada fila en PC es una fila de grid de 7 columnas y en móvil una tarjeta apilada. `ChecklistField` renderiza 4 `Switch` con `Label`. Botón primario `h-11`, ancho completo en móvil. El envío mapea `''` → `null` donde el schema lo permite (`nullable(...)`) — el schema ya lo hace en `parse`, así que basta enviar `form.handleSubmit((data) => onSubmit(data, andNew))`.

`routes/_app/trabajos/nuevo.tsx`:
```tsx
export const Route = createFileRoute('/_app/trabajos/nuevo')({
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'admin' && context.user.role !== 'recepcion') throw redirect({ to: '/trabajos' })
  },
  component: NewCasePage,
})
function NewCasePage() {
  const navigate = useNavigate()
  const create = useCreateCase()
  const { user } = Route.useRouteContext()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nuevo trabajo" description="Registra la orden tal como llega de la clínica." />
      <CaseForm role={user.role} pending={create.isPending}
        onSubmit={(input, andNew) => create.mutate(input, { onSuccess: (c) => (andNew ? window.scrollTo(0, 0) : navigate({ to: '/trabajos/$caseId', params: { caseId: c.id } })) })} />
    </div>
  )
}
```
(Con "Guardar y nuevo" el formulario se reinicia con `key` incremental en el padre.)

- [ ] **Step 3: Verificación en Chrome DevTools** — 1280×800: crear un trabajo completo (clínica → doctor, ZR ×2 con piezas 11 y 12, AC ×1 arcada, descuento 10 %, color A2 VITA Classical, checklist con 3 marcados, observaciones), ver totales y "Para aceptar falta" vaciarse al completar; guardar → redirige a la ficha (placeholder hasta la Tarea 10: comprobar la URL y el 200 del POST). 390×844: campos apilados, odontograma con celdas ≥ 44 px, botones al pie de ancho completo; consola limpia. Editar el trabajo creado desde `/trabajos/$caseId/editar` y cambiar un precio → PUT 200.

- [ ] **Step 4: Ejecutar y commit**

```bash
pnpm --filter @dentalware/web test && pnpm typecheck && pnpm lint && pnpm format:check
git add apps/web && git commit -m "feat(web): formulario de trabajo con odontograma, líneas con precio por clínica, checklist y datos obligatorios

Refs #3"
```

---

### Task 10: Web — ficha del trabajo: detalle, fotos y historial con comentarios (Refs #3)

**Files:**
- Create: `apps/web/src/features/cases/case-header.tsx`, `case-detail-tab.tsx`, `case-history.tsx`, `case-history.test.tsx`, `comment-form.tsx`, `comment-form.test.tsx`, `attachments-api.ts`, `use-attachments.ts`, `photos-tab.tsx`, `photo-uploader.tsx`, `photo-uploader.test.tsx`, `apps/web/src/lib/image-compress.ts`, `image-compress.test.ts`, `apps/web/src/routes/_app/trabajos/$caseId.tsx`

**Interfaces:**
- Consumes: `GET /api/trabajos/:id` (`{ case, missing }`), `GET /api/trabajos/:id/eventos`, `POST /api/trabajos/:id/comentarios`, `GET/POST /api/adjuntos/trabajo/:caseId`, `DELETE /api/adjuntos/:id`.
- Produces:
  - `<CaseHeader case missing role />`: pestaña de color, código `font-mono` 24 px, chip de estado, prioridad, clínica · doctor, paciente (ref, edad, sexo), fechas (ingreso, deseada, comprometida), técnico y fase si existen, total (oculto por rol), botón "Editar" (admin|recepcion, solo `nuevo|en_proceso`) y aviso "Para aceptar falta: …" cuando `missing.length > 0`.
  - `<CaseDetailTab case hidePrices />`: líneas (producto, cantidad, piezas con `Odontogram readOnly size="sm"` por línea, precio, descuento, total), color/sistema/referencia, lista de verificación (chips "Antagonista ✓ / Mordida ✗ …" con texto), observaciones, prescripción, notas internas (solo admin|recepcion).
  - `<CaseHistory events />`: lista cronológica con icono por tipo, texto en español (`EVENT_LABEL: Record<CaseEventType, string>` — `created: 'Trabajo creado'`, `comment: 'Comentario'`, `attachment_added: 'Adjunto agregado'`, `edited: 'Datos editados'`, `price_changed: 'Precio modificado'`, …), autor y fecha relativa (`hace 5 min` con `Intl.RelativeTimeFormat('es')`); los comentarios muestran su texto en un bloque.
  - `<CommentForm onSubmit pending />`: `Textarea` + botón "Comentar"; valida con `commentSchema`.
  - `compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<Blob>` con `createImageBitmap` + `canvas` (si el navegador no soporta o el archivo no es imagen, devuelve el original).
  - `<PhotoUploader caseId onUploaded />`: `<input type="file" accept="image/*,application/pdf" capture="environment" multiple>` oculto tras un botón `h-11` "Añadir foto" y otro "Subir archivo" (sin `capture`); comprime en cliente, sube en serie con progreso "2 de 3…", toast por error; `useUploadAttachment(caseId)` invalida `queryKeys.attachments(caseId)` y `queryKeys.caseEvents(caseId)`.
  - `<PhotosTab caseId role />`: grilla de miniaturas (`img src=thumbUrl`, `loading="lazy"`, `alt=filename`), clic abre `Dialog` con la imagen completa y botón "Abrir original"; documentos PDF se listan con icono y enlace; botón "Eliminar" (admin|recepcion) con `ConfirmDialog`.
  - Ruta `/trabajos/$caseId`: `Tabs` Detalle · Fotos · Historial, con contador de fotos y de comentarios en las pestañas.

- [ ] **Step 1: Tests (RED)**
  - `image-compress.test.ts`: con un `File` `text/plain` devuelve el mismo objeto; con `createImageBitmap` simulado (`vi.stubGlobal`) y `HTMLCanvasElement.prototype.toBlob` simulado, devuelve un `Blob` `image/jpeg` y pide un canvas de ≤ 1600 px (comprobar `canvas.width`).
  - `case-history.test.tsx`: renderiza "Trabajo creado" y un comentario con su texto y autor; orden ascendente.
  - `comment-form.test.tsx`: enviar vacío muestra "Escribe un comentario"; con texto llama `onSubmit({ text })` y limpia el campo.
  - `photo-uploader.test.tsx`: `user.upload(input, file)` llama a la mutación con el `FormData` (mock de `attachments-api.uploadAttachment`) y muestra "1 de 1…" mientras `pending`.

- [ ] **Step 2: Implementación (GREEN)** — `attachments-api.ts` usa `api.api.adjuntos.trabajo[':caseId'].$post({ param, form: { file, kind } })` (hc soporta `form`); `use-attachments.ts` con `useAttachments(caseId)`, `useUploadAttachment(caseId)`, `useDeleteAttachment(caseId)`. La ruta:
```tsx
export const Route = createFileRoute('/_app/trabajos/$caseId')({ component: CasePage })
function CasePage() {
  const { caseId } = Route.useParams()
  const { user } = Route.useRouteContext()
  const q = useCase(caseId)
  const events = useEvents(caseId)
  const attachments = useAttachments(caseId)
  if (q.isPending) return <p className="text-sm text-muted-foreground">Cargando…</p>
  if (q.isError || !q.data) return <EmptyState title="El trabajo no existe" action={<Button asChild><Link to="/trabajos">Volver a trabajos</Link></Button>} />
  const hidePrices = user.role === 'tecnico' || user.role === 'mensajero'
  const comments = (events.data ?? []).filter((e) => e.type === 'comment').length
  return (
    <div className="flex flex-col gap-6">
      <CaseHeader case={q.data.case} missing={q.data.missing} role={user.role} />
      <Tabs defaultValue="detalle">
        <TabsList>
          <TabsTrigger value="detalle">Detalle</TabsTrigger>
          <TabsTrigger value="fotos">Fotos ({attachments.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="historial">Historial ({comments})</TabsTrigger>
        </TabsList>
        <TabsContent value="detalle" className="pt-4"><CaseDetailTab case={q.data.case} hidePrices={hidePrices} role={user.role} /></TabsContent>
        <TabsContent value="fotos" className="pt-4"><PhotosTab caseId={caseId} role={user.role} /></TabsContent>
        <TabsContent value="historial" className="flex flex-col gap-4 pt-4">
          <CommentForm onSubmit={(v) => addComment.mutate(v)} pending={addComment.isPending} />
          <CaseHistory events={events.data ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```
(`addComment = useAddComment(caseId)` declarado arriba con los demás hooks, antes de los `return` tempranos.)

- [ ] **Step 3: Verificación en Chrome DevTools** — ficha del trabajo de la Tarea 9 a 1280×800 y 390×844: cabecera, líneas con odontograma de solo lectura, checklist, subir una foto real (usar `upload_file` de DevTools con un PNG del scratchpad) → miniatura aparece y el historial registra "Adjunto agregado"; comentar como técnico (sesión aparte) y comprobar que no ve precios ni notas internas; eliminar la foto como admin; consola limpia; el `POST /api/adjuntos/...` devuelve 201 con `width ≤ 1600`.

- [ ] **Step 4: Ejecutar y commit** — `feat(web): ficha del trabajo con detalle, fotos con compresión en cliente y historial con comentarios` (Refs #3).

---

### Task 11: Importación de trabajos desde plantilla CSV (Refs #3)

**Files:**
- Create: `packages/shared/src/csv.ts`, `csv.test.ts`, `packages/shared/src/schemas/import.ts`, `import.test.ts`, `apps/api/src/features/cases/import.ts`, `import.test.ts`, `apps/web/src/features/cases/import-dialog.tsx`, `import-dialog.test.tsx`, `use-import.ts`
- Modify: `packages/shared/src/index.ts`, `apps/api/src/features/cases/routes.ts` (montar `importRoutes`), `apps/web/src/features/cases/api.ts`, `apps/web/src/routes/_app/trabajos/index.tsx` (botón "Importar" activo para admin|recepcion)

**Interfaces:**
- `parseCsv(text: string): string[][]` (RFC 4180: comillas, comas y saltos de línea dentro de comillas, `\r\n`, BOM; filas vacías ignoradas) y `toCsv(rows: string[][]): string`.
- `IMPORT_COLUMNS = ['clinica','doctor','paciente','producto','piezas','cantidad','color','fecha_deseada','caja','observaciones'] as const`; `importRowSchema` (valida una fila ya mapeada por cabecera: `clinica`/`doctor`/`producto` texto no vacío, `piezas` "11,12,21" → `number[]` FDI (vacío permitido), `cantidad` entero ≥ 1 (por defecto 1), `fecha_deseada` ISO o `DD/MM/AAAA` → ISO, `color`/`caja`/`observaciones` opcionales).
- `importCases(db, { rows, actorId, today, commit }): Promise<ImportReport>` con `ImportReport = { totalRows: number; cases: number; errors: { row: number; column: string; message: string }[]; created: string[] }`: agrupa filas consecutivas con la misma (clinica, doctor, paciente, fecha_deseada, caja) en un trabajo; resuelve clínica y doctor por nombre (insensible a mayúsculas y acentos; doctor dentro de la clínica) y producto por código o nombre; con errores no crea nada; con `commit` y sin errores crea los trabajos en una transacción (reutiliza `createCase` por trabajo dentro de `db.transaction`… `createCase` abre su propia transacción: refactorizar `createCase` en `createCaseTx(tx, …)` + wrapper) y devuelve los códigos.
- Rutas: `GET /api/trabajos/importar/plantilla` → `text/csv; charset=utf-8` con cabecera y una fila de ejemplo (`Content-Disposition: attachment; filename="plantilla-trabajos.csv"`); `POST /api/trabajos/importar?confirmar=true|false` (admin|recepcion) multipart `file` (CSV ≤ 2 MB) → 200 `ImportReport` (422 si falta el archivo o la cabecera no coincide).
- Web: `ImportDialog` con paso 1 (enlace "Descargar plantilla", input de archivo, botón "Validar"), paso 2 (resumen "12 filas → 5 trabajos" o tabla de errores fila/columna/mensaje) y botón "Importar N trabajos" que llama con `confirmar=true` e invalida la lista.

- [ ] **Step 1: Tests (RED)** — `csv.test.ts` (comillas escapadas `""`, coma dentro de comillas, `\r\n`, BOM, línea vacía final, `toCsv` cita valores con coma/comilla/salto); `import.test.ts` (shared: fila válida mapeada, `piezas` inválida → mensaje "Pieza dental FDI inválida", fecha `15/09/2026` → `2026-09-15`); `import.test.ts` (api: plantilla descargable; CSV con 3 filas de 2 trabajos → `cases: 2`, `errors: []`, sin filas creadas cuando `confirmar=false`; con `confirmar=true` crea 2 trabajos con sus líneas y precios; clínica desconocida → error `{ row: 2, column: 'clinica', message: 'La clínica "X" no existe' }` y no crea nada; técnico → 403).

- [ ] **Step 2: Implementación (GREEN)** — `csv.ts` con un autómata de 3 estados (fuera de campo, en campo sin comillas, en campo con comillas); `import.ts` de la API construye `CaseInput` por grupo y llama `createCaseTx`; normalización de nombres con `s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()`.

- [ ] **Step 3: Verificación en Chrome** — descargar la plantilla desde el diálogo, subir un CSV con un error y otro limpio; ver el informe y la creación; consola limpia. Commit `feat: importación de trabajos desde plantilla CSV con informe de errores` (Refs #3).

---

### Task 12: E2E de Trabajos I, README y cierre de la iteración (Refs #33, #3)

**Files:**
- Create: `apps/web/e2e/trabajos.spec.ts`, `apps/web/e2e/fixtures/foto.png` (PNG de 640×480 generado con `sharp` en un script de un solo uso o guardado desde el scratchpad; < 50 KB)
- Modify: `apps/web/e2e/helpers.ts` (helper `createClinicWithDoctor(page)` vía API y `createProduct(page)`), `README.md` (sección "Trabajos"), `docs/superpowers/plans/2026-09-06-iteracion-2-trabajos-i.md` (casillas)

- [ ] **Step 1: E2E** — `trabajos.spec.ts` (escritorio y android):
  1. `crea un trabajo con odontograma y lo ve en la lista`: admin crea clínica+doctor+producto por API, va a `/trabajos/nuevo`, completa el formulario (piezas 11 y 12 desde el diálogo), guarda, comprueba el código `/^\d{2}-\d{5}$/` en la cabecera de la ficha y que aparece en `/trabajos?vista=nuevos`.
  2. `comenta y sube una foto`: en la ficha, pestaña Historial → comentario visible con autor; pestaña Fotos → `setInputFiles('e2e/fixtures/foto.png')` → miniatura visible y "Adjunto agregado" en el historial.
  3. `un técnico ve el trabajo sin precios`: crea técnico por API, nuevo contexto, abre la ficha: no aparece "$" ni "Total"; puede comentar.
  4. `importa dos trabajos desde CSV`: sube un CSV en memoria (`setInputFiles({ name, mimeType: 'text/csv', buffer })`), valida, importa, ve "2 trabajos" y ambos códigos en la lista.
  Expected: 7 (previos) + 4 = 11 tests × 2 proyectos = 22.

- [ ] **Step 2: Verificación completa** — `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` (web incluido) y E2E; recorrido final en Chrome DevTools (lista, nuevo, ficha, importar) a 1280×800 y 390×844 sin errores de consola; servidores detenidos al terminar.

- [ ] **Step 3: README** — tras "Configuración inicial": 
```markdown
## Trabajos

Recepción registra cada orden en **Trabajos → Nuevo trabajo** siguiendo la hoja en papel: clínica y doctor, referencia del paciente, líneas de trabajo con piezas FDI en el odontograma, color VITA, lista de verificación (antagonista, mordida, color, fotos) y observaciones. El precio sale del catálogo y de los precios especiales de la clínica; técnicos y mensajeros nunca ven montos. La ficha guarda fotos (comprimidas en el navegador) y comentarios con historial. **Importar** acepta la plantilla CSV descargable (una fila por línea de trabajo) y muestra los errores por fila antes de crear nada. Los archivos se guardan en `UPLOAD_DIR` (volumen `uploads` en producción).
```

- [ ] **Step 4: Marcar el plan y commit final**

```bash
sed -i 's/^- \[ \]/- [x]/' docs/superpowers/plans/2026-09-06-iteracion-2-trabajos-i.md
git add apps/web README.md docs/superpowers/plans/2026-09-06-iteracion-2-trabajos-i.md
git commit -m "test(web): E2E de trabajos; docs de trabajos y cierre de la iteración 2

Refs #33, #3

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi"
```

- [ ] **Step 5: Issue de revisión UI/UX de la iteración** (regla de Nelson, 2026-09-06)

```bash
gh issue create --title "Revisión UI/UX de la Iteración 2 (Trabajos I) con frontend-design" --label historia --label area:web --label accessibility --milestone "Iteración 3 — Trabajos II" --body "Recorrer con frontend-design todas las pantallas nuevas (lista, nuevo/editar trabajo con odontograma, ficha con fotos e historial, importación) a 1280×800, 390×844 y 360×740; verificar jerarquía visual y dirección de diseño, responsividad, usabilidad y accesibilidad (44 px, foco, teclado, contraste AA), copy claro para recepción/técnico/mensajero y flujos reales (registrar una orden en papel completa, subir fotos desde el celular). Informe priorizado + ola de fixes antes de la Iteración 3. Épica #3."
```
Añadirlo al tablero en "Por hacer" y enlazarlo como sub-issue de la épica #3.

---

## Self-review (hecho al redactar)

- **Cobertura del spec:** §4 `cases`/`case_items`/`case_events`/`attachments` (T3; columnas de iteraciones futuras creadas ya como nulas para no repetir migraciones), `case_sequences` (código por año, §7); §5 orden en papel → campos `boxNumber`, `patientAge/Sex`, `shade/shadeSystem/reference`, checklist (T2/T3/T9/T10), importación (T11); §6 pantallas 3 (T7), 4 (T8/T9), 5 sin pestañas Entregas/Documentos (Iteraciones 3-4) (T10); §7 datos obligatorios → `missingForAccept` mostrado en formulario y ficha y devuelto por la API (T2/T5/T9/T10; la validación bloqueante se aplica en `aceptar`, Iteración 3); precios ocultos por rol (T4/T5/T7/T9/T10); §8 harness web (T1) y E2E (T12).
- **Fuera de alcance explícito (rulings del controlador):** XLSX (solo CSV), driver S3/R2 (issue aparte, decisión de Nelson), arrastre para puentes en el odontograma (selección por toque), `requires_shade` en productos (la regla de color queda parametrizada), estados `por_recoger`/`cobrado` (Iteración 3/4/5), avisos a la clínica por checklist incompleto (Iteración 6).
- **Consistencia de nombres:** `caseInputSchema`/`CaseInput` (T2) en repo, rutas, formulario e importación; `stripPrices` y `total: null` (T4/T5/T7/T10); `queryKeys.cases/case/caseEvents/attachments` (T7/T10); `AttachmentDto.url/thumbUrl` (T6/T10); `createCaseTx` (T11 refactoriza T4 sin cambiar la firma pública de `createCase`); `todayIso` (T5/T11); `renderWithProviders`/`setMatchMedia`/`renderWithRouter` (T1/T7/T9).
- **Riesgos conocidos:** (1) relaciones v2 hacia `users` (auth) desde `appRelations` → BLOCKED con error exacto si no tipa (T3); (2) `.for('update')` y `orderBy` con `sql` mixto en rc.4 → alternativas indicadas (T4); (3) `sharp` en `node:24-alpine` → `vips-dev` (T6); (4) `hc` con `form` y `File` en jsdom para tests del uploader → mockear `attachments-api` (T10); (5) `validateSearch` con zod en TanStack Router 1.170 → si `parse` lanza, usar `caseListQuerySchema.partial().catch({})` (T7).
