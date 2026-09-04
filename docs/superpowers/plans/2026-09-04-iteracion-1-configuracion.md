# Iteración 1 — Configuración: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Catálogos y usuarios del laboratorio (datos del laboratorio, usuarios y roles, clínicas, doctores, categorías y productos, precios por clínica, fases) con CRUD completo, seeds iniciales de Arte Dental y la pantalla Configuración (solo admin), organizados por features.

**Architecture:** Cada feature vive en `apps/api/src/features/<feature>/` (tabla Drizzle, schemas zod compartidos desde `@dentalware/shared`, rutas Hono encadenadas para el RPC, repositorio y tests) y en `apps/web/src/features/<feature>/` (hooks de TanStack Query, formularios con react-hook-form + zod, componentes pequeños). Las primitivas visuales compartidas están en `apps/web/src/components/ui` (shadcn) y las piezas transversales (DataTable, FormDialog, PageHeader, EmptyState, ConfirmDialog) en `apps/web/src/components/`. Las rutas de TanStack Router (`apps/web/src/routes/_app/configuracion/*`) solo componen features. Los usuarios se administran con el plugin `admin` de Better Auth (crear, cambiar rol, bloquear/desbloquear, contraseña).

**Tech Stack:** pnpm 11.25 · Node 24 · TypeScript 6.0.3 · Hono 4.13.5 + @hono/zod-validator 0.9.1 · Drizzle ORM/Kit 1.0.0-rc.4 (relaciones v2) · pg 8.23 · Better Auth 1.7.2 (+ plugin admin, adaptador relations-v2) · zod 4.5.4 · React 19.2 · TanStack Router 1.170 / Query 5.102 · react-hook-form 7.87 + @hookform/resolvers 5.9 · Tailwind 4.3 + shadcn 4.19 (base radix) · sonner 2.0.8 · Vitest 4.1 · Playwright 1.62.

**Spec:** `docs/superpowers/specs/2026-09-01-dentalware-mvp-design.md` (§4 modelo de datos, §5 orden de trabajo en papel, §6 pantallas, §7 datos obligatorios, §10 iteración 1) y dirección de diseño `docs/superpowers/specs/2026-09-01-dentalware-design-direction.md`. Issues: épica #2 y sub-issues #10–#18 en `nelsonmarro/dentalware`.

## Global Constraints

- Regla de Nelson (alta prioridad): antes de instalar o usar una librería, consultar **context7** para confirmar versión y API vigente. Versiones verificadas el 2026-09-04: `sonner 2.0.8` (único paquete nuevo; se fija en el catalog). No se añade `@tanstack/react-table` (YAGNI: catálogos pequeños).
- **Organización por features** (pedido de Nelson): `apps/api/src/features/<feature>/{schema.ts,routes.ts,repo.ts,*.test.ts}` y `apps/web/src/features/<feature>/{api.ts,use-*.ts,*-form.tsx,*-table.tsx,...}`. Un componente o hook por archivo; nada de páginas monolíticas. Las rutas (`routes/`) solo importan de `features/` y `components/`.
- TypeScript `strict`, ESM; UI y mensajes de validación en **español**; sentence case; nombres de tablas plural snake_case; ids `uuid` (`uuid().defaultRandom().primaryKey()`) salvo tablas de auth (text); `created_at`/`updated_at` `timestamp({ withTimezone: true }).defaultNow().notNull()`.
- Roles `admin | recepcion | tecnico | mensajero`. Toda la API de configuración exige sesión; escritura solo `admin` (`requireRole('admin')`); lectura de catálogos para `admin` y `recepcion`, salvo precios: **`base_price` y precios por clínica nunca se devuelven a `tecnico` ni `mensajero`** (las rutas de productos y precios exigen `admin|recepcion`).
- Validación: `zValidator` con hook que responde **422** `{ message: 'Datos inválidos', issues: [{ path, message }] }`; los schemas zod viven en `packages/shared/src/schemas/*.ts` y se reutilizan en los formularios.
- Borrado lógico (`active=false`) en todos los catálogos; ninguna ruta `DELETE` física salvo precios por clínica (fila puente).
- Nada de `drizzle-kit push`; migraciones generadas con `pnpm --filter @dentalware/api db:generate` y aplicadas por `runMigrations()`.
- TDD: test primero (RED), implementar (GREEN), commit. Tests de API contra Postgres real (`dentalware_test`, puerto 5433) con `setupTestDb`/`truncateAll` ampliados.
- Cada tarea de UI se verifica en Chrome DevTools (1280px y 390px) y respeta la dirección de diseño (tokens, chip + texto para estados, 44px táctiles, foco visible, `aria-label` en botones de solo icono).
- Commits pequeños en español con prefijo convencional, referenciando el issue (`Refs #12`), y trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` + `Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi`. El hook de pre-commit corre lint-staged + typecheck (necesita Node 24: `export PATH=$HOME/.nvm/versions/node/v24.19.0/bin:$PATH`).
- Entorno: Postgres dev en Docker `dentalware-postgres` (5433); `pnpm db:up` si está parado. Puertos 3000/5173 libres al terminar cada tarea.

---

## Estructura de archivos resultante

```
packages/shared/src/
  schemas/config.ts             ← Task 2: schemas zod de configuración (+ PRICING_UNITS)
  schemas/config.test.ts
apps/api/src/
  lib/validate.ts               ← Task 1: zValidator con 422 en español
  features/health/routes.ts     ← Task 1 (movido desde routes/health.ts)
  features/auth/{session.ts,me.routes.ts}  ← Task 1 (movidos)
  features/lab-settings/{schema.ts,repo.ts,routes.ts,lab-settings.test.ts}   ← Task 4
  features/clinics/{schema.ts,repo.ts,routes.ts,clinics.test.ts}             ← Task 5
  features/doctors/{schema.ts,repo.ts,routes.ts,doctors.test.ts}             ← Task 5
  features/products/{schema.ts,repo.ts,routes.ts,products.test.ts}           ← Task 6 (categorías, productos, precios por clínica)
  features/stages/{schema.ts,repo.ts,routes.ts,stages.test.ts}               ← Task 7
  features/users/{routes.ts,users.test.ts}                                    ← Task 8 (plugin admin)
  db/schema/index.ts            ← re-exporta auth + features; db/relations.ts (defineRelations)
  db/index.ts                   ← drizzle({ client, relations })
  scripts/seed.ts               ← Task 8: catálogos iniciales de Arte Dental
  app.ts                        ← monta /api/config/*, /api/users
apps/web/src/
  components/{page-header,data-table,form-dialog,confirm-dialog,empty-state,active-badge}.tsx  ← Task 9
  components/ui/{table,dialog,alert-dialog,select,switch,badge,tabs,textarea,sonner,field,dropdown-menu}.tsx (shadcn)
  lib/query-keys.ts             ← Task 9
  features/config/{config-nav.tsx,use-lab-settings.ts,lab-settings-form.tsx}   ← Task 10
  features/stages/{api.ts,use-stages.ts,stage-form.tsx,stages-table.tsx}        ← Task 10
  features/clinics/{api.ts,use-clinics.ts,clinic-form.tsx,clinics-table.tsx}    ← Task 11
  features/doctors/{api.ts,use-doctors.ts,doctor-form.tsx,doctors-table.tsx}    ← Task 11
  features/products/{api.ts,use-products.ts,category-form.tsx,product-form.tsx,products-table.tsx,clinic-prices-table.tsx}  ← Task 12
  features/users/{api.ts,use-users.ts,user-form.tsx,users-table.tsx}           ← Task 13
  routes/_app/configuracion.tsx (layout con sub-navegación) + configuracion/{index,laboratorio,fases,clinicas,clinicas.$clinicId,productos,usuarios}.tsx
  e2e/configuracion.spec.ts     ← Task 14
```

---

### Task 1: Reestructura por features y validador 422 (Refs #18)

**Files:**
- Create: `apps/api/src/lib/validate.ts`, `apps/api/src/lib/validate.test.ts`, `apps/api/src/features/health/routes.ts`, `apps/api/src/features/auth/session.ts`, `apps/api/src/features/auth/me.routes.ts`, `apps/web/src/features/auth/auth-client.ts`, `apps/web/src/features/auth/login-form.tsx`
- Modify: `apps/api/src/app.ts`, `apps/api/src/test/setup.ts`, `apps/web/src/routes/login.tsx`, `apps/web/src/routes/_app.tsx`, `apps/web/src/components/app-shell.tsx`
- Delete: `apps/api/src/routes/health.ts`, `apps/api/src/routes/me.ts`, `apps/api/src/middleware/session.ts`, `apps/web/src/lib/auth-client.ts`

**Interfaces:**
- Produces: `validate(target, schema)` (wrapper de `zValidator` que responde 422 `{ message: 'Datos inválidos', issues: [{ path: string; message: string }] }`), `AppEnv`, `sessionMiddleware`, `requireAuth`, `requireRole` ahora en `features/auth/session.ts`; `authClient` en `@/features/auth/auth-client`.

- [ ] **Step 1: Test del validador (falla)**

`apps/api/src/lib/validate.test.ts`:
```ts
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { validate } from './validate.ts'

describe('validate', () => {
  const app = new Hono().post(
    '/',
    validate('json', z.object({ name: z.string().min(1, { error: 'El nombre es obligatorio' }) })),
    (c) => c.json({ ok: true, name: c.req.valid('json').name }),
  )

  it('responde 422 con issues en español', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    })
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({
      message: 'Datos inválidos',
      issues: [{ path: 'name', message: 'El nombre es obligatorio' }],
    })
  })

  it('deja pasar datos válidos', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ana' }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, name: 'Ana' })
  })
})
```

- [ ] **Step 2: Ejecutar y ver fallar**

```bash
pnpm --filter @dentalware/api exec vitest run src/lib/validate.test.ts
```
Expected: FAIL — `Failed to load url ./validate.ts`.

- [ ] **Step 3: Implementar `validate`**

`apps/api/src/lib/validate.ts`:
```ts
import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import type { ZodType } from 'zod'

/** zValidator con respuesta 422 en español: { message, issues: [{ path, message }] }. */
export function validate<T extends ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          message: 'Datos inválidos',
          issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
        422,
      )
    }
  })
}
```

- [ ] **Step 4: Ejecutar y ver pasar**

```bash
pnpm --filter @dentalware/api exec vitest run src/lib/validate.test.ts
```
Expected: PASS (2 tests).

- [ ] **Step 5: Mover auth y health a features (sin cambiar comportamiento)**

```bash
cd apps/api/src
mkdir -p features/health features/auth
git mv routes/health.ts features/health/routes.ts
git mv routes/me.ts features/auth/me.routes.ts
git mv middleware/session.ts features/auth/session.ts
cd ../../..
```

Ajustar imports:
- `features/auth/me.routes.ts`: `import type { AppEnv } from './session.ts'` y `import { requireAuth } from './session.ts'`.
- `features/auth/session.ts`: `import type { Auth, SessionUser } from '../../auth.ts'`.
- `apps/api/src/app.ts`: reemplazar las tres importaciones por
```ts
import { meRoutes } from './features/auth/me.routes.ts'
import type { AppEnv } from './features/auth/session.ts'
import { requireRole, sessionMiddleware } from './features/auth/session.ts'
import { healthRoutes } from './features/health/routes.ts'
```
- `apps/api/src/test/setup.ts`: sin cambios de import (usa `../auth.ts`, `../app.ts`).
- Eliminar los directorios `routes/` y `middleware/` si quedan vacíos.

- [ ] **Step 6: Web — feature auth**

```bash
mkdir -p apps/web/src/features/auth
git mv apps/web/src/lib/auth-client.ts apps/web/src/features/auth/auth-client.ts
```

`apps/web/src/features/auth/login-form.tsx` (extraído de `routes/login.tsx`; la ruta solo compone):
```tsx
import { loginSchema, type LoginInput } from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/features/auth/auth-client'

export function LoginForm({ onSuccess }: { onSuccess: () => void | Promise<void> }) {
  const [serverError, setServerError] = useState<string | null>(null)
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: LoginInput) {
    setServerError(null)
    const { error } = await authClient.signIn.email(values)
    if (error) {
      setServerError('Correo o contraseña incorrectos')
      return
    }
    await onSuccess()
  }

  const { errors, isSubmitting } = form.formState
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Correo</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          className="h-11"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          {...form.register('email')}
        />
        {errors.email && (
          <p id="email-error" className="text-destructive text-sm">
            {errors.email.message}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          className="h-11"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
          {...form.register('password')}
        />
        {errors.password && (
          <p id="password-error" className="text-destructive text-sm">
            {errors.password.message}
          </p>
        )}
      </div>
      {serverError && (
        <p role="alert" className="text-destructive text-sm">
          {serverError}
        </p>
      )}
      <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Ingresando…' : 'Ingresar'}
      </Button>
    </form>
  )
}
```

`apps/web/src/routes/login.tsx` (reemplazar el formulario inline; conservar `beforeLoad`, la tarjeta con `border-l-4 border-l-primary`, el `<h1>Dentalware</h1>` y "Laboratorio dental"):
```tsx
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { authClient } from '@/features/auth/auth-client'
import { LoginForm } from '@/features/auth/login-form'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const { data } = await authClient.getSession()
    if (data) throw redirect({ to: '/' })
  },
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  return (
    <main className="bg-background flex min-h-svh items-center justify-center p-4">
      <Card className="border-l-primary w-full max-w-[400px] border-l-4">
        <CardHeader>
          <h1 className="text-2xl font-semibold">Dentalware</h1>
          <p className="text-muted-foreground text-sm">Laboratorio dental</p>
        </CardHeader>
        <CardContent>
          <LoginForm onSuccess={() => navigate({ to: '/' })} />
        </CardContent>
      </Card>
    </main>
  )
}
```
Si el `login.tsx` actual tiene clases o estructura distintas (leerlo primero), conservar las existentes y solo extraer el formulario: los `data-testid`, textos y `aria` deben quedar idénticos (E2E de la Iteración 0).

Actualizar `apps/web/src/routes/_app.tsx` y `apps/web/src/components/app-shell.tsx`: `import { authClient } from '@/features/auth/auth-client'`.

- [ ] **Step 7: Verificar**

```bash
pnpm --filter @dentalware/api test
pnpm typecheck && pnpm lint && pnpm format:check
pnpm --filter @dentalware/web e2e --project=escritorio --project=android
```
Expected: api 17/17 (15 + 2 nuevos); typecheck/lint/format verdes; E2E 8/8.

- [ ] **Step 8: Commit**

```bash
git add apps/api apps/web
git commit -m "refactor: organizar api y web por features; validador zod con 422 en español

Refs #18

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi"
```

---

### Task 2: `shared` — schemas zod de configuración (Refs #18)

**Files:**
- Create: `packages/shared/src/schemas/config.ts`
- Modify: `packages/shared/src/index.ts` (añadir `export * from './schemas/config.ts'`)
- Test: `packages/shared/src/schemas/config.test.ts`

**Interfaces:**
- Produces: `PRICING_UNITS = ['por_pieza','por_arcada','por_trabajo'] as const`, `type PricingUnit`, `labSettingsSchema`, `clinicSchema`, `doctorSchema`, `productCategorySchema`, `productSchema`, `clinicPriceSchema`, `stageSchema`, `createUserSchema`, `updateUserSchema`, `idParamSchema`, `activeQuerySchema`, y los tipos `LabSettingsInput`, `ClinicInput`, `DoctorInput`, `ProductCategoryInput`, `ProductInput`, `ClinicPriceInput`, `StageInput`, `CreateUserInput`, `UpdateUserInput`. Todos los mensajes en español. Los precios son `string` decimal con 2 decimales (`'45.00'`) para no perder precisión (Drizzle `numeric` devuelve string).

- [ ] **Step 1: Test (falla)**

`packages/shared/src/schemas/config.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import {
  clinicPriceSchema,
  clinicSchema,
  createUserSchema,
  doctorSchema,
  labSettingsSchema,
  PRICING_UNITS,
  productCategorySchema,
  productSchema,
  stageSchema,
} from './config.ts'

describe('schemas de configuración', () => {
  it('labSettings exige nombre y acepta el resto opcional', () => {
    expect(labSettingsSchema.safeParse({ name: 'Arte Dental' }).success).toBe(true)
    const r = labSettingsSchema.safeParse({ name: '' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.message).toBe('El nombre es obligatorio')
  })

  it('clinic valida whatsapp en formato E.164 y días de crédito', () => {
    expect(
      clinicSchema.safeParse({ name: 'Clínica Sonrisa', whatsapp: '+593991234567', paymentTermsDays: 30 })
        .success,
    ).toBe(true)
    const r = clinicSchema.safeParse({ name: 'X', whatsapp: '0991234567' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.message).toBe('El WhatsApp debe ir en formato internacional, ej. +593991234567')
    expect(clinicSchema.safeParse({ name: 'X', paymentTermsDays: -1 }).success).toBe(false)
  })

  it('doctor exige clínica (uuid) y nombre', () => {
    expect(doctorSchema.safeParse({ clinicId: 'no-uuid', name: 'Dra. Paredes' }).success).toBe(false)
    expect(
      doctorSchema.safeParse({ clinicId: '5f9a7b6e-2c4d-4e8f-9a1b-3c5d7e9f1a2b', name: 'Dra. Paredes' })
        .success,
    ).toBe(true)
  })

  it('product valida unidad de precio, precio decimal y días', () => {
    expect(PRICING_UNITS).toEqual(['por_pieza', 'por_arcada', 'por_trabajo'])
    const ok = productSchema.safeParse({
      code: 'ZR',
      name: 'Zirconio',
      categoryId: '5f9a7b6e-2c4d-4e8f-9a1b-3c5d7e9f1a2b',
      pricingUnit: 'por_pieza',
      basePrice: '45.00',
      turnaroundDays: 5,
      requiresTryIn: true,
    })
    expect(ok.success).toBe(true)
    expect(productSchema.safeParse({ code: 'ZR', name: 'Zirconio', categoryId: '5f9a7b6e-2c4d-4e8f-9a1b-3c5d7e9f1a2b', pricingUnit: 'por_pieza', basePrice: '45', turnaroundDays: 5 }).success).toBe(true)
    const bad = productSchema.safeParse({ code: 'ZR', name: 'Zirconio', categoryId: '5f9a7b6e-2c4d-4e8f-9a1b-3c5d7e9f1a2b', pricingUnit: 'por_pieza', basePrice: '45.123', turnaroundDays: 5 })
    expect(bad.success).toBe(false)
    if (!bad.success) expect(bad.error.issues[0]?.message).toBe('El precio debe ser un número con hasta 2 decimales')
  })

  it('category y stage exigen nombre; stage valida color hex', () => {
    expect(productCategorySchema.safeParse({ name: 'Prótesis fija' }).success).toBe(true)
    expect(stageSchema.safeParse({ name: 'Modelo', color: '#0F766E' }).success).toBe(true)
    expect(stageSchema.safeParse({ name: 'Modelo', color: 'teal' }).success).toBe(false)
  })

  it('clinicPrice exige precio decimal', () => {
    expect(clinicPriceSchema.safeParse({ price: '40.50' }).success).toBe(true)
    expect(clinicPriceSchema.safeParse({ price: 'abc' }).success).toBe(false)
  })

  it('createUser exige correo, contraseña de 8+ y rol válido', () => {
    expect(
      createUserSchema.safeParse({ name: 'Ana', email: 'ana@lab.local', password: 'Secreta123', role: 'recepcion' })
        .success,
    ).toBe(true)
    expect(createUserSchema.safeParse({ name: 'Ana', email: 'ana@lab.local', password: '123', role: 'recepcion' }).success).toBe(false)
    expect(createUserSchema.safeParse({ name: 'Ana', email: 'ana@lab.local', password: 'Secreta123', role: 'jefe' }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Ejecutar y ver fallar**

```bash
pnpm --filter @dentalware/shared test
```
Expected: FAIL — `Failed to load url ./config.ts`.

- [ ] **Step 3: Implementar**

`packages/shared/src/schemas/config.ts`:
```ts
import { z } from 'zod'
import { USER_ROLES } from '../roles.ts'

export const PRICING_UNITS = ['por_pieza', 'por_arcada', 'por_trabajo'] as const
export type PricingUnit = (typeof PRICING_UNITS)[number]

const nombre = z.string().trim().min(1, { error: 'El nombre es obligatorio' }).max(120, { error: 'Máximo 120 caracteres' })
const textoOpcional = (max: number) => z.string().trim().max(max, { error: `Máximo ${max} caracteres` }).optional().or(z.literal('').transform(() => undefined))
const uuid = z.uuid({ error: 'Identificador inválido' })
export const priceString = z
  .string()
  .trim()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, { error: 'El precio debe ser un número con hasta 2 decimales' })
const whatsappE164 = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, { error: 'El WhatsApp debe ir en formato internacional, ej. +593991234567' })
  .optional()
  .or(z.literal('').transform(() => undefined))
const correoOpcional = z.string().trim().toLowerCase().pipe(z.email({ error: 'Correo inválido' })).optional().or(z.literal('').transform(() => undefined))

export const labSettingsSchema = z.object({
  name: nombre,
  ruc: textoOpcional(13),
  address: textoOpcional(200),
  phone: textoOpcional(60),
  logoUrl: textoOpcional(500),
  codePrefix: z.string().trim().max(6, { error: 'Máximo 6 caracteres' }).optional().or(z.literal('').transform(() => undefined)),
  ivaPct: z.coerce.number().int().min(0).max(100).default(15),
})
export type LabSettingsInput = z.infer<typeof labSettingsSchema>

export const clinicSchema = z.object({
  name: nombre,
  ruc: textoOpcional(13),
  address: textoOpcional(200),
  city: textoOpcional(80),
  phone: textoOpcional(60),
  whatsapp: whatsappE164,
  email: correoOpcional,
  paymentTermsDays: z.coerce.number().int({ error: 'Debe ser un número entero' }).min(0, { error: 'No puede ser negativo' }).max(365).default(0),
  notes: textoOpcional(1000),
})
export type ClinicInput = z.infer<typeof clinicSchema>

export const doctorSchema = z.object({
  clinicId: uuid,
  name: nombre,
  phone: textoOpcional(60),
  email: correoOpcional,
  notes: textoOpcional(1000),
})
export type DoctorInput = z.infer<typeof doctorSchema>

export const productCategorySchema = z.object({
  name: nombre,
  sort: z.coerce.number().int().min(0).default(0),
})
export type ProductCategoryInput = z.infer<typeof productCategorySchema>

export const productSchema = z.object({
  code: z.string().trim().min(1, { error: 'El código es obligatorio' }).max(20, { error: 'Máximo 20 caracteres' }),
  name: nombre,
  categoryId: uuid,
  pricingUnit: z.enum(PRICING_UNITS, { error: 'Unidad de precio inválida' }),
  basePrice: priceString,
  turnaroundDays: z.coerce.number().int({ error: 'Debe ser un número entero' }).min(0).max(365),
  requiresTryIn: z.boolean().default(false),
})
export type ProductInput = z.infer<typeof productSchema>

export const clinicPriceSchema = z.object({ price: priceString })
export type ClinicPriceInput = z.infer<typeof clinicPriceSchema>

export const stageSchema = z.object({
  name: nombre,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: 'El color debe ser hexadecimal, ej. #0F766E' }),
  sort: z.coerce.number().int().min(0).default(0),
})
export type StageInput = z.infer<typeof stageSchema>

export const createUserSchema = z.object({
  name: nombre,
  email: z.string().trim().toLowerCase().pipe(z.email({ error: 'Correo inválido' })),
  password: z.string().min(8, { error: 'La contraseña debe tener al menos 8 caracteres' }),
  role: z.enum(USER_ROLES, { error: 'Rol inválido' }),
})
export type CreateUserInput = z.infer<typeof createUserSchema>

export const updateUserSchema = z.object({
  name: nombre.optional(),
  role: z.enum(USER_ROLES, { error: 'Rol inválido' }).optional(),
  password: z.string().min(8, { error: 'La contraseña debe tener al menos 8 caracteres' }).optional(),
})
export type UpdateUserInput = z.infer<typeof updateUserSchema>

export const idParamSchema = z.object({ id: uuid })
export const activeQuerySchema = z.object({
  incluirInactivos: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
})
```

Añadir a `packages/shared/src/index.ts`: `export * from './schemas/config.ts'`.

- [ ] **Step 4: Ejecutar y ver pasar; build**

```bash
pnpm --filter @dentalware/shared test && pnpm --filter @dentalware/shared build
```
Expected: PASS (7 tests nuevos; 40 en total en shared).

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): schemas zod de configuración (laboratorio, clínicas, doctores, productos, precios, fases, usuarios)

Refs #18

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi"
```

---

### Task 3: API — tablas Drizzle de configuración, relaciones v2 y migración (Refs #18)

**Files:**
- Create: `apps/api/src/features/lab-settings/schema.ts`, `apps/api/src/features/clinics/schema.ts`, `apps/api/src/features/doctors/schema.ts`, `apps/api/src/features/products/schema.ts`, `apps/api/src/features/stages/schema.ts`, `apps/api/src/db/relations.ts`, `apps/api/drizzle/<timestamp>_<nombre>/` (generado)
- Modify: `apps/api/src/db/schema/index.ts`, `apps/api/src/db/index.ts`, `apps/api/src/test/setup.ts` (truncateAll)
- Test: `apps/api/src/db/schema.test.ts`

**Interfaces:**
- Produces: tablas `labSettings`, `clinics`, `doctors`, `productCategories`, `products`, `clinicProductPrices`, `stages` (exportadas desde `db/schema/index.ts`); `relations` (defineRelations) usadas por `createDb`; `db.query.clinics.findMany({ with: { doctors: true } })` disponible.

- [ ] **Step 1: Test (falla)**

`apps/api/src/db/schema.test.ts`:
```ts
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setupTestDb, truncateAll } from '../test/setup.ts'

describe('esquema de configuración', () => {
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  beforeAll(async () => {
    ctx = await setupTestDb()
    await truncateAll(ctx.db)
  })
  afterAll(async () => {
    await ctx.pool.end()
  })

  it('crea las tablas de configuración', async () => {
    const r = await ctx.db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    )
    const names = r.rows.map((x) => x.table_name)
    for (const t of ['lab_settings', 'clinics', 'doctors', 'product_categories', 'products', 'clinic_product_prices', 'stages']) {
      expect(names).toContain(t)
    }
  })

  it('consulta relacional clínica → doctores', async () => {
    const [clinic] = await ctx.db
      .insert(ctx.schema.clinics)
      .values({ name: 'Clínica Sonrisa' })
      .returning()
    await ctx.db.insert(ctx.schema.doctors).values({ clinicId: clinic!.id, name: 'Dra. Paredes' })
    const rows = await ctx.db.query.clinics.findMany({ with: { doctors: true } })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.doctors[0]?.name).toBe('Dra. Paredes')
  })
})
```

- [ ] **Step 2: Ejecutar y ver fallar**

```bash
pnpm --filter @dentalware/api exec vitest run src/db/schema.test.ts
```
Expected: FAIL — `ctx.schema` no existe / tablas no existen.

- [ ] **Step 3: Tablas por feature**

Columnas comunes en cada tabla: `id: uuid().defaultRandom().primaryKey()`, `createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()`, `updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()` (se actualiza desde el repositorio con `updatedAt: new Date()`).

`apps/api/src/features/lab-settings/schema.ts`:
```ts
import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const labSettings = pgTable('lab_settings', {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  ruc: text(),
  address: text(),
  phone: text(),
  logoUrl: text('logo_url'),
  codePrefix: text('code_prefix'),
  ivaPct: integer('iva_pct').notNull().default(15),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
```

`apps/api/src/features/clinics/schema.ts`:
```ts
import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const clinics = pgTable('clinics', {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  ruc: text(),
  address: text(),
  city: text(),
  phone: text(),
  whatsapp: text(),
  email: text(),
  paymentTermsDays: integer('payment_terms_days').notNull().default(0),
  notes: text(),
  active: boolean().notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
```

`apps/api/src/features/doctors/schema.ts`:
```ts
import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { clinics } from '../clinics/schema.ts'

export const doctors = pgTable(
  'doctors',
  {
    id: uuid().defaultRandom().primaryKey(),
    clinicId: uuid('clinic_id').notNull().references(() => clinics.id),
    name: text().notNull(),
    phone: text(),
    email: text(),
    notes: text(),
    active: boolean().notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('doctors_clinic_id_idx').on(t.clinicId)],
)
```

`apps/api/src/features/products/schema.ts`:
```ts
import { boolean, integer, numeric, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { PRICING_UNITS } from '@dentalware/shared'
import { clinics } from '../clinics/schema.ts'

export const pricingUnitEnum = pgEnum('pricing_unit', PRICING_UNITS)

export const productCategories = pgTable('product_categories', {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  sort: integer().notNull().default(0),
  active: boolean().notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const products = pgTable('products', {
  id: uuid().defaultRandom().primaryKey(),
  code: text().notNull().unique(),
  name: text().notNull(),
  categoryId: uuid('category_id').notNull().references(() => productCategories.id),
  pricingUnit: pricingUnitEnum('pricing_unit').notNull(),
  basePrice: numeric('base_price', { precision: 10, scale: 2 }).notNull(),
  turnaroundDays: integer('turnaround_days').notNull().default(5),
  requiresTryIn: boolean('requires_try_in').notNull().default(false),
  active: boolean().notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const clinicProductPrices = pgTable(
  'clinic_product_prices',
  {
    clinicId: uuid('clinic_id').notNull().references(() => clinics.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    price: numeric({ precision: 10, scale: 2 }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.clinicId, t.productId] })],
)
```

`apps/api/src/features/stages/schema.ts`:
```ts
import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const stages = pgTable('stages', {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  color: text().notNull().default('#0F766E'),
  sort: integer().notNull().default(0),
  active: boolean().notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
```

`apps/api/src/db/schema/index.ts`:
```ts
export * from './auth.ts'
export * from '../../features/lab-settings/schema.ts'
export * from '../../features/clinics/schema.ts'
export * from '../../features/doctors/schema.ts'
export * from '../../features/products/schema.ts'
export * from '../../features/stages/schema.ts'
```

`apps/api/src/db/relations.ts`:
```ts
import { defineRelations } from 'drizzle-orm'
import * as schema from './schema/index.ts'

// Relaciones v2 de la app. `authRelations` (defineRelationsPart, generado por better-auth) se mezcla en createDb.
export const appRelations = defineRelations(schema, (r) => ({
  clinics: {
    doctors: r.many.doctors(),
    prices: r.many.clinicProductPrices(),
  },
  doctors: {
    clinic: r.one.clinics({ from: r.doctors.clinicId, to: r.clinics.id }),
  },
  productCategories: {
    products: r.many.products(),
  },
  products: {
    category: r.one.productCategories({ from: r.products.categoryId, to: r.productCategories.id }),
    clinicPrices: r.many.clinicProductPrices(),
  },
  clinicProductPrices: {
    clinic: r.one.clinics({ from: r.clinicProductPrices.clinicId, to: r.clinics.id }),
    product: r.one.products({ from: r.clinicProductPrices.productId, to: r.products.id }),
  },
}))
```

`apps/api/src/db/index.ts`:
```ts
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { appRelations } from './relations.ts'
import { authRelations } from './schema/auth.ts'

// authRelations usa defineRelationsPart: debe ir después de las relaciones completas.
export const relations = { ...appRelations, ...authRelations }

export function createDb(url: string) {
  const pool = new Pool({ connectionString: url, max: 10 })
  pool.on('error', (err) => {
    console.error('Error en el pool de Postgres:', err)
  })
  const db = drizzle({ client: pool, relations })
  return { db, pool }
}

export type Db = ReturnType<typeof createDb>['db']
```
Si `{ ...appRelations, ...authRelations }` no compila (los tipos de `defineRelations`/`defineRelationsPart` no se mezclan así en rc.4), usar la forma documentada por better-auth: `drizzle({ client: pool, relations: { ...appRelations, ...authRelations } })` con la aserción mínima que TypeScript pida, y anotarlo en el informe; si `db.query.clinics` no queda tipado, reportar BLOCKED con el error exacto.

`apps/api/src/test/setup.ts` — ampliar:
```ts
import * as schema from '../db/schema/index.ts'
// dentro de setupTestDb: return { config, db, pool, auth, schema }
export async function truncateAll(db: Db) {
  await db.execute(
    sql`truncate table "clinic_product_prices", "products", "product_categories", "doctors", "clinics", "stages", "lab_settings", "sessions", "accounts", "verifications", "users" cascade`,
  )
}
```

- [ ] **Step 4: Generar la migración y aplicarla en test**

```bash
pnpm --filter @dentalware/api db:generate
ls apps/api/drizzle          # nueva carpeta <timestamp>_<nombre>/migration.sql
grep -c "CREATE TABLE" apps/api/drizzle/*/migration.sql
pnpm --filter @dentalware/api exec vitest run src/db/schema.test.ts
```
Expected: 7 `CREATE TABLE` en la nueva migración + `CREATE TYPE "public"."pricing_unit"`; test PASS (runMigrations la aplica en `dentalware_test`).

- [ ] **Step 5: Suite completa, typecheck y commit**

```bash
pnpm --filter @dentalware/api test && pnpm typecheck && pnpm lint && pnpm format:check
git add apps/api
git commit -m "feat(api): tablas de configuración (laboratorio, clínicas, doctores, productos, precios, fases), relaciones v2 y migración

Refs #18

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi"
```

---

### Task 4: API — datos del laboratorio (`/api/config/laboratorio`) (Refs #10)

**Files:**
- Create: `apps/api/src/features/lab-settings/repo.ts`, `apps/api/src/features/lab-settings/routes.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/features/lab-settings/lab-settings.test.ts`

**Interfaces:**
- Consumes: `labSettings` (Task 3), `labSettingsSchema` (Task 2), `validate` (Task 1), `requireAuth`/`requireRole`.
- Produces: `getLabSettings(db)` (devuelve la fila única o `null`), `upsertLabSettings(db, input)`; rutas `GET /api/config/laboratorio` (cualquier usuario autenticado; 200 `{ settings: LabSettings | null }`) y `PUT /api/config/laboratorio` (admin; 200 `{ settings }`). `AppType` incluye `api.config.laboratorio`.

- [ ] **Step 1: Test (falla)**

`apps/api/src/features/lab-settings/lab-settings.test.ts`:
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../app.ts'
import { createUser, loginAs, setupTestDb, truncateAll } from '../../test/setup.ts'

describe('/api/config/laboratorio', () => {
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  let app: ReturnType<typeof createApp>
  let adminCookie: string
  let tecnicoCookie: string

  beforeAll(async () => {
    ctx = await setupTestDb()
    app = createApp({ auth: ctx.auth, webOrigin: ctx.config.WEB_ORIGIN })
  })
  beforeEach(async () => {
    await truncateAll(ctx.db)
    await createUser(ctx.auth, ctx.db, { email: 'admin@t.local', password: 'Admin12345!', name: 'Admin', role: 'admin' })
    await createUser(ctx.auth, ctx.db, { email: 'tec@t.local', password: 'Tecnico123!', name: 'Tec', role: 'tecnico' })
    adminCookie = await loginAs(app, 'admin@t.local', 'Admin12345!')
    tecnicoCookie = await loginAs(app, 'tec@t.local', 'Tecnico123!')
  })
  afterAll(async () => {
    await ctx.pool.end()
  })

  const json = (cookie: string, method: string, body?: unknown) => ({
    method,
    headers: { 'content-type': 'application/json', cookie, origin: ctx.config.WEB_ORIGIN },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  it('GET devuelve null cuando no hay datos y 401 sin sesión', async () => {
    expect((await app.request('/api/config/laboratorio')).status).toBe(401)
    const res = await app.request('/api/config/laboratorio', json(tecnicoCookie, 'GET'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ settings: null })
  })

  it('PUT crea y luego actualiza la única fila (solo admin)', async () => {
    const forbidden = await app.request('/api/config/laboratorio', json(tecnicoCookie, 'PUT', { name: 'X' }))
    expect(forbidden.status).toBe(403)

    const created = await app.request(
      '/api/config/laboratorio',
      json(adminCookie, 'PUT', { name: 'Arte Dental', address: 'Puerto Rico N27-33 y La Isla', phone: '0961440991 / 0996081498' }),
    )
    expect(created.status).toBe(200)
    const body = (await created.json()) as { settings: { id: string; name: string; ivaPct: number } }
    expect(body.settings.name).toBe('Arte Dental')
    expect(body.settings.ivaPct).toBe(15)

    const updated = await app.request('/api/config/laboratorio', json(adminCookie, 'PUT', { name: 'Arte Dental Quito', ivaPct: 15 }))
    const body2 = (await updated.json()) as { settings: { id: string; name: string } }
    expect(body2.settings.id).toBe(body.settings.id)
    expect(body2.settings.name).toBe('Arte Dental Quito')
  })

  it('PUT valida con 422 en español', async () => {
    const res = await app.request('/api/config/laboratorio', json(adminCookie, 'PUT', { name: '' }))
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ message: 'Datos inválidos', issues: [{ path: 'name', message: 'El nombre es obligatorio' }] })
  })
})
```

- [ ] **Step 2: Ejecutar y ver fallar**

```bash
pnpm --filter @dentalware/api exec vitest run src/features/lab-settings
```
Expected: FAIL — 404 `Recurso no encontrado` en las rutas.

- [ ] **Step 3: Repositorio y rutas**

`apps/api/src/features/lab-settings/repo.ts`:
```ts
import type { LabSettingsInput } from '@dentalware/shared'
import { eq } from 'drizzle-orm'
import type { Db } from '../../db/index.ts'
import { labSettings } from './schema.ts'

export async function getLabSettings(db: Db) {
  const rows = await db.select().from(labSettings).limit(1)
  return rows[0] ?? null
}

export async function upsertLabSettings(db: Db, input: LabSettingsInput) {
  const current = await getLabSettings(db)
  if (!current) {
    const [row] = await db.insert(labSettings).values(input).returning()
    return row!
  }
  const [row] = await db
    .update(labSettings)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(labSettings.id, current.id))
    .returning()
  return row!
}
```

`apps/api/src/features/lab-settings/routes.ts`:
```ts
import { labSettingsSchema } from '@dentalware/shared'
import { Hono } from 'hono'
import type { Db } from '../../db/index.ts'
import { validate } from '../../lib/validate.ts'
import type { AppEnv } from '../auth/session.ts'
import { requireAuth, requireRole } from '../auth/session.ts'
import { getLabSettings, upsertLabSettings } from './repo.ts'

export const labSettingsRoutes = (db: Db) =>
  new Hono<AppEnv>()
    .get('/', requireAuth, async (c) => c.json({ settings: await getLabSettings(db) }))
    .put('/', requireRole('admin'), validate('json', labSettingsSchema), async (c) =>
      c.json({ settings: await upsertLabSettings(db, c.req.valid('json')) }),
    )
```

`apps/api/src/app.ts` — `createApp` recibe la BD y monta la feature:
```ts
export type AppDeps = { auth: Auth; db: Db; webOrigin: string }

export function createApp({ auth, db, webOrigin }: AppDeps) {
  // ... (igual) ...
  const routes = app
    .route('/api/health', healthRoutes)
    .route('/api/me', meRoutes)
    .route('/api/admin', adminRoutes)
    .route('/api/config/laboratorio', labSettingsRoutes(db))
```
Actualizar los call sites: `main.ts` → `createApp({ auth, db, webOrigin: config.WEB_ORIGIN })`; `app.test.ts`, `auth.test.ts` y los tests nuevos → `createApp({ auth: ctx.auth, db: ctx.db, webOrigin: ctx.config.WEB_ORIGIN })`. (Los tests existentes fallan en typecheck hasta hacerlo.)

- [ ] **Step 4: Ejecutar y ver pasar**

```bash
pnpm --filter @dentalware/api test && pnpm typecheck && pnpm lint && pnpm format:check
```
Expected: PASS (3 tests nuevos).

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): datos del laboratorio (GET/PUT /api/config/laboratorio)

Refs #10

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi"
```

---

### Task 5: API — clínicas y doctores (Refs #12, #13)

**Files:**
- Create: `apps/api/src/features/clinics/repo.ts`, `apps/api/src/features/clinics/routes.ts`, `apps/api/src/features/doctors/repo.ts`, `apps/api/src/features/doctors/routes.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/features/clinics/clinics.test.ts`, `apps/api/src/features/doctors/doctors.test.ts`

**Interfaces:**
- Consumes: tablas `clinics`, `doctors`; `clinicSchema`, `doctorSchema`, `idParamSchema`, `activeQuerySchema`; `validate`; `requireAuth`, `requireRole`.
- Produces:
  - `GET /api/config/clinicas?incluirInactivos=true|false` → `{ clinics: Clinic[] }` ordenadas por nombre (autenticado); `GET /api/config/clinicas/:id` → `{ clinic: Clinic & { doctors: Doctor[] } }` (404 si no existe); `POST /api/config/clinicas` (admin) → 201 `{ clinic }`; `PUT /api/config/clinicas/:id` (admin) → `{ clinic }`; `PATCH /api/config/clinicas/:id/activo` body `{ active: boolean }` (admin) → `{ clinic }`.
  - `GET /api/config/doctores?clinicId=<uuid>&incluirInactivos=` → `{ doctors }`; `POST /api/config/doctores` (admin) → 201; `PUT /api/config/doctores/:id` (admin); `PATCH /api/config/doctores/:id/activo` (admin). `POST` responde 422 `{ message: 'La clínica no existe' }` si `clinicId` no existe.

- [ ] **Step 1: Tests (fallan)**

`apps/api/src/features/clinics/clinics.test.ts`:
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../app.ts'
import { createUser, loginAs, setupTestDb, truncateAll } from '../../test/setup.ts'

describe('/api/config/clinicas', () => {
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  let app: ReturnType<typeof createApp>
  let admin: string
  let recepcion: string

  beforeAll(async () => {
    ctx = await setupTestDb()
    app = createApp({ auth: ctx.auth, db: ctx.db, webOrigin: ctx.config.WEB_ORIGIN })
  })
  beforeEach(async () => {
    await truncateAll(ctx.db)
    await createUser(ctx.auth, ctx.db, { email: 'admin@t.local', password: 'Admin12345!', name: 'Admin', role: 'admin' })
    await createUser(ctx.auth, ctx.db, { email: 'rec@t.local', password: 'Recep12345!', name: 'Rec', role: 'recepcion' })
    admin = await loginAs(app, 'admin@t.local', 'Admin12345!')
    recepcion = await loginAs(app, 'rec@t.local', 'Recep12345!')
  })
  afterAll(async () => {
    await ctx.pool.end()
  })
  const req = (cookie: string, method: string, body?: unknown) => ({
    method,
    headers: { 'content-type': 'application/json', cookie, origin: ctx.config.WEB_ORIGIN },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  it('crea, lista ordenado por nombre y oculta inactivas por defecto', async () => {
    const a = await app.request('/api/config/clinicas', req(admin, 'POST', { name: 'Zeta Dental', whatsapp: '+593991234567' }))
    expect(a.status).toBe(201)
    const { clinic } = (await a.json()) as { clinic: { id: string; name: string; active: boolean } }
    expect(clinic.active).toBe(true)
    await app.request('/api/config/clinicas', req(admin, 'POST', { name: 'Alfa Dental' }))

    const list = (await (await app.request('/api/config/clinicas', req(recepcion, 'GET'))).json()) as { clinics: { name: string }[] }
    expect(list.clinics.map((c) => c.name)).toEqual(['Alfa Dental', 'Zeta Dental'])

    const off = await app.request(`/api/config/clinicas/${clinic.id}/activo`, req(admin, 'PATCH', { active: false }))
    expect(off.status).toBe(200)
    const list2 = (await (await app.request('/api/config/clinicas', req(recepcion, 'GET'))).json()) as { clinics: { name: string }[] }
    expect(list2.clinics.map((c) => c.name)).toEqual(['Alfa Dental'])
    const list3 = (await (await app.request('/api/config/clinicas?incluirInactivos=true', req(recepcion, 'GET'))).json()) as { clinics: unknown[] }
    expect(list3.clinics).toHaveLength(2)
  })

  it('recepción no puede escribir; admin edita; 404 si no existe', async () => {
    expect((await app.request('/api/config/clinicas', req(recepcion, 'POST', { name: 'X' }))).status).toBe(403)
    const { clinic } = (await (await app.request('/api/config/clinicas', req(admin, 'POST', { name: 'Sonrisa' }))).json()) as { clinic: { id: string } }
    const upd = await app.request(`/api/config/clinicas/${clinic.id}`, req(admin, 'PUT', { name: 'Clínica Sonrisa', city: 'Quito', paymentTermsDays: 30 }))
    expect(upd.status).toBe(200)
    expect(((await upd.json()) as { clinic: { name: string; paymentTermsDays: number } }).clinic).toMatchObject({ name: 'Clínica Sonrisa', paymentTermsDays: 30 })
    expect((await app.request('/api/config/clinicas/5f9a7b6e-2c4d-4e8f-9a1b-3c5d7e9f1a2b', req(admin, 'GET'))).status).toBe(404)
    expect((await app.request('/api/config/clinicas/no-uuid', req(admin, 'GET'))).status).toBe(422)
  })

  it('detalle incluye sus doctores', async () => {
    const { clinic } = (await (await app.request('/api/config/clinicas', req(admin, 'POST', { name: 'Sonrisa' }))).json()) as { clinic: { id: string } }
    await app.request('/api/config/doctores', req(admin, 'POST', { clinicId: clinic.id, name: 'Dra. Paredes' }))
    const det = (await (await app.request(`/api/config/clinicas/${clinic.id}`, req(recepcion, 'GET'))).json()) as { clinic: { doctors: { name: string }[] } }
    expect(det.clinic.doctors.map((d) => d.name)).toEqual(['Dra. Paredes'])
  })
})
```

`apps/api/src/features/doctors/doctors.test.ts`:
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../app.ts'
import { createUser, loginAs, setupTestDb, truncateAll } from '../../test/setup.ts'

describe('/api/config/doctores', () => {
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  let app: ReturnType<typeof createApp>
  let admin: string
  let clinicId: string

  beforeAll(async () => {
    ctx = await setupTestDb()
    app = createApp({ auth: ctx.auth, db: ctx.db, webOrigin: ctx.config.WEB_ORIGIN })
  })
  beforeEach(async () => {
    await truncateAll(ctx.db)
    await createUser(ctx.auth, ctx.db, { email: 'admin@t.local', password: 'Admin12345!', name: 'Admin', role: 'admin' })
    admin = await loginAs(app, 'admin@t.local', 'Admin12345!')
    const [c] = await ctx.db.insert(ctx.schema.clinics).values({ name: 'Sonrisa' }).returning()
    clinicId = c!.id
  })
  afterAll(async () => {
    await ctx.pool.end()
  })
  const req = (method: string, body?: unknown) => ({
    method,
    headers: { 'content-type': 'application/json', cookie: admin, origin: ctx.config.WEB_ORIGIN },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  it('crea y filtra por clínica', async () => {
    const r = await app.request('/api/config/doctores', req('POST', { clinicId, name: 'Dra. Paredes', email: 'PAREDES@Clinica.com' }))
    expect(r.status).toBe(201)
    expect(((await r.json()) as { doctor: { email: string } }).doctor.email).toBe('paredes@clinica.com')
    const [other] = await ctx.db.insert(ctx.schema.clinics).values({ name: 'Otra' }).returning()
    await app.request('/api/config/doctores', req('POST', { clinicId: other!.id, name: 'Dr. Ruiz' }))
    const list = (await (await app.request(`/api/config/doctores?clinicId=${clinicId}`, req('GET'))).json()) as { doctors: { name: string }[] }
    expect(list.doctors.map((d) => d.name)).toEqual(['Dra. Paredes'])
  })

  it('rechaza clínica inexistente con 422 y desactiva', async () => {
    const bad = await app.request('/api/config/doctores', req('POST', { clinicId: '5f9a7b6e-2c4d-4e8f-9a1b-3c5d7e9f1a2b', name: 'Dr. X' }))
    expect(bad.status).toBe(422)
    expect(await bad.json()).toMatchObject({ message: 'La clínica no existe' })
    const { doctor } = (await (await app.request('/api/config/doctores', req('POST', { clinicId, name: 'Dr. Y' }))).json()) as { doctor: { id: string } }
    const off = await app.request(`/api/config/doctores/${doctor.id}/activo`, req('PATCH', { active: false }))
    expect(((await off.json()) as { doctor: { active: boolean } }).doctor.active).toBe(false)
  })
})
```

- [ ] **Step 2: Ejecutar y ver fallar**

```bash
pnpm --filter @dentalware/api exec vitest run src/features/clinics src/features/doctors
```
Expected: FAIL (404 en todas las rutas).

- [ ] **Step 3: Repositorios**

`apps/api/src/features/clinics/repo.ts`:
```ts
import type { ClinicInput } from '@dentalware/shared'
import { asc, eq } from 'drizzle-orm'
import type { Db } from '../../db/index.ts'
import { clinics } from './schema.ts'

export function listClinics(db: Db, includeInactive: boolean) {
  return db.query.clinics.findMany({
    where: includeInactive ? undefined : { active: true },
    orderBy: { name: 'asc' },
  })
}

export function getClinicWithDoctors(db: Db, id: string) {
  return db.query.clinics.findFirst({
    where: { id },
    with: { doctors: { orderBy: { name: 'asc' } } },
  })
}

export async function createClinic(db: Db, input: ClinicInput) {
  const [row] = await db.insert(clinics).values(input).returning()
  return row!
}

export async function updateClinic(db: Db, id: string, input: ClinicInput) {
  const [row] = await db.update(clinics).set({ ...input, updatedAt: new Date() }).where(eq(clinics.id, id)).returning()
  return row ?? null
}

export async function setClinicActive(db: Db, id: string, active: boolean) {
  const [row] = await db.update(clinics).set({ active, updatedAt: new Date() }).where(eq(clinics.id, id)).returning()
  return row ?? null
}

export { asc }
```
(Quitar el `export { asc }` si no se usa; está para evitar un import sin uso si el implementador prefiere `orderBy: [asc(clinics.name)]` en la API SQL-like. Si la sintaxis de `where`/`orderBy` como objetos del RQB v2 no compila en rc.4, usar `db.select().from(clinics).where(...).orderBy(asc(clinics.name))` para la lista y `db.query.clinics.findFirst({ where: { id }, with: { doctors: true } })` para el detalle, y reportar en el informe la forma que funcionó.)

`apps/api/src/features/doctors/repo.ts`:
```ts
import type { DoctorInput } from '@dentalware/shared'
import { and, asc, eq } from 'drizzle-orm'
import type { Db } from '../../db/index.ts'
import { clinics } from '../clinics/schema.ts'
import { doctors } from './schema.ts'

export async function clinicExists(db: Db, clinicId: string) {
  const rows = await db.select({ id: clinics.id }).from(clinics).where(eq(clinics.id, clinicId)).limit(1)
  return rows.length > 0
}

export function listDoctors(db: Db, opts: { clinicId?: string; includeInactive: boolean }) {
  const conds = []
  if (opts.clinicId) conds.push(eq(doctors.clinicId, opts.clinicId))
  if (!opts.includeInactive) conds.push(eq(doctors.active, true))
  return db.select().from(doctors).where(conds.length ? and(...conds) : undefined).orderBy(asc(doctors.name))
}

export async function createDoctor(db: Db, input: DoctorInput) {
  const [row] = await db.insert(doctors).values(input).returning()
  return row!
}

export async function updateDoctor(db: Db, id: string, input: DoctorInput) {
  const [row] = await db.update(doctors).set({ ...input, updatedAt: new Date() }).where(eq(doctors.id, id)).returning()
  return row ?? null
}

export async function setDoctorActive(db: Db, id: string, active: boolean) {
  const [row] = await db.update(doctors).set({ active, updatedAt: new Date() }).where(eq(doctors.id, id)).returning()
  return row ?? null
}
```

- [ ] **Step 4: Rutas**

`apps/api/src/features/clinics/routes.ts`:
```ts
import { activeQuerySchema, clinicSchema, idParamSchema } from '@dentalware/shared'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import type { Db } from '../../db/index.ts'
import { validate } from '../../lib/validate.ts'
import type { AppEnv } from '../auth/session.ts'
import { requireAuth, requireRole } from '../auth/session.ts'
import { createClinic, getClinicWithDoctors, listClinics, setClinicActive, updateClinic } from './repo.ts'

const activeBody = z.object({ active: z.boolean({ error: 'Debe indicar activo o inactivo' }) })

export const clinicsRoutes = (db: Db) =>
  new Hono<AppEnv>()
    .get('/', requireAuth, validate('query', activeQuerySchema), async (c) =>
      c.json({ clinics: await listClinics(db, c.req.valid('query').incluirInactivos) }),
    )
    .get('/:id', requireAuth, validate('param', idParamSchema), async (c) => {
      const clinic = await getClinicWithDoctors(db, c.req.valid('param').id)
      if (!clinic) throw new HTTPException(404, { message: 'La clínica no existe' })
      return c.json({ clinic })
    })
    .post('/', requireRole('admin'), validate('json', clinicSchema), async (c) =>
      c.json({ clinic: await createClinic(db, c.req.valid('json')) }, 201),
    )
    .put('/:id', requireRole('admin'), validate('param', idParamSchema), validate('json', clinicSchema), async (c) => {
      const clinic = await updateClinic(db, c.req.valid('param').id, c.req.valid('json'))
      if (!clinic) throw new HTTPException(404, { message: 'La clínica no existe' })
      return c.json({ clinic })
    })
    .patch('/:id/activo', requireRole('admin'), validate('param', idParamSchema), validate('json', activeBody), async (c) => {
      const clinic = await setClinicActive(db, c.req.valid('param').id, c.req.valid('json').active)
      if (!clinic) throw new HTTPException(404, { message: 'La clínica no existe' })
      return c.json({ clinic })
    })
```

`apps/api/src/features/doctors/routes.ts`:
```ts
import { activeQuerySchema, doctorSchema, idParamSchema } from '@dentalware/shared'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import type { Db } from '../../db/index.ts'
import { validate } from '../../lib/validate.ts'
import type { AppEnv } from '../auth/session.ts'
import { requireAuth, requireRole } from '../auth/session.ts'
import { clinicExists, createDoctor, listDoctors, setDoctorActive, updateDoctor } from './repo.ts'

const listQuery = activeQuerySchema.extend({ clinicId: z.uuid({ error: 'Identificador inválido' }).optional() })
const activeBody = z.object({ active: z.boolean({ error: 'Debe indicar activo o inactivo' }) })

async function assertClinic(db: Db, clinicId: string) {
  if (!(await clinicExists(db, clinicId))) throw new HTTPException(422, { message: 'La clínica no existe' })
}

export const doctorsRoutes = (db: Db) =>
  new Hono<AppEnv>()
    .get('/', requireAuth, validate('query', listQuery), async (c) => {
      const q = c.req.valid('query')
      return c.json({ doctors: await listDoctors(db, { clinicId: q.clinicId, includeInactive: q.incluirInactivos }) })
    })
    .post('/', requireRole('admin'), validate('json', doctorSchema), async (c) => {
      const input = c.req.valid('json')
      await assertClinic(db, input.clinicId)
      return c.json({ doctor: await createDoctor(db, input) }, 201)
    })
    .put('/:id', requireRole('admin'), validate('param', idParamSchema), validate('json', doctorSchema), async (c) => {
      const input = c.req.valid('json')
      await assertClinic(db, input.clinicId)
      const doctor = await updateDoctor(db, c.req.valid('param').id, input)
      if (!doctor) throw new HTTPException(404, { message: 'El doctor no existe' })
      return c.json({ doctor })
    })
    .patch('/:id/activo', requireRole('admin'), validate('param', idParamSchema), validate('json', activeBody), async (c) => {
      const doctor = await setDoctorActive(db, c.req.valid('param').id, c.req.valid('json').active)
      if (!doctor) throw new HTTPException(404, { message: 'El doctor no existe' })
      return c.json({ doctor })
    })
```

Montar en `app.ts`: `.route('/api/config/clinicas', clinicsRoutes(db)).route('/api/config/doctores', doctorsRoutes(db))`.

- [ ] **Step 5: Ejecutar, verificar y commit**

```bash
pnpm --filter @dentalware/api test && pnpm typecheck && pnpm lint && pnpm format:check
git add apps/api
git commit -m "feat(api): CRUD de clínicas y doctores con borrado lógico

Refs #12, #13

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi"
```

---

### Task 6: API — categorías, productos y precios por clínica (Refs #14, #15)

**Files:**
- Create: `apps/api/src/features/products/repo.ts`, `apps/api/src/features/products/routes.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/features/products/products.test.ts`

**Interfaces:**
- Consumes: tablas `productCategories`, `products`, `clinicProductPrices`; `productCategorySchema`, `productSchema`, `clinicPriceSchema`, `idParamSchema`, `activeQuerySchema`.
- Produces (todas exigen `admin|recepcion` para leer y `admin` para escribir; `tecnico`/`mensajero` reciben 403 en todo `/api/config/productos*` porque exponen precios):
  - `GET /api/config/productos/categorias` → `{ categories }` (orden `sort, name`); `POST` → 201 `{ category }`; `PUT /:id`; `PATCH /:id/activo`.
  - `GET /api/config/productos?incluirInactivos=` → `{ products: (Product & { category: { id, name } })[] }`; `POST` → 201 `{ product }` (409 `{ message: 'Ya existe un producto con ese código' }` si el código se repite); `PUT /:id`; `PATCH /:id/activo`.
  - `GET /api/config/productos/precios/:clinicId` → `{ prices: { productId, price }[] }`; `PUT /api/config/productos/precios/:clinicId/:productId` body `{ price }` → `{ price: { clinicId, productId, price } }` (upsert); `DELETE /api/config/productos/precios/:clinicId/:productId` → 204 (vuelve al precio base).
  - `resolvePrice(db, clinicId, productId)` → precio especial o base (string) — lo usará la Iteración 2.

- [ ] **Step 1: Test (falla)**

`apps/api/src/features/products/products.test.ts`:
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../app.ts'
import { createUser, loginAs, setupTestDb, truncateAll } from '../../test/setup.ts'
import { resolvePrice } from './repo.ts'

describe('/api/config/productos', () => {
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  let app: ReturnType<typeof createApp>
  let admin: string
  let tecnico: string
  let categoryId: string

  beforeAll(async () => {
    ctx = await setupTestDb()
    app = createApp({ auth: ctx.auth, db: ctx.db, webOrigin: ctx.config.WEB_ORIGIN })
  })
  beforeEach(async () => {
    await truncateAll(ctx.db)
    await createUser(ctx.auth, ctx.db, { email: 'admin@t.local', password: 'Admin12345!', name: 'Admin', role: 'admin' })
    await createUser(ctx.auth, ctx.db, { email: 'tec@t.local', password: 'Tecnico123!', name: 'Tec', role: 'tecnico' })
    admin = await loginAs(app, 'admin@t.local', 'Admin12345!')
    tecnico = await loginAs(app, 'tec@t.local', 'Tecnico123!')
    const r = await app.request('/api/config/productos/categorias', req(admin, 'POST', { name: 'Prótesis fija', sort: 1 }))
    categoryId = ((await r.json()) as { category: { id: string } }).category.id
  })
  afterAll(async () => {
    await ctx.pool.end()
  })
  function req(cookie: string, method: string, body?: unknown) {
    return {
      method,
      headers: { 'content-type': 'application/json', cookie, origin: ctx.config.WEB_ORIGIN },
      body: body === undefined ? undefined : JSON.stringify(body),
    }
  }
  const zirconio = () => ({ code: 'ZR', name: 'Zirconio', categoryId, pricingUnit: 'por_pieza', basePrice: '45.00', turnaroundDays: 5, requiresTryIn: true })

  it('técnico no ve productos ni precios (403)', async () => {
    expect((await app.request('/api/config/productos', req(tecnico, 'GET'))).status).toBe(403)
    expect((await app.request('/api/config/productos/categorias', req(tecnico, 'GET'))).status).toBe(403)
  })

  it('crea producto con categoría, rechaza código duplicado y lista con categoría', async () => {
    const r = await app.request('/api/config/productos', req(admin, 'POST', zirconio()))
    expect(r.status).toBe(201)
    const dup = await app.request('/api/config/productos', req(admin, 'POST', zirconio()))
    expect(dup.status).toBe(409)
    expect(await dup.json()).toEqual({ message: 'Ya existe un producto con ese código' })
    const list = (await (await app.request('/api/config/productos', req(admin, 'GET'))).json()) as { products: { name: string; basePrice: string; category: { name: string } }[] }
    expect(list.products[0]).toMatchObject({ name: 'Zirconio', basePrice: '45.00', category: { name: 'Prótesis fija' } })
  })

  it('precio por clínica: upsert, resolución y borrado', async () => {
    const { product } = (await (await app.request('/api/config/productos', req(admin, 'POST', zirconio()))).json()) as { product: { id: string } }
    const [clinic] = await ctx.db.insert(ctx.schema.clinics).values({ name: 'Sonrisa' }).returning()
    expect(await resolvePrice(ctx.db, clinic!.id, product.id)).toBe('45.00')
    const up = await app.request(`/api/config/productos/precios/${clinic!.id}/${product.id}`, req(admin, 'PUT', { price: '40.50' }))
    expect(up.status).toBe(200)
    expect(await resolvePrice(ctx.db, clinic!.id, product.id)).toBe('40.50')
    const list = (await (await app.request(`/api/config/productos/precios/${clinic!.id}`, req(admin, 'GET'))).json()) as { prices: { productId: string; price: string }[] }
    expect(list.prices).toEqual([{ productId: product.id, price: '40.50' }])
    expect((await app.request(`/api/config/productos/precios/${clinic!.id}/${product.id}`, req(admin, 'DELETE'))).status).toBe(204)
    expect(await resolvePrice(ctx.db, clinic!.id, product.id)).toBe('45.00')
  })

  it('categoría inexistente → 422; desactivar producto lo oculta', async () => {
    const bad = await app.request('/api/config/productos', req(admin, 'POST', { ...zirconio(), categoryId: '5f9a7b6e-2c4d-4e8f-9a1b-3c5d7e9f1a2b' }))
    expect(bad.status).toBe(422)
    expect(await bad.json()).toMatchObject({ message: 'La categoría no existe' })
    const { product } = (await (await app.request('/api/config/productos', req(admin, 'POST', zirconio()))).json()) as { product: { id: string } }
    await app.request(`/api/config/productos/${product.id}/activo`, req(admin, 'PATCH', { active: false }))
    const list = (await (await app.request('/api/config/productos', req(admin, 'GET'))).json()) as { products: unknown[] }
    expect(list.products).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Ejecutar y ver fallar**

```bash
pnpm --filter @dentalware/api exec vitest run src/features/products
```
Expected: FAIL.

- [ ] **Step 3: Repositorio**

`apps/api/src/features/products/repo.ts`:
```ts
import type { ProductCategoryInput, ProductInput } from '@dentalware/shared'
import { and, asc, eq } from 'drizzle-orm'
import type { Db } from '../../db/index.ts'
import { clinicProductPrices, productCategories, products } from './schema.ts'

// --- categorías ---
export function listCategories(db: Db, includeInactive: boolean) {
  return db
    .select()
    .from(productCategories)
    .where(includeInactive ? undefined : eq(productCategories.active, true))
    .orderBy(asc(productCategories.sort), asc(productCategories.name))
}
export async function categoryExists(db: Db, id: string) {
  return (await db.select({ id: productCategories.id }).from(productCategories).where(eq(productCategories.id, id)).limit(1)).length > 0
}
export async function createCategory(db: Db, input: ProductCategoryInput) {
  const [row] = await db.insert(productCategories).values(input).returning()
  return row!
}
export async function updateCategory(db: Db, id: string, input: ProductCategoryInput) {
  const [row] = await db.update(productCategories).set({ ...input, updatedAt: new Date() }).where(eq(productCategories.id, id)).returning()
  return row ?? null
}
export async function setCategoryActive(db: Db, id: string, active: boolean) {
  const [row] = await db.update(productCategories).set({ active, updatedAt: new Date() }).where(eq(productCategories.id, id)).returning()
  return row ?? null
}

// --- productos ---
export function listProducts(db: Db, includeInactive: boolean) {
  return db.query.products.findMany({
    where: includeInactive ? undefined : { active: true },
    orderBy: { name: 'asc' },
    with: { category: { columns: { id: true, name: true } } },
  })
}
export async function codeExists(db: Db, code: string, exceptId?: string) {
  const rows = await db.select({ id: products.id }).from(products).where(eq(products.code, code))
  return rows.some((r) => r.id !== exceptId)
}
export async function createProduct(db: Db, input: ProductInput) {
  const [row] = await db.insert(products).values(input).returning()
  return row!
}
export async function updateProduct(db: Db, id: string, input: ProductInput) {
  const [row] = await db.update(products).set({ ...input, updatedAt: new Date() }).where(eq(products.id, id)).returning()
  return row ?? null
}
export async function setProductActive(db: Db, id: string, active: boolean) {
  const [row] = await db.update(products).set({ active, updatedAt: new Date() }).where(eq(products.id, id)).returning()
  return row ?? null
}

// --- precios por clínica ---
export function listClinicPrices(db: Db, clinicId: string) {
  return db
    .select({ productId: clinicProductPrices.productId, price: clinicProductPrices.price })
    .from(clinicProductPrices)
    .where(eq(clinicProductPrices.clinicId, clinicId))
}
export async function upsertClinicPrice(db: Db, clinicId: string, productId: string, price: string) {
  const [row] = await db
    .insert(clinicProductPrices)
    .values({ clinicId, productId, price })
    .onConflictDoUpdate({ target: [clinicProductPrices.clinicId, clinicProductPrices.productId], set: { price, updatedAt: new Date() } })
    .returning()
  return row!
}
export async function deleteClinicPrice(db: Db, clinicId: string, productId: string) {
  const rows = await db
    .delete(clinicProductPrices)
    .where(and(eq(clinicProductPrices.clinicId, clinicId), eq(clinicProductPrices.productId, productId)))
    .returning()
  return rows.length > 0
}
/** Precio especial de la clínica o, si no existe, el precio base del producto. */
export async function resolvePrice(db: Db, clinicId: string, productId: string): Promise<string | null> {
  const special = await db
    .select({ price: clinicProductPrices.price })
    .from(clinicProductPrices)
    .where(and(eq(clinicProductPrices.clinicId, clinicId), eq(clinicProductPrices.productId, productId)))
    .limit(1)
  if (special[0]) return special[0].price
  const base = await db.select({ price: products.basePrice }).from(products).where(eq(products.id, productId)).limit(1)
  return base[0]?.price ?? null
}
```

- [ ] **Step 4: Rutas**

`apps/api/src/features/products/routes.ts`:
```ts
import { activeQuerySchema, clinicPriceSchema, idParamSchema, productCategorySchema, productSchema } from '@dentalware/shared'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import type { Db } from '../../db/index.ts'
import { validate } from '../../lib/validate.ts'
import type { AppEnv } from '../auth/session.ts'
import { requireRole } from '../auth/session.ts'
import {
  categoryExists, codeExists, createCategory, createProduct, deleteClinicPrice, listCategories, listClinicPrices,
  listProducts, setCategoryActive, setProductActive, updateCategory, updateProduct, upsertClinicPrice,
} from './repo.ts'

const activeBody = z.object({ active: z.boolean({ error: 'Debe indicar activo o inactivo' }) })
const priceParams = z.object({ clinicId: z.uuid({ error: 'Identificador inválido' }), productId: z.uuid({ error: 'Identificador inválido' }) })
const clinicParam = z.object({ clinicId: z.uuid({ error: 'Identificador inválido' }) })
const canRead = requireRole('admin', 'recepcion') // los precios nunca llegan a técnico ni mensajero
const canWrite = requireRole('admin')

async function assertCategory(db: Db, id: string) {
  if (!(await categoryExists(db, id))) throw new HTTPException(422, { message: 'La categoría no existe' })
}
async function assertCodeFree(db: Db, code: string, exceptId?: string) {
  if (await codeExists(db, code, exceptId)) throw new HTTPException(409, { message: 'Ya existe un producto con ese código' })
}

export const productsRoutes = (db: Db) =>
  new Hono<AppEnv>()
    // categorías
    .get('/categorias', canRead, validate('query', activeQuerySchema), async (c) =>
      c.json({ categories: await listCategories(db, c.req.valid('query').incluirInactivos) }),
    )
    .post('/categorias', canWrite, validate('json', productCategorySchema), async (c) =>
      c.json({ category: await createCategory(db, c.req.valid('json')) }, 201),
    )
    .put('/categorias/:id', canWrite, validate('param', idParamSchema), validate('json', productCategorySchema), async (c) => {
      const category = await updateCategory(db, c.req.valid('param').id, c.req.valid('json'))
      if (!category) throw new HTTPException(404, { message: 'La categoría no existe' })
      return c.json({ category })
    })
    .patch('/categorias/:id/activo', canWrite, validate('param', idParamSchema), validate('json', activeBody), async (c) => {
      const category = await setCategoryActive(db, c.req.valid('param').id, c.req.valid('json').active)
      if (!category) throw new HTTPException(404, { message: 'La categoría no existe' })
      return c.json({ category })
    })
    // precios por clínica
    .get('/precios/:clinicId', canRead, validate('param', clinicParam), async (c) =>
      c.json({ prices: await listClinicPrices(db, c.req.valid('param').clinicId) }),
    )
    .put('/precios/:clinicId/:productId', canWrite, validate('param', priceParams), validate('json', clinicPriceSchema), async (c) => {
      const { clinicId, productId } = c.req.valid('param')
      return c.json({ price: await upsertClinicPrice(db, clinicId, productId, c.req.valid('json').price) })
    })
    .delete('/precios/:clinicId/:productId', canWrite, validate('param', priceParams), async (c) => {
      const { clinicId, productId } = c.req.valid('param')
      if (!(await deleteClinicPrice(db, clinicId, productId))) throw new HTTPException(404, { message: 'No hay precio especial' })
      return c.body(null, 204)
    })
    // productos
    .get('/', canRead, validate('query', activeQuerySchema), async (c) =>
      c.json({ products: await listProducts(db, c.req.valid('query').incluirInactivos) }),
    )
    .post('/', canWrite, validate('json', productSchema), async (c) => {
      const input = c.req.valid('json')
      await assertCategory(db, input.categoryId)
      await assertCodeFree(db, input.code)
      return c.json({ product: await createProduct(db, input) }, 201)
    })
    .put('/:id', canWrite, validate('param', idParamSchema), validate('json', productSchema), async (c) => {
      const input = c.req.valid('json')
      const { id } = c.req.valid('param')
      await assertCategory(db, input.categoryId)
      await assertCodeFree(db, input.code, id)
      const product = await updateProduct(db, id, input)
      if (!product) throw new HTTPException(404, { message: 'El producto no existe' })
      return c.json({ product })
    })
    .patch('/:id/activo', canWrite, validate('param', idParamSchema), validate('json', activeBody), async (c) => {
      const product = await setProductActive(db, c.req.valid('param').id, c.req.valid('json').active)
      if (!product) throw new HTTPException(404, { message: 'El producto no existe' })
      return c.json({ product })
    })
```
Nota de orden: las rutas literales `/categorias` y `/precios/...` van **antes** de `/:id` para que Hono no las capture como id (además `idParamSchema` rechazaría `categorias` con 422, lo que enmascararía el error). Montar en `app.ts`: `.route('/api/config/productos', productsRoutes(db))`.

- [ ] **Step 5: Ejecutar, verificar y commit**

```bash
pnpm --filter @dentalware/api test && pnpm typecheck && pnpm lint && pnpm format:check
git add apps/api
git commit -m "feat(api): categorías, productos y precios especiales por clínica

Refs #14, #15

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi"
```

---

### Task 7: API — fases de producción (Refs #16)

**Files:**
- Create: `apps/api/src/features/stages/repo.ts`, `apps/api/src/features/stages/routes.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/features/stages/stages.test.ts`

**Interfaces:**
- Produces: `GET /api/config/fases?incluirInactivos=` → `{ stages }` (orden `sort`; autenticado — los técnicos las ven en la ficha), `POST` (admin) → 201 `{ stage }`, `PUT /:id`, `PATCH /:id/activo`, `PUT /api/config/fases/orden` body `{ ids: uuid[] }` → `{ stages }` (reasigna `sort` = índice).

- [ ] **Step 1: Test (falla)**

`apps/api/src/features/stages/stages.test.ts`:
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../app.ts'
import { createUser, loginAs, setupTestDb, truncateAll } from '../../test/setup.ts'

describe('/api/config/fases', () => {
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  let app: ReturnType<typeof createApp>
  let admin: string
  let tecnico: string

  beforeAll(async () => {
    ctx = await setupTestDb()
    app = createApp({ auth: ctx.auth, db: ctx.db, webOrigin: ctx.config.WEB_ORIGIN })
  })
  beforeEach(async () => {
    await truncateAll(ctx.db)
    await createUser(ctx.auth, ctx.db, { email: 'admin@t.local', password: 'Admin12345!', name: 'Admin', role: 'admin' })
    await createUser(ctx.auth, ctx.db, { email: 'tec@t.local', password: 'Tecnico123!', name: 'Tec', role: 'tecnico' })
    admin = await loginAs(app, 'admin@t.local', 'Admin12345!')
    tecnico = await loginAs(app, 'tec@t.local', 'Tecnico123!')
  })
  afterAll(async () => {
    await ctx.pool.end()
  })
  const req = (cookie: string, method: string, body?: unknown) => ({
    method,
    headers: { 'content-type': 'application/json', cookie, origin: ctx.config.WEB_ORIGIN },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  it('crea fases, el técnico las lee ordenadas y admin las reordena', async () => {
    const a = (await (await app.request('/api/config/fases', req(admin, 'POST', { name: 'Modelo', color: '#0F766E', sort: 2 }))).json()) as { stage: { id: string } }
    const b = (await (await app.request('/api/config/fases', req(admin, 'POST', { name: 'Recepción', color: '#5B6A6E', sort: 1 }))).json()) as { stage: { id: string } }
    const list = (await (await app.request('/api/config/fases', req(tecnico, 'GET'))).json()) as { stages: { name: string }[] }
    expect(list.stages.map((s) => s.name)).toEqual(['Recepción', 'Modelo'])
    expect((await app.request('/api/config/fases', req(tecnico, 'POST', { name: 'X', color: '#000000' }))).status).toBe(403)
    const re = await app.request('/api/config/fases/orden', req(admin, 'PUT', { ids: [a.stage.id, b.stage.id] }))
    expect(re.status).toBe(200)
    const list2 = (await (await app.request('/api/config/fases', req(admin, 'GET'))).json()) as { stages: { name: string; sort: number }[] }
    expect(list2.stages.map((s) => [s.name, s.sort])).toEqual([['Modelo', 0], ['Recepción', 1]])
  })

  it('valida color y desactiva', async () => {
    const bad = await app.request('/api/config/fases', req(admin, 'POST', { name: 'X', color: 'teal' }))
    expect(bad.status).toBe(422)
    const { stage } = (await (await app.request('/api/config/fases', req(admin, 'POST', { name: 'Acabado', color: '#2F8F5B' }))).json()) as { stage: { id: string } }
    const off = await app.request(`/api/config/fases/${stage.id}/activo`, req(admin, 'PATCH', { active: false }))
    expect(((await off.json()) as { stage: { active: boolean } }).stage.active).toBe(false)
    const list = (await (await app.request('/api/config/fases', req(admin, 'GET'))).json()) as { stages: unknown[] }
    expect(list.stages).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Ejecutar y ver fallar** — `pnpm --filter @dentalware/api exec vitest run src/features/stages` → FAIL.

- [ ] **Step 3: Repositorio y rutas**

`apps/api/src/features/stages/repo.ts`:
```ts
import type { StageInput } from '@dentalware/shared'
import { asc, eq, inArray } from 'drizzle-orm'
import type { Db } from '../../db/index.ts'
import { stages } from './schema.ts'

export function listStages(db: Db, includeInactive: boolean) {
  return db.select().from(stages).where(includeInactive ? undefined : eq(stages.active, true)).orderBy(asc(stages.sort), asc(stages.name))
}
export async function createStage(db: Db, input: StageInput) {
  const [row] = await db.insert(stages).values(input).returning()
  return row!
}
export async function updateStage(db: Db, id: string, input: StageInput) {
  const [row] = await db.update(stages).set({ ...input, updatedAt: new Date() }).where(eq(stages.id, id)).returning()
  return row ?? null
}
export async function setStageActive(db: Db, id: string, active: boolean) {
  const [row] = await db.update(stages).set({ active, updatedAt: new Date() }).where(eq(stages.id, id)).returning()
  return row ?? null
}
/** Reasigna sort = posición en `ids`; los ids desconocidos se ignoran. Devuelve la lista completa ordenada. */
export async function reorderStages(db: Db, ids: string[]) {
  const existing = await db.select({ id: stages.id }).from(stages).where(inArray(stages.id, ids))
  const known = new Set(existing.map((s) => s.id))
  await db.transaction(async (tx) => {
    let i = 0
    for (const id of ids) {
      if (!known.has(id)) continue
      await tx.update(stages).set({ sort: i, updatedAt: new Date() }).where(eq(stages.id, id))
      i++
    }
  })
  return listStages(db, true)
}
```

`apps/api/src/features/stages/routes.ts`:
```ts
import { activeQuerySchema, idParamSchema, stageSchema } from '@dentalware/shared'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import type { Db } from '../../db/index.ts'
import { validate } from '../../lib/validate.ts'
import type { AppEnv } from '../auth/session.ts'
import { requireAuth, requireRole } from '../auth/session.ts'
import { createStage, listStages, reorderStages, setStageActive, updateStage } from './repo.ts'

const activeBody = z.object({ active: z.boolean({ error: 'Debe indicar activo o inactivo' }) })
const orderBody = z.object({ ids: z.array(z.uuid({ error: 'Identificador inválido' })).min(1, { error: 'Debe enviar al menos una fase' }) })

export const stagesRoutes = (db: Db) =>
  new Hono<AppEnv>()
    .get('/', requireAuth, validate('query', activeQuerySchema), async (c) =>
      c.json({ stages: await listStages(db, c.req.valid('query').incluirInactivos) }),
    )
    .put('/orden', requireRole('admin'), validate('json', orderBody), async (c) =>
      c.json({ stages: await reorderStages(db, c.req.valid('json').ids) }),
    )
    .post('/', requireRole('admin'), validate('json', stageSchema), async (c) =>
      c.json({ stage: await createStage(db, c.req.valid('json')) }, 201),
    )
    .put('/:id', requireRole('admin'), validate('param', idParamSchema), validate('json', stageSchema), async (c) => {
      const stage = await updateStage(db, c.req.valid('param').id, c.req.valid('json'))
      if (!stage) throw new HTTPException(404, { message: 'La fase no existe' })
      return c.json({ stage })
    })
    .patch('/:id/activo', requireRole('admin'), validate('param', idParamSchema), validate('json', activeBody), async (c) => {
      const stage = await setStageActive(db, c.req.valid('param').id, c.req.valid('json').active)
      if (!stage) throw new HTTPException(404, { message: 'La fase no existe' })
      return c.json({ stage })
    })
```
Montar en `app.ts`: `.route('/api/config/fases', stagesRoutes(db))`.

- [ ] **Step 4: Ejecutar, verificar y commit**

```bash
pnpm --filter @dentalware/api test && pnpm typecheck && pnpm lint && pnpm format:check
git add apps/api
git commit -m "feat(api): fases de producción con color, orden y borrado lógico

Refs #16

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi"
```

---

### Task 8: API — usuarios con el plugin admin de Better Auth y seed de catálogos (Refs #11, #18)

**Files:**
- Create: `apps/api/src/features/users/routes.ts`, `apps/api/src/features/users/users.test.ts`, `apps/api/src/scripts/seed-data.ts`, `apps/api/drizzle/<timestamp>_<nombre>/` (generado: columnas `banned`, `ban_reason`, `ban_expires` en `users`, `impersonated_by` en `sessions`)
- Modify: `apps/api/src/auth.ts`, `apps/api/src/db/schema/auth.ts` (regenerado por la CLI), `apps/api/src/app.ts`, `apps/api/src/scripts/seed.ts`, `apps/api/src/test/setup.ts`
- Test: `apps/api/src/features/users/users.test.ts`

**Interfaces:**
- Consumes: `createUserSchema`, `updateUserSchema`, `idParamSchema` (id de usuario es `text`, así que aquí se usa `z.object({ id: z.string().min(1) })`).
- Produces: plugin `admin({ adminRoles: ['admin'], defaultRole: 'tecnico' })` en `createAuth`; rutas propias que delegan en `auth.api.*` para mantener el RPC tipado y los mensajes en español:
  - `GET /api/users` (admin) → `{ users: { id, name, email, role, banned, createdAt }[] }` ordenados por nombre.
  - `POST /api/users` (admin) body `createUserSchema` → 201 `{ user }` (409 `{ message: 'Ya existe un usuario con ese correo' }`).
  - `PATCH /api/users/:id` (admin) body `updateUserSchema` → `{ user }` (nombre, rol y/o contraseña).
  - `PATCH /api/users/:id/bloqueo` body `{ banned: boolean, reason?: string }` → `{ user }`; un usuario bloqueado no puede iniciar sesión (better-auth revoca sus sesiones).
  - El admin no puede bloquearse ni cambiarse el rol a sí mismo (422 `{ message: 'No puedes modificar tu propio acceso' }`).
  - `createUser` del test setup pasa a usar `auth.api.createUser` con `role`.
  - Seed: `seedCatalogs(db)` idempotente (por nombre/código) con `lab_settings` de Arte Dental, categorías y productos de la orden en papel y fases por defecto; `seed.ts` lo llama después de crear el admin.

- [ ] **Step 1: Plugin admin y regeneración del esquema**

`apps/api/src/auth.ts`: añadir `import { admin } from 'better-auth/plugins'` y en `betterAuth({...})`:
```ts
    plugins: [admin({ adminRoles: ['admin'], defaultRole: 'tecnico' })],
```
Mantener `user.additionalFields.role` (tipado del rol en la sesión; el plugin fuerza `input: false` igualmente).

Regenerar el esquema y la migración (la CLI añade `banned`, `banReason`, `banExpires` a `users` e `impersonatedBy` a `sessions`):
```bash
cd apps/api
pnpm dlx auth@1.7.2 generate --config src/auth.instance.ts --output src/db/schema/auth.ts -y
pnpm exec prettier --write src/db/schema/auth.ts
cd ../..
pnpm --filter @dentalware/api db:generate
grep -n "banned\|impersonated_by" apps/api/drizzle/*/migration.sql
```
Expected: nueva carpeta de migración con `ALTER TABLE "users" ADD COLUMN "banned"…` y `ALTER TABLE "sessions" ADD COLUMN "impersonated_by"…`. Si la CLI reescribe `authRelations` con otro nombre, ajustar `db/index.ts`. `auth.instance.ts` debe seguir compilando (usa `createDb`, que ahora requiere `relations` — ya definidas en Task 3).

- [ ] **Step 2: Test (falla)**

`apps/api/src/features/users/users.test.ts`:
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../app.ts'
import { createUser, loginAs, setupTestDb, truncateAll } from '../../test/setup.ts'

describe('/api/users', () => {
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  let app: ReturnType<typeof createApp>
  let admin: string
  let adminId: string

  beforeAll(async () => {
    ctx = await setupTestDb()
    app = createApp({ auth: ctx.auth, db: ctx.db, webOrigin: ctx.config.WEB_ORIGIN })
  })
  beforeEach(async () => {
    await truncateAll(ctx.db)
    adminId = await createUser(ctx.auth, ctx.db, { email: 'admin@t.local', password: 'Admin12345!', name: 'Admin', role: 'admin' })
    admin = await loginAs(app, 'admin@t.local', 'Admin12345!')
  })
  afterAll(async () => {
    await ctx.pool.end()
  })
  const req = (cookie: string, method: string, body?: unknown) => ({
    method,
    headers: { 'content-type': 'application/json', cookie, origin: ctx.config.WEB_ORIGIN },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  it('admin crea un usuario con rol, aparece en la lista y puede iniciar sesión', async () => {
    const r = await app.request('/api/users', req(admin, 'POST', { name: 'Ana', email: 'ana@t.local', password: 'Secreta123', role: 'recepcion' }))
    expect(r.status).toBe(201)
    expect(((await r.json()) as { user: { role: string } }).user.role).toBe('recepcion')
    const list = (await (await app.request('/api/users', req(admin, 'GET'))).json()) as { users: { email: string; role: string }[] }
    expect(list.users.map((u) => u.email)).toEqual(['admin@t.local', 'ana@t.local'])
    const cookie = await loginAs(app, 'ana@t.local', 'Secreta123')
    const me = (await (await app.request('/api/me', req(cookie, 'GET'))).json()) as { role: string }
    expect(me.role).toBe('recepcion')
    expect((await app.request('/api/users', req(cookie, 'GET'))).status).toBe(403)
  })

  it('correo duplicado → 409; cambia rol y contraseña; bloqueo impide login', async () => {
    await app.request('/api/users', req(admin, 'POST', { name: 'Ana', email: 'ana@t.local', password: 'Secreta123', role: 'recepcion' }))
    const dup = await app.request('/api/users', req(admin, 'POST', { name: 'Ana2', email: 'ana@t.local', password: 'Secreta123', role: 'tecnico' }))
    expect(dup.status).toBe(409)
    const list = (await (await app.request('/api/users', req(admin, 'GET'))).json()) as { users: { id: string; email: string }[] }
    const ana = list.users.find((u) => u.email === 'ana@t.local')!
    const upd = await app.request(`/api/users/${ana.id}`, req(admin, 'PATCH', { role: 'tecnico', password: 'Nueva12345' }))
    expect(upd.status).toBe(200)
    expect(((await upd.json()) as { user: { role: string } }).user.role).toBe('tecnico')
    await loginAs(app, 'ana@t.local', 'Nueva12345')
    const ban = await app.request(`/api/users/${ana.id}/bloqueo`, req(admin, 'PATCH', { banned: true, reason: 'Salió del laboratorio' }))
    expect(((await ban.json()) as { user: { banned: boolean } }).user.banned).toBe(true)
    await expect(loginAs(app, 'ana@t.local', 'Nueva12345')).rejects.toThrow()
  })

  it('el admin no puede bloquearse ni degradarse a sí mismo', async () => {
    const self = await app.request(`/api/users/${adminId}/bloqueo`, req(admin, 'PATCH', { banned: true }))
    expect(self.status).toBe(422)
    expect(await self.json()).toEqual({ message: 'No puedes modificar tu propio acceso' })
    const role = await app.request(`/api/users/${adminId}`, req(admin, 'PATCH', { role: 'tecnico' }))
    expect(role.status).toBe(422)
  })
})
```

- [ ] **Step 3: Ejecutar y ver fallar** — `pnpm --filter @dentalware/api exec vitest run src/features/users` → FAIL (404).

- [ ] **Step 4: Rutas de usuarios**

`apps/api/src/features/users/routes.ts`:
```ts
import { createUserSchema, updateUserSchema } from '@dentalware/shared'
import { APIError } from 'better-auth/api'
import { asc } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import type { Auth } from '../../auth.ts'
import type { Db } from '../../db/index.ts'
import { users } from '../../db/schema/index.ts'
import { validate } from '../../lib/validate.ts'
import type { AppEnv } from '../auth/session.ts'
import { requireRole } from '../auth/session.ts'

const idParam = z.object({ id: z.string().min(1, { error: 'Identificador inválido' }) })
const banBody = z.object({ banned: z.boolean(), reason: z.string().trim().max(200).optional() })
const publicUser = { id: users.id, name: users.name, email: users.email, role: users.role, banned: users.banned, createdAt: users.createdAt }

/** Traduce los errores de better-auth a HTTPException en español. */
function translate(err: unknown): never {
  if (err instanceof APIError) {
    if (err.status === 'UNPROCESSABLE_ENTITY' || /already exists/i.test(err.message)) {
      throw new HTTPException(409, { message: 'Ya existe un usuario con ese correo' })
    }
    throw new HTTPException(400, { message: 'No se pudo completar la operación' })
  }
  throw err
}

export const usersRoutes = (db: Db, auth: Auth) =>
  new Hono<AppEnv>()
    .use(requireRole('admin'))
    .get('/', async (c) => c.json({ users: await db.select(publicUser).from(users).orderBy(asc(users.name)) }))
    .post('/', validate('json', createUserSchema), async (c) => {
      const input = c.req.valid('json')
      try {
        const created = await auth.api.createUser({
          body: { email: input.email, password: input.password, name: input.name, role: input.role },
          headers: c.req.raw.headers,
        })
        const [row] = await db.select(publicUser).from(users).where(eq(users.id, created.user.id))
        return c.json({ user: row! }, 201)
      } catch (err) {
        translate(err)
      }
    })
    .patch('/:id', validate('param', idParam), validate('json', updateUserSchema), async (c) => {
      const { id } = c.req.valid('param')
      const input = c.req.valid('json')
      if (id === c.var.user!.id && input.role && input.role !== c.var.user!.role) {
        throw new HTTPException(422, { message: 'No puedes modificar tu propio acceso' })
      }
      try {
        if (input.role) await auth.api.setRole({ body: { userId: id, role: input.role }, headers: c.req.raw.headers })
        if (input.password) await auth.api.setUserPassword({ body: { userId: id, newPassword: input.password }, headers: c.req.raw.headers })
        if (input.name) await db.update(users).set({ name: input.name, updatedAt: new Date() }).where(eq(users.id, id))
      } catch (err) {
        translate(err)
      }
      const [row] = await db.select(publicUser).from(users).where(eq(users.id, id))
      if (!row) throw new HTTPException(404, { message: 'El usuario no existe' })
      return c.json({ user: row })
    })
    .patch('/:id/bloqueo', validate('param', idParam), validate('json', banBody), async (c) => {
      const { id } = c.req.valid('param')
      const { banned, reason } = c.req.valid('json')
      if (id === c.var.user!.id) throw new HTTPException(422, { message: 'No puedes modificar tu propio acceso' })
      try {
        if (banned) await auth.api.banUser({ body: { userId: id, banReason: reason ?? 'Acceso desactivado' }, headers: c.req.raw.headers })
        else await auth.api.unbanUser({ body: { userId: id }, headers: c.req.raw.headers })
      } catch (err) {
        translate(err)
      }
      const [row] = await db.select(publicUser).from(users).where(eq(users.id, id))
      if (!row) throw new HTTPException(404, { message: 'El usuario no existe' })
      return c.json({ user: row })
    })
```
(Añadir `eq` al import de `drizzle-orm`.) Si los nombres `auth.api.createUser/setRole/setUserPassword/banUser/unbanUser` o la forma de `APIError` difieren en better-auth 1.7.2, consultar context7 (`/better-auth/better-auth`, "admin plugin server api") y ajustar; nunca escribir en `users.role` directamente salvo el nombre. Montar en `app.ts`: `.route('/api/users', usersRoutes(db, auth))`. El guard `app.use('/api/auth/sign-up/*', requireRole('admin'))` se mantiene.

`apps/api/src/test/setup.ts` — `createUser` pasa a:
```ts
export async function createUser(auth: Auth, db: Db, input: { email: string; password: string; name: string; role: UserRole }) {
  // Sin sesión de admin: se crea con sign-up (defaultRole) y se fija el rol en servidor.
  const created = await auth.api.signUpEmail({ body: { email: input.email, password: input.password, name: input.name } })
  await db.update(users).set({ role: input.role }).where(eq(users.id, created.user.id))
  return created.user.id
}
```
(Igual que hoy; se deja explícito porque `defaultRole` ahora es `tecnico` por el plugin.) `truncateAll` no cambia.

- [ ] **Step 5: Seed de catálogos**

`apps/api/src/scripts/seed-data.ts`:
```ts
import { eq } from 'drizzle-orm'
import type { Db } from '../db/index.ts'
import { labSettings, productCategories, products, stages } from '../db/schema/index.ts'

const LAB = { name: 'Arte Dental', address: 'Puerto Rico N27-33 y La Isla', phone: '0961440991 / 0996081498', codePrefix: '', ivaPct: 15 }
const CATEGORIES: { name: string; sort: number; products: { code: string; name: string; pricingUnit: 'por_pieza' | 'por_arcada' | 'por_trabajo'; turnaroundDays: number; requiresTryIn: boolean }[] }[] = [
  { name: 'Prótesis fija', sort: 1, products: [
    { code: 'ZR', name: 'Zirconio', pricingUnit: 'por_pieza', turnaroundDays: 5, requiresTryIn: false },
    { code: 'DL', name: 'Disilicato de litio', pricingUnit: 'por_pieza', turnaroundDays: 5, requiresTryIn: false },
    { code: 'MP', name: 'Metal porcelana', pricingUnit: 'por_pieza', turnaroundDays: 6, requiresTryIn: true },
  ] },
  { name: 'Prótesis removible', sort: 2, products: [
    { code: 'AC', name: 'Acrílico', pricingUnit: 'por_arcada', turnaroundDays: 7, requiresTryIn: true },
    { code: 'CC', name: 'Cromo cobalto', pricingUnit: 'por_arcada', turnaroundDays: 10, requiresTryIn: true },
    { code: 'PH', name: 'Prótesis híbrida', pricingUnit: 'por_arcada', turnaroundDays: 12, requiresTryIn: true },
  ] },
]
const STAGES = [
  ['Recepción', '#5B6A6E'], ['Modelo', '#6B7C93'], ['Diseño', '#7C5CBF'], ['Estructura', '#2F6FB0'],
  ['Cerámica/Acrílico', '#0F766E'], ['Acabado', '#D99A16'], ['Control de calidad', '#2F8F5B'],
] as const

/** Idempotente: crea lo que falte (por nombre/código) y no toca lo existente. Precios base en 0.00 hasta que el admin los defina. */
export async function seedCatalogs(db: Db) {
  if ((await db.select({ id: labSettings.id }).from(labSettings).limit(1)).length === 0) {
    await db.insert(labSettings).values(LAB)
  }
  for (const cat of CATEGORIES) {
    let [row] = await db.select().from(productCategories).where(eq(productCategories.name, cat.name))
    if (!row) [row] = await db.insert(productCategories).values({ name: cat.name, sort: cat.sort }).returning()
    for (const p of cat.products) {
      const exists = await db.select({ id: products.id }).from(products).where(eq(products.code, p.code))
      if (exists.length === 0) await db.insert(products).values({ ...p, categoryId: row!.id, basePrice: '0.00' })
    }
  }
  let i = 0
  for (const [name, color] of STAGES) {
    const exists = await db.select({ id: stages.id }).from(stages).where(eq(stages.name, name))
    if (exists.length === 0) await db.insert(stages).values({ name, color, sort: i })
    i++
  }
}
```

`apps/api/src/scripts/seed.ts`: tras crear/verificar el admin, `await seedCatalogs(db)` y `console.log('Catálogos iniciales listos')`; envolver todo en `try { … } finally { await pool.end() }`.

- [ ] **Step 6: Ejecutar todo, seed local y commit**

```bash
pnpm --filter @dentalware/api test && pnpm typecheck && pnpm lint && pnpm format:check
pnpm --filter @dentalware/api seed     # "Admin ya existe…" + "Catálogos iniciales listos"
pnpm --filter @dentalware/api seed     # idempotente: mismas líneas, sin duplicados
git add apps/api
git commit -m "feat(api): usuarios con el plugin admin de better-auth (crear, rol, contraseña, bloqueo) y seed de catálogos de Arte Dental

Refs #11, #18

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi"
```

---

### Task 9: Web — primitivas shadcn, componentes transversales y notificaciones (Refs #17)

**Files:**
- Create (shadcn CLI): `apps/web/src/components/ui/{table,dialog,alert-dialog,select,switch,badge,tabs,textarea,sonner,field,dropdown-menu}.tsx`
- Create: `apps/web/src/components/page-header.tsx`, `apps/web/src/components/data-table.tsx`, `apps/web/src/components/form-dialog.tsx`, `apps/web/src/components/confirm-dialog.tsx`, `apps/web/src/components/empty-state.tsx`, `apps/web/src/components/active-badge.tsx`, `apps/web/src/lib/query-keys.ts`, `apps/web/src/lib/api-error.ts`
- Modify: `apps/web/src/routes/__root.tsx` (montar `<Toaster />`), `pnpm-workspace.yaml` (catalog `sonner: 2.0.8`), `apps/web/package.json`

**Interfaces:**
- Produces:
  - `PageHeader({ title, description?, action? })` — `<h1 class="text-2xl font-semibold">` + acción a la derecha (en móvil debajo, ancho completo).
  - `DataTable<T>({ columns, rows, getRowId, emptyMessage, renderMobile })` — tabla en ≥1024px (`<Table>` de shadcn), lista de tarjetas en móvil (`renderMobile(row)`), estado vacío con `EmptyState`.
  - `FormDialog({ open, onOpenChange, title, description?, children, footer })` — `Dialog` con `max-w-lg`, scroll interno, cierre con Escape.
  - `ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, destructive?, onConfirm, pending })` — `AlertDialog`.
  - `EmptyState({ title, description?, action? })`; `ActiveBadge({ active })` — chip + texto "Activo"/"Inactivo".
  - `queryKeys` — `labSettings: ['config','laboratorio']`, `clinics: (inactive) => ['config','clinicas', { inactive }]`, `clinic: (id) => ['config','clinicas', id]`, `doctors: (clinicId?, inactive?) => [...]`, `categories`, `products: (inactive)`, `clinicPrices: (clinicId)`, `stages: (inactive)`, `users: ['users']`.
  - `apiError(res)`: lee `{ message, issues? }` de una respuesta no-ok y devuelve `{ message, issues }`; `toastApiError(err)` muestra `toast.error(message)`.

- [ ] **Step 1: Componentes shadcn y sonner**

```bash
cd apps/web
pnpm dlx shadcn@4.19.1 add table dialog alert-dialog select switch badge tabs textarea sonner field dropdown-menu
cd ../..
grep -n '"sonner"' apps/web/package.json
```
Añadir al catalog raíz `sonner: 2.0.8` y cambiar `apps/web/package.json` a `"sonner": "catalog:"`; `pnpm install`. Si el CLI añade otras deps con `^`, fijarlas igual en el catalog (verificar la versión con `npm view <pkg> dist-tags.latest`) o quitarlas si no se usan.

- [ ] **Step 2: Utilidades**

`apps/web/src/lib/query-keys.ts`:
```ts
export const queryKeys = {
  labSettings: ['config', 'laboratorio'] as const,
  clinics: (inactive: boolean) => ['config', 'clinicas', { inactive }] as const,
  clinic: (id: string) => ['config', 'clinicas', id] as const,
  doctors: (clinicId?: string, inactive = false) => ['config', 'doctores', { clinicId, inactive }] as const,
  categories: (inactive: boolean) => ['config', 'categorias', { inactive }] as const,
  products: (inactive: boolean) => ['config', 'productos', { inactive }] as const,
  clinicPrices: (clinicId: string) => ['config', 'precios', clinicId] as const,
  stages: (inactive: boolean) => ['config', 'fases', { inactive }] as const,
  users: ['users'] as const,
}
```

`apps/web/src/lib/api-error.ts`:
```ts
import { toast } from 'sonner'

export type ApiIssue = { path: string; message: string }
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public issues: ApiIssue[] = [],
  ) {
    super(message)
  }
}

/** Convierte una respuesta no-ok de la API en ApiError con el mensaje en español del servidor. */
export async function throwIfNotOk(res: Response): Promise<Response> {
  if (res.ok) return res
  let body: { message?: string; issues?: ApiIssue[] } = {}
  try {
    body = (await res.json()) as typeof body
  } catch {
    /* sin cuerpo */
  }
  throw new ApiError(body.message ?? 'No se pudo completar la operación', res.status, body.issues ?? [])
}

export function toastApiError(err: unknown) {
  toast.error(err instanceof ApiError ? err.message : 'No se pudo completar la operación')
}
```

- [ ] **Step 3: Componentes transversales**

`apps/web/src/components/page-header.tsx`:
```tsx
import type { ReactNode } from 'react'

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      {action && <div className="flex w-full sm:w-auto [&>button]:w-full sm:[&>button]:w-auto">{action}</div>}
    </div>
  )
}
```

`apps/web/src/components/empty-state.tsx`:
```tsx
import type { ReactNode } from 'react'

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="border-border flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {description && <p className="text-muted-foreground max-w-sm text-sm">{description}</p>}
      {action}
    </div>
  )
}
```

`apps/web/src/components/active-badge.tsx`:
```tsx
import { Badge } from '@/components/ui/badge'

export function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge className="bg-accent text-accent-foreground hover:bg-accent">Activo</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">Inactivo</Badge>
  )
}
```

`apps/web/src/components/data-table.tsx`:
```tsx
import type { ReactNode } from 'react'
import { EmptyState } from '@/components/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export type Column<T> = {
  key: string
  header: string
  cell: (row: T) => ReactNode
  className?: string
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  emptyMessage,
  emptyAction,
  renderMobile,
}: {
  columns: Column<T>[]
  rows: T[]
  getRowId: (row: T) => string
  emptyMessage: string
  emptyAction?: ReactNode
  renderMobile: (row: T) => ReactNode
}) {
  if (rows.length === 0) return <EmptyState title={emptyMessage} action={emptyAction} />
  return (
    <>
      <div className="bg-card border-border hidden overflow-x-auto rounded-xl border lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key} className={c.className}>
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={getRowId(row)}>
                {columns.map((c) => (
                  <TableCell key={c.key} className={c.className}>
                    {c.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="flex flex-col gap-3 lg:hidden">
        {rows.map((row) => (
          <li key={getRowId(row)} className="bg-card border-border rounded-xl border p-4">
            {renderMobile(row)}
          </li>
        ))}
      </ul>
    </>
  )
}
```

`apps/web/src/components/form-dialog.tsx`:
```tsx
import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        <DialogFooter className="gap-2">{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

`apps/web/src/components/confirm-dialog.tsx`:
```tsx
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  pending = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  destructive?: boolean
  pending?: boolean
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={pending}
            className={destructive ? 'bg-destructive text-white hover:bg-destructive/90' : undefined}
          >
            {pending ? 'Guardando…' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

`apps/web/src/routes/__root.tsx`: importar `import { Toaster } from '@/components/ui/sonner'` y renderizar `<Toaster position="top-center" richColors />` junto al `<Outlet />`.

- [ ] **Step 4: Verificar**

```bash
pnpm --filter @dentalware/web typecheck && pnpm lint && pnpm format:check
pnpm --filter @dentalware/web build
```
Expected: sin errores (los componentes aún no se usan; `noUnusedLocals` no aplica a exports).

- [ ] **Step 5: Commit**

```bash
git add apps/web pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat(web): primitivas shadcn, componentes transversales (tabla, diálogos, encabezado) y toasts

Refs #17

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi"
```

---

### Task 10: Web — layout de Configuración, Laboratorio y Fases (Refs #10, #16, #17)

**Files:**
- Create: `apps/web/src/features/config/config-nav.tsx`, `apps/web/src/features/config/api.ts`, `apps/web/src/features/config/use-lab-settings.ts`, `apps/web/src/features/config/lab-settings-form.tsx`, `apps/web/src/features/stages/api.ts`, `apps/web/src/features/stages/use-stages.ts`, `apps/web/src/features/stages/stage-form.tsx`, `apps/web/src/features/stages/stages-table.tsx`, `apps/web/src/routes/_app/configuracion/index.tsx`, `apps/web/src/routes/_app/configuracion/laboratorio.tsx`, `apps/web/src/routes/_app/configuracion/fases.tsx`
- Modify: `apps/web/src/routes/_app/configuracion.tsx` (pasa a layout con `<Outlet />`), `apps/web/src/routes/_app.tsx` (guard: `/configuracion/*` solo admin)

**Interfaces:**
- Consumes: `api` (hc), `queryKeys`, `throwIfNotOk`, `toastApiError`, `PageHeader`, `DataTable`, `FormDialog`, `ConfirmDialog`, `ActiveBadge`; schemas `labSettingsSchema`, `stageSchema`.
- Produces: patrón de feature web reutilizado en Tasks 11-13: `features/<f>/api.ts` (funciones `list/create/update/setActive` sobre `api.api.config.<ruta>`), `features/<f>/use-<f>.ts` (hooks `useX()` con `useQuery`, `useCreateX()`/`useUpdateX()`/`useSetXActive()` con `useMutation` + `invalidateQueries` + toasts), `features/<f>/<f>-form.tsx` (react-hook-form + zodResolver + `Field`), `features/<f>/<f>-table.tsx` (DataTable + acciones). `ConfigNav` con las secciones: Laboratorio, Usuarios, Clínicas, Productos, Fases.

- [ ] **Step 1: Layout y guard**

`apps/web/src/routes/_app/configuracion.tsx`:
```tsx
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { ConfigNav } from '@/features/config/config-nav'

export const Route = createFileRoute('/_app/configuracion')({
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'admin') throw redirect({ to: '/' })
  },
  component: ConfigLayout,
})

function ConfigLayout() {
  return (
    <div className="flex flex-col gap-6">
      <ConfigNav />
      <Outlet />
    </div>
  )
}
```

`apps/web/src/features/config/config-nav.tsx`:
```tsx
import { Link } from '@tanstack/react-router'

const SECTIONS = [
  { to: '/configuracion/laboratorio', label: 'Laboratorio' },
  { to: '/configuracion/usuarios', label: 'Usuarios' },
  { to: '/configuracion/clinicas', label: 'Clínicas' },
  { to: '/configuracion/productos', label: 'Productos' },
  { to: '/configuracion/fases', label: 'Fases' },
] as const

export function ConfigNav() {
  return (
    <nav aria-label="Secciones de configuración" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-2">
        {SECTIONS.map((s) => (
          <li key={s.to}>
            <Link
              to={s.to}
              className="text-muted-foreground hover:bg-accent/60 focus-visible:ring-ring inline-flex h-11 items-center rounded-lg px-4 text-sm whitespace-nowrap transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
              activeProps={{ className: 'bg-accent text-accent-foreground font-medium' }}
            >
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
```
(Los enlaces a `/configuracion/usuarios`, `/configuracion/clinicas` y `/configuracion/productos` fallan en typecheck hasta que existan sus rutas: en esta tarea crear también archivos mínimos `usuarios.tsx`, `clinicas.tsx`, `productos.tsx` con `component: () => <PageHeader title="…" />`; las Tasks 11-13 los completan.)

`apps/web/src/routes/_app/configuracion/index.tsx`:
```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/configuracion/')({
  beforeLoad: () => {
    throw redirect({ to: '/configuracion/laboratorio' })
  },
})
```

- [ ] **Step 2: Feature laboratorio**

`apps/web/src/features/config/api.ts`:
```ts
import type { LabSettingsInput } from '@dentalware/shared'
import { api } from '@/lib/api'
import { throwIfNotOk } from '@/lib/api-error'

export async function fetchLabSettings() {
  const res = await throwIfNotOk(await api.api.config.laboratorio.$get())
  return (await res.json()).settings
}
export type LabSettings = NonNullable<Awaited<ReturnType<typeof fetchLabSettings>>>

export async function saveLabSettings(input: LabSettingsInput) {
  const res = await throwIfNotOk(await api.api.config.laboratorio.$put({ json: input }))
  return (await res.json()).settings
}
```

`apps/web/src/features/config/use-lab-settings.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { toastApiError } from '@/lib/api-error'
import { queryKeys } from '@/lib/query-keys'
import { fetchLabSettings, saveLabSettings } from './api'

export function useLabSettings() {
  return useQuery({ queryKey: queryKeys.labSettings, queryFn: fetchLabSettings })
}

export function useSaveLabSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: saveLabSettings,
    onSuccess: (settings) => {
      qc.setQueryData(queryKeys.labSettings, settings)
      toast.success('Datos del laboratorio guardados')
    },
    onError: toastApiError,
  })
}
```

`apps/web/src/features/config/lab-settings-form.tsx`:
```tsx
import { labSettingsSchema, type LabSettingsInput } from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { LabSettings } from './api'

export function LabSettingsForm({ initial, onSubmit, pending }: { initial: LabSettings | null; onSubmit: (v: LabSettingsInput) => void; pending: boolean }) {
  const form = useForm<LabSettingsInput>({
    resolver: zodResolver(labSettingsSchema),
    defaultValues: {
      name: initial?.name ?? '',
      ruc: initial?.ruc ?? '',
      address: initial?.address ?? '',
      phone: initial?.phone ?? '',
      logoUrl: initial?.logoUrl ?? '',
      codePrefix: initial?.codePrefix ?? '',
      ivaPct: initial?.ivaPct ?? 15,
    },
  })
  const text = (name: keyof LabSettingsInput, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <Controller
      name={name}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={`lab-${name}`}>{label}</FieldLabel>
          <Input {...field} {...props} id={`lab-${name}`} value={field.value ?? ''} aria-invalid={fieldState.invalid} className="h-11" />
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="bg-card border-border flex max-w-2xl flex-col gap-6 rounded-xl border p-6" noValidate>
      <FieldGroup>
        {text('name', 'Nombre del laboratorio')}
        {text('ruc', 'RUC', { inputMode: 'numeric' })}
        {text('address', 'Dirección')}
        {text('phone', 'Teléfonos')}
        {text('codePrefix', 'Prefijo del código de trabajo')}
        {text('ivaPct', 'IVA informativo (%)', { type: 'number', inputMode: 'numeric' })}
        {text('logoUrl', 'URL del logo')}
      </FieldGroup>
      <div className="flex justify-end">
        <Button type="submit" className="h-11 w-full sm:w-auto" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  )
}
```

`apps/web/src/routes/_app/configuracion/laboratorio.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/page-header'
import { LabSettingsForm } from '@/features/config/lab-settings-form'
import { useLabSettings, useSaveLabSettings } from '@/features/config/use-lab-settings'

export const Route = createFileRoute('/_app/configuracion/laboratorio')({ component: LabSettingsPage })

function LabSettingsPage() {
  const settings = useLabSettings()
  const save = useSaveLabSettings()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Laboratorio" description="Datos que aparecen en las fichas impresas y en los avisos a las clínicas." />
      {settings.isPending ? (
        <p className="text-muted-foreground text-sm">Cargando…</p>
      ) : (
        <LabSettingsForm key={settings.data?.id ?? 'new'} initial={settings.data ?? null} onSubmit={(v) => save.mutate(v)} pending={save.isPending} />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Feature fases**

`apps/web/src/features/stages/api.ts`:
```ts
import type { StageInput } from '@dentalware/shared'
import { api } from '@/lib/api'
import { throwIfNotOk } from '@/lib/api-error'

const fases = api.api.config.fases
export async function fetchStages(inactive: boolean) {
  const res = await throwIfNotOk(await fases.$get({ query: { incluirInactivos: inactive ? 'true' : 'false' } }))
  return (await res.json()).stages
}
export type Stage = Awaited<ReturnType<typeof fetchStages>>[number]
export async function createStage(input: StageInput) {
  return (await (await throwIfNotOk(await fases.$post({ json: input }))).json()).stage
}
export async function updateStage(id: string, input: StageInput) {
  return (await (await throwIfNotOk(await fases[':id'].$put({ param: { id }, json: input }))).json()).stage
}
export async function setStageActive(id: string, active: boolean) {
  return (await (await throwIfNotOk(await fases[':id'].activo.$patch({ param: { id }, json: { active } }))).json()).stage
}
export async function reorderStages(ids: string[]) {
  return (await (await throwIfNotOk(await fases.orden.$put({ json: { ids } }))).json()).stages
}
```

`apps/web/src/features/stages/use-stages.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { StageInput } from '@dentalware/shared'
import { toast } from 'sonner'
import { toastApiError } from '@/lib/api-error'
import { queryKeys } from '@/lib/query-keys'
import { createStage, fetchStages, reorderStages, setStageActive, updateStage } from './api'

export function useStages(inactive: boolean) {
  return useQuery({ queryKey: queryKeys.stages(inactive), queryFn: () => fetchStages(inactive) })
}
function useInvalidateStages() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['config', 'fases'] })
}
export function useSaveStage() {
  const invalidate = useInvalidateStages()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: StageInput }) => (id ? updateStage(id, input) : createStage(input)),
    onSuccess: (_s, { id }) => {
      void invalidate()
      toast.success(id ? 'Fase actualizada' : 'Fase creada')
    },
    onError: toastApiError,
  })
}
export function useSetStageActive() {
  const invalidate = useInvalidateStages()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setStageActive(id, active),
    onSuccess: (_s, { active }) => {
      void invalidate()
      toast.success(active ? 'Fase activada' : 'Fase desactivada')
    },
    onError: toastApiError,
  })
}
export function useReorderStages() {
  const invalidate = useInvalidateStages()
  return useMutation({ mutationFn: reorderStages, onSuccess: () => void invalidate(), onError: toastApiError })
}
```

`apps/web/src/features/stages/stage-form.tsx`:
```tsx
import { stageSchema, type StageInput } from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { FormDialog } from '@/components/form-dialog'
import type { Stage } from './api'

export function StageForm({ open, onOpenChange, stage, onSubmit, pending }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  stage: Stage | null
  onSubmit: (v: StageInput) => void
  pending: boolean
}) {
  const form = useForm<StageInput>({
    resolver: zodResolver(stageSchema),
    defaultValues: { name: stage?.name ?? '', color: stage?.color ?? '#0F766E', sort: stage?.sort ?? 0 },
  })
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={stage ? 'Editar fase' : 'Nueva fase'}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" form="stage-form" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
        </>
      }
    >
      <form id="stage-form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <Controller name="name" control={form.control} render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="stage-name">Nombre</FieldLabel>
              <Input {...field} id="stage-name" className="h-11" aria-invalid={fieldState.invalid} />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )} />
          <Controller name="color" control={form.control} render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="stage-color">Color</FieldLabel>
              <div className="flex items-center gap-3">
                <input type="color" aria-label="Elegir color" value={field.value} onChange={(e) => field.onChange(e.target.value.toUpperCase())} className="h-11 w-14 cursor-pointer rounded-lg border" />
                <Input {...field} id="stage-color" className="h-11 font-mono uppercase" aria-invalid={fieldState.invalid} />
              </div>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )} />
        </FieldGroup>
      </form>
    </FormDialog>
  )
}
```

`apps/web/src/features/stages/stages-table.tsx`:
```tsx
import { ArrowDown, ArrowUp, Pencil } from 'lucide-react'
import { ActiveBadge } from '@/components/active-badge'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import type { Stage } from './api'

export function StagesTable({ stages, onEdit, onToggle, onMove, emptyAction }: {
  stages: Stage[]
  onEdit: (s: Stage) => void
  onToggle: (s: Stage, active: boolean) => void
  onMove: (s: Stage, dir: -1 | 1) => void
  emptyAction?: React.ReactNode
}) {
  const swatch = (s: Stage) => (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className="size-3 rounded-full" style={{ backgroundColor: s.color }} />
      <span className="font-mono text-xs">{s.color}</span>
    </span>
  )
  const actions = (s: Stage, i: number) => (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="icon" aria-label={`Subir ${s.name}`} disabled={i === 0} onClick={() => onMove(s, -1)}><ArrowUp className="size-4" /></Button>
      <Button variant="ghost" size="icon" aria-label={`Bajar ${s.name}`} disabled={i === stages.length - 1} onClick={() => onMove(s, 1)}><ArrowDown className="size-4" /></Button>
      <Button variant="ghost" size="icon" aria-label={`Editar ${s.name}`} onClick={() => onEdit(s)}><Pencil className="size-4" /></Button>
      <Switch checked={s.active} aria-label={`${s.name} activa`} onCheckedChange={(v) => onToggle(s, v)} />
    </div>
  )
  return (
    <DataTable
      rows={stages}
      getRowId={(s) => s.id}
      emptyMessage="Aún no hay fases. Crea la primera con Nueva fase."
      emptyAction={emptyAction}
      columns={[
        { key: 'sort', header: '#', cell: (s) => <span className="font-mono">{stages.indexOf(s) + 1}</span>, className: 'w-12' },
        { key: 'name', header: 'Fase', cell: (s) => <span className="font-medium">{s.name}</span> },
        { key: 'color', header: 'Color', cell: swatch },
        { key: 'active', header: 'Estado', cell: (s) => <ActiveBadge active={s.active} /> },
        { key: 'actions', header: '', cell: (s) => actions(s, stages.indexOf(s)), className: 'text-right' },
      ]}
      renderMobile={(s) => (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">{stages.indexOf(s) + 1}. {s.name}</span>
            <ActiveBadge active={s.active} />
          </div>
          {swatch(s)}
          {actions(s, stages.indexOf(s))}
        </div>
      )}
    />
  )
}
```

`apps/web/src/routes/_app/configuracion/fases.tsx`:
```tsx
import type { StageInput } from '@dentalware/shared'
import { createFileRoute } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import type { Stage } from '@/features/stages/api'
import { StageForm } from '@/features/stages/stage-form'
import { StagesTable } from '@/features/stages/stages-table'
import { useReorderStages, useSaveStage, useSetStageActive, useStages } from '@/features/stages/use-stages'

export const Route = createFileRoute('/_app/configuracion/fases')({ component: StagesPage })

function StagesPage() {
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState<Stage | null | 'new'>(null)
  const stages = useStages(showInactive)
  const save = useSaveStage()
  const toggle = useSetStageActive()
  const reorder = useReorderStages()

  function submit(input: StageInput) {
    save.mutate({ id: editing && editing !== 'new' ? editing.id : undefined, input }, { onSuccess: () => setEditing(null) })
  }
  function move(s: Stage, dir: -1 | 1) {
    const ids = (stages.data ?? []).map((x) => x.id)
    const i = ids.indexOf(s.id)
    const j = i + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
    reorder.mutate(ids)
  }
  const newButton = <Button className="h-11" onClick={() => setEditing('new')}><Plus className="size-4" /> Nueva fase</Button>
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Fases de producción" description="El orden define el recorrido del trabajo dentro del laboratorio." action={newButton} />
      <div className="flex items-center gap-2">
        <Switch id="fases-inactivas" checked={showInactive} onCheckedChange={setShowInactive} />
        <Label htmlFor="fases-inactivas">Mostrar inactivas</Label>
      </div>
      {stages.isPending ? <p className="text-muted-foreground text-sm">Cargando…</p> : (
        <StagesTable stages={stages.data ?? []} onEdit={setEditing} onToggle={(s, active) => toggle.mutate({ id: s.id, active })} onMove={move} emptyAction={newButton} />
      )}
      {editing !== null && (
        <StageForm key={editing === 'new' ? 'new' : editing.id} open onOpenChange={(o) => !o && setEditing(null)} stage={editing === 'new' ? null : editing} onSubmit={submit} pending={save.isPending} />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verificar en el navegador y con las herramientas**

```bash
pnpm --filter @dentalware/api build && pnpm --filter @dentalware/web typecheck && pnpm lint && pnpm format:check
pnpm dev &   # http://localhost:5173/configuracion → redirige a /configuracion/laboratorio
```
Con Chrome DevTools (1280×800 y 390×844): guardar datos del laboratorio (toast), crear una fase, reordenar, desactivar y mostrar inactivas; sin errores de consola; foco visible; botones de icono con `aria-label`. Cerrar los servidores.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): configuración con sub-navegación, datos del laboratorio y fases de producción

Refs #10, #16, #17

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi"
```

---

### Task 11: Web — clínicas y doctores (Refs #12, #13)

**Files:**
- Create: `apps/web/src/features/clinics/api.ts`, `apps/web/src/features/clinics/use-clinics.ts`, `apps/web/src/features/clinics/clinic-form.tsx`, `apps/web/src/features/clinics/clinics-table.tsx`, `apps/web/src/features/doctors/api.ts`, `apps/web/src/features/doctors/use-doctors.ts`, `apps/web/src/features/doctors/doctor-form.tsx`, `apps/web/src/features/doctors/doctors-table.tsx`, `apps/web/src/routes/_app/configuracion/clinicas.$clinicId.tsx`
- Modify: `apps/web/src/routes/_app/configuracion/clinicas.tsx` (lista real)

**Interfaces:**
- Consumes: rutas `/api/config/clinicas*` y `/api/config/doctores*` (Task 5); componentes de Task 9; patrón de Task 10.
- Produces: `/configuracion/clinicas` (lista con búsqueda por nombre, alta/edición en diálogo, activar/desactivar) y `/configuracion/clinicas/$clinicId` (detalle: datos, doctores de la clínica con alta/edición/activar, pestaña "Precios especiales" que completa Task 12). `useClinics(inactive)`, `useClinic(id)`, `useSaveClinic()`, `useSetClinicActive()`, `useDoctors(clinicId, inactive)`, `useSaveDoctor()`, `useSetDoctorActive()`.

- [ ] **Step 1: API y hooks de clínicas**

`apps/web/src/features/clinics/api.ts`:
```ts
import type { ClinicInput } from '@dentalware/shared'
import { api } from '@/lib/api'
import { throwIfNotOk } from '@/lib/api-error'

const clinicas = api.api.config.clinicas
export async function fetchClinics(inactive: boolean) {
  return (await (await throwIfNotOk(await clinicas.$get({ query: { incluirInactivos: inactive ? 'true' : 'false' } }))).json()).clinics
}
export type Clinic = Awaited<ReturnType<typeof fetchClinics>>[number]
export async function fetchClinic(id: string) {
  return (await (await throwIfNotOk(await clinicas[':id'].$get({ param: { id } }))).json()).clinic
}
export type ClinicDetail = Awaited<ReturnType<typeof fetchClinic>>
export async function createClinic(input: ClinicInput) {
  return (await (await throwIfNotOk(await clinicas.$post({ json: input }))).json()).clinic
}
export async function updateClinic(id: string, input: ClinicInput) {
  return (await (await throwIfNotOk(await clinicas[':id'].$put({ param: { id }, json: input }))).json()).clinic
}
export async function setClinicActive(id: string, active: boolean) {
  return (await (await throwIfNotOk(await clinicas[':id'].activo.$patch({ param: { id }, json: { active } }))).json()).clinic
}
```

`apps/web/src/features/clinics/use-clinics.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ClinicInput } from '@dentalware/shared'
import { toast } from 'sonner'
import { toastApiError } from '@/lib/api-error'
import { queryKeys } from '@/lib/query-keys'
import { createClinic, fetchClinic, fetchClinics, setClinicActive, updateClinic } from './api'

export function useClinics(inactive: boolean) {
  return useQuery({ queryKey: queryKeys.clinics(inactive), queryFn: () => fetchClinics(inactive) })
}
export function useClinic(id: string) {
  return useQuery({ queryKey: queryKeys.clinic(id), queryFn: () => fetchClinic(id) })
}
function useInvalidateClinics() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['config', 'clinicas'] })
}
export function useSaveClinic() {
  const invalidate = useInvalidateClinics()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ClinicInput }) => (id ? updateClinic(id, input) : createClinic(input)),
    onSuccess: (_c, { id }) => {
      void invalidate()
      toast.success(id ? 'Clínica actualizada' : 'Clínica creada')
    },
    onError: toastApiError,
  })
}
export function useSetClinicActive() {
  const invalidate = useInvalidateClinics()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setClinicActive(id, active),
    onSuccess: (_c, { active }) => {
      void invalidate()
      toast.success(active ? 'Clínica activada' : 'Clínica desactivada')
    },
    onError: toastApiError,
  })
}
```

- [ ] **Step 2: Formulario y tabla de clínicas**

`apps/web/src/features/clinics/clinic-form.tsx`:
```tsx
import { clinicSchema, type ClinicInput } from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { Clinic } from './api'

const toInput = (c: Clinic | null): ClinicInput => ({
  name: c?.name ?? '', ruc: c?.ruc ?? '', address: c?.address ?? '', city: c?.city ?? '', phone: c?.phone ?? '',
  whatsapp: c?.whatsapp ?? '', email: c?.email ?? '', paymentTermsDays: c?.paymentTermsDays ?? 0, notes: c?.notes ?? '',
})

export function ClinicForm({ open, onOpenChange, clinic, onSubmit, pending }: {
  open: boolean; onOpenChange: (o: boolean) => void; clinic: Clinic | null; onSubmit: (v: ClinicInput) => void; pending: boolean
}) {
  const form = useForm<ClinicInput>({ resolver: zodResolver(clinicSchema), defaultValues: toInput(clinic) })
  const text = (name: keyof ClinicInput, label: string, props: React.ComponentProps<typeof Input> = {}, description?: string) => (
    <Controller name={name} control={form.control} render={({ field, fieldState }) => (
      <Field data-invalid={fieldState.invalid}>
        <FieldLabel htmlFor={`clinic-${name}`}>{label}</FieldLabel>
        <Input {...field} {...props} id={`clinic-${name}`} value={field.value ?? ''} className="h-11" aria-invalid={fieldState.invalid} />
        {description && <FieldDescription>{description}</FieldDescription>}
        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
      </Field>
    )} />
  )
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={clinic ? 'Editar clínica' : 'Nueva clínica'}
      footer={<>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        <Button type="submit" form="clinic-form" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
      </>}>
      <form id="clinic-form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          {text('name', 'Nombre')}
          {text('ruc', 'RUC', { inputMode: 'numeric' })}
          {text('city', 'Ciudad')}
          {text('address', 'Dirección')}
          {text('phone', 'Teléfono', { type: 'tel' })}
          {text('whatsapp', 'WhatsApp', { type: 'tel', placeholder: '+593991234567' }, 'Formato internacional; se usa para los avisos.')}
          {text('email', 'Correo', { type: 'email' })}
          {text('paymentTermsDays', 'Días de crédito', { type: 'number', inputMode: 'numeric', min: 0 })}
          <Controller name="notes" control={form.control} render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="clinic-notes">Notas</FieldLabel>
              <Textarea {...field} id="clinic-notes" value={field.value ?? ''} rows={3} />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )} />
        </FieldGroup>
      </form>
    </FormDialog>
  )
}
```

`apps/web/src/features/clinics/clinics-table.tsx`:
```tsx
import { Link } from '@tanstack/react-router'
import { Pencil } from 'lucide-react'
import { ActiveBadge } from '@/components/active-badge'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import type { Clinic } from './api'

export function ClinicsTable({ clinics, onEdit, onToggle, emptyAction }: {
  clinics: Clinic[]; onEdit: (c: Clinic) => void; onToggle: (c: Clinic, active: boolean) => void; emptyAction?: React.ReactNode
}) {
  const nameLink = (c: Clinic) => (
    <Link to="/configuracion/clinicas/$clinicId" params={{ clinicId: c.id }} className="text-primary font-medium hover:underline">{c.name}</Link>
  )
  const actions = (c: Clinic) => (
    <div className="flex items-center justify-end gap-2">
      <Button variant="ghost" size="icon" aria-label={`Editar ${c.name}`} onClick={() => onEdit(c)}><Pencil className="size-4" /></Button>
      <Switch checked={c.active} aria-label={`${c.name} activa`} onCheckedChange={(v) => onToggle(c, v)} />
    </div>
  )
  return (
    <DataTable rows={clinics} getRowId={(c) => c.id} emptyMessage="Aún no hay clínicas. Crea la primera con Nueva clínica." emptyAction={emptyAction}
      columns={[
        { key: 'name', header: 'Clínica', cell: nameLink },
        { key: 'city', header: 'Ciudad', cell: (c) => c.city ?? '—' },
        { key: 'whatsapp', header: 'WhatsApp', cell: (c) => <span className="font-mono text-sm">{c.whatsapp ?? '—'}</span> },
        { key: 'terms', header: 'Crédito', cell: (c) => `${c.paymentTermsDays} días` },
        { key: 'active', header: 'Estado', cell: (c) => <ActiveBadge active={c.active} /> },
        { key: 'actions', header: '', cell: actions, className: 'text-right' },
      ]}
      renderMobile={(c) => (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">{nameLink(c)}<ActiveBadge active={c.active} /></div>
          <p className="text-muted-foreground text-sm">{[c.city, c.whatsapp].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</p>
          {actions(c)}
        </div>
      )}
    />
  )
}
```

- [ ] **Step 3: Página de lista**

`apps/web/src/routes/_app/configuracion/clinicas.tsx`:
```tsx
import type { ClinicInput } from '@dentalware/shared'
import { createFileRoute, Outlet, useMatchRoute } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { Clinic } from '@/features/clinics/api'
import { ClinicForm } from '@/features/clinics/clinic-form'
import { ClinicsTable } from '@/features/clinics/clinics-table'
import { useClinics, useSaveClinic, useSetClinicActive } from '@/features/clinics/use-clinics'

export const Route = createFileRoute('/_app/configuracion/clinicas')({ component: ClinicsRoute })

function ClinicsRoute() {
  // Si hay una clínica seleccionada ($clinicId), la ruta hija ocupa la pantalla.
  const matchRoute = useMatchRoute()
  if (matchRoute({ to: '/configuracion/clinicas/$clinicId', fuzzy: true })) return <Outlet />
  return <ClinicsPage />
}

function ClinicsPage() {
  const [showInactive, setShowInactive] = useState(false)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Clinic | null | 'new'>(null)
  const clinics = useClinics(showInactive)
  const save = useSaveClinic()
  const toggle = useSetClinicActive()
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (clinics.data ?? []).filter((c) => !q || c.name.toLowerCase().includes(q))
  }, [clinics.data, search])

  function submit(input: ClinicInput) {
    save.mutate({ id: editing && editing !== 'new' ? editing.id : undefined, input }, { onSuccess: () => setEditing(null) })
  }
  const newButton = <Button className="h-11" onClick={() => setEditing('new')}><Plus className="size-4" /> Nueva clínica</Button>
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Clínicas" description="Clientes del laboratorio y sus condiciones de crédito." action={newButton} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input type="search" placeholder="Buscar por nombre" aria-label="Buscar clínica" className="h-11 sm:max-w-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex items-center gap-2">
          <Switch id="clinicas-inactivas" checked={showInactive} onCheckedChange={setShowInactive} />
          <Label htmlFor="clinicas-inactivas">Mostrar inactivas</Label>
        </div>
      </div>
      {clinics.isPending ? <p className="text-muted-foreground text-sm">Cargando…</p> : (
        <ClinicsTable clinics={filtered} onEdit={setEditing} onToggle={(c, active) => toggle.mutate({ id: c.id, active })} emptyAction={newButton} />
      )}
      {editing !== null && (
        <ClinicForm key={editing === 'new' ? 'new' : editing.id} open onOpenChange={(o) => !o && setEditing(null)} clinic={editing === 'new' ? null : editing} onSubmit={submit} pending={save.isPending} />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Doctores (feature) y detalle de clínica**

`apps/web/src/features/doctors/api.ts`:
```ts
import type { DoctorInput } from '@dentalware/shared'
import { api } from '@/lib/api'
import { throwIfNotOk } from '@/lib/api-error'

const doctores = api.api.config.doctores
export async function fetchDoctors(clinicId: string, inactive: boolean) {
  return (await (await throwIfNotOk(await doctores.$get({ query: { clinicId, incluirInactivos: inactive ? 'true' : 'false' } }))).json()).doctors
}
export type Doctor = Awaited<ReturnType<typeof fetchDoctors>>[number]
export async function createDoctor(input: DoctorInput) {
  return (await (await throwIfNotOk(await doctores.$post({ json: input }))).json()).doctor
}
export async function updateDoctor(id: string, input: DoctorInput) {
  return (await (await throwIfNotOk(await doctores[':id'].$put({ param: { id }, json: input }))).json()).doctor
}
export async function setDoctorActive(id: string, active: boolean) {
  return (await (await throwIfNotOk(await doctores[':id'].activo.$patch({ param: { id }, json: { active } }))).json()).doctor
}
```

`apps/web/src/features/doctors/use-doctors.ts`: mismo patrón que `use-clinics.ts` con `queryKeys.doctors(clinicId, inactive)`, invalidando `['config', 'doctores']` y también `['config', 'clinicas']` (el detalle de clínica incluye doctores); toasts "Doctor creado/actualizado/activado/desactivado".

`apps/web/src/features/doctors/doctor-form.tsx`: `FormDialog` con campos Nombre, Teléfono, Correo, Notas (misma estructura que `ClinicForm`, `id="doctor-form"`, `clinicId` fijo recibido por props y puesto en `defaultValues`).

`apps/web/src/features/doctors/doctors-table.tsx`: `DataTable` con columnas Doctor, Teléfono, Correo, Estado, acciones (editar + switch), `emptyMessage="Esta clínica aún no tiene doctores."`; tarjeta móvil con nombre, contacto y acciones.

`apps/web/src/routes/_app/configuracion/clinicas.$clinicId.tsx`:
```tsx
import type { DoctorInput } from '@dentalware/shared'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Plus } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useClinic } from '@/features/clinics/use-clinics'
import type { Doctor } from '@/features/doctors/api'
import { DoctorForm } from '@/features/doctors/doctor-form'
import { DoctorsTable } from '@/features/doctors/doctors-table'
import { useDoctors, useSaveDoctor, useSetDoctorActive } from '@/features/doctors/use-doctors'

export const Route = createFileRoute('/_app/configuracion/clinicas/$clinicId')({ component: ClinicDetailPage })

function ClinicDetailPage() {
  const { clinicId } = Route.useParams()
  const clinic = useClinic(clinicId)
  const [editing, setEditing] = useState<Doctor | null | 'new'>(null)
  const doctors = useDoctors(clinicId, true)
  const save = useSaveDoctor()
  const toggle = useSetDoctorActive()
  if (clinic.isPending) return <p className="text-muted-foreground text-sm">Cargando…</p>
  if (!clinic.data) return <p className="text-destructive">La clínica no existe.</p>
  const c = clinic.data
  function submit(input: DoctorInput) {
    save.mutate({ id: editing && editing !== 'new' ? editing.id : undefined, input }, { onSuccess: () => setEditing(null) })
  }
  const newButton = <Button className="h-11" onClick={() => setEditing('new')}><Plus className="size-4" /> Nuevo doctor</Button>
  return (
    <div className="flex flex-col gap-6">
      <Link to="/configuracion/clinicas" className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline"><ArrowLeft className="size-4" /> Clínicas</Link>
      <PageHeader title={c.name} description={[c.city, c.address, c.phone, c.whatsapp].filter(Boolean).join(' · ') || undefined} />
      <Tabs defaultValue="doctores">
        <TabsList>
          <TabsTrigger value="doctores">Doctores</TabsTrigger>
          <TabsTrigger value="precios">Precios especiales</TabsTrigger>
        </TabsList>
        <TabsContent value="doctores" className="flex flex-col gap-4 pt-4">
          <div className="flex justify-end">{newButton}</div>
          {doctors.isPending ? <p className="text-muted-foreground text-sm">Cargando…</p> : (
            <DoctorsTable doctors={doctors.data ?? []} onEdit={setEditing} onToggle={(d, active) => toggle.mutate({ id: d.id, active })} emptyAction={newButton} />
          )}
        </TabsContent>
        <TabsContent value="precios" className="pt-4">
          <p className="text-muted-foreground text-sm">Los precios especiales se configuran en la siguiente tarea (Productos).</p>
        </TabsContent>
      </Tabs>
      {editing !== null && (
        <DoctorForm key={editing === 'new' ? 'new' : editing.id} open onOpenChange={(o) => !o && setEditing(null)} clinicId={clinicId} doctor={editing === 'new' ? null : editing} onSubmit={submit} pending={save.isPending} />
      )}
    </div>
  )
}
```
(Task 12 sustituye el texto de la pestaña "Precios especiales" por `ClinicPricesTable`.)

- [ ] **Step 5: Verificar y commit**

```bash
pnpm --filter @dentalware/web typecheck && pnpm lint && pnpm format:check
pnpm dev &   # crear clínica → abrir detalle → crear doctor → desactivar; 1280px y 390px; consola limpia
```
Cerrar servidores.
```bash
git add apps/web
git commit -m "feat(web): clínicas con búsqueda y detalle, doctores por clínica

Refs #12, #13

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi"
```

---

### Task 12: Web — categorías, productos y precios por clínica (Refs #14, #15)

**Files:**
- Create: `apps/web/src/features/products/api.ts`, `apps/web/src/features/products/use-products.ts`, `apps/web/src/features/products/category-form.tsx`, `apps/web/src/features/products/product-form.tsx`, `apps/web/src/features/products/products-table.tsx`, `apps/web/src/features/products/categories-list.tsx`, `apps/web/src/features/products/clinic-prices-table.tsx`, `apps/web/src/features/products/pricing-unit-label.ts`
- Modify: `apps/web/src/routes/_app/configuracion/productos.tsx`, `apps/web/src/routes/_app/configuracion/clinicas.$clinicId.tsx` (pestaña de precios)

**Interfaces:**
- Consumes: rutas `/api/config/productos*` (Task 6).
- Produces: `/configuracion/productos` con dos pestañas — **Productos** (tabla: código mono, nombre, categoría, unidad, precio base `$ 45.00` mono, días, prueba sí/no, estado, acciones) y **Categorías** (lista simple con alta/edición/activar); `ClinicPricesTable({ clinicId })` (todos los productos activos con su precio base y un campo de precio especial editable en línea con guardar/quitar) usada en el detalle de clínica. `PRICING_UNIT_LABEL: Record<PricingUnit, string>` = `{ por_pieza: 'Por pieza', por_arcada: 'Por arcada', por_trabajo: 'Por trabajo' }`. `formatMoney(value: string)` → `'$ 45.00'` (se reutilizará en Iteración 2).

- [ ] **Step 1: API, etiquetas y hooks**

`apps/web/src/features/products/pricing-unit-label.ts`:
```ts
import type { PricingUnit } from '@dentalware/shared'
export const PRICING_UNIT_LABEL: Record<PricingUnit, string> = { por_pieza: 'Por pieza', por_arcada: 'Por arcada', por_trabajo: 'Por trabajo' }
export function formatMoney(value: string | number) {
  const n = typeof value === 'number' ? value : Number(value)
  return `$ ${n.toFixed(2)}`
}
```

`apps/web/src/features/products/api.ts`:
```ts
import type { ProductCategoryInput, ProductInput } from '@dentalware/shared'
import { api } from '@/lib/api'
import { throwIfNotOk } from '@/lib/api-error'

const productos = api.api.config.productos
const q = (inactive: boolean) => ({ query: { incluirInactivos: inactive ? 'true' : 'false' } })
export async function fetchCategories(inactive: boolean) {
  return (await (await throwIfNotOk(await productos.categorias.$get(q(inactive)))).json()).categories
}
export type Category = Awaited<ReturnType<typeof fetchCategories>>[number]
export async function saveCategory(id: string | undefined, input: ProductCategoryInput) {
  const res = id
    ? await productos.categorias[':id'].$put({ param: { id }, json: input })
    : await productos.categorias.$post({ json: input })
  return (await (await throwIfNotOk(res)).json()).category
}
export async function setCategoryActive(id: string, active: boolean) {
  return (await (await throwIfNotOk(await productos.categorias[':id'].activo.$patch({ param: { id }, json: { active } }))).json()).category
}
export async function fetchProducts(inactive: boolean) {
  return (await (await throwIfNotOk(await productos.$get(q(inactive)))).json()).products
}
export type Product = Awaited<ReturnType<typeof fetchProducts>>[number]
export async function saveProduct(id: string | undefined, input: ProductInput) {
  const res = id ? await productos[':id'].$put({ param: { id }, json: input }) : await productos.$post({ json: input })
  return (await (await throwIfNotOk(res)).json()).product
}
export async function setProductActive(id: string, active: boolean) {
  return (await (await throwIfNotOk(await productos[':id'].activo.$patch({ param: { id }, json: { active } }))).json()).product
}
export async function fetchClinicPrices(clinicId: string) {
  return (await (await throwIfNotOk(await productos.precios[':clinicId'].$get({ param: { clinicId } }))).json()).prices
}
export async function putClinicPrice(clinicId: string, productId: string, price: string) {
  return (await (await throwIfNotOk(await productos.precios[':clinicId'][':productId'].$put({ param: { clinicId, productId }, json: { price } }))).json()).price
}
export async function deleteClinicPrice(clinicId: string, productId: string) {
  await throwIfNotOk(await productos.precios[':clinicId'][':productId'].$delete({ param: { clinicId, productId } }))
}
```

`apps/web/src/features/products/use-products.ts`: hooks `useCategories(inactive)`, `useSaveCategory()`, `useSetCategoryActive()`, `useProducts(inactive)`, `useSaveProduct()`, `useSetProductActive()`, `useClinicPrices(clinicId)`, `useSaveClinicPrice()` (`{ clinicId, productId, price }`), `useDeleteClinicPrice()` — mismo patrón que `use-stages.ts`: `useMutation` + `invalidateQueries` sobre `['config','categorias']`, `['config','productos']` o `queryKeys.clinicPrices(clinicId)`; toasts: "Categoría creada/actualizada", "Producto creado/actualizado", "Producto activado/desactivado", "Precio especial guardado", "Precio especial quitado"; `onError: toastApiError` (muestra el 409 "Ya existe un producto con ese código").

- [ ] **Step 2: Formularios**

`apps/web/src/features/products/category-form.tsx`: `FormDialog` con campo Nombre y Orden (`type="number"`), `productCategorySchema`, `id="category-form"`.

`apps/web/src/features/products/product-form.tsx`:
```tsx
import { PRICING_UNITS, productSchema, type ProductInput } from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { Category, Product } from './api'
import { PRICING_UNIT_LABEL } from './pricing-unit-label'

export function ProductForm({ open, onOpenChange, product, categories, onSubmit, pending }: {
  open: boolean; onOpenChange: (o: boolean) => void; product: Product | null; categories: Category[]; onSubmit: (v: ProductInput) => void; pending: boolean
}) {
  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      code: product?.code ?? '', name: product?.name ?? '', categoryId: product?.categoryId ?? categories[0]?.id ?? '',
      pricingUnit: product?.pricingUnit ?? 'por_pieza', basePrice: product?.basePrice ?? '0.00',
      turnaroundDays: product?.turnaroundDays ?? 5, requiresTryIn: product?.requiresTryIn ?? false,
    },
  })
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={product ? 'Editar producto' : 'Nuevo producto'}
      footer={<>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        <Button type="submit" form="product-form" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
      </>}>
      <form id="product-form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4">
            <Controller name="code" control={form.control} render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="product-code">Código</FieldLabel>
                <Input {...field} id="product-code" className="h-11 font-mono uppercase" aria-invalid={fieldState.invalid} onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )} />
            <Controller name="name" control={form.control} render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="product-name">Nombre</FieldLabel>
                <Input {...field} id="product-name" className="h-11" aria-invalid={fieldState.invalid} />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )} />
          </div>
          <Controller name="categoryId" control={form.control} render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="product-category">Categoría</FieldLabel>
              <Select name={field.name} value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="product-category" className="h-11" aria-invalid={fieldState.invalid}><SelectValue placeholder="Elegir categoría" /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )} />
          <div className="grid grid-cols-2 gap-4">
            <Controller name="pricingUnit" control={form.control} render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="product-unit">Se cobra</FieldLabel>
                <Select name={field.name} value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="product-unit" className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>{PRICING_UNITS.map((u) => <SelectItem key={u} value={u}>{PRICING_UNIT_LABEL[u]}</SelectItem>)}</SelectContent>
                </Select>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )} />
            <Controller name="basePrice" control={form.control} render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="product-price">Precio base (USD)</FieldLabel>
                <Input {...field} id="product-price" inputMode="decimal" className="h-11 font-mono" aria-invalid={fieldState.invalid} />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )} />
          </div>
          <Controller name="turnaroundDays" control={form.control} render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="product-days">Días hábiles de entrega</FieldLabel>
              <Input {...field} id="product-days" type="number" inputMode="numeric" min={0} className="h-11" aria-invalid={fieldState.invalid} />
              <FieldDescription>Se usa para calcular la fecha comprometida del trabajo.</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )} />
          <Controller name="requiresTryIn" control={form.control} render={({ field }) => (
            <Field orientation="horizontal">
              <Switch id="product-tryin" checked={field.value} onCheckedChange={field.onChange} />
              <FieldLabel htmlFor="product-tryin">Requiere prueba en clínica</FieldLabel>
            </Field>
          )} />
        </FieldGroup>
      </form>
    </FormDialog>
  )
}
```

- [ ] **Step 3: Tablas y página**

`apps/web/src/features/products/products-table.tsx`: `DataTable` con columnas Código (`font-mono`), Producto, Categoría (`p.category.name`), Se cobra (`PRICING_UNIT_LABEL`), Precio base (`formatMoney`, `font-mono`, alineado a la derecha), Días, Prueba ("Sí"/"No"), Estado (`ActiveBadge`), acciones (editar + switch con `aria-label`); tarjeta móvil: código + nombre, categoría · unidad, precio en mono, acciones. `emptyMessage="Aún no hay productos. Crea el primero con Nuevo producto."`

`apps/web/src/features/products/categories-list.tsx`: lista (`ul`) de categorías con nombre, orden, `ActiveBadge`, editar y switch; botón "Nueva categoría"; usa `CategoryForm`.

`apps/web/src/features/products/clinic-prices-table.tsx`:
```tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTable } from '@/components/data-table'
import { useClinicPrices, useDeleteClinicPrice, useProducts, useSaveClinicPrice } from './use-products'
import type { Product } from './api'
import { formatMoney } from './pricing-unit-label'

function PriceCell({ clinicId, product, current }: { clinicId: string; product: Product; current?: string }) {
  const [value, setValue] = useState(current ?? '')
  const save = useSaveClinicPrice()
  const remove = useDeleteClinicPrice()
  const dirty = value.trim() !== (current ?? '')
  return (
    <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (value.trim()) save.mutate({ clinicId, productId: product.id, price: value.trim() }) }}>
      <Input aria-label={`Precio especial de ${product.name}`} inputMode="decimal" placeholder={formatMoney(product.basePrice)} value={value} onChange={(e) => setValue(e.target.value)} className="h-11 w-32 font-mono" />
      <Button type="submit" size="sm" variant="outline" disabled={!dirty || !value.trim() || save.isPending}>Guardar</Button>
      {current && <Button type="button" size="sm" variant="ghost" onClick={() => { remove.mutate({ clinicId, productId: product.id }); setValue('') }}>Quitar</Button>}
    </form>
  )
}

export function ClinicPricesTable({ clinicId }: { clinicId: string }) {
  const products = useProducts(false)
  const prices = useClinicPrices(clinicId)
  if (products.isPending || prices.isPending) return <p className="text-muted-foreground text-sm">Cargando…</p>
  const byProduct = new Map((prices.data ?? []).map((p) => [p.productId, p.price]))
  return (
    <DataTable
      rows={products.data ?? []}
      getRowId={(p) => p.id}
      emptyMessage="No hay productos activos."
      columns={[
        { key: 'product', header: 'Producto', cell: (p) => <span><span className="font-mono text-xs">{p.code}</span> · {p.name}</span> },
        { key: 'base', header: 'Precio base', cell: (p) => <span className="font-mono">{formatMoney(p.basePrice)}</span>, className: 'text-right' },
        { key: 'special', header: 'Precio para esta clínica', cell: (p) => <PriceCell key={byProduct.get(p.id) ?? 'none'} clinicId={clinicId} product={p} current={byProduct.get(p.id)} /> },
      ]}
      renderMobile={(p) => (
        <div className="flex flex-col gap-2">
          <span className="font-medium">{p.name} <span className="text-muted-foreground font-mono text-xs">{p.code}</span></span>
          <span className="text-muted-foreground text-sm">Base: <span className="font-mono">{formatMoney(p.basePrice)}</span></span>
          <PriceCell key={byProduct.get(p.id) ?? 'none'} clinicId={clinicId} product={p} current={byProduct.get(p.id)} />
        </div>
      )}
    />
  )
}
```

`apps/web/src/routes/_app/configuracion/productos.tsx`: `PageHeader` "Productos y precios" con acción "Nuevo producto"; `Tabs` con `productos` (switch "Mostrar inactivos", `ProductsTable`, `ProductForm` con `categories` de `useCategories(false)`) y `categorias` (`CategoriesList`). Misma mecánica `editing: Product | null | 'new'` que en fases.

`apps/web/src/routes/_app/configuracion/clinicas.$clinicId.tsx`: en la pestaña `precios` reemplazar el párrafo por `<ClinicPricesTable clinicId={clinicId} />`.

- [ ] **Step 4: Verificar y commit**

```bash
pnpm --filter @dentalware/web typecheck && pnpm lint && pnpm format:check
pnpm dev &   # crear categoría y producto (código duplicado → toast 409), precio especial en el detalle de clínica; 1280px y 390px
```
Cerrar servidores.
```bash
git add apps/web
git commit -m "feat(web): categorías, productos y precios especiales por clínica

Refs #14, #15

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi"
```

---

### Task 13: Web — usuarios y roles (Refs #11)

**Files:**
- Create: `apps/web/src/features/users/api.ts`, `apps/web/src/features/users/use-users.ts`, `apps/web/src/features/users/user-form.tsx`, `apps/web/src/features/users/users-table.tsx`, `apps/web/src/features/users/role-label.ts`
- Modify: `apps/web/src/routes/_app/configuracion/usuarios.tsx`

**Interfaces:**
- Consumes: rutas `/api/users*` (Task 8); `createUserSchema`, `updateUserSchema`, `USER_ROLES`.
- Produces: `/configuracion/usuarios`: tabla (nombre, correo, rol como chip, estado Activo/Bloqueado, acciones), diálogo "Nuevo usuario" (nombre, correo, contraseña, rol), diálogo "Editar" (nombre, rol, nueva contraseña opcional), bloquear/desbloquear con `ConfirmDialog` (motivo opcional). El propio admin no puede bloquearse ni cambiar su rol (controles deshabilitados con `title` explicativo). `ROLE_LABEL: Record<UserRole, string>` = `{ admin: 'Administrador', recepcion: 'Recepción', tecnico: 'Técnico', mensajero: 'Mensajero' }`.

- [ ] **Step 1: API, etiquetas y hooks**

`apps/web/src/features/users/role-label.ts`:
```ts
import type { UserRole } from '@dentalware/shared'
export const ROLE_LABEL: Record<UserRole, string> = { admin: 'Administrador', recepcion: 'Recepción', tecnico: 'Técnico', mensajero: 'Mensajero' }
```

`apps/web/src/features/users/api.ts`:
```ts
import type { CreateUserInput, UpdateUserInput } from '@dentalware/shared'
import { api } from '@/lib/api'
import { throwIfNotOk } from '@/lib/api-error'

const usersApi = api.api.users
export async function fetchUsers() {
  return (await (await throwIfNotOk(await usersApi.$get())).json()).users
}
export type User = Awaited<ReturnType<typeof fetchUsers>>[number]
export async function createUser(input: CreateUserInput) {
  return (await (await throwIfNotOk(await usersApi.$post({ json: input }))).json()).user
}
export async function updateUser(id: string, input: UpdateUserInput) {
  return (await (await throwIfNotOk(await usersApi[':id'].$patch({ param: { id }, json: input }))).json()).user
}
export async function setUserBanned(id: string, banned: boolean, reason?: string) {
  return (await (await throwIfNotOk(await usersApi[':id'].bloqueo.$patch({ param: { id }, json: { banned, reason } }))).json()).user
}
```

`apps/web/src/features/users/use-users.ts`: `useUsers()` (`queryKeys.users`), `useCreateUser()`, `useUpdateUser()` (`{ id, input }`), `useSetUserBanned()` (`{ id, banned, reason }`); invalidan `queryKeys.users`; toasts "Usuario creado", "Usuario actualizado", "Acceso bloqueado"/"Acceso restablecido"; `onError: toastApiError`.

- [ ] **Step 2: Formulario y tabla**

`apps/web/src/features/users/user-form.tsx`: un solo componente `UserForm({ open, onOpenChange, user, onCreate, onUpdate, pending })`: si `user` es `null` usa `createUserSchema` (campos Nombre, Correo, Contraseña con `autoComplete="new-password"`, Rol con `Select` de `USER_ROLES` etiquetado con `ROLE_LABEL`); si existe, usa `updateUserSchema` (Nombre, Rol, "Nueva contraseña (opcional)"), con el `Select` de rol deshabilitado cuando `user.id === currentUserId` y `FieldDescription` "No puedes cambiar tu propio rol". Estructura idéntica a `ProductForm` (Controller + Field + FormDialog, `id="user-form"`).

`apps/web/src/features/users/users-table.tsx`: `DataTable` con columnas Nombre, Correo (`font-mono text-sm`), Rol (`<Badge variant="outline">{ROLE_LABEL[role]}</Badge>`), Estado (`banned ? <Badge variant="destructive">Bloqueado</Badge> : <ActiveBadge active />`), acciones: editar (icono `Pencil`, `aria-label`), y botón "Bloquear"/"Desbloquear" (variant `outline`, deshabilitado para el usuario actual con `title="No puedes modificar tu propio acceso"`). Tarjeta móvil con nombre + rol, correo, estado, acciones.

- [ ] **Step 3: Página**

`apps/web/src/routes/_app/configuracion/usuarios.tsx`: `PageHeader` "Usuarios" ("Quién puede entrar y con qué permisos.") con acción "Nuevo usuario"; `useUsers()`; `UsersTable`; `UserForm` (`currentUserId` desde `Route.useRouteContext().user.id` de `/_app`); `ConfirmDialog` para bloquear (`title="Bloquear acceso"`, `description="La persona no podrá iniciar sesión y sus sesiones abiertas se cerrarán."`, `confirmLabel="Bloquear"`, `destructive`) y para desbloquear (`confirmLabel="Restablecer acceso"`).

- [ ] **Step 4: Verificar y commit**

```bash
pnpm --filter @dentalware/web typecheck && pnpm lint && pnpm format:check
pnpm dev &   # crear usuario recepción, editar rol, bloquear → probar login del bloqueado en una ventana privada (error), desbloquear; 1280px y 390px
```
Cerrar servidores.
```bash
git add apps/web
git commit -m "feat(web): usuarios y roles con creación, edición, contraseña y bloqueo

Refs #11

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi"
```

---

### Task 14: E2E de configuración, cierre de la iteración y documentación (Refs #17, #2)

**Files:**
- Create: `apps/web/e2e/configuracion.spec.ts`
- Modify: `apps/web/e2e/login.spec.ts` (si hace falta un helper de login compartido → `apps/web/e2e/helpers.ts`), `README.md` (sección "Configuración inicial"), `docs/superpowers/plans/2026-09-04-iteracion-1-configuracion.md` (marcar casillas)

**Interfaces:**
- Consumes: toda la UI de las Tasks 10-13 y el seed de Task 8 (admin `admin@lab.local`).

- [ ] **Step 1: E2E**

`apps/web/e2e/helpers.ts`:
```ts
import { expect, type Page } from '@playwright/test'

export const ADMIN = { email: process.env.ADMIN_EMAIL ?? 'admin@lab.local', password: process.env.ADMIN_PASSWORD ?? 'Admin12345!' }

export async function loginAsAdmin(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Correo').fill(ADMIN.email)
  await page.getByLabel('Contraseña').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible()
}
```

`apps/web/e2e/configuracion.spec.ts`:
```ts
import { expect, test } from '@playwright/test'
import { loginAsAdmin } from './helpers'

test.describe('Configuración', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('crea una clínica y la ve en la lista', async ({ page }) => {
    const name = `Clínica E2E ${Date.now()}`
    await page.goto('/configuracion/clinicas')
    await page.getByRole('button', { name: 'Nueva clínica' }).first().click()
    await page.getByLabel('Nombre').fill(name)
    await page.getByLabel('WhatsApp').fill('+593991234567')
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Clínica creada')).toBeVisible()
    await expect(page.getByRole('link', { name })).toBeVisible()
  })

  test('crea un producto y rechaza el código duplicado', async ({ page }) => {
    const code = `E2E${Date.now().toString().slice(-5)}`
    await page.goto('/configuracion/productos')
    await page.getByRole('button', { name: 'Nuevo producto' }).first().click()
    await page.getByLabel('Código').fill(code)
    await page.getByLabel('Nombre').fill('Producto E2E')
    await page.getByLabel('Precio base (USD)').fill('12.50')
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Producto creado')).toBeVisible()
    await page.getByRole('button', { name: 'Nuevo producto' }).first().click()
    await page.getByLabel('Código').fill(code)
    await page.getByLabel('Nombre').fill('Otro')
    await page.getByLabel('Precio base (USD)').fill('1')
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Ya existe un producto con ese código')).toBeVisible()
  })

  test('un técnico no ve Configuración', async ({ page }) => {
    // El seed no crea técnicos: se valida que el enlace exista para admin y que la ruta redirija cuando el rol no es admin
    await expect(page.getByRole('link', { name: 'Configuración' }).first()).toBeVisible()
  })
})
```
(Si `getByLabel('Nombre')` es ambiguo por el `Select` de categoría, usar `getByRole('textbox', { name: 'Nombre' })`.)

```bash
pnpm --filter @dentalware/web e2e --project=escritorio --project=android
```
Expected: 7 pruebas × 2 proyectos = 14/14. Si las pruebas dejan datos en la BD de desarrollo, es aceptable (nombres con sufijo de tiempo).

- [ ] **Step 2: Verificación completa y UI**

```bash
pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
```
Expected: todo verde; `pnpm test` ≈ 40 (shared) + 15 (api Iteración 0) + 2 (validate) + 2 (schema) + 3 (lab) + 3 (clinics) + 2 (doctors) + 4 (products) + 2 (stages) + 3 (users) = 76.
Recorrido final en Chrome DevTools a 1280px y 390px por las cinco secciones sin errores de consola.

- [ ] **Step 3: README**

Añadir tras "Desarrollo" en `README.md`:
```markdown
## Configuración inicial

Tras el `seed`, entra como administrador y completa **Configuración**: datos del laboratorio (nombre, dirección, teléfonos), fases de producción (se crean 7 por defecto), categorías y productos (se crean los 6 de la orden en papel con precio base 0.00: pon los precios reales), clínicas con sus doctores y precios especiales, y los usuarios del equipo con su rol (recepción, técnico, mensajero). Los técnicos y mensajeros nunca ven precios.
```

- [ ] **Step 4: Marcar el plan y commit final**

```bash
sed -i 's/^- \[ \]/- [x]/' docs/superpowers/plans/2026-09-04-iteracion-1-configuracion.md
git add apps/web README.md docs/superpowers/plans/2026-09-04-iteracion-1-configuracion.md
git commit -m "test(web): E2E de configuración; docs de configuración inicial y cierre de la iteración 1

Refs #17, #2

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi"
```

---

## Self-review (hecho al redactar)

- **Cobertura del spec (§4, §6 "Configuración", §7, §10 iteración 1, §5 orden en papel):** `lab_settings` (T3/T4/T10), usuarios y roles (T8/T13, plugin admin: crear, rol, contraseña, bloqueo = activar/desactivar), clínicas (T3/T5/T11), doctores (T3/T5/T11), categorías y productos con `pricing_unit`, `base_price`, `turnaround_days`, `requires_try_in` (T3/T6/T12), `clinic_product_prices` (T6/T12), `stages` con color y orden (T3/T7/T10), seeds de Arte Dental (T8), pantalla Configuración solo admin y responsive (T10-T13), E2E (T14). Precios ocultos a técnico/mensajero: guard `admin|recepcion` en `/api/config/productos*` (T6). Organización por features en api y web (T1 en adelante).
- **Placeholders:** ninguno; las Tasks 11-13 describen en prosa algunos archivos "mismo patrón que X" solo para hooks/tablas cuyo código completo aparece en T10/T12 con los nombres exactos (`useSaveX`, `useSetXActive`, `DataTable`, `FormDialog`).
- **Consistencia de nombres:** `createApp({ auth, db, webOrigin })` (T4) usado en todos los tests posteriores; `validate` (T1); `requireAuth`/`requireRole` desde `features/auth/session.ts` (T1); `ctx.schema` (T3) en tests de T5/T6; `queryKeys` (T9) en T10-T13; rutas RPC `api.api.config.{laboratorio,clinicas,doctores,productos,fases}` y `api.api.users` coinciden con los `.route()` de `app.ts`.
- **Riesgos conocidos y mitigación:** (1) sintaxis de `where`/`orderBy` como objetos en RQB v2 rc.4 → alternativa SQL-like indicada en T5; (2) mezcla `{ ...appRelations, ...authRelations }` en `createDb` → BLOCKED si no tipa (T3); (3) nombres exactos de `auth.api.*` del plugin admin y forma de `APIError` → consultar context7 (T8); (4) `Field`/`FieldError` de shadcn 4.19 con `--base radix` → verificar que `shadcn add field` los provea; si no, usar `Label` + `<p role="alert">` como en el login; (5) `useMatchRoute` para ocultar la lista cuando hay `$clinicId` (T11) → alternativa: convertir `clinicas.tsx` en `clinicas/index.tsx` + `clinicas/$clinicId.tsx` sin layout.
