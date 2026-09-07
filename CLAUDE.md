# Dentalware — reglas del proyecto

Gestión de laboratorio dental (Arte Dental, Ecuador). Monorepo pnpm: `packages/shared` (zod, enums, máquina de estados), `apps/api` (Hono + Drizzle + Postgres + Better Auth), `apps/web` (React 19 + Vite + TanStack Router/Query + Tailwind 4 + shadcn). Spec: `docs/superpowers/specs/2026-09-01-dentalware-mvp-design.md`. Planes por iteración en `docs/superpowers/plans/`.

## Reglas de trabajo (pedidas por Nelson)

1. **TDD siempre.** Antes de empezar cualquier feature o fix, invocar la skill `superpowers:test-driven-development` y trabajar RED → GREEN → refactor. Ninguna tarea se cierra sin su prueba; el código sin test es un hallazgo _Important_ en revisión. El software debe quedar probado en todas las capas (unit shared/api/web + E2E Playwright). Épica de pruebas en GitHub: ver etiqueta `epic`.
2. **context7 antes de instalar o usar una librería** para confirmar versión y API vigente. Versiones fijadas en el `catalog:` de `pnpm-workspace.yaml`.
3. **Organización por features.** `apps/api/src/features/<feature>/{schema,repo,routes,*.test}.ts` y `apps/web/src/features/<feature>/{api.ts,use-*.ts,*-form.tsx,*-table.tsx}`; componentes transversales en `apps/web/src/components/`. Un componente o hook por archivo; las rutas (`routes/`) solo importan de `features/` y `components/`.
4. **UI con `frontend-design`** y verificada en Chrome DevTools (1280×800 y 390×844: flujo, capturas, consola sin errores) antes de cerrar la tarea.
5. **Español** en UI, mensajes de validación, commits y documentación; sentence case.
6. **Revisión UI/UX al cerrar cada iteración.** La tarea de cierre de cada plan crea un issue «Revisión UI/UX de la Iteración N con frontend-design» (historia, area:web, hito de la iteración siguiente) con checklist: recorrer todas las pantallas nuevas a 1280×800, 390×844 y 360 px con `frontend-design`, comprobar jerarquía visual y consistencia con la dirección de diseño, responsividad, usabilidad y accesibilidad (44 px, foco, teclado, contraste AA) y que sea fácil de entender para recepción, técnicos y mensajero; los hallazgos se corrigen en una ola de fixes antes de construir encima. Primer issue: #49.

## Entorno

- Node 24 obligatorio en cada shell: `export PATH=$HOME/.nvm/versions/node/v24.19.0/bin:$PATH`.
- Postgres de desarrollo en Docker, puerto 5433 (`pnpm db:up`); BD de tests `dentalware_test` en el mismo servidor.
- Verificación completa: `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`; E2E: `pnpm e2e --project=escritorio --project=android` (iphone solo en CI; con `--` de más, pnpm 11 lo reenvía y corren los 3 proyectos). Playwright arranca la API con `NODE_ENV=test`; deja libres los puertos 3000 y 5173 antes de correrlo.

## Git y seguimiento

- Commits pequeños en español con prefijo convencional y `Refs #N`; trailers `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` y `Claude-Session: <url de la sesión>`. El hook de pre-commit corre lint-staged y typecheck.
- Seguimiento en GitHub: hitos por iteración, épicas con sub-issues, tablero Kanban (Backlog · Por hacer · En progreso · En revisión · Hecho). Mover el issue al empezar, al abrir PR y al mergear.
