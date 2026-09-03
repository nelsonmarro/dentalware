# Iteración 0 — Fundación del monorepo Dentalware · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar un monorepo TypeScript funcionando de punta a punta: paquete compartido con las reglas de dominio básicas (estados del trabajo, piezas FDI, días hábiles, código de trabajo) con tests, API Hono con PostgreSQL + Drizzle + autenticación por roles, PWA React con login y layout responsive, Docker Compose para desarrollo y producción, CI y hooks de pre-commit.

**Architecture:** pnpm workspaces con `packages/shared` (reglas puras + zod), `apps/api` (Hono + Drizzle + better-auth, inyección de dependencias para poder testear contra una BD real) y `apps/web` (Vite + React + TanStack Router/Query + Tailwind v4 + shadcn/ui + vite-plugin-pwa). Tipado end-to-end: la API exporta `AppType` y la web usa el cliente RPC `hc<AppType>()`. Caddy sirve la web y hace proxy de `/api/*` a la API en el VPS.

**Tech Stack (versiones verificadas el 2026-09-01 con context7 + registro npm; fijar EXACTAS en el catálogo de pnpm):**

| Paquete | Versión | Paquete | Versión |
|---|---|---|---|
| node | 24 LTS (`24.19.0` local, `node:24-alpine`) | pnpm | 11.25.0 |
| typescript | 6.0.3 (NO 7.x: typescript-eslint exige `<6.1`) | tsx | 4.23.13 |
| vitest / @vitest/coverage-v8 | 4.1.11 | @playwright/test | 1.62.1 |
| eslint / @eslint/js | 10.9.1 / 10.0.1 | typescript-eslint | 8.69.0 |
| eslint-plugin-react-hooks | 7.1.1 | eslint-config-prettier | 10.1.8 |
| prettier / prettier-plugin-tailwindcss | 3.9.6 / 0.8.1 | husky / lint-staged | 9.1.7 / 17.4.1 |
| hono | 4.13.5 | @hono/node-server | 2.1.1 |
| @hono/zod-validator | 0.9.1 | zod | 4.5.4 |
| drizzle-orm / drizzle-kit | 1.0.0-rc.4 (ambos, exactos) | pg / @types/pg | 8.23.0 / 8.23.1 |
| better-auth / @better-auth/drizzle-adapter | 1.7.2 / 1.7.2 (CLI: paquete npm `auth` 1.7.2; `@better-auth/cli` está estancada en 1.4.22) | @types/node | ^24 |
| vite / @vitejs/plugin-react | 8.2.2 / 6.1.1 | react / react-dom | 19.2.8 |
| @tanstack/react-router | 1.170.32 | @tanstack/router-plugin | 1.168.35 |
| @tanstack/react-router-devtools | 1.167.1 | @tanstack/react-query (+devtools) | 5.102.8 |
| tailwindcss / @tailwindcss/vite | 4.3.3 | tw-animate-css | 1.4.0 |
| shadcn (CLI, vía dlx) | 4.19.1 | vite-plugin-pwa | 1.3.0 |
| react-hook-form | 7.87.0 | @hookform/resolvers | 5.9.1 |
| lucide-react | 1.39.0 | sharp (solo script de iconos) | 0.35.4 |

**Spec:** `docs/superpowers/specs/2026-09-01-dentalware-mvp-design.md`

## Global Constraints

- Regla de Nelson (alta prioridad): antes de instalar o usar una librería, consultar **context7** para confirmar versión y API vigente. Las versiones de arriba ya fueron verificadas; si al ejecutar `pnpm install` una versión no existe o hay conflicto de peers, consultar context7 de nuevo antes de cambiarla.
- Un solo lenguaje: TypeScript `strict`, ESM (`"type": "module"`) en todos los paquetes.
- UI y mensajes de validación en **español**.
- Roles del sistema: `admin | recepcion | tecnico | mensajero`.
- Nombres de tablas en plural y snake_case (`users`, `sessions`, …). Ids como `text` (better-auth) en tablas de auth; `uuid` en el resto (iteraciones siguientes).
- Los precios nunca se exponen a `tecnico` ni `mensajero` (aplica desde la Iteración 1; aquí solo se deja el guard de roles).
- Nada de `drizzle-kit push` fuera de local. Producción aplica migraciones con `migrate()` al arrancar la API.
- Commits pequeños, mensajes en español con prefijo convencional (`feat:`, `test:`, `chore:`, `docs:`), y trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` y línea `Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi`.
- Desarrollo con TDD: test primero, verlo fallar, implementar, verlo pasar, commit.

---

## Estructura de archivos resultante

```
dentalware/
  .nvmrc                          24
  .npmrc                          shamefully-hoist=false (por defecto), auto-install-peers=true
  package.json                    scripts raíz, packageManager, devDeps de tooling
  pnpm-workspace.yaml             packages + catalog de versiones
  tsconfig.base.json              opciones comunes
  eslint.config.js · .prettierrc · lint-staged.config.js · vitest.config.ts
  .github/workflows/ci.yml
  .husky/pre-commit
  packages/shared/
    package.json · tsconfig.json · vitest.config.ts
    src/index.ts                  re-exporta todo
    src/roles.ts                  USER_ROLES, UserRole
    src/case-status.ts            estados, acciones, transiciones, permisos por rol
    src/fdi.ts                    piezas FDI
    src/business-days.ts          addBusinessDays
    src/case-code.ts              formatCaseCode / parseCaseCode
    src/schemas/auth.ts           loginSchema (zod)
    src/*.test.ts                 tests unitarios junto al código
  apps/api/
    package.json · tsconfig.json · vitest.config.ts · drizzle.config.ts
    .env.example · .env.test
    drizzle/                      migraciones SQL generadas
    src/config.ts                 env validado con zod
    src/db/index.ts               createDb(url) → { db, pool }
    src/db/migrate.ts             runMigrations(db)
    src/db/schema/index.ts        re-export de tablas
    src/db/schema/auth.ts         users, sessions, accounts, verifications (generado por better-auth CLI)
    src/auth.ts                   createAuth(db, config)
    src/auth.instance.ts          instancia para la CLI de better-auth
    src/middleware/session.ts     sessionMiddleware, requireAuth, requireRole
    src/routes/health.ts · src/routes/me.ts
    src/app.ts                    createApp({ auth }) + AppType
    src/main.ts                   arranque: config → db → migrate → auth → serve
    src/scripts/seed.ts           crea el admin inicial
    src/test/setup.ts             helpers de test (db de test, limpiar tablas, login)
    src/app.test.ts · src/auth.test.ts
  apps/web/
    package.json · tsconfig.json · vite.config.ts · components.json · playwright.config.ts
    index.html · public/icon.svg · public/*.png (generados)
    scripts/gen-icons.mjs
    src/main.tsx · src/index.css · src/vite-env.d.ts · src/routeTree.gen.ts (generado)
    src/lib/utils.ts (shadcn) · src/lib/auth-client.ts · src/lib/api.ts
    src/components/ui/*           shadcn (button, input, label, card)
    src/components/app-shell.tsx  sidebar (PC) + barra inferior (móvil)
    src/routes/__root.tsx · src/routes/login.tsx · src/routes/_app.tsx
    src/routes/_app/index.tsx · trabajos.tsx · entregas.tsx · cuentas.tsx · configuracion.tsx
    e2e/login.spec.ts
  infra/
    docker-compose.dev.yml        postgres local (bd dev + bd test)
    postgres/init-test-db.sql
    docker-compose.yml            producción: caddy + api + postgres
    api.Dockerfile · web.Dockerfile · Caddyfile
    .env.example · backup.sh
```

---

### Task 1: Bootstrap del monorepo y tooling raíz

**Files:**
- Create: `.nvmrc`, `.npmrc`, `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `.prettierignore`, `lint-staged.config.js`, `vitest.config.ts`, `README.md`
- Modify: `docs/superpowers/specs/2026-09-01-dentalware-mvp-design.md` (Node 22 → Node 24; Drizzle 1.0 RC)

**Interfaces:**
- Produces: nombres de paquetes `@dentalware/shared`, `@dentalware/api`, `@dentalware/web`; scripts raíz `dev`, `build`, `typecheck`, `lint`, `format`, `test`, `e2e`; catálogo pnpm con las versiones de la tabla.

- [ ] **Step 1: Activar Node 24 y pnpm 11 (local)**

```bash
cd /home/nelson/workspace/github/nelsonmarro/dentalware
source ~/.nvm/nvm.sh && nvm use 24.19.0 && node --version   # v24.19.0
corepack enable && corepack use pnpm@11.25.0 && pnpm --version   # 11.25.0
```
`corepack use` añade `"packageManager": "pnpm@11.25.0"` a `package.json` (lo crea si no existe). Para que `nvm` use 24 siempre en este repo:

```bash
echo 24 > .nvmrc
```

- [ ] **Step 2: Escribir `package.json` raíz**

```json
{
  "name": "dentalware",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.25.0",
  "engines": { "node": ">=24.0.0" },
  "scripts": {
    "dev": "pnpm --filter @dentalware/shared build && pnpm -r --parallel --stream dev",
    "build": "pnpm -r build",
    "typecheck": "tsc -b packages/shared apps/api && pnpm --filter @dentalware/web typecheck",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "pnpm --filter @dentalware/web e2e",
    "db:up": "docker compose -f infra/docker-compose.dev.yml up -d",
    "db:down": "docker compose -f infra/docker-compose.dev.yml down",
    "prepare": "husky"
  },
  "devDependencies": {
    "@eslint/js": "catalog:",
    "@types/node": "catalog:",
    "eslint": "catalog:",
    "eslint-config-prettier": "catalog:",
    "eslint-plugin-react-hooks": "catalog:",
    "husky": "catalog:",
    "lint-staged": "catalog:",
    "prettier": "catalog:",
    "prettier-plugin-tailwindcss": "catalog:",
    "typescript": "catalog:",
    "typescript-eslint": "catalog:",
    "vitest": "catalog:"
  }
}
```

- [ ] **Step 3: Escribir `pnpm-workspace.yaml` con el catálogo de versiones**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'

catalog:
  # tooling
  typescript: 6.0.3
  tsx: 4.23.13
  '@types/node': ^24.0.0
  vitest: 4.1.11
  '@vitest/coverage-v8': 4.1.11
  '@playwright/test': 1.62.1
  eslint: 10.9.1
  '@eslint/js': 10.0.1
  typescript-eslint: 8.69.0
  eslint-plugin-react-hooks: 7.1.1
  eslint-config-prettier: 10.1.8
  prettier: 3.9.6
  prettier-plugin-tailwindcss: 0.8.1
  husky: 9.1.7
  lint-staged: 17.4.1
  # compartido
  zod: 4.5.4
  # api
  hono: 4.13.5
  '@hono/node-server': 2.1.1
  '@hono/zod-validator': 0.9.1
  drizzle-orm: 1.0.0-rc.4
  drizzle-kit: 1.0.0-rc.4
  pg: 8.23.0
  '@types/pg': 8.23.1
  better-auth: 1.7.2
  '@better-auth/drizzle-adapter': 1.7.2
  # web
  vite: 8.2.2
  '@vitejs/plugin-react': 6.1.1
  react: 19.2.8
  react-dom: 19.2.8
  '@types/react': ^19.2.0
  '@types/react-dom': ^19.2.0
  '@tanstack/react-router': 1.170.32
  '@tanstack/router-plugin': 1.168.35
  '@tanstack/react-router-devtools': 1.167.1
  '@tanstack/react-query': 5.102.8
  '@tanstack/react-query-devtools': 5.102.8
  tailwindcss: 4.3.3
  '@tailwindcss/vite': 4.3.3
  tw-animate-css: 1.4.0
  vite-plugin-pwa: 1.3.0
  react-hook-form: 7.87.0
  '@hookform/resolvers': 5.9.1
  lucide-react: 1.39.0
  '@fontsource-variable/instrument-sans': 5.3.0
  '@fontsource-variable/jetbrains-mono': 5.3.0
  workbox-window: 7.4.1   # peer de vite-plugin-pwa (necesario para `vite build`)
  # inyectadas por `shadcn add` — se fijan en el catalog como todo lo demás
  class-variance-authority: 0.7.1
  clsx: 2.1.1
  radix-ui: 1.6.7
  tailwind-merge: 3.6.0
  sharp: 0.35.4
```

- [ ] **Step 4: Escribir `.npmrc`, `tsconfig.base.json`, Prettier, ESLint, lint-staged, vitest raíz**

`.npmrc`:
```
auto-install-peers=true
strict-peer-dependencies=false
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "target": "es2023",
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noUncheckedIndexedAccess": true,
    "noUncheckedSideEffectImports": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "sourceMap": true
  }
}
```

`.prettierrc`:
```json
{
  "semi": false,
  "singleQuote": true,
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

> `tailwindStylesheet` se añade en la Tarea 9 (Step 5), cuando exista `apps/web/src/index.css`; si se pone antes, `prettier-plugin-tailwindcss` lanza `ENOENT` en todo archivo `.js/.ts`.

`.prettierignore`:
```
dist
coverage
pnpm-lock.yaml
**/routeTree.gen.ts
apps/api/drizzle
docs/**/*.pdf
docs/caputras_ejemplo
```

`eslint.config.js`:
```js
// @ts-check
import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import eslintConfigPrettier from 'eslint-config-prettier/flat'

export default defineConfig([
  globalIgnores([
    '**/dist/**',
    '**/coverage/**',
    '**/playwright-report/**',
    '**/test-results/**',
    '**/routeTree.gen.ts',
    'apps/api/drizzle/**',
    'apps/web/dev-dist/**',
  ]),
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
  },
  eslintConfigPrettier,
])
```

`lint-staged.config.js`:
```js
export default {
  '*.{js,mjs,ts,tsx}': ['eslint --fix', 'prettier --write'],
  '*.{json,md,yaml,yml,css}': 'prettier --write',
}
```

`vitest.config.ts` (raíz; cada paquete define su propio `vitest.config.ts`):
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['packages/*/vitest.config.ts', 'apps/api/vitest.config.ts'],
    coverage: { provider: 'v8', reporter: ['text', 'html'] },
  },
})
```

- [ ] **Step 5: Corregir el spec (Node 24, Drizzle RC) y escribir README**

En `docs/superpowers/specs/2026-09-01-dentalware-mvp-design.md`:
- Reemplazar todas las apariciones de `Node 22 LTS` por `Node 24 LTS` y de `node:22-alpine` por `node:24-alpine`.
- En la sección 3 (Arquitectura), tras la línea de `api/`, añadir la nota: `Drizzle ORM 1.0 RC (relaciones v2) fijado en versión exacta; TypeScript 6.0.x hasta que typescript-eslint soporte 7.x.`

`README.md`:
```markdown
# Dentalware

Gestión interna de un laboratorio dental: trabajos, producción por fases, entregas y cuentas por clínica. Una sola app web (PWA) para PC y móvil.

## Requisitos
- Node 24 (`nvm use`), pnpm 11 (`corepack enable`), Docker.

## Desarrollo
```bash
pnpm install
pnpm db:up                      # PostgreSQL local (dev + test)
cp apps/api/.env.example apps/api/.env
pnpm --filter @dentalware/api seed   # crea el admin inicial
pnpm dev                        # shared (watch) + api :3000 + web :5173
```

## Calidad
```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm e2e
```

Spec: `docs/superpowers/specs/2026-09-01-dentalware-mvp-design.md`.
```

- [ ] **Step 6: Instalar dependencias raíz y verificar herramientas**

```bash
pnpm install
pnpm exec tsc --version      # Version 6.0.3
pnpm exec eslint --version   # v10.9.1
pnpm exec prettier --version # 3.9.6
pnpm exec vitest --version   # vitest/4.1.11
```
Si `pnpm install` falla por una versión inexistente, consultar context7 para esa librería y ajustar solo esa entrada del catálogo.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: bootstrap del monorepo pnpm con tooling raíz (TS 6, ESLint 10, Prettier, Vitest 4)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi"
```

---

### Task 2: `packages/shared` — paquete, roles y máquina de estados del trabajo

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/vitest.config.ts`, `packages/shared/src/index.ts`, `packages/shared/src/roles.ts`, `packages/shared/src/case-status.ts`
- Test: `packages/shared/src/case-status.test.ts`

**Interfaces:**
- Produces:
  - `USER_ROLES = ['admin','recepcion','tecnico','mensajero'] as const`, `type UserRole`
  - `CASE_STATUSES` (8 estados), `type CaseStatus`
  - `CASE_ACTIONS` (9 acciones), `type CaseAction`
  - `applyAction(status: CaseStatus, action: CaseAction): { ok: true; status: CaseStatus } | { ok: false; reason: string }`
  - `availableActions(status: CaseStatus): CaseAction[]`
  - `ACTIONS_REQUIRING_REASON: readonly CaseAction[]`
  - `canPerform(role: UserRole, action: CaseAction): boolean`

- [ ] **Step 1: Crear el paquete**

`packages/shared/package.json`:
```json
{
  "name": "@dentalware/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -b",
    "dev": "tsc -b --watch --preserveWatchOutput",
    "typecheck": "tsc -b",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "catalog:"
  },
  "devDependencies": {
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

`packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "module": "nodenext",
    "rewriteRelativeImportExtensions": true,
    "erasableSyntaxOnly": true,
    "declaration": true,
    "declarationMap": true,
    "rootDir": "src",
    "outDir": "dist",
    "types": []
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"]
}
```

`packages/shared/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { name: 'shared', environment: 'node', include: ['src/**/*.test.ts'] },
})
```

`packages/shared/src/roles.ts`:
```ts
export const USER_ROLES = ['admin', 'recepcion', 'tecnico', 'mensajero'] as const
export type UserRole = (typeof USER_ROLES)[number]
```

`packages/shared/src/index.ts` (por ahora):
```ts
export * from './roles.ts'
export * from './case-status.ts'
```

```bash
pnpm install
```

- [ ] **Step 2: Escribir el test de la máquina de estados (falla)**

`packages/shared/src/case-status.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import {
  ACTIONS_REQUIRING_REASON,
  applyAction,
  availableActions,
  canPerform,
  CASE_ACTIONS,
  CASE_STATUSES,
} from './case-status.ts'

describe('estados y acciones', () => {
  it('define los 8 estados del spec en orden', () => {
    expect(CASE_STATUSES).toEqual([
      'nuevo',
      'en_proceso',
      'en_espera',
      'en_prueba',
      'terminado',
      'enviado',
      'entregado',
      'cancelado',
    ])
  })

  it('define las 9 acciones', () => {
    expect([...CASE_ACTIONS].sort()).toEqual(
      [
        'aceptar',
        'pausar',
        'reanudar',
        'enviar_prueba',
        'recibir_prueba',
        'finalizar',
        'marcar_enviado',
        'marcar_entregado',
        'cancelar',
      ].sort(),
    )
  })
})

describe('applyAction — camino feliz', () => {
  it.each([
    ['nuevo', 'aceptar', 'en_proceso'],
    ['en_proceso', 'pausar', 'en_espera'],
    ['en_espera', 'reanudar', 'en_proceso'],
    ['en_proceso', 'enviar_prueba', 'en_prueba'],
    ['en_prueba', 'recibir_prueba', 'en_proceso'],
    ['en_proceso', 'finalizar', 'terminado'],
    ['terminado', 'marcar_enviado', 'enviado'],
    ['enviado', 'marcar_entregado', 'entregado'],
  ] as const)('%s + %s → %s', (from, action, to) => {
    expect(applyAction(from, action)).toEqual({ ok: true, status: to })
  })

  it('cancelar es válido desde cualquier estado excepto entregado y cancelado', () => {
    for (const s of CASE_STATUSES) {
      const result = applyAction(s, 'cancelar')
      if (s === 'entregado' || s === 'cancelado') expect(result.ok).toBe(false)
      else expect(result).toEqual({ ok: true, status: 'cancelado' })
    }
  })
})

describe('applyAction — transiciones inválidas', () => {
  it('rechaza con motivo legible', () => {
    expect(applyAction('nuevo', 'finalizar')).toEqual({
      ok: false,
      reason: 'No se puede "finalizar" un trabajo en estado "nuevo"',
    })
    expect(applyAction('entregado', 'aceptar').ok).toBe(false)
    expect(applyAction('cancelado', 'reanudar').ok).toBe(false)
  })
})

describe('availableActions', () => {
  it('lista solo las acciones válidas para el estado', () => {
    expect(availableActions('nuevo').sort()).toEqual(['aceptar', 'cancelar'])
    expect(availableActions('en_proceso').sort()).toEqual(
      ['pausar', 'enviar_prueba', 'finalizar', 'cancelar'].sort(),
    )
    expect(availableActions('entregado')).toEqual([])
    expect(availableActions('cancelado')).toEqual([])
  })
})

describe('motivo obligatorio y permisos por rol', () => {
  it('pausar y cancelar exigen motivo', () => {
    expect([...ACTIONS_REQUIRING_REASON].sort()).toEqual(['cancelar', 'pausar'])
  })

  it('aplica la tabla de roles del spec', () => {
    expect(canPerform('admin', 'aceptar')).toBe(true)
    expect(canPerform('recepcion', 'aceptar')).toBe(true)
    expect(canPerform('tecnico', 'aceptar')).toBe(false)
    expect(canPerform('tecnico', 'finalizar')).toBe(true)
    expect(canPerform('mensajero', 'marcar_enviado')).toBe(true)
    expect(canPerform('mensajero', 'marcar_entregado')).toBe(true)
    expect(canPerform('mensajero', 'finalizar')).toBe(false)
    expect(canPerform('tecnico', 'cancelar')).toBe(false)
  })
})
```

- [ ] **Step 3: Ejecutar y ver fallar**

```bash
pnpm --filter @dentalware/shared test
```
Expected: FAIL — `Failed to load url ./case-status.ts` (el módulo no existe).

- [ ] **Step 4: Implementar `case-status.ts`**

```ts
import type { UserRole } from './roles.ts'

export const CASE_STATUSES = [
  'nuevo',
  'en_proceso',
  'en_espera',
  'en_prueba',
  'terminado',
  'enviado',
  'entregado',
  'cancelado',
] as const
export type CaseStatus = (typeof CASE_STATUSES)[number]

export const CASE_ACTIONS = [
  'aceptar',
  'pausar',
  'reanudar',
  'enviar_prueba',
  'recibir_prueba',
  'finalizar',
  'marcar_enviado',
  'marcar_entregado',
  'cancelar',
] as const
export type CaseAction = (typeof CASE_ACTIONS)[number]

type Transition = { from: readonly CaseStatus[]; to: CaseStatus; roles: readonly UserRole[] }

const CANCELABLE: readonly CaseStatus[] = CASE_STATUSES.filter(
  (s) => s !== 'entregado' && s !== 'cancelado',
)

export const CASE_TRANSITIONS: Record<CaseAction, Transition> = {
  aceptar: { from: ['nuevo'], to: 'en_proceso', roles: ['admin', 'recepcion'] },
  pausar: { from: ['en_proceso'], to: 'en_espera', roles: ['admin', 'recepcion'] },
  reanudar: { from: ['en_espera'], to: 'en_proceso', roles: ['admin', 'recepcion'] },
  enviar_prueba: { from: ['en_proceso'], to: 'en_prueba', roles: ['admin', 'recepcion'] },
  recibir_prueba: { from: ['en_prueba'], to: 'en_proceso', roles: ['admin', 'recepcion'] },
  finalizar: { from: ['en_proceso'], to: 'terminado', roles: ['admin', 'recepcion', 'tecnico'] },
  marcar_enviado: { from: ['terminado'], to: 'enviado', roles: ['admin', 'recepcion', 'mensajero'] },
  marcar_entregado: {
    from: ['enviado'],
    to: 'entregado',
    roles: ['admin', 'recepcion', 'mensajero'],
  },
  cancelar: { from: CANCELABLE, to: 'cancelado', roles: ['admin', 'recepcion'] },
}

export const ACTIONS_REQUIRING_REASON: readonly CaseAction[] = ['pausar', 'cancelar']

export type ApplyResult = { ok: true; status: CaseStatus } | { ok: false; reason: string }

export function applyAction(status: CaseStatus, action: CaseAction): ApplyResult {
  const t = CASE_TRANSITIONS[action]
  if (!t.from.includes(status)) {
    return { ok: false, reason: `No se puede "${action}" un trabajo en estado "${status}"` }
  }
  return { ok: true, status: t.to }
}

export function availableActions(status: CaseStatus): CaseAction[] {
  return CASE_ACTIONS.filter((a) => CASE_TRANSITIONS[a].from.includes(status))
}

export function canPerform(role: UserRole, action: CaseAction): boolean {
  return CASE_TRANSITIONS[action].roles.includes(role)
}
```

- [ ] **Step 5: Ejecutar tests y typecheck**

```bash
pnpm --filter @dentalware/shared test        # PASS (5 archivos de describe, todos verdes)
pnpm --filter @dentalware/shared build       # genera dist/ sin errores
```

- [ ] **Step 6: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): paquete compartido con roles y máquina de estados del trabajo

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi"
```

---

### Task 3: `shared` — piezas FDI

**Files:**
- Create: `packages/shared/src/fdi.ts`
- Modify: `packages/shared/src/index.ts` (añadir `export * from './fdi.ts'`)
- Test: `packages/shared/src/fdi.test.ts`

**Interfaces:**
- Produces: `FDI_TEETH: readonly number[]` (32 valores), `isFdiTooth(n: unknown): n is FdiTooth`, `type FdiTooth`, `FDI_QUADRANTS: Record<1|2|3|4, readonly FdiTooth[]>`, `toothLabel(n: FdiTooth): string`, `fdiToothSchema` (zod), `fdiTeethSchema` (zod, array sin duplicados, ordenado)

- [ ] **Step 1: Test (falla)**

`packages/shared/src/fdi.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { FDI_QUADRANTS, FDI_TEETH, fdiTeethSchema, isFdiTooth, toothLabel } from './fdi.ts'

describe('FDI', () => {
  it('tiene 32 piezas permanentes en orden de cuadrante', () => {
    expect(FDI_TEETH).toHaveLength(32)
    expect(FDI_TEETH.slice(0, 8)).toEqual([18, 17, 16, 15, 14, 13, 12, 11])
    expect(FDI_TEETH.slice(8, 16)).toEqual([21, 22, 23, 24, 25, 26, 27, 28])
    expect(FDI_TEETH.slice(16, 24)).toEqual([48, 47, 46, 45, 44, 43, 42, 41])
    expect(FDI_TEETH.slice(24, 32)).toEqual([31, 32, 33, 34, 35, 36, 37, 38])
  })

  it('agrupa por cuadrante', () => {
    expect(FDI_QUADRANTS[1]).toEqual([18, 17, 16, 15, 14, 13, 12, 11])
    expect(FDI_QUADRANTS[3]).toEqual([31, 32, 33, 34, 35, 36, 37, 38])
  })

  it('valida piezas', () => {
    expect(isFdiTooth(11)).toBe(true)
    expect(isFdiTooth(48)).toBe(true)
    expect(isFdiTooth(19)).toBe(false)
    expect(isFdiTooth(10)).toBe(false)
    expect(isFdiTooth(51)).toBe(false) // temporales fuera del MVP
    expect(isFdiTooth('11')).toBe(false)
  })

  it('etiqueta legible', () => {
    expect(toothLabel(11)).toBe('11 · Incisivo central superior derecho')
    expect(toothLabel(36)).toBe('36 · Primer molar inferior izquierdo')
  })

  it('schema zod: ordena y rechaza duplicados o piezas inválidas', () => {
    expect(fdiTeethSchema.parse([44, 42, 43])).toEqual([42, 43, 44])
    expect(fdiTeethSchema.safeParse([11, 11]).success).toBe(false)
    expect(fdiTeethSchema.safeParse([99]).success).toBe(false)
  })
})
```

- [ ] **Step 2: Ejecutar y ver fallar**

```bash
pnpm --filter @dentalware/shared test
```
Expected: FAIL — `Failed to load url ./fdi.ts`.

- [ ] **Step 3: Implementar `fdi.ts`**

```ts
import { z } from 'zod'

const Q1 = [18, 17, 16, 15, 14, 13, 12, 11] as const
const Q2 = [21, 22, 23, 24, 25, 26, 27, 28] as const
const Q4 = [48, 47, 46, 45, 44, 43, 42, 41] as const
const Q3 = [31, 32, 33, 34, 35, 36, 37, 38] as const

/** Orden de lectura del odontograma: arcada superior (18→28) y luego inferior (48→38). */
export const FDI_TEETH = [...Q1, ...Q2, ...Q4, ...Q3] as const
export type FdiTooth = (typeof FDI_TEETH)[number]

export const FDI_QUADRANTS = { 1: Q1, 2: Q2, 3: Q3, 4: Q4 } as const

const FDI_SET: ReadonlySet<number> = new Set(FDI_TEETH)

export function isFdiTooth(n: unknown): n is FdiTooth {
  return typeof n === 'number' && FDI_SET.has(n)
}

const POSITION_NAMES = [
  'Incisivo central',
  'Incisivo lateral',
  'Canino',
  'Primer premolar',
  'Segundo premolar',
  'Primer molar',
  'Segundo molar',
  'Tercer molar',
] as const

export function toothLabel(n: FdiTooth): string {
  const quadrant = Math.floor(n / 10)
  const position = (n % 10) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  const arch = quadrant <= 2 ? 'superior' : 'inferior'
  const side = quadrant === 1 || quadrant === 4 ? 'derecho' : 'izquierdo'
  return `${n} · ${POSITION_NAMES[position - 1]} ${arch} ${side}`
}

export const fdiToothSchema = z
  .number()
  .int()
  .refine(isFdiTooth, { error: 'Pieza dental FDI inválida' })

export const fdiTeethSchema = z
  .array(fdiToothSchema)
  .refine((arr) => new Set(arr).size === arr.length, { error: 'Piezas repetidas' })
  .transform((arr) => [...arr].sort((a, b) => a - b))
```

Añadir a `src/index.ts`: `export * from './fdi.ts'`.

- [ ] **Step 4: Ejecutar tests**

```bash
pnpm --filter @dentalware/shared test   # PASS
```

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): piezas dentales FDI con validación zod

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi"
```

---

### Task 4: `shared` — días hábiles y código de trabajo

**Files:**
- Create: `packages/shared/src/business-days.ts`, `packages/shared/src/case-code.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/business-days.test.ts`, `packages/shared/src/case-code.test.ts`

**Interfaces:**
- Produces:
  - `addBusinessDays(start: Date, days: number, holidays?: readonly string[]): Date` — `holidays` en formato `YYYY-MM-DD`; cuenta desde el día siguiente a `start`; salta sábados, domingos y feriados; devuelve la fecha a medianoche local.
  - `toIsoDate(d: Date): string` (`YYYY-MM-DD` local)
  - `formatCaseCode(year: number, seq: number): string` → `26-00123`
  - `parseCaseCode(code: string): { year: number; seq: number } | null`
  - `CASE_CODE_REGEX`

- [ ] **Step 1: Tests (fallan)**

`packages/shared/src/business-days.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { addBusinessDays, toIsoDate } from './business-days.ts'

const d = (iso: string) => new Date(`${iso}T00:00:00`)

describe('addBusinessDays', () => {
  it('cuenta desde el día siguiente (5 días desde un lunes = lunes siguiente)', () => {
    // 2026-09-07 es lunes
    expect(toIsoDate(addBusinessDays(d('2026-09-07'), 5))).toBe('2026-09-14')
  })

  it('salta fin de semana (1 día desde viernes = lunes)', () => {
    // 2026-09-11 es viernes
    expect(toIsoDate(addBusinessDays(d('2026-09-11'), 1))).toBe('2026-09-14')
  })

  it('si el inicio cae en fin de semana, arranca el lunes', () => {
    // 2026-09-12 es sábado → 1 día hábil = lunes 14
    expect(toIsoDate(addBusinessDays(d('2026-09-12'), 1))).toBe('2026-09-14')
  })

  it('salta feriados', () => {
    // 2026-10-09 (viernes) es feriado en Ecuador (Independencia de Guayaquil)
    expect(toIsoDate(addBusinessDays(d('2026-10-08'), 1, ['2026-10-09']))).toBe('2026-10-12')
  })

  it('0 días devuelve el mismo día a medianoche', () => {
    expect(toIsoDate(addBusinessDays(d('2026-09-07'), 0))).toBe('2026-09-07')
  })

  it('rechaza días negativos', () => {
    expect(() => addBusinessDays(d('2026-09-07'), -1)).toThrow('días debe ser >= 0')
  })
})
```

`packages/shared/src/case-code.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { CASE_CODE_REGEX, formatCaseCode, parseCaseCode } from './case-code.ts'

describe('código de trabajo', () => {
  it('formatea AA-NNNNN', () => {
    expect(formatCaseCode(2026, 123)).toBe('26-00123')
    expect(formatCaseCode(2030, 1)).toBe('30-00001')
  })

  it('parsea', () => {
    expect(parseCaseCode('26-00123')).toEqual({ year: 2026, seq: 123 })
    expect(parseCaseCode('26-123')).toBeNull()
    expect(parseCaseCode('abc')).toBeNull()
  })

  it('regex', () => {
    expect(CASE_CODE_REGEX.test('26-00123')).toBe(true)
    expect(CASE_CODE_REGEX.test('2026-00123')).toBe(false)
  })

  it('rechaza secuencias fuera de rango', () => {
    expect(() => formatCaseCode(2026, 0)).toThrow()
    expect(() => formatCaseCode(2026, 100000)).toThrow()
  })
})
```

- [ ] **Step 2: Ejecutar y ver fallar**

```bash
pnpm --filter @dentalware/shared test
```
Expected: FAIL en ambos archivos por módulo inexistente.

- [ ] **Step 3: Implementar**

`packages/shared/src/business-days.ts`:
```ts
export function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isWeekend(d: Date): boolean {
  const day = d.getDay()
  return day === 0 || day === 6
}

/**
 * Suma `days` días hábiles a `start`, contando desde el día siguiente.
 * Salta sábados, domingos y las fechas de `holidays` (YYYY-MM-DD).
 */
export function addBusinessDays(start: Date, days: number, holidays: readonly string[] = []): Date {
  if (days < 0) throw new Error('días debe ser >= 0')
  const holidaySet = new Set(holidays)
  const current = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  let remaining = days
  while (remaining > 0) {
    current.setDate(current.getDate() + 1)
    if (isWeekend(current) || holidaySet.has(toIsoDate(current))) continue
    remaining -= 1
  }
  return current
}
```

`packages/shared/src/case-code.ts`:
```ts
export const CASE_CODE_REGEX = /^(\d{2})-(\d{5})$/

export function formatCaseCode(year: number, seq: number): string {
  if (!Number.isInteger(seq) || seq < 1 || seq > 99999) {
    throw new Error(`Secuencia fuera de rango: ${seq}`)
  }
  const yy = String(year % 100).padStart(2, '0')
  return `${yy}-${String(seq).padStart(5, '0')}`
}

export function parseCaseCode(code: string): { year: number; seq: number } | null {
  const m = CASE_CODE_REGEX.exec(code)
  if (!m) return null
  return { year: 2000 + Number(m[1]), seq: Number(m[2]) }
}
```

`src/index.ts` completo:
```ts
export * from './roles.ts'
export * from './case-status.ts'
export * from './fdi.ts'
export * from './business-days.ts'
export * from './case-code.ts'
```

- [ ] **Step 4: Ejecutar tests y build**

```bash
pnpm --filter @dentalware/shared test && pnpm --filter @dentalware/shared build   # PASS
```

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): cálculo de días hábiles y formato de código de trabajo

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi"
```

---

### Task 5: `shared` — schemas zod de autenticación

**Files:**
- Create: `packages/shared/src/schemas/auth.ts`
- Modify: `packages/shared/src/index.ts` (añadir `export * from './schemas/auth.ts'`)
- Test: `packages/shared/src/schemas/auth.test.ts`

**Interfaces:**
- Produces: `loginSchema = z.object({ email, password })`, `type LoginInput`; `userRoleSchema = z.enum(USER_ROLES)`.

- [ ] **Step 1: Test (falla)**

```ts
import { describe, expect, it } from 'vitest'
import { loginSchema, userRoleSchema } from './auth.ts'

describe('loginSchema', () => {
  it('acepta credenciales válidas y normaliza el email', () => {
    expect(loginSchema.parse({ email: ' Admin@Lab.com ', password: 'secreto123' })).toEqual({
      email: 'admin@lab.com',
      password: 'secreto123',
    })
  })
  it('mensajes en español', () => {
    const r = loginSchema.safeParse({ email: 'no-es-email', password: '123' })
    expect(r.success).toBe(false)
    if (!r.success) {
      const msgs = r.error.issues.map((i) => i.message)
      expect(msgs).toContain('Correo inválido')
      expect(msgs).toContain('La contraseña debe tener al menos 8 caracteres')
    }
  })
})

describe('userRoleSchema', () => {
  it('solo acepta los 4 roles', () => {
    expect(userRoleSchema.parse('admin')).toBe('admin')
    expect(userRoleSchema.safeParse('root').success).toBe(false)
  })
})
```

- [ ] **Step 2: Ejecutar y ver fallar**

```bash
pnpm --filter @dentalware/shared test
```
Expected: FAIL — módulo `./auth.ts` no existe.

- [ ] **Step 3: Implementar `schemas/auth.ts`**

```ts
import { z } from 'zod'
import { USER_ROLES } from '../roles.ts'

export const userRoleSchema = z.enum(USER_ROLES)

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'Correo inválido' })),
  password: z.string().min(8, { error: 'La contraseña debe tener al menos 8 caracteres' }),
})
export type LoginInput = z.infer<typeof loginSchema>
```

- [ ] **Step 4: Ejecutar tests, build, lint**

```bash
pnpm --filter @dentalware/shared test && pnpm --filter @dentalware/shared build && pnpm lint
```
Expected: todo verde.

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): schemas zod de login y rol

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi"
```

---

### Task 6: PostgreSQL local con Docker y esqueleto de la API (health)

**Files:**
- Create: `infra/docker-compose.dev.yml`, `infra/postgres/init-test-db.sql`, `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`, `apps/api/.env.example`, `apps/api/.env.test`, `apps/api/src/config.ts`, `apps/api/src/routes/health.ts`, `apps/api/src/app.ts`, `apps/api/src/main.ts`
- Test: `apps/api/src/app.test.ts`, `apps/api/src/config.test.ts` (mensajes en español y defaults de `loadConfig`)

**Interfaces:**
- Produces:
  - `loadConfig(env = process.env): Config` con `DATABASE_URL, PORT, NODE_ENV, BETTER_AUTH_SECRET, BETTER_AUTH_URL, WEB_ORIGIN, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME`
  - `createApp(deps: AppDeps): Hono` y `type AppType` (en esta tarea `AppDeps = {}`; Task 8 lo amplía a `{ auth }`)
  - `GET /api/health → { ok: true, ts: string }`

- [ ] **Step 1: Compose de desarrollo y script de BD de test**

`infra/docker-compose.dev.yml`:
```yaml
services:
  postgres:
    image: postgres:17-alpine
    container_name: dentalware-postgres
    environment:
      POSTGRES_USER: dentalware
      POSTGRES_PASSWORD: dentalware
      POSTGRES_DB: dentalware
    ports:
      - '5433:5432'
    # Puerto 5433 en el host: 5432 suele estar ocupado por otro Postgres local (ruling del controlador, 2026-09-03).
    volumes:
      - pgdata_dev:/var/lib/postgresql/data
      - ./postgres/init-test-db.sql:/docker-entrypoint-initdb.d/init-test-db.sql:ro
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U dentalware -d dentalware']
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  pgdata_dev:
```

`infra/postgres/init-test-db.sql`:
```sql
CREATE DATABASE dentalware_test OWNER dentalware;
```

```bash
pnpm db:up
docker compose -f infra/docker-compose.dev.yml ps    # postgres healthy
docker exec dentalware-postgres psql -U dentalware -d dentalware_test -c 'select 1'   # 1 fila
```

- [ ] **Step 2: Crear el paquete `apps/api`**

`apps/api/package.json`:
```json
{
  "name": "@dentalware/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./app": { "types": "./dist/app.d.ts", "default": "./dist/app.js" },
    "./auth": { "types": "./dist/auth.d.ts", "default": "./dist/auth.js" }
  },
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc -b",
    "typecheck": "tsc -b",
    "start": "node dist/main.js",
    "test": "vitest run",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "seed": "tsx src/scripts/seed.ts"
  },
  "dependencies": {
    "@dentalware/shared": "workspace:*",
    "@hono/node-server": "catalog:",
    "@hono/zod-validator": "catalog:",
    "@better-auth/drizzle-adapter": "catalog:",
    "better-auth": "catalog:",
    "drizzle-orm": "catalog:",
    "hono": "catalog:",
    "pg": "catalog:",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "@types/pg": "catalog:",
    "drizzle-kit": "catalog:",
    "tsx": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

`apps/api/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "module": "nodenext",
    "rewriteRelativeImportExtensions": true,
    "erasableSyntaxOnly": true,
    "declaration": true,
    "declarationMap": true,
    "rootDir": "src",
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts", "src/test/**"],
  "references": [{ "path": "../../packages/shared" }]
}
```

`apps/api/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

// Carga .env.test sin sobrescribir variables ya presentes (CI).
try {
  process.loadEnvFile(new URL('./.env.test', import.meta.url).pathname)
} catch {
  /* sin archivo: se usan las variables del entorno */
}

export default defineConfig({
  test: {
    name: 'api',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    fileParallelism: false, // los tests comparten la BD de test
    testTimeout: 20_000,
  },
})
```

`apps/api/.env.example`:
```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://dentalware:dentalware@localhost:5433/dentalware
BETTER_AUTH_SECRET=cambia-esto-por-32-caracteres-aleatorios-minimo
BETTER_AUTH_URL=http://localhost:3000
WEB_ORIGIN=http://localhost:5173
ADMIN_EMAIL=admin@lab.local
ADMIN_PASSWORD=Admin12345!
ADMIN_NAME=Administrador
```

`apps/api/.env.test` (se commitea; solo apunta a la BD de test local). El `.gitignore` raíz tiene `.env.*`: añadir la excepción `!.env.test` justo después de `!.env.example` e incluir `.gitignore` en el commit de esta tarea:
```
NODE_ENV=test
PORT=3999
DATABASE_URL=postgres://dentalware:dentalware@localhost:5433/dentalware_test
BETTER_AUTH_SECRET=secreto-de-test-no-usar-en-produccion-0123456789
BETTER_AUTH_URL=http://localhost:3999
WEB_ORIGIN=http://localhost:5173
ADMIN_EMAIL=admin@test.local
ADMIN_PASSWORD=Test12345!
ADMIN_NAME=Admin Test
```

```bash
cp apps/api/.env.example apps/api/.env
pnpm install
```

- [ ] **Step 3: Test del health endpoint (falla)**

`apps/api/src/app.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { createApp } from './app.ts'

describe('GET /api/health', () => {
  it('responde ok con timestamp ISO', async () => {
    const app = createApp({})
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; ts: string }
    expect(body.ok).toBe(true)
    expect(new Date(body.ts).toISOString()).toBe(body.ts)
  })

  it('404 en JSON para rutas desconocidas bajo /api', async () => {
    const app = createApp({})
    const res = await app.request('/api/no-existe')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ message: 'Recurso no encontrado' })
  })
})
```

- [ ] **Step 4: Ejecutar y ver fallar**

```bash
pnpm --filter @dentalware/api test
```
Expected: FAIL — `./app.ts` no existe.

- [ ] **Step 5: Implementar config, health y app**

`apps/api/src/config.ts`:
```ts
import { z } from 'zod'

const configSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'], {
      error: 'NODE_ENV debe ser development, test o production',
    })
    .default('development'),
  PORT: z.coerce
    .number({ error: 'PORT debe ser un entero positivo' })
    .int({ error: 'PORT debe ser un entero positivo' })
    .positive({ error: 'PORT debe ser un entero positivo' })
    .default(3000),
  DATABASE_URL: z.url({ error: 'DATABASE_URL debe ser una URL postgres://' }),
  BETTER_AUTH_SECRET: z
    .string({ error: 'BETTER_AUTH_SECRET: mínimo 32 caracteres' })
    .min(32, { error: 'BETTER_AUTH_SECRET: mínimo 32 caracteres' }),
  BETTER_AUTH_URL: z.url({ error: 'BETTER_AUTH_URL debe ser una URL válida' }),
  WEB_ORIGIN: z.url({ error: 'WEB_ORIGIN debe ser una URL válida' }),
  ADMIN_EMAIL: z.email({ error: 'ADMIN_EMAIL debe ser un correo válido' }),
  ADMIN_PASSWORD: z
    .string({ error: 'ADMIN_PASSWORD: mínimo 8 caracteres' })
    .min(8, { error: 'ADMIN_PASSWORD: mínimo 8 caracteres' }),
  ADMIN_NAME: z
    .string()
    .min(1, { error: 'ADMIN_NAME no puede estar vacío' })
    .default('Administrador'),
})

export type Config = z.infer<typeof configSchema>

/** Carga `.env` si existe (no sobrescribe variables ya definidas) y valida. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (env === process.env) {
    try {
      process.loadEnvFile()
    } catch {
      /* sin .env: entorno real */
    }
  }
  const parsed = configSchema.safeParse(env)
  if (!parsed.success) {
    const detalle = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Configuración inválida:\n${detalle}`)
  }
  return parsed.data
}
```

`apps/api/src/routes/health.ts`:
```ts
import { Hono } from 'hono'

export const healthRoutes = new Hono().get('/', (c) =>
  c.json({ ok: true as const, ts: new Date().toISOString() }),
)
```

`apps/api/src/app.ts` (versión de esta tarea; Task 8 la amplía):
```ts
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { healthRoutes } from './routes/health.ts'

export type AppDeps = Record<string, never>

export function createApp(_deps: AppDeps) {
  const app = new Hono()

  app.use(secureHeaders())
  if (process.env.NODE_ENV !== 'test') app.use(logger())

  const routes = app.route('/api/health', healthRoutes)

  app.notFound((c) => c.json({ message: 'Recurso no encontrado' }, 404))
  app.onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse()
    console.error(err)
    return c.json({ message: 'Error interno del servidor' }, 500)
  })

  return routes
}

export type AppType = ReturnType<typeof createApp>
```

`apps/api/src/main.ts` (versión de esta tarea):
```ts
import { serve } from '@hono/node-server'
import { createApp } from './app.ts'
import { loadConfig } from './config.ts'

const config = loadConfig()
const app = createApp({})

serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.log(`API escuchando en http://localhost:${info.port}`)
})
```

- [ ] **Step 6: Ejecutar tests, arrancar y probar**

```bash
pnpm --filter @dentalware/api test          # PASS
pnpm --filter @dentalware/api typecheck     # sin errores
pnpm --filter @dentalware/api dev &         # en otra terminal
curl -s localhost:3000/api/health           # {"ok":true,"ts":"..."}
```
Detener el servidor (`kill %1` o Ctrl+C).

- [ ] **Step 7: Commit**

```bash
git add infra/docker-compose.dev.yml infra/postgres apps/api pnpm-lock.yaml
git commit -m "feat(api): esqueleto Hono con config validada, health y Postgres local en Docker

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi"
```

---

### Task 7: Drizzle — conexión, esquema de autenticación y migraciones

**Files:**
- Create: `apps/api/drizzle.config.ts`, `apps/api/src/db/index.ts`, `apps/api/src/db/migrate.ts`, `apps/api/src/db/schema/index.ts`, `apps/api/src/db/schema/auth.ts`, `apps/api/src/auth.ts`, `apps/api/src/auth.instance.ts`, `apps/api/drizzle/0000_*.sql` (generado)
- Test: `apps/api/src/db/migrate.test.ts`

**Interfaces:**
- Produces:
  - `createDb(url: string): { db: Db; pool: Pool }`, `type Db`
  - `runMigrations(db: Db): Promise<void>`
  - Tablas `users` (con `role`), `sessions`, `accounts`, `verifications` exportadas desde `db/schema/index.ts`
  - `createAuth(db: Db, config: Config): Auth`, `type Auth`, `type SessionUser = Auth['$Infer']['Session']['user']`

- [ ] **Step 1: Test de migraciones (falla)**

`apps/api/src/db/migrate.test.ts`:
```ts
import { sql } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { loadConfig } from '../config.ts'
import { createDb } from './index.ts'
import { runMigrations } from './migrate.ts'

const config = loadConfig()
const { db, pool } = createDb(config.DATABASE_URL)

afterAll(async () => {
  await pool.end()
})

describe('migraciones', () => {
  it('crea las tablas de autenticación', async () => {
    await runMigrations(db)
    const result = await db.execute<{ table_name: string }>(sql`
      select table_name from information_schema.tables
      where table_schema = 'public' order by table_name
    `)
    const names = result.rows.map((r) => r.table_name)
    expect(names).toEqual(expect.arrayContaining(['users', 'sessions', 'accounts', 'verifications']))
  })

  it('users tiene la columna role con default tecnico', async () => {
    const result = await db.execute<{ column_default: string | null }>(sql`
      select column_default from information_schema.columns
      where table_name = 'users' and column_name = 'role'
    `)
    expect(result.rows[0]?.column_default).toContain('tecnico')
  })
})
```

- [ ] **Step 2: Ejecutar y ver fallar**

```bash
pnpm --filter @dentalware/api test
```
Expected: FAIL — módulos `./index.ts` / `./migrate.ts` no existen.

- [ ] **Step 3: Conexión y migrador**

`apps/api/src/db/index.ts`:
```ts
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

export function createDb(url: string) {
  const pool = new Pool({ connectionString: url, max: 10 })
  const db = drizzle({ client: pool })
  return { db, pool }
}

export type Db = ReturnType<typeof createDb>['db']
```

`apps/api/src/db/migrate.ts`:
```ts
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { Db } from './index.ts'

const migrationsFolder = new URL('../../drizzle', import.meta.url).pathname

export async function runMigrations(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder })
}
```

`apps/api/drizzle.config.ts`:
```ts
import { defineConfig } from 'drizzle-kit'

try {
  process.loadEnvFile()
} catch {
  /* sin .env */
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
  verbose: true,
})
```

- [ ] **Step 4: Configuración de better-auth y generación del esquema**

`apps/api/src/db/schema/index.ts` (inicialmente vacío para que la CLI pueda cargar la config):
```ts
export * from './auth.ts'
```
Crear `apps/api/src/db/schema/auth.ts` vacío con `export {}` temporalmente.

`apps/api/src/auth.ts`:
```ts
import { USER_ROLES } from '@dentalware/shared'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2' // Drizzle 1.0: relaciones v2
import type { Config } from './config.ts'
import type { Db } from './db/index.ts'
import * as schema from './db/schema/index.ts'

export function createAuth(db: Db, config: Config) {
  return betterAuth({
    appName: 'Dentalware',
    baseURL: config.BETTER_AUTH_URL,
    basePath: '/api/auth',
    secret: config.BETTER_AUTH_SECRET,
    trustedOrigins: [config.WEB_ORIGIN],
    database: drizzleAdapter(db, { provider: 'pg', usePlural: true, schema }),
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    user: {
      additionalFields: {
        role: {
          type: [...USER_ROLES],
          required: true,
          defaultValue: 'tecnico',
          input: false, // el rol nunca lo elige el cliente
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 14, // 14 días
      updateAge: 60 * 60 * 24,
    },
    // better-auth fija además 3 req/10 s en sign-in/sign-up; en tests se desactiva para no romper la suite.
    rateLimit: { enabled: config.NODE_ENV !== 'test', window: 60, max: 30 },
    advanced: {
      useSecureCookies: config.NODE_ENV === 'production',
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>
export type SessionUser = Auth['$Infer']['Session']['user']
```

`apps/api/src/auth.instance.ts` (solo para la CLI de better-auth):
```ts
import { createAuth } from './auth.ts'
import { loadConfig } from './config.ts'
import { createDb } from './db/index.ts'

const config = loadConfig()
export const auth = createAuth(createDb(config.DATABASE_URL).db, config)
```

Generar el esquema Drizzle con la CLI oficial (versión fijada igual que better-auth):
```bash
cd apps/api
pnpm dlx auth@1.7.2 generate --config src/auth.instance.ts --output src/db/schema/auth.ts -y
# La CLI de Better Auth es el paquete npm `auth` (bins `auth`/`better-auth`), versionado junto al core (1.7.2).
# `@better-auth/cli` quedó estancada en 1.4.22 (marzo 2026): despacha por `adapter.id` a un generador interno que emite
# `relations()` de la API v1, incompatible con drizzle-orm 1.0. Con `auth@1.7.2` + adaptador `relations-v2` la salida usa
# `defineRelationsPart`. Nunca editar a mano el archivo generado.
cd ../..
```
Antes de la CLI: añadir `"@better-auth/drizzle-adapter": "catalog:"` a `apps/api/package.json` (y `'@better-auth/drizzle-adapter': 1.7.2` al catalog raíz) y `pnpm install`.

Expected: `src/db/schema/auth.ts` contiene `pgTable('users', …)` con columnas `id, name, email, emailVerified, image, createdAt, updatedAt, role` (role `text().notNull().default('tecnico')`), más `sessions`, `accounts`, `verifications`. Revisar el archivo: si la CLI generó nombres en singular, verificar que `usePlural: true` esté en el adapter y regenerar. Si la CLI pide confirmar sobreescritura, aceptar.

Generar y aplicar la migración:
```bash
pnpm --filter @dentalware/api db:generate      # crea drizzle/0000_<nombre>.sql + meta/
cat apps/api/drizzle/0000_*.sql | head -30      # CREATE TABLE "users" ... "role" text DEFAULT 'tecnico' NOT NULL
```

- [ ] **Step 5: Ejecutar tests de migración**

```bash
pnpm --filter @dentalware/api test
```
Expected: PASS (las 2 pruebas de `migrate.test.ts` y las de `app.test.ts`).

- [ ] **Step 6: Typecheck y commit**

```bash
pnpm --filter @dentalware/api typecheck
git add apps/api
git commit -m "feat(api): Drizzle 1.0 RC con Postgres, esquema de auth generado por better-auth y migraciones

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi"
```

---

### Task 8: Autenticación en la API — handler, sesión, roles, `/api/me`, seed

**Files:**
- Create: `apps/api/src/middleware/session.ts`, `apps/api/src/routes/me.ts`, `apps/api/src/scripts/seed.ts`, `apps/api/src/test/setup.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/main.ts`
- Test: `apps/api/src/auth.test.ts`

**Interfaces:**
- Consumes: `createAuth`, `createDb`, `runMigrations`, `loadConfig`, `USER_ROLES`, `UserRole`.
- Produces:
  - `type AppEnv = { Variables: { user: SessionUser | null; session: Auth['$Infer']['Session']['session'] | null } }`
  - `sessionMiddleware(auth)`, `requireAuth`, `requireRole(...roles: UserRole[])`
  - `createApp({ auth, webOrigin }: AppDeps)` (CORS con lista blanca = `WEB_ORIGIN`); rutas `GET /api/me → { id, name, email, role }` (401 sin sesión); `/api/auth/*` (better-auth); `POST /api/auth/sign-up/*` solo para `admin` autenticado (403 en otro caso)
  - Test helpers: `setupTestDb()`, `truncateAll(db)`, `createUser(auth, db, { email, password, name, role })`, `loginAs(app, email, password): Promise<string /* cookie */>`
  - Script `pnpm --filter @dentalware/api seed` crea el admin de `ADMIN_EMAIL` si no existe.

- [ ] **Step 1: Helpers de test**

`apps/api/src/test/setup.ts`:
```ts
import type { UserRole } from '@dentalware/shared'
import { eq, sql } from 'drizzle-orm'
import type { Auth } from '../auth.ts'
import { createAuth } from '../auth.ts'
import { loadConfig } from '../config.ts'
import type { Db } from '../db/index.ts'
import { createDb } from '../db/index.ts'
import { runMigrations } from '../db/migrate.ts'
import { users } from '../db/schema/index.ts'
import type { AppType } from '../app.ts'

export async function setupTestDb() {
  const config = loadConfig()
  const { db, pool } = createDb(config.DATABASE_URL)
  await runMigrations(db)
  const auth = createAuth(db, config)
  return { config, db, pool, auth }
}

export async function truncateAll(db: Db) {
  await db.execute(sql`truncate table "sessions", "accounts", "verifications", "users" cascade`)
}

export async function createUser(
  auth: Auth,
  db: Db,
  input: { email: string; password: string; name: string; role: UserRole },
) {
  const created = await auth.api.signUpEmail({
    body: { email: input.email, password: input.password, name: input.name },
  })
  // `role` tiene input:false: se fija en servidor, nunca desde el body.
  await db.update(users).set({ role: input.role }).where(eq(users.id, created.user.id))
  return created.user.id
}

export async function loginAs(app: AppType, email: string, password: string): Promise<string> {
  const res = await app.request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: loadConfig().WEB_ORIGIN },
    body: JSON.stringify({ email, password }),
  })
  if (res.status !== 200) throw new Error(`login falló: ${res.status} ${await res.text()}`)
  const cookie = res.headers.get('set-cookie')
  if (!cookie) throw new Error('sin set-cookie')
  return cookie.split(';')[0]!
}
```

- [ ] **Step 2: Test de autenticación (falla)**

`apps/api/src/auth.test.ts`:
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app.ts'
import { createUser, loginAs, setupTestDb, truncateAll } from './test/setup.ts'

let ctx: Awaited<ReturnType<typeof setupTestDb>>
let app: ReturnType<typeof createApp>

beforeAll(async () => {
  ctx = await setupTestDb()
  app = createApp({ auth: ctx.auth, webOrigin: ctx.config.WEB_ORIGIN })
})
beforeEach(async () => {
  await truncateAll(ctx.db)
})
afterAll(async () => {
  await ctx.pool.end()
})

describe('sesión y /api/me', () => {
  it('401 sin sesión', async () => {
    const res = await app.request('/api/me')
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ message: 'No autenticado' })
  })

  it('devuelve el usuario con su rol tras iniciar sesión', async () => {
    await createUser(ctx.auth, ctx.db, {
      email: 'ana@lab.local',
      password: 'Recepcion1!',
      name: 'Ana',
      role: 'recepcion',
    })
    const cookie = await loginAs(app, 'ana@lab.local', 'Recepcion1!')
    const res = await app.request('/api/me', { headers: { cookie } })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ name: 'Ana', email: 'ana@lab.local', role: 'recepcion' })
  })

  it('rechaza credenciales inválidas', async () => {
    const res = await app.request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ctx.config.WEB_ORIGIN },
      body: JSON.stringify({ email: 'nadie@lab.local', password: 'xxxxxxxx' }),
    })
    expect(res.status).toBe(401)
  })
})

describe('registro de usuarios', () => {
  const signUp = (cookie?: string) =>
    app.request('/api/auth/sign-up/email', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: ctx.config.WEB_ORIGIN,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify({ email: 'nuevo@lab.local', password: 'Nuevo1234!', name: 'Nuevo' }),
    })

  it('bloquea el registro anónimo', async () => {
    const res = await signUp()
    expect(res.status).toBe(403)
  })

  it('bloquea el registro a un técnico', async () => {
    await createUser(ctx.auth, ctx.db, {
      email: 'tec@lab.local',
      password: 'Tecnico12!',
      name: 'Tec',
      role: 'tecnico',
    })
    const cookie = await loginAs(app, 'tec@lab.local', 'Tecnico12!')
    expect((await signUp(cookie)).status).toBe(403)
  })

  it('permite el registro a un admin y el nuevo usuario nace como tecnico', async () => {
    await createUser(ctx.auth, ctx.db, {
      email: 'admin@lab.local',
      password: 'Admin1234!',
      name: 'Admin',
      role: 'admin',
    })
    const cookie = await loginAs(app, 'admin@lab.local', 'Admin1234!')
    const res = await signUp(cookie)
    expect(res.status).toBe(200)
    const nuevoCookie = await loginAs(app, 'nuevo@lab.local', 'Nuevo1234!')
    const me = await app.request('/api/me', { headers: { cookie: nuevoCookie } })
    expect(await me.json()).toMatchObject({ email: 'nuevo@lab.local', role: 'tecnico' })
  })
})

describe('requireRole', () => {
  it('403 para rol no permitido en una ruta protegida de prueba', async () => {
    await createUser(ctx.auth, ctx.db, {
      email: 'men@lab.local',
      password: 'Mensajero1!',
      name: 'Men',
      role: 'mensajero',
    })
    const cookie = await loginAs(app, 'men@lab.local', 'Mensajero1!')
    const res = await app.request('/api/admin/ping', { headers: { cookie } })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ message: 'Sin permiso' })
  })
})
```

- [ ] **Step 3: Ejecutar y ver fallar**

```bash
pnpm --filter @dentalware/api test
```
Expected: FAIL — `createApp` no acepta `auth`; `./middleware/session.ts` no existe.

- [ ] **Step 4: Middleware de sesión y roles**

`apps/api/src/middleware/session.ts`:
```ts
import type { UserRole } from '@dentalware/shared'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import type { Auth, SessionUser } from '../auth.ts'

export type AppEnv = {
  Variables: {
    user: SessionUser | null
    session: Auth['$Infer']['Session']['session'] | null
  }
}

export const sessionMiddleware = (auth: Auth) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const result = await auth.api.getSession({ headers: c.req.raw.headers })
    c.set('user', result?.user ?? null)
    c.set('session', result?.session ?? null)
    await next()
  })

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.var.user) throw new HTTPException(401, { message: 'No autenticado' })
  await next()
})

export const requireRole = (...roles: UserRole[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const user = c.var.user
    // Sin sesión o rol incorrecto: ambos 403, no se revela si la ruta exige autenticación.
    if (!user || !roles.includes(user.role as UserRole)) {
      throw new HTTPException(403, { message: 'Sin permiso' })
    }
    await next()
  })
```

`apps/api/src/routes/me.ts`:
```ts
import { Hono } from 'hono'
import type { AppEnv } from '../middleware/session.ts'
import { requireAuth } from '../middleware/session.ts'

export const meRoutes = new Hono<AppEnv>().get('/', requireAuth, (c) => {
  const u = c.var.user!
  return c.json({ id: u.id, name: u.name, email: u.email, role: u.role })
})
```

- [ ] **Step 5: Ampliar `app.ts` y `main.ts`**

`apps/api/src/app.ts` (reemplazo completo):
```ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import type { Auth } from './auth.ts'
import type { AppEnv } from './middleware/session.ts'
import { requireRole, sessionMiddleware } from './middleware/session.ts'
import { healthRoutes } from './routes/health.ts'
import { meRoutes } from './routes/me.ts'

export type AppDeps = { auth: Auth; webOrigin: string }

// Los errores de HTTPException se devuelven siempre como JSON en español.
function errorResponse(err: HTTPException) {
  return Response.json({ message: err.message || 'Error' }, { status: err.status })
}

export function createApp({ auth, webOrigin }: AppDeps) {
  const app = new Hono<AppEnv>()

  app.use(secureHeaders())
  if (process.env.NODE_ENV !== 'test') app.use(logger())
  app.use(
    '/api/*',
    cors({
      origin: (origin) => (origin === webOrigin ? origin : null), // solo el frontend configurado (WEB_ORIGIN); nunca reflejar cualquier Origin
      credentials: true,
      allowHeaders: ['Content-Type'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  )

  app.use('/api/*', sessionMiddleware(auth))

  // Solo un admin autenticado puede crear usuarios.
  app.use('/api/auth/sign-up/*', requireRole('admin'))
  app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw))

  // Ruta de prueba para el guard de roles (se reutiliza en la Iteración 1 para /api/admin/*).
  const adminRoutes = new Hono<AppEnv>().get('/ping', requireRole('admin'), (c) =>
    c.json({ pong: true }),
  )

  const routes = app
    .route('/api/health', healthRoutes)
    .route('/api/me', meRoutes)
    .route('/api/admin', adminRoutes)

  app.notFound((c) => c.json({ message: 'Recurso no encontrado' }, 404))
  app.onError((err, c) => {
    if (err instanceof HTTPException) return errorResponse(err)
    console.error(err)
    return c.json({ message: 'Error interno del servidor' }, 500)
  })

  return routes
}

export type AppType = ReturnType<typeof createApp>
```

Actualizar `apps/api/src/app.test.ts` para el nuevo `createApp`: reemplazar `createApp({})` por una app real con auth de test:
```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from './app.ts'
import { setupTestDb } from './test/setup.ts'

let ctx: Awaited<ReturnType<typeof setupTestDb>>
let app: ReturnType<typeof createApp>
beforeAll(async () => {
  ctx = await setupTestDb()
  app = createApp({ auth: ctx.auth, webOrigin: ctx.config.WEB_ORIGIN })
})
afterAll(async () => {
  await ctx.pool.end()
})

describe('GET /api/health', () => {
  it('responde ok con timestamp ISO', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; ts: string }
    expect(body.ok).toBe(true)
    expect(new Date(body.ts).toISOString()).toBe(body.ts)
  })

  it('404 en JSON para rutas desconocidas bajo /api', async () => {
    const res = await app.request('/api/no-existe')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ message: 'Recurso no encontrado' })
  })
})
```

`apps/api/src/main.ts` (reemplazo completo):
```ts
import { serve } from '@hono/node-server'
import { createApp } from './app.ts'
import { createAuth } from './auth.ts'
import { loadConfig } from './config.ts'
import { createDb } from './db/index.ts'
import { runMigrations } from './db/migrate.ts'

const config = loadConfig()
const { db } = createDb(config.DATABASE_URL)
await runMigrations(db)
const auth = createAuth(db, config)
const app = createApp({ auth, webOrigin: config.WEB_ORIGIN })

serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.log(`API escuchando en http://localhost:${info.port} (${config.NODE_ENV})`)
})
```

- [ ] **Step 6: Ejecutar tests**

```bash
pnpm --filter @dentalware/api test
```
Expected: PASS. Si `sign-in` devuelve 403 por CSRF/origen, confirmar que `WEB_ORIGIN` de `.env.test` está en `trustedOrigins` y que el test envía la cabecera `origin`.

- [ ] **Step 7: Script de seed**

`apps/api/src/scripts/seed.ts`:
```ts
import { eq } from 'drizzle-orm'
import { createAuth } from '../auth.ts'
import { loadConfig } from '../config.ts'
import { createDb } from '../db/index.ts'
import { runMigrations } from '../db/migrate.ts'
import { users } from '../db/schema/index.ts'

const config = loadConfig()
const { db, pool } = createDb(config.DATABASE_URL)
await runMigrations(db)
const auth = createAuth(db, config)

const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, config.ADMIN_EMAIL))
if (existing.length > 0) {
  console.log(`Admin ya existe: ${config.ADMIN_EMAIL}`)
} else {
  const created = await auth.api.signUpEmail({
    body: { email: config.ADMIN_EMAIL, password: config.ADMIN_PASSWORD, name: config.ADMIN_NAME },
  })
  await db.update(users).set({ role: 'admin' }).where(eq(users.id, created.user.id))
  console.log(`Admin creado: ${config.ADMIN_EMAIL}`)
}
await pool.end()
```

```bash
pnpm --filter @dentalware/api seed        # "Admin creado: admin@lab.local"
pnpm --filter @dentalware/api seed        # "Admin ya existe: admin@lab.local"
```

- [ ] **Step 8: Prueba manual del flujo completo**

```bash
pnpm --filter @dentalware/api dev &
curl -s -c /tmp/cj -H 'content-type: application/json' -H 'origin: http://localhost:5173' \
  -d '{"email":"admin@lab.local","password":"Admin12345!"}' localhost:3000/api/auth/sign-in/email | head -c 200; echo
curl -s -b /tmp/cj localhost:3000/api/me      # {"id":"...","name":"Administrador","email":"admin@lab.local","role":"admin"}
kill %1
```

- [ ] **Step 9: Typecheck, lint y commit**

```bash
pnpm --filter @dentalware/api typecheck && pnpm lint
git add apps/api
git commit -m "feat(api): autenticación better-auth, sesión por cookie, guard de roles, /api/me y seed del admin

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi"
```

---

### Task 9: `apps/web` — scaffold Vite + React + Router + Query + Tailwind + shadcn + PWA

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/index.css`, `apps/web/src/vite-env.d.ts`, `apps/web/src/routes/__root.tsx`, `apps/web/src/routes/index.tsx` (temporal), `apps/web/components.json`, `apps/web/src/lib/utils.ts`, `apps/web/public/icon.svg`, `apps/web/scripts/gen-icons.mjs`, iconos PNG generados

**Interfaces:**
- Produces: app web en `http://localhost:5173` con proxy `/api` → `:3000`, alias `@/*`, Tailwind v4 + shadcn (button, input, label, card), PWA instalable (manifest + service worker), TanStack Router file-based con `routeTree.gen.ts`, `QueryClientProvider`.

- [ ] **Step 1: package.json y tsconfig**

Antes, añadir al `catalog` de `pnpm-workspace.yaml` raíz (versiones verificadas en npm el 2026-09-03): `'@fontsource-variable/instrument-sans': 5.3.0` y `'@fontsource-variable/jetbrains-mono': 5.3.0`.

`apps/web/package.json`:
```json
{
  "name": "@dentalware/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "icons": "node scripts/gen-icons.mjs",
    "e2e": "playwright test",
    "e2e:ui": "playwright test --ui"
  },
  "dependencies": {
    "@dentalware/shared": "workspace:*",
    "@hookform/resolvers": "catalog:",
    "@tanstack/react-query": "catalog:",
    "@tanstack/react-router": "catalog:",
    "better-auth": "catalog:",
    "hono": "catalog:",
    "@fontsource-variable/instrument-sans": "catalog:",
    "@fontsource-variable/jetbrains-mono": "catalog:",
    "lucide-react": "catalog:",
    "react": "catalog:",
    "react-dom": "catalog:",
    "react-hook-form": "catalog:",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@dentalware/api": "workspace:*",
    "@playwright/test": "catalog:",
    "@tailwindcss/vite": "catalog:",
    "@tanstack/react-query-devtools": "catalog:",
    "@tanstack/react-router-devtools": "catalog:",
    "@tanstack/router-plugin": "catalog:",
    "@types/node": "catalog:",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "@vitejs/plugin-react": "catalog:",
    "sharp": "catalog:",
    "tailwindcss": "catalog:",
    "tw-animate-css": "catalog:",
    "typescript": "catalog:",
    "vite": "catalog:",
    "vite-plugin-pwa": "catalog:",
    "workbox-window": "catalog:"
  }
}
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "lib": ["es2023", "dom", "dom.iterable"],
    "types": ["vite/client", "vite-plugin-pwa/client"],
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src", "e2e", "vite.config.ts", "playwright.config.ts"]
}
```

- [ ] **Step 2: vite.config.ts con Router, React, Tailwind, PWA, alias y proxy**

```ts
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }), // antes de react()
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg'],
      manifest: {
        name: 'Dentalware',
        short_name: 'Dentalware',
        description: 'Gestión del laboratorio dental',
        lang: 'es',
        theme_color: '#0f766e',
        background_color: '#F4F6F5' // porcelana (--background),
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: false } },
  },
})
```

- [ ] **Step 3: index.html, CSS, main.tsx, rutas mínimas**

`apps/web/index.html`:
```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="description" content="Gestión del laboratorio dental" />
    <meta name="theme-color" content="#0f766e" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Dentalware" />
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
    <title>Dentalware</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`apps/web/src/index.css` (shadcn `init` lo reescribe en el Step 5; esta versión permite arrancar):
```css
@import 'tailwindcss';
@import 'tw-animate-css';
```

`apps/web/src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
```

`apps/web/src/main.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import { routeTree } from './routeTree.gen'

registerSW({ immediate: true })

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
)
```

`apps/web/src/routes/__root.tsx`:
```tsx
import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

export type RouterContext = { queryClient: QueryClient }

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <Outlet />
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
    </>
  ),
})
```

`apps/web/src/routes/index.tsx` (temporal; Task 10 lo mueve a `_app/index.tsx`):
```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: () => <h1 className="p-6 text-2xl font-semibold">Dentalware</h1>,
})
```

- [ ] **Step 4: Iconos PWA**

`scripts/gen-icons.mjs` usa `console`/`process`: añadir en `eslint.config.js` raíz un bloque `{ files: ['**/*.mjs'], languageOptions: { globals: { console: 'readonly', process: 'readonly' } } }`. Añadir `apps/web/.tanstack/` al `.gitignore` raíz (caché del plugin de rutas).

`apps/web/public/icon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0f766e"/>
  <path d="M176 120c-40 0-64 32-64 88 0 72 40 184 72 184 24 0 24-72 72-72s48 72 72 72c32 0 72-112 72-184 0-56-24-88-64-88-32 0-48 24-80 24s-48-24-80-24z" fill="#fff"/>
</svg>
```

`apps/web/scripts/gen-icons.mjs`:
```js
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(import.meta.dirname, '..')
const src = path.join(root, 'public/icon.svg')
const out = path.join(root, 'public')
await mkdir(out, { recursive: true })

const targets = [
  ['pwa-192x192.png', 192],
  ['pwa-512x512.png', 512],
  ['apple-touch-icon.png', 180],
]
for (const [name, size] of targets) {
  await writeFile(path.join(out, name), await sharp(src).resize(size, size).png().toBuffer())
}
await writeFile(path.join(out, 'favicon.ico'), await sharp(src).resize(48, 48).png().toBuffer())
console.log('iconos generados')
```

```bash
pnpm install
pnpm --filter @dentalware/web icons
# Si pnpm bloqueó el postinstall de sharp (`ERR_PNPM_IGNORED_BUILDS`), añadir `sharp: true` a `allowBuilds` en pnpm-workspace.yaml y repetir `pnpm install`.
ls apps/web/public   # icon.svg pwa-192x192.png pwa-512x512.png apple-touch-icon.png favicon.ico
```

- [ ] **Step 5: shadcn/ui init y componentes base**

```bash
cd apps/web
pnpm dlx shadcn@4.19.1 init -y -p nova --base radix --css-variables --no-monorepo --no-rtl --pointer
# shadcn 4.19 pide un preset en lugar del color base: `-p nova` (Lucide). El preset inyecta `shadcn` y `@fontsource-variable/geist`
# en package.json: quitarlos (no aprobados) y reinstalar. `shadcn add` añade `class-variance-authority`, `clsx`, `radix-ui`
# y `tailwind-merge` con rangos `^`: cambiarlos a `catalog:` (versiones en el catalog raíz).
```
Flags no interactivos verificados en la documentación de la CLI (context7, 2026-09-03): `-y` omite confirmaciones, `--base radix` fija la librería de primitivas, `--css-variables` activa tokens CSS, `--no-monorepo`/`--no-rtl` evitan prompts. Si aun así pide el color base, responder `neutral`. El CLI detecta Vite + Tailwind v4, reescribe `src/index.css` con `@import "tailwindcss"`, `@import "tw-animate-css"`, tokens `@theme inline` y crea `src/lib/utils.ts` y `components.json`. Verificar que `components.json` tenga `"css": "src/index.css"`, `"tailwind.config": ""` y `"aliases.components": "@/components"`.

```bash
pnpm dlx shadcn@4.19.1 add button input label card
cd ../..
```
Expected: `src/components/ui/{button,input,label,card}.tsx`.

Aplicar la dirección de diseño (`docs/superpowers/specs/2026-09-01-dentalware-design-direction.md`, §2) en `src/index.css`:
- Sustituir los valores de las variables de `:root` por el bloque de mapeo shadcn de la dirección de diseño (`--background: #F4F6F5`, `--primary: #0F766E`, `--destructive: #D6453D`, `--radius: 0.75rem`, etc.). Dejar `.dark` como lo generó shadcn (tema oscuro fuera del alcance).
- Añadir los tokens propios en `:root`: `--articulating-red: #D6453D; --wax-amber: #D99A16; --ok-green: #2F8F5B; --teal-lab-soft: #D9EFEC;` y exponerlos en `@theme inline` como `--color-articulating-red`, `--color-wax-amber`, `--color-ok-green`, `--color-teal-lab-soft`.
- Importar las fuentes al inicio del archivo: `@import '@fontsource-variable/instrument-sans';` y `@import '@fontsource-variable/jetbrains-mono';` y definir en `@theme inline`: `--font-sans: 'Instrument Sans Variable', system-ui, sans-serif; --font-mono: 'JetBrains Mono Variable', ui-monospace, monospace;`.
- `body` con `@apply bg-background text-foreground font-sans antialiased` y `line-height: 1.45`.

Ahora que `apps/web/src/index.css` existe, añadir en el `.prettierrc` raíz la clave `"tailwindStylesheet": "./apps/web/src/index.css"` (junto a `plugins`) y comprobar `pnpm format:check` en verde.

- [ ] **Step 6: Arrancar y verificar**

```bash
pnpm --filter @dentalware/shared build
pnpm --filter @dentalware/web dev &
curl -s localhost:5173 | grep -o '<title>.*</title>'     # <title>Dentalware</title>
curl -s localhost:5173/api/health                         # proxy → {"ok":true,...} (con la API corriendo)
kill %1
pnpm --filter @dentalware/web build                       # genera dist/ + sw.js + manifest.webmanifest
ls apps/web/dist | grep -E 'sw.js|manifest'               # sw.js manifest.webmanifest
pnpm --filter @dentalware/web typecheck
```
El archivo `src/routeTree.gen.ts` se genera al arrancar `vite`; no editarlo.

- [ ] **Step 7: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): scaffold Vite 8 + React 19 + TanStack Router/Query + Tailwind 4 + shadcn + PWA

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi"
```

---

### Task 10: Web — cliente de auth, login, guard de rutas y layout responsive

**Files:**
- Create: `apps/web/src/lib/auth-client.ts`, `apps/web/src/lib/api.ts`, `apps/web/src/components/app-shell.tsx`, `apps/web/src/routes/login.tsx`, `apps/web/src/routes/_app.tsx`, `apps/web/src/routes/_app/index.tsx`, `apps/web/src/routes/_app/trabajos.tsx`, `apps/web/src/routes/_app/entregas.tsx`, `apps/web/src/routes/_app/cuentas.tsx`, `apps/web/src/routes/_app/configuracion.tsx`
- Delete: `apps/web/src/routes/index.tsx`

**Interfaces:**
- Consumes: `AppType` de `@dentalware/api/app`, `Auth` de `@dentalware/api/auth`, `loginSchema`, `UserRole` de `@dentalware/shared`.
- Produces: `authClient` (better-auth react), `api` (cliente `hc<AppType>`), rutas `/login` y layout `/_app` (protegido) con `Inicio /`, `/trabajos`, `/entregas`, `/cuentas`, `/configuracion` (solo admin/recepcion ven el enlace); `AppShell` con sidebar ≥1024px y barra inferior en móvil; cerrar sesión.

- [ ] **Step 1: Clientes**

`apps/web/src/lib/auth-client.ts`:
```ts
import type { Auth } from '@dentalware/api/auth'
import { inferAdditionalFields } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: window.location.origin,
  basePath: '/api/auth',
  plugins: [inferAdditionalFields<Auth>()],
})

export type SessionData = NonNullable<
  Awaited<ReturnType<typeof authClient.getSession>>['data']
>
```

`apps/web/src/lib/api.ts`:
```ts
import type { AppType } from '@dentalware/api/app'
import { hc } from 'hono/client'

export const api = hc<AppType>(window.location.origin, {
  init: { credentials: 'include' },
})
```

- [ ] **Step 2: AppShell responsive**

Aplicar la dirección de diseño §9 (`docs/superpowers/specs/2026-09-01-dentalware-design-direction.md`) sobre el código de este paso y del Step 3 (login): tokens, pestaña del ticket en la tarjeta de login, estados activo/inactivo de la navegación, iconos lucide, `aria-label` en botones de solo icono, `motion-reduce`. Mantener intactos los `data-testid` (`sidebar`, `bottom-nav`, `api-status`) y las etiquetas "Correo"/"Contraseña" que usa la Tarea 11.

`apps/web/src/components/app-shell.tsx`:
```tsx
import type { UserRole } from '@dentalware/shared'
import { Link, useNavigate } from '@tanstack/react-router'
import { ClipboardList, Home, LogOut, Settings, Truck, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'

type NavItem = { to: string; label: string; icon: typeof Home; roles?: UserRole[] }

const NAV: NavItem[] = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/trabajos', label: 'Trabajos', icon: ClipboardList },
  { to: '/entregas', label: 'Entregas', icon: Truck },
  { to: '/cuentas', label: 'Cuentas', icon: Wallet, roles: ['admin', 'recepcion'] },
  { to: '/configuracion', label: 'Configuración', icon: Settings, roles: ['admin'] },
]

export function AppShell({
  user,
  children,
}: {
  user: { name: string; role: UserRole }
  children: ReactNode
}) {
  const navigate = useNavigate()
  const items = NAV.filter((i) => !i.roles || i.roles.includes(user.role))

  async function logout() {
    await authClient.signOut()
    await navigate({ to: '/login' })
  }

  return (
    <div className="bg-background text-foreground flex min-h-svh">
      {/* Sidebar PC */}
      <aside className="border-border hidden w-60 shrink-0 flex-col border-r lg:flex" data-testid="sidebar">
        <div className="px-5 py-4 text-lg font-semibold">Dentalware</div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {items.map((i) => (
            <Link
              key={i.to}
              to={i.to}
              className="hover:bg-muted flex items-center gap-3 rounded-md px-3 py-2 text-sm"
              activeProps={{ className: 'bg-muted font-medium' }}
              activeOptions={{ exact: i.to === '/' }}
            >
              <i.icon className="size-4" /> {i.label}
            </Link>
          ))}
        </nav>
        <div className="border-border flex items-center justify-between border-t px-4 py-3 text-sm">
          <span className="truncate">{user.name}</span>
          <Button variant="ghost" size="icon" onClick={logout} aria-label="Cerrar sesión">
            <LogOut className="size-4" />
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header móvil */}
        <header className="border-border flex items-center justify-between border-b px-4 py-3 lg:hidden">
          <span className="font-semibold">Dentalware</span>
          <Button variant="ghost" size="icon" onClick={logout} aria-label="Cerrar sesión">
            <LogOut className="size-4" />
          </Button>
        </header>

        <main className="flex-1 p-4 pb-24 lg:p-8 lg:pb-8">{children}</main>

        {/* Barra inferior móvil */}
        <nav
          className="bg-background border-border fixed inset-x-0 bottom-0 flex justify-around border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
          data-testid="bottom-nav"
        >
          {items.map((i) => (
            <Link
              key={i.to}
              to={i.to}
              className="text-muted-foreground flex flex-1 flex-col items-center gap-1 py-2 text-xs"
              activeProps={{ className: 'text-primary font-medium' }}
              activeOptions={{ exact: i.to === '/' }}
            >
              <i.icon className="size-5" />
              {i.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Rutas**

`apps/web/src/routes/login.tsx`:
```tsx
import { loginSchema, type LoginInput } from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth-client'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const { data } = await authClient.getSession()
    if (data) throw redirect({ to: '/' })
  },
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
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
    await navigate({ to: '/' })
  }

  return (
    <div className="bg-muted/40 flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Dentalware</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Correo</Label>
              <Input id="email" type="email" autoComplete="username" {...form.register('email')} />
              {form.formState.errors.email && (
                <p className="text-destructive text-sm">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...form.register('password')}
              />
              {form.formState.errors.password && (
                <p className="text-destructive text-sm">{form.formState.errors.password.message}</p>
              )}
            </div>
            {serverError && <p className="text-destructive text-sm">{serverError}</p>}
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Ingresando…' : 'Ingresar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

`apps/web/src/routes/_app.tsx` (layout protegido):
```tsx
import type { UserRole } from '@dentalware/shared'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { AppShell } from '@/components/app-shell'
import { authClient } from '@/lib/auth-client'

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ location }) => {
    const { data } = await authClient.getSession()
    if (!data) throw redirect({ to: '/login', search: { redirect: location.href } })
    return { user: { ...data.user, role: data.user.role as UserRole } }
  },
  component: () => {
    const { user } = Route.useRouteContext()
    return (
      <AppShell user={user}>
        <Outlet />
      </AppShell>
    )
  },
})
```

`apps/web/src/routes/_app/index.tsx` (Inicio, con comprobación de API vía RPC tipado):
```tsx
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { api } from '@/lib/api'

export const Route = createFileRoute('/_app/')({
  component: () => {
    const { user } = Route.useRouteContext()
    const health = useQuery({
      queryKey: ['health'],
      queryFn: async () => {
        const res = await api.api.health.$get()
        return res.json()
      },
    })
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Inicio</h1>
        <p className="text-muted-foreground">
          Hola, {user.name} ({user.role}).
        </p>
        <p className="text-sm" data-testid="api-status">
          API: {health.isPending ? 'comprobando…' : health.data?.ok ? 'conectada' : 'sin conexión'}
        </p>
      </div>
    )
  },
})
```

Las cuatro rutas restantes son idénticas salvo el título; crear cada una (`trabajos.tsx`, `entregas.tsx`, `cuentas.tsx`, `configuracion.tsx`) con su ruta y título correspondiente:
```tsx
// apps/web/src/routes/_app/trabajos.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/trabajos')({
  component: () => <h1 className="text-2xl font-semibold">Trabajos</h1>,
})
```
```tsx
// apps/web/src/routes/_app/entregas.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/entregas')({
  component: () => <h1 className="text-2xl font-semibold">Entregas</h1>,
})
```
```tsx
// apps/web/src/routes/_app/cuentas.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/cuentas')({
  component: () => <h1 className="text-2xl font-semibold">Cuentas</h1>,
})
```
```tsx
// apps/web/src/routes/_app/configuracion.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/configuracion')({
  component: () => <h1 className="text-2xl font-semibold">Configuración</h1>,
})
```

Eliminar `apps/web/src/routes/index.tsx` (la raíz ahora vive en `_app/index.tsx`).

- [ ] **Step 4: Construir la API (para los tipos) y verificar**

```bash
pnpm --filter @dentalware/api build          # genera dist/app.d.ts y dist/auth.d.ts
pnpm --filter @dentalware/web typecheck      # sin errores; `api.api.health.$get` tipado
pnpm lint
```
Arranque manual:
```bash
pnpm dev &
# Navegador: http://localhost:5173 → redirige a /login → admin@lab.local / Admin12345! → Inicio con "API: conectada"
# Redimensionar < 1024px: aparece la barra inferior; ≥ 1024px: sidebar.
kill %1
```

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): login con better-auth, rutas protegidas y layout responsive con navegación por rol

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi"
```

---

### Task 11: E2E con Playwright (escritorio, Android, iPhone)

**Files:**
- Create: `apps/web/playwright.config.ts`, `apps/web/e2e/login.spec.ts`
- Modify: `.gitignore` (añadir `apps/web/dev-dist/`)

**Interfaces:**
- Consumes: seed del admin (`ADMIN_EMAIL`/`ADMIN_PASSWORD` de `apps/api/.env`), rutas `/login`, `/`.
- Produces: `pnpm e2e` levanta API y web y ejecuta el flujo de login en 3 dispositivos.

- [ ] **Step 1: Instalar navegadores**

```bash
pnpm --filter @dentalware/web exec playwright install chromium webkit
# En la máquina de desarrollo (Arch Linux) `--with-deps` no aplica (usa apt); las dependencias del sistema ya están o se instalan con pacman.
# En CI (Ubuntu, Tarea 13) sí se usa `--with-deps`. En Arch el WebKit de Playwright (compilado contra Ubuntu 24.04) no arranca
# sin libicu74/libflite1: correr localmente `--project=escritorio --project=android`; el proyecto `iphone` lo cubre CI.
```

- [ ] **Step 2: Configuración**

`apps/web/playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' },
  webServer: [
    {
      // NODE_ENV=test: desactiva el rate limit fijo de better-auth (3 req/10 s en sign-in) que los 3 proyectos compartirían
      command: 'NODE_ENV=test pnpm --filter @dentalware/api seed && NODE_ENV=test pnpm --filter @dentalware/api dev',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      cwd: '../..',
    },
    {
      command: 'pnpm --filter @dentalware/shared build && pnpm --filter @dentalware/web dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      cwd: '../..',
    },
  ],
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
    { name: 'android', use: { ...devices['Pixel 7'] } },
    { name: 'iphone', use: { ...devices['iPhone 14'] } },
  ],
})
```

- [ ] **Step 3: Test (falla hasta que exista la config; con la app ya hecha debe pasar)**

`apps/web/e2e/login.spec.ts`:
```ts
import { expect, test } from '@playwright/test'

const EMAIL = process.env.ADMIN_EMAIL ?? 'admin@lab.local'
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin12345!'

test('redirige a /login sin sesión', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'Dentalware' })).toBeVisible()
})

test('muestra errores de validación en español', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Correo').fill('no-es-email')
  await page.getByLabel('Contraseña').fill('123')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByText('Correo inválido')).toBeVisible()
  await expect(page.getByText('La contraseña debe tener al menos 8 caracteres')).toBeVisible()
})

test('inicia sesión y ve el inicio con la API conectada', async ({ page, isMobile }) => {
  await page.goto('/login')
  await page.getByLabel('Correo').fill(EMAIL)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible()
  await expect(page.getByTestId('api-status')).toHaveText('API: conectada')

  if (isMobile) {
    await expect(page.getByTestId('bottom-nav')).toBeVisible()
    await expect(page.getByTestId('sidebar')).toBeHidden()
  } else {
    await expect(page.getByTestId('sidebar')).toBeVisible()
    await expect(page.getByTestId('bottom-nav')).toBeHidden()
  }

  await page.getByRole('link', { name: 'Trabajos' }).first().click()
  await expect(page.getByRole('heading', { name: 'Trabajos' })).toBeVisible()
})

test('cierra sesión', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Correo').fill(EMAIL)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL('/')
  await page.getByRole('button', { name: 'Cerrar sesión' }).first().click()
  await expect(page).toHaveURL(/\/login/)
})
```

- [ ] **Step 4: Ejecutar**

```bash
pnpm db:up
pnpm e2e
```
Expected: 12 tests (4 × 3 proyectos) PASS. Si en `iphone` (WebKit) falla el `getByLabel`, comprobar que `Label` de shadcn renderiza `htmlFor` y que los ids coinciden.

- [ ] **Step 5: Commit**

```bash
echo "apps/web/dev-dist/" >> .gitignore
git add apps/web/playwright.config.ts apps/web/e2e .gitignore
git commit -m "test(web): E2E de login y navegación en escritorio, Android e iPhone con Playwright

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi"
```

---

### Task 12: Docker de producción (Caddy + API + Postgres) y backup

**Files:**
- Create: `infra/api.Dockerfile`, `infra/web.Dockerfile`, `infra/Caddyfile`, `infra/docker-compose.yml`, `infra/.env.example`, `infra/backup.sh`, `.dockerignore`

**Interfaces:**
- Consumes: `pnpm -r build`, `node apps/api/dist/main.js` (aplica migraciones al arrancar), `apps/web/dist`.
- Produces: `docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build` sirve la app en `https://$DOMAIN` (o `http://localhost` en pruebas locales).

- [ ] **Step 1: `.dockerignore` (raíz)**

```
node_modules
**/node_modules
**/dist
**/coverage
**/playwright-report
**/test-results
.git
docs
infra/data
*.md
```

- [ ] **Step 2: Dockerfile de la API**

`infra/api.Dockerfile`:
```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true HUSKY=0
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @dentalware/api... 
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @dentalware/api... build
RUN pnpm --filter @dentalware/api... prune --prod

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
RUN mkdir -p /data/uploads && chown -R node:node /data /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "apps/api/dist/main.js"]
```

- [ ] **Step 3: Dockerfile de la web y Caddyfile**

`infra/web.Dockerfile`:
```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true HUSKY=0
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @dentalware/web...
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY apps/web apps/web
RUN pnpm --filter @dentalware/web... build

FROM caddy:2-alpine
COPY infra/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv
```

`infra/Caddyfile`:
```caddyfile
{$SITE_ADDRESS}

encode zstd gzip

handle /api/* {
	reverse_proxy api:3000
}

handle {
	root * /srv
	try_files {path} /index.html
	file_server
}

# El shell y el service worker nunca se cachean; los assets con hash sí.
@nocache path /index.html /sw.js /manifest.webmanifest /registerSW.js
header @nocache Cache-Control "no-cache"
header /assets/* Cache-Control "public, max-age=31536000, immutable"
```

- [ ] **Step 4: docker-compose de producción y env**

`infra/docker-compose.yml`:
```yaml
services:
  caddy:
    build: { context: .., dockerfile: infra/web.Dockerfile }
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
    environment:
      SITE_ADDRESS: ${SITE_ADDRESS}
    volumes:
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      api:
        condition: service_healthy

  api:
    build: { context: .., dockerfile: infra/api.Dockerfile }
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
      BETTER_AUTH_URL: ${PUBLIC_URL}
      WEB_ORIGIN: ${PUBLIC_URL}
      ADMIN_EMAIL: ${ADMIN_EMAIL}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD}
      ADMIN_NAME: ${ADMIN_NAME}
      UPLOAD_DIR: /data/uploads
    volumes:
      - uploads:/data/uploads
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}']
      interval: 10s
      timeout: 5s
      retries: 10

volumes:
  pgdata:
  uploads:
  caddy_data:
  caddy_config:
```

`infra/.env.example`:
```
# Dominio público. En el VPS: lab.midominio.com (Caddy obtiene TLS solo).
# Para probar en local: SITE_ADDRESS=:80 y PUBLIC_URL=http://localhost (el compose solo publica 80/443)
SITE_ADDRESS=lab.midominio.com
PUBLIC_URL=https://lab.midominio.com

POSTGRES_USER=dentalware
POSTGRES_PASSWORD=cambia-esta-clave
POSTGRES_DB=dentalware

BETTER_AUTH_SECRET=genera-32-o-mas-caracteres-aleatorios-con-openssl-rand-base64-32

ADMIN_EMAIL=admin@lab.local
ADMIN_PASSWORD=cambia-esta-clave-tambien
ADMIN_NAME=Administrador
```

`infra/backup.sh`:
```bash
#!/usr/bin/env bash
# Backup diario: dump de Postgres + tar de uploads, retención 14 días.
# Uso (cron en el VPS): 0 3 * * * /opt/dentalware/infra/backup.sh >> /var/log/dentalware-backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")"
set -a; source ./.env; set +a
DEST=${BACKUP_DIR:-/opt/dentalware-backups}
STAMP=$(date +%F_%H%M)
mkdir -p "$DEST"
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$DEST/db_$STAMP.dump"
docker run --rm -v dentalware_uploads:/data:ro -v "$DEST":/backup alpine \
  tar czf "/backup/uploads_$STAMP.tgz" -C /data .
find "$DEST" -type f -mtime +14 -delete
echo "$(date -Is) backup ok: db_$STAMP.dump uploads_$STAMP.tgz"
```
```bash
chmod +x infra/backup.sh
```
Nota: el volumen se llama `dentalware_uploads` porque el proyecto compose se llama `dentalware` (carpeta padre); si se despliega desde otra carpeta, ajustar el nombre o pasar `-p dentalware`.

- [ ] **Step 5: Prueba local del stack de producción**

```bash
cp infra/.env.example infra/.env
sed -i 's|^SITE_ADDRESS=.*|SITE_ADDRESS=:80|; s|^PUBLIC_URL=.*|PUBLIC_URL=http://localhost|' infra/.env
sed -i 's|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET='"$(openssl rand -base64 32)"'|' infra/.env
docker compose -p dentalware -f infra/docker-compose.yml --env-file infra/.env up -d --build
sleep 10
curl -s localhost/api/health                      # {"ok":true,...}
curl -s localhost | grep -o '<title>.*</title>'        # <title>Dentalware</title>
docker compose -p dentalware -f infra/docker-compose.yml --env-file infra/.env exec api node -e "console.log('ok')"
docker compose -p dentalware -f infra/docker-compose.yml --env-file infra/.env run --rm api node apps/api/dist/scripts/seed.js   # Admin creado
# Navegador: http://localhost → login con ADMIN_EMAIL/ADMIN_PASSWORD de infra/.env
docker compose -p dentalware -f infra/docker-compose.yml --env-file infra/.env down
```
Si la imagen de la API falla en `prune --prod` por el flag `--filter`, ejecutar `pnpm prune --prod` sin filtro en su lugar.

- [ ] **Step 6: Commit**

```bash
git add infra .dockerignore
git commit -m "chore(infra): Docker Compose de producción con Caddy, API y Postgres, y script de backup

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi"
```

---

### Task 13: CI en GitHub Actions y hooks de pre-commit

**Files:**
- Create: `.github/workflows/ci.yml`, `.husky/pre-commit`

**Interfaces:**
- Produces: en cada push/PR se ejecutan lint, typecheck, tests unitarios/API (con Postgres) y E2E (chromium); pre-commit local corre lint-staged + typecheck.

- [ ] **Step 1: Husky**

```bash
pnpm exec husky init
```
Reemplazar el contenido de `.husky/pre-commit` por:
```sh
pnpm lint-staged
pnpm typecheck
```

- [ ] **Step 2: Workflow**

`.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  quality:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: dentalware
          POSTGRES_PASSWORD: dentalware
          POSTGRES_DB: dentalware_test
        ports: ['5433:5432']
        options: >-
          --health-cmd "pg_isready -U dentalware -d dentalware_test"
          --health-interval 5s --health-timeout 3s --health-retries 10
    env:
      HUSKY: 0
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm lint
      - run: pnpm format:check
      - run: pnpm typecheck
      - run: pnpm test

  e2e:
    runs-on: ubuntu-latest
    needs: quality
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: dentalware
          POSTGRES_PASSWORD: dentalware
          POSTGRES_DB: dentalware
        ports: ['5433:5432']
        options: >-
          --health-cmd "pg_isready -U dentalware -d dentalware"
          --health-interval 5s --health-timeout 3s --health-retries 10
    env:
      HUSKY: 0
      CI: true
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: cp apps/api/.env.example apps/api/.env
      - run: pnpm --filter @dentalware/web exec playwright install --with-deps chromium webkit
      - run: pnpm --filter @dentalware/web exec playwright test   # los 3 proyectos; WebKit (iphone) solo corre fiable en Ubuntu/CI
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: apps/web/playwright-report
```

- [ ] **Step 3: Verificar localmente lo que corre el CI**

```bash
pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
```
Expected: todo verde. Si `format:check` falla, ejecutar `pnpm format` y revisar el diff.

- [ ] **Step 4: Commit (el hook de pre-commit debe ejecutarse solo)**

```bash
git add .github .husky package.json
git commit -m "chore: CI con lint, typecheck, tests y E2E; hooks de pre-commit con husky y lint-staged

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi"
```
Expected: en la salida aparecen `lint-staged` y `tsc` antes de crear el commit.

---

### Task 14: Cierre de la iteración — verificación completa y documentación

**Files:**
- Modify: `README.md` (sección Despliegue), `docs/superpowers/plans/2026-09-01-iteracion-0-fundacion.md` (marcar checkboxes)

- [ ] **Step 1: Ejecutar la verificación end-to-end de la iteración**

```bash
pnpm db:up
pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm e2e
```
Expected: todos los comandos en verde; `pnpm test` muestra proyectos `shared` y `api`; `pnpm e2e` 12 pruebas en 3 dispositivos.

- [ ] **Step 2: Prueba manual en un celular real**

Con `pnpm dev` corriendo y el celular en la misma red Wi-Fi: abrir `http://<IP-del-PC>:5173` (añadir `server.host: true` en `vite.config.ts` si Vite no expone la red; quitarlo después o dejarlo, es solo dev). Verificar: login, barra inferior, "API: conectada". La instalación como PWA (Añadir a pantalla de inicio) requiere HTTPS o `localhost`, así que se valida en el VPS en la Iteración 6.

- [ ] **Step 3: Documentar despliegue en el README**

Añadir al final de `README.md`:
```markdown
## Despliegue (VPS con Docker)
```bash
git clone <repo> /opt/dentalware && cd /opt/dentalware
cp infra/.env.example infra/.env   # editar dominio, claves y admin
docker compose -p dentalware -f infra/docker-compose.yml --env-file infra/.env up -d --build
docker compose -p dentalware -f infra/docker-compose.yml --env-file infra/.env run --rm api node apps/api/dist/scripts/seed.js
```
Caddy obtiene el certificado TLS automáticamente para `SITE_ADDRESS`. Backups: `infra/backup.sh` en cron diario.
Actualizar: `git pull && docker compose -p dentalware -f infra/docker-compose.yml --env-file infra/.env up -d --build`.
```

- [ ] **Step 4: Commit final**

```bash
git add README.md docs/superpowers/plans/2026-09-01-iteracion-0-fundacion.md
git commit -m "docs: instrucciones de despliegue y cierre de la iteración 0

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hohj4e8tVRUyqcq6t4DYSi"
```

---

## Self-review (hecho al redactar)

- **Cobertura del spec para la Iteración 0**: monorepo + tooling (T1), `shared` con enums/FDI/máquina de estados/días hábiles/código con tests (T2-T5), API con auth y roles (T6-T8), web con layout responsive + PWA (T9-T10), docker-compose local (T6) y de producción (T12), E2E (T11), CI (T13). Fuera de esta iteración, a propósito: catálogos, trabajos, entregas, cuentas, subida de archivos (`UPLOAD_DIR` ya se pasa al contenedor para la Iteración 2), `sharp` para miniaturas y `qrcode` (Iteración 3).
- **Consistencia de nombres**: `createApp({ auth })`, `AppType`, `AppEnv`, `sessionMiddleware(auth)`, `requireAuth`, `requireRole`, `createDb`, `runMigrations`, `createAuth`, `Auth`, `SessionUser`, `setupTestDb`, `truncateAll`, `createUser`, `loginAs`, `USER_ROLES`, `loginSchema` se usan con la misma firma en todas las tareas.
- **Riesgos conocidos y su mitigación**: (1) la salida exacta de `@better-auth/cli generate` puede diferir en nombres de índices → se acepta la generada y se regenera la migración; (2) `pnpm prune --prod --filter` puede no estar soportado → alternativa indicada en T12; (3) si `iPhone 14` (WebKit) falla en `getByLabel`, revisar `htmlFor`; (4) cualquier cambio de versión pasa por context7 antes de editar el catálogo.
