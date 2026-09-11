# Convenciones de código y buenas prácticas — Dentalware

Documento de referencia para cualquier persona o agente que toque el repo. Complementa `CLAUDE.md` (reglas de trabajo) y `docs/architecture.md` (arquitectura y decisiones). Si una convención nueva se decide en una revisión o ruling, se anota aquí en el mismo PR.

## 1. Idioma, copy y nombres

- **Español** en UI, mensajes de validación y error, comentarios, commits, issues y docs. Sentence case («Nuevo trabajo», no «Nuevo Trabajo»). Términos del dominio como los usa el laboratorio: trabajo (no caso), clínica, doctor, pieza (diente FDI), fase, técnico, mensajero, recepción.
- **Código en inglés técnico** para identificadores (`caseInputSchema`, `createCase`, `useCases`) salvo términos de dominio sin traducción clara (`odontogram`, `fdi`, `remake`). Rutas HTTP y de la web en español (`/api/trabajos`, `/trabajos/nuevo`, `/configuracion`).
- Archivos en `kebab-case` (`case-items-editor.tsx`, `use-cases.ts`); componentes React en `PascalCase`; hooks `useX`; constantes de dominio en `SCREAMING_SNAKE_CASE` (`CASE_STATUSES`, `CASE_PAGE_SIZE`); tipos e interfaces en `PascalCase` sin prefijo `I`.
- Un componente o hook por archivo. Los tests viven junto al código: `x.test.ts(x)`.

## 2. TypeScript y tooling

- `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax` (usar `import type`), `erasableSyntaxOnly` en `packages/shared`: **sin `enum`, sin parameter properties, sin namespaces**; usar `as const` + tipos derivados.
- Nunca `any`; `unknown` + narrowing. Nada de `!` no-null salvo justificado con comentario. Preferir tipos inferidos de zod (`z.input` / `z.output`) y de Drizzle (`typeof table.$inferSelect`).
- Imports relativos con extensión `.ts` en `packages/shared` (ESM `nodenext`); alias `@/` en `apps/web`; en `apps/api` imports relativos.
- Prettier: sin punto y coma, comillas simples, `printWidth` 100, plugin de Tailwind (ordena clases). ESLint 10 sin warnings: `pnpm lint` debe salir limpio; `no-unused-vars` se resuelve borrando, no con `_` decorativo salvo parámetros obligatorios.
- Versiones fijadas en el `catalog:` de `pnpm-workspace.yaml`; antes de añadir o usar una API de librería, **context7** (regla 2 de `CLAUDE.md`). Node 24 en cada shell.

## 3. Estructura por features

- `packages/shared/src/`: dominio puro (sin I/O): `schemas/*.ts` (zod + tipos), `case-status.ts` (máquina de estados), `money.ts`, `fdi.ts`, `business-days.ts`, `case-code.ts`, `case-readiness.ts`, `case-events.ts`, `csv.ts`, `roles.ts`. Todo se exporta desde `index.ts`.
- `apps/api/src/features/<feature>/`: `ports.ts` (interfaces que consume el caso de uso: repositorios, `Storage`, `Clock`, `IdGenerator`, `UnitOfWork`, puertos de otras features), `service.ts` (casos de uso: orquesta reglas de `shared` y puertos; **sin Hono, sin Drizzle, sin `process.env`**), `errors.ts` (errores de dominio), `repo.ts` (adaptador Drizzle, `createXRepo(db) satisfies XRepository`), `schema.ts` (tablas Drizzle, la importa `repo.ts`; ver excepciones abajo), `routes.ts` (adaptador HTTP), `fakes.ts` (implementaciones en memoria de los puertos, usadas por `*.test.ts`), `*.test.ts`. Transversales en `lib/` (`validate`, `storage`, `images`), `db/` (conexión, relaciones, migraciones, `reset`), `scripts/` (seed, reset-test-db), `test/` (setup). `app.ts` es la raíz de composición (`createApp({ auth, db, webOrigin, storage, clock?, ids? })`): construye adaptadores, arma servicios por factoría y monta rutas; `main.ts` solo arranca.
- `ports.ts` + `service.ts` son **obligatorios en features nuevas**. Un CRUD simple (un solo repositorio, sin transacción, sin enmascarado por rol, sin reglas) puede omitir `service.ts` y llamar al repo desde la ruta; en cuanto gana la primera regla, se le crea el servicio en ese mismo PR. Las features existentes se migran cuando se las toca (boy-scout), no en un big-bang: ver el plan por feature en `docs/architecture.md` §3.4–§3.6.
- `apps/web/src/features/<feature>/`: `api.ts` (puerto/adaptador HTTP: cliente `hc` tipado; **única frontera con la red**), `use-*.ts` (capa de aplicación con TanStack Query), `*-form.tsx`, `*-table.tsx`, componentes de la feature y sus tests. Transversales en `components/` (y primitivas shadcn en `components/ui/`), utilidades en `lib/`, harness de pruebas en `test/`. `routes/` (TanStack Router file-based) **solo importa de `features/` y `components/`** y no contiene lógica de negocio. Nada de `fetch` ni `hc` fuera de `api.ts`; `authClient` (Better Auth) solo dentro de `features/auth/` (`auth-client.ts`), consumido por el resto de la web a través de `getSession()`/`signIn()`/`signOut()` (`session.ts`) o del hook `useSession()` (`use-session.ts`).
- Una feature no importa el `repo`, el `schema` ni las `routes` de otra: declara lo que necesita como **puerto en su propio `ports.ts`** y la raíz de composición le inyecta la implementación de la otra feature (ver `docs/architecture.md` §2 y §3.5). Tres excepciones acotadas: el `repo.ts` de una feature puede importar el `schema.ts` de otra para joins y lecturas de solo lectura (ADR 24, p. ej. `cases/import.repo.ts` lee `clinics`/`doctors`/`products`); `ports.ts` puede importar (solo con `import type`) su propio `schema.ts` para derivar tipos de fila (ADR 25), nunca de `repo.ts`; y `errors.ts` puede reexportar una clase de error de dominio de otra feature, nunca un adaptador (ADR 26, p. ej. `attachments/errors.ts` reexporta `CaseNotFoundError` de `cases/errors.ts`).

## 4. API (Hono + Drizzle + Postgres)

- `routes.ts` solo valida, autoriza, traduce errores de dominio a códigos HTTP y serializa: **en una feature nueva no aparece `db.` ni `drizzle-orm` dentro de la ruta**; los datos llegan por el servicio (o por el repo, en el CRUD simple de §3). El contexto de sesión viaja al servicio como `RequestContext { userId, role }` construido desde `c.var.user`; el servicio nunca recibe el `Context` de Hono.
- Servicios: factorías con dependencias explícitas (`createCasesService({ cases, storage, clock })`), sin contenedor de DI ni decoradores. Toda dependencia oculta se convierte en puerto: reloj (`Clock.today()`), generación de identificadores, disco, red. **Cada servicio se prueba con fakes en memoria** (sin Postgres ni HTTP) además de la prueba de integración de sus rutas; si un caso de uso no se puede probar sin Postgres, hay un adaptador dentro de la lógica.
- Validación con `validate('json' | 'query' | 'param', schema)` usando los schemas de `@dentalware/shared`. Respuesta de validación: **422** `{ message: 'Datos inválidos', issues: [{ path, message }] }`.
- Errores: lanzar `HTTPException` con mensaje en español; el `onError` global responde `{ message }`. **403** tanto sin sesión como con rol incorrecto (`requireAuth`, `requireRole('admin', 'recepcion')`); 404 `{ message: 'No encontrado' }`; 409 para transiciones de estado inválidas; 413/415 en subidas. Códigos explícitos en `c.json(x, 200)`.
- Escrituras solo para `admin | recepcion` salvo acciones propias del rol (técnico comenta, sube fotos y cambia fase; mensajero marca entregas). **Técnico y mensajero nunca reciben precios ni notas internas**: el enmascarado (`stripPrices`/`maskPriceEvents`) es decisión del **servicio** (en features no migradas, del `repo`/rutas), nunca solo de la UI; la lista devuelve `total: null`.
- Dinero: se guarda y transporta como cadena decimal `"12.34"`; los cálculos usan centavos enteros (`money.ts`: `toCents`, `fromCents`, `lineTotalCents`, `sumCents`). Fechas de negocio como `YYYY-MM-DD` (`isoDate`), timestamps en UTC; el cliente formatea (`date-format.ts`).
- Toda mutación de un trabajo escribe su `case_event` **en la misma transacción**. El puerto `UnitOfWork.run(fn)` con `createXRepo(db | tx)` (ADR 19) es el único patrón vigente: el par `xTx(tx, …)`/`x(db, …)` (`createCaseTx`/`createCase`) que existía antes de migrar `cases` desapareció (ver `docs/architecture.md` §3.6); una feature nueva o recién migrada no lo reintroduce. Nunca abrir `db.transaction` dentro de otra.
- Catálogos con borrado lógico (`active`); los trabajos nunca se borran, se cancelan. Código de trabajo `AA-NNNNN` por secuencia anual con `FOR UPDATE`.
- Subidas: `bodyLimit` antes de `parseBody`, MIME real por magic bytes (imágenes con `sharp`, PDF `%PDF-`), nombre de disco = UUID (el nombre original nunca forma la ruta), servidas solo con sesión. El driver se elige por la interfaz `Storage` (`LocalStorage` hoy).
- Configuración: `loadConfig` valida con zod y carga `.env` o `.env.test` según `NODE_ENV`; nada de `process.env` suelto fuera de `config.ts`. Las claves de integraciones externas (p. ej. `RESEND_API_KEY` y el remitente de correo en la Iteración 6) se declaran allí y llegan al adaptador por la raíz de composición, nunca al servicio.
- Migraciones con drizzle-kit versionadas en `apps/api/drizzle/`; las columnas de iteraciones futuras se crean ya como `nullable` para no repetir migraciones; seed idempotente en `scripts/seed.ts` con datos en `seed-data.ts` (probados).

## 5. Web (React 19 + TanStack + Tailwind 4 + shadcn)

- Estado de servidor solo con TanStack Query: claves centralizadas en `lib/query-keys.ts`; cada mutación invalida las claves que corresponden (lista, detalle, eventos, adjuntos). Sin estado global propio; el estado de UI local en el componente o en la URL.
- Cliente HTTP `hc<AppType>` en `features/<f>/api.ts` + `throwIfNotOk` → `ApiError { status, message, issues }`; errores al usuario con `toastApiError` **una sola vez** por acción (o en el hook o en el handler, no en ambos). Endpoints sin validador de `form` usan `fetch` mismo origen con `credentials: 'include'`, documentado en el archivo. Identidad: `authClient` (Better Auth) solo dentro de `features/auth/` (`auth-client.ts`); el resto de la web lo consume por `getSession()`/`signIn()`/`signOut()` (`session.ts`) o el hook `useSession()` (`use-session.ts`) — ver también §3.
- Formularios: react-hook-form con `zodResolver` y los tres genéricos `useForm<z.input<S>, unknown, z.output<S>>`; los campos vacíos viajan como `''` y el schema los normaliza a `null`; mensajes de error bajo el campo con `aria-invalid`; botón primario al pie y a ancho completo en móvil.
- Rutas: `beforeLoad` para sesión y rol (redirigir, nunca renderizar y luego ocultar); `validateSearch` tolerante (`schema.partial().catch({})`); la lista de trabajos guarda vista, filtros y página en la URL.
- Primitivas `components/ui/*` con objetivo táctil de **44 px** por defecto (`Button`, `Select`, `Input`, `Tabs`, `Switch` 24×44); `sm`/`icon-sm` de 36 px solo en tablas densas de escritorio con `pointer-coarse:` a 44. Chips con texto (nunca solo color); código y montos en monoespaciada; pestaña de color del ticket en cabeceras.
- Responsive: una sola UI; tabla en ≥ `lg`, tarjetas en móvil (`useMediaQuery`, una variante montada a la vez); sin scroll horizontal de página en 1280 / 390 / 360 (`overflow-x-auto` + `min-w-0` en el contenedor que debe encoger).
- Accesibilidad: `h1` por página, labels visibles o `aria-label`, `aria-pressed` en toggles (odontograma), foco visible, teclado en diálogos y selects, contraste AA (test `theme-tokens.test.ts`), `alt` en imágenes, `inputmode` en numéricos.
- Imágenes: compresión en cliente (≤ 1600 px) antes de subir; `loading="lazy"` en miniaturas; `URL.createObjectURL` siempre revocado.

## 6. Shared (contratos)

- Los schemas zod de `packages/shared` son la **única fuente de verdad** de los DTOs: los usa la API para validar y la web para tipar formularios. Mensajes en español dentro del schema (`{ error: '…' }`). Helpers reutilizables: `textoOpcional(max)`, `uuid`, `isoDate` (valida fecha real), `priceString`, `fdiTeethSchema`.
- Constantes de dominio (`CASE_STATUSES`, `EDITABLE_CASE_STATUSES`, `CASE_EVENT_TYPES`, `ATTACHMENT_KINDS`, `IMPORT_COLUMNS`) viven aquí y se derivan sus tipos; api y web no duplican listas ni tipos de respuesta (`ImportReport` viene de shared).
- Sin dependencias de runtime salvo `zod`; nada de I/O.

## 7. Pruebas (TDD obligatorio)

- Ciclo RED → GREEN → refactor en cada tarea; una tarea sin prueba es un hallazgo _Important_ en revisión. Prueba primero lo que el hallazgo o la historia describen, con el nombre del test en español describiendo el comportamiento («al editar conserva el precio guardado hasta que se cambia de clínica»).
- Vitest con proyectos `shared`, `api`, `web`. API contra Postgres real (`dentalware_test`, `truncateAll` en `beforeEach`, `createApp` con `storage` temporal), login por rol en cada test que dependa de permisos (probar 403 sin sesión y con rol incorrecto). Web con jsdom y Testing Library: `renderWithProviders`, `renderWithRouter`, `setMatchMedia`; consultas por rol y etiqueta; `findBy*` para lo asíncrono; mocks solo de `api.ts` (nunca de hooks internos).
- E2E Playwright (`apps/web/e2e`): proyectos `escritorio` y `android` en local (`pnpm e2e --project=escritorio --project=android`), `iphone` solo en CI; datos únicos por ejecución creados por API en `helpers.ts`; selectores por rol/label; sin `waitForTimeout`; `login()` espera a que cargue «Inicio». Los E2E usan `.env.test` y `reset-test-db` limpia `dentalware_test` antes del seed; puertos 3000/5173 libres antes de correrlos.
- `accesibilidad.spec.ts` barre tamaños táctiles en móvil: toda pantalla nueva se añade ahí.
- Los revisores no ejecutan tests de BD ni E2E mientras haya un implementador activo (BD compartida).

## 8. Git, revisión y proceso

- Ramas `feat/iteracion-N-…`, `fix/…`; commits pequeños con prefijo convencional en español (`feat(web): …`, `fix(api): …`, `test(web): …`, `docs: …`, `refactor(shared): …`) y `Refs #N`; trailers `Co-Authored-By` y `Claude-Session`. Pre-commit: lint-staged + typecheck; nunca `--no-verify`.
- Verificación antes de cada commit: `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`; E2E al cerrar la tarea que los toque; verificación en Chrome DevTools de toda tarea de UI (1280×800, 390×844 y 360×740, consola limpia, capturas en el reporte).
- Proceso por plan (SDD): un implementador a la vez, brief por tarea, reporte (`Implementado / Desviaciones con motivo / TDD / Verificación / Concerns`), revisión de código con severidades **Critical / Important / Minor**, ronda de fixes con re-revisión acotada, ledger `.superpowers/sdd/<plan>/progress.md` con los rulings. Revisión final de rama + ola de fixes antes del PR.
- PR contra `main` con resumen, verificación y `Closes #N` por cada issue; tablero Kanban: En progreso al empezar, En revisión al abrir PR, Hecho al mergear. Al cerrar cada iteración: issue de revisión UI/UX con `frontend-design` (regla 6 de `CLAUDE.md`).
- Secretos solo en `.env` (gitignored) y `.env.test` con valores de prueba; nunca tokens reales en chat, docs ni tests.

## 9. Definición de hecho (checklist)

- [ ] Prueba escrita primero y en verde en la capa correcta (shared / api / web / E2E).
- [ ] Sin `any`, sin duplicar constantes o tipos que ya existen en shared.
- [ ] **Sin dependencias hacia adaptadores desde los servicios**: `service.ts`/`ports.ts` no importan `hono`, `drizzle-orm`, `better-auth`, `sharp`, `node:fs`, `node:crypto`, `./repo.ts` ni nada de otra feature que no sea un puerto inyectado o un error de dominio reexportado de su `errors.ts` (ADR 26); excepción acotada: `ports.ts` puede importar **solo tipos** de su propio `schema.ts` para derivar tipos de fila (ADR 25), nunca de `repo.ts`; ninguna ruta nueva usa `db.` directo; el repo cumple su puerto con `satisfies`; el caso de uso tiene su test con fakes.
- [ ] `pnpm lint` verifica las fronteras (`docs/architecture.md` §3.5): `service.ts`/`ports.ts` sin adaptadores, rutas sin `db.` directo, web sin `fetch`/`hc`/Better Auth fuera de su sitio.
- [ ] Mensajes y textos en español, sentence case; roles y precios respetados en API y UI.
- [ ] Verificado en Chrome DevTools (si toca UI) en los tres viewports con consola limpia y 44 px.
- [ ] `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` en verde; E2E si aplica; puertos libres.
- [ ] Commit con `Refs #N`, reporte de tarea y ledger actualizados; issue movido en el tablero.
