# Convenciones de código — Dentalware

Cómo se escribe código en este repo. Complementa `CLAUDE.md` (reglas de trabajo) y `docs/architecture.md` (fronteras y decisiones). Una convención nueva se anota aquí en el mismo PR que la introduce.

## 1. Idioma y nombres

- **Español** en UI, validaciones, errores, comentarios, commits, issues y docs, en sentence case («Nuevo trabajo»). Vocabulario del laboratorio: trabajo (no caso), clínica, doctor, pieza (FDI), fase, técnico, mensajero, recepción.
- **Identificadores en inglés técnico** (`caseInputSchema`, `useCases`) salvo términos de dominio (`odontogram`, `fdi`, `remake`). Rutas HTTP y web en español (`/api/trabajos`, `/configuracion`).
- Archivos `kebab-case`; componentes `PascalCase`; hooks `useX`; constantes de dominio `SCREAMING_SNAKE_CASE`; tipos sin prefijo `I`. Un componente o hook por archivo; tests junto al código (`x.test.ts(x)`).

## 2. TypeScript y tooling

- `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax` (`import type`); en `shared`, `erasableSyntaxOnly`: sin `enum`, namespaces ni parameter properties — `as const` y tipos derivados.
- Nunca `any` (`unknown` + narrowing); `!` solo justificado. Tipos inferidos de zod (`z.input`/`z.output`) y Drizzle (`$inferSelect`).
- Imports: `.ts` explícito en `shared`, alias `@/` en web, relativos en api.
- Prettier (sin `;`, comillas simples, 100 columnas, orden de clases Tailwind) y ESLint sin warnings. Variables sin usar se borran.
- Versiones fijadas en el `catalog:` de `pnpm-workspace.yaml`; context7 antes de usar una API de librería. Node 24 en cada shell.

## 3. Estructura

- **`packages/shared/src`**: dominio puro sin I/O (schemas zod, máquina de estados, dinero, FDI, días hábiles, código de trabajo, readiness, roles). Todo sale por `index.ts`; solo depende de `zod`.
- **`apps/api/src/features/<f>/`**: `ports.ts`, `service.ts`, `errors.ts`, `repo.ts`, `schema.ts`, `routes.ts`, `fakes.ts`, `*.test.ts` (papel de cada uno en `docs/architecture.md` §3). Transversal en `lib/`, `db/`, `scripts/`, `test/`. `app.ts` es la raíz de composición; `main.ts` solo arranca.
- **`apps/web/src/features/<f>/`**: `api.ts` (única frontera con la red), `use-*.ts` (TanStack Query), componentes y tests. Transversal en `components/` (`ui/` = primitivas shadcn), `lib/` y `test/`. `routes/` solo importa de `features/` y `components/` y no tiene lógica.
- Una feature no importa el `repo`, `schema` ni `routes` de otra: declara un puerto y la raíz de composición lo inyecta (excepciones en ADR 24–26).

## 4. API

- **Rutas** solo validan, autorizan, traducen errores de dominio a HTTP y serializan; nada de `db.` en una feature con servicio. Pasan al servicio un `RequestContext { userId, role }` (`ctxFrom`), nunca el `Context` de Hono.
- **Servicios**: factorías con dependencias explícitas; toda dependencia oculta (reloj, ids, disco, red, config) es un puerto. Cada servicio tiene test con fakes además de la integración de sus rutas.
- **Validación**: `validate('json'|'query'|'param', schema)` con schemas de `shared` → 422 `{ message: 'Datos inválidos', issues }`.
- **Errores**: `{ message }` en español. 401 «No autenticado» en `requireAuth`; 403 «Sin permiso» uniforme en `requireRole` y ante un rol desconocido; 404 «No encontrado»; 409 transición inválida; 413/415 en subidas. Status explícito en `c.json(x, 200)`.
- **Permisos**: quién puede qué lo dicen las constantes de `shared` (`CASE_TRANSITIONS`, `*_ROLES`, ADR 31). Cada ruta usa **su** constante; en el ciclo de vida del trabajo el servicio vuelve a comprobar el rol. **Técnico y mensajero nunca reciben precios ni notas internas**: lo enmascara el servicio (`stripPrices`/`maskPriceEvents`), nunca solo la UI.
- **Dinero** como cadena decimal `"12.34"`, cálculos en centavos (`money.ts`). Fechas de negocio `YYYY-MM-DD`, timestamps UTC; formatea el cliente.
- **Transacciones**: toda mutación de un trabajo escribe su `case_event` en la misma transacción, vía `UnitOfWork.run(fn)` (ADR 19). Nunca `db.transaction` anidado.
- Catálogos con borrado lógico (`active`); los trabajos se cancelan, no se borran. Código `AA-NNNNN` por secuencia anual con `FOR UPDATE`.
- **Subidas**: `bodyLimit` antes de parsear, MIME real por magic bytes, nombre en disco = UUID, servidas solo con sesión. Las features solo conocen el puerto `Storage`; el driver lo elige `createStorage` según `STORAGE_DRIVER` (ADR 10).
- **Configuración** solo en `config.ts` (`loadConfig` con zod, `.env`/`.env.test`); nada de `process.env` suelto. Las claves externas llegan al adaptador por la raíz de composición. Un error de config sale como mensaje limpio; cualquier otro fallo de arranque, con traza completa. Scripts importables desde tests se protegen con `isMainModule`.
- **Migraciones** con drizzle-kit en `apps/api/drizzle/`; columnas futuras como `nullable`. Seed idempotente; `ensureAdmin` corrige el rol pero **nunca desbanea**. `users.role` tiene un CHECK derivado de `USER_ROLES`: un rol nuevo exige `drizzle-kit generate`.

## 5. Web

- **Estado de servidor** solo con TanStack Query, claves en `lib/query-keys.ts`. Cada mutación invalida lo que cambia; si cambia lo que pinta su propio botón, `onSuccess` hace `await invalidate()` (con `void`, un doble toque repite la acción). Sin store global: estado de UI en el componente o en la URL.
- **Acciones de estado** derivadas de `shared` (`availableActions` + `canPerform`). Se confirman por **reversibilidad**: lo que no tiene vuelta (`finalizar`, `marcar_enviado`, `marcar_entregado`) abre un `ConfirmDialog` que nombra la consecuencia. Todo diálogo de acción nombra la acción en su botón principal (nunca «Confirmar»), dice en una línea qué le pasa al trabajo y cierra con «Volver» (no «Cancelar», que se confunde con «Cancelar trabajo»); el toast de éxito dice qué pasó (`CASE_ACTION_DONE`), y los 409 nombran acción y estado con `CASE_ACTION_LABEL`/`CASE_STATUS_LABEL` de `shared`, nunca con la clave (UX3-03/11/12). Toda clasificación por acción o estado es un `Record` **exhaustivo**, para que lo nuevo no compile sin decidir.
- **HTTP**: `hc<AppType>` en `api.ts` + `throwIfNotOk` → `ApiError`. `toastApiError` una sola vez por acción. Identidad solo por `getSession`/`signIn`/`signOut` (`features/auth/session.ts`) o `useSession`; `authClient` no sale de `features/auth/`.
- **Un fallo de red nunca se muestra como dato**: `isNotFoundError` (`lib/api-error.ts`) separa «no existe» (404, o un status propio de la pantalla) de «no se pudo cargar», que se pinta con `LoadError` (`role="alert"` y «Reintentar»; `autoFocus` solo donde sustituye toda la pantalla, para no robar el foco a otros controles). Lo que no captura ninguna pantalla lo cubre el `defaultErrorComponent` del router (`RouterErrorFallback`), en español, con «Reintentar» que hace `router.invalidate()`. El login distingue credenciales (401), usuario bloqueado (403 con `code: 'BANNED_USER'`), demasiados intentos (429) y red: `signIn` devuelve un `SignInFailureReason` y `LoginForm` toma el texto de un `Record` exhaustivo.
- **Formularios**: react-hook-form + `zodResolver` con `useForm<z.input<S>, unknown, z.output<S>>`; vacíos como `''` normalizados a `null` por el schema; error bajo el campo con `aria-invalid`; primario al pie y a ancho completo en móvil.
- **Rutas**: `beforeLoad` para sesión y rol (redirigir, no renderizar y ocultar); `validateSearch` tolerante (`schema.partial().catch({})`); vista, filtros y página en la URL. Todo destino de redirección pasa por `safeRedirect` (solo rutas internas).
- **Tablas** con `components/data-grid` declarando sus features, salvo listas simples (`docs/data-grid.md`).
- **Selección**: `Combobox` para catálogos largos que se buscan (clínica, producto); `Select` para listas cortas o dependientes.
- **Diseño**:
  - Objetivo táctil de **44 px** (36 px solo en tablas densas de escritorio, 44 con `pointer-coarse`).
  - Chips con texto, nunca solo color; código y montos en monoespaciada.
  - `--wax-amber` es acento; el texto sobre ámbar usa `--wax-amber-ink`. El contraste se prueba en `theme-tokens.test.ts`.
- **Responsive**: una sola UI; tabla en ≥ `lg` y tarjetas en móvil, con una sola variante montada; sin scroll horizontal a 1280, 390 y 360 px.
- **Accesibilidad**: un `h1` por página, labels o `aria-label`, `aria-pressed` en toggles, foco visible, teclado en diálogos y selects, contraste AA, `alt` e `inputmode`.
- **Imágenes**: se comprimen en el cliente (≤ 1600 px), las miniaturas usan `loading="lazy"` y todo `createObjectURL` se revoca.

## 6. Shared

- Los schemas zod son la **única fuente de verdad** de los DTOs (la API valida y la web tipa con ellos), con mensajes en español dentro del schema.
- Las constantes de dominio (`CASE_STATUSES`, listas de las vistas, roles…) viven aquí y de ellas se derivan los tipos. Api y web no duplican listas ni tipos de respuesta.

## 7. Pruebas

- **TDD** RED → GREEN → refactor; una tarea sin prueba es un hallazgo _Important_. Los nombres de los tests en español describen el comportamiento.
- **API** contra Postgres real (`dentalware_test`, `truncateAll`), con login por rol en cada test que dependa de permisos (403 sin sesión y con rol incorrecto). En test, Better Auth usa un hash barato (`lib/password.ts`); nunca fuera de test.
- **Web** con Testing Library (`renderWithProviders`, `renderWithRouter`, `setMatchMedia`): consultas por rol y etiqueta, `findBy*` para lo asíncrono y mocks solo de `api.ts`.
- **Un test protege una constante con valores literales**, no derivando sus casos de esa misma constante.
- **E2E** con Playwright:
  - Proyectos `escritorio` y `android` en local; `iphone` solo en CI.
  - Datos únicos por ejecución (`uniqueSuffix`), selectores por rol o label, sin `waitForTimeout`.
  - Puertos 3000 y 5173 libres antes de correrlos.
- **Niveles de E2E**: cada test lleva exactamente una etiqueta, verificada por `e2e-tags.test.ts`. Ante la duda, `@clave`.
  - `@esencial`: sin esto el laboratorio no trabaja (sesión, crear trabajo, técnico sin precios ni configuración, crear clínica y producto).
  - `@clave`: uso diario cuyo fallo no lo detiene.
  - `@extendida`: barridos y recorridos largos.

  El PR corre `@esencial` y `@clave` en escritorio y android (`pnpm e2e:pr`). El push a `main` corre todo, `iphone` incluido.
- **Barrido táctil**: toda pantalla nueva entra en `accesibilidad.spec.ts`. Cada barrido espera a un elemento propio de su pantalla, y `expectTouchTargets` falla si no mide nada. Los inputs nativos ocultos (`aria-hidden`, `tabIndex=-1`) no cuentan como objetivo táctil.
- Los revisores no corren tests de BD ni E2E mientras haya un implementador activo.

## 8. Git y proceso

- **Ramas y commits**:
  - Ramas `feat/…` o `fix/…`.
  - Commits pequeños en español con prefijo convencional, `Refs #N` y los trailers `Co-Authored-By` y `Claude-Session`.
  - El pre-commit corre lint-staged y typecheck, no los tests. Nunca `--no-verify`.
- **Antes de cada commit**: `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`. Los E2E se corren al cerrar la tarea que los toque. Toda tarea de UI se verifica en Chrome DevTools a 1280×800, 390×844 y 360×740, con la consola limpia.
- **Proceso SDD**:
  - Un implementador a la vez, con un brief por tarea.
  - El reporte sigue el formato `Implementado / Desviaciones / TDD / Verificación / Concerns`.
  - La revisión clasifica en Critical, Important o Minor; los fixes llevan re-revisión acotada.
  - Los rulings se anotan en el ledger `.superpowers/sdd/<plan>/progress.md`.
  - Revisión final de la rama antes del PR.
- **Historias primero** (`docs/superpowers/specs/2026-09-12-historias-de-usuario-mvp.md`): cada historia es un issue `historia` con su versión mínima y sus criterios, que son los primeros tests. Lo técnico va en issues `tarea`.
- **PR** contra `main` con `Closes #N`. El tablero avanza En progreso → En revisión → Hecho.
- **Secretos**: solo en `.env` (gitignored) y `.env.test` con valores de prueba. GitGuardian escanea todo el repo. `.gitguardian.yaml` silencia solo, por valor, las contraseñas inventadas de los usuarios de test; un test nuevo reutiliza una de ellas o añade la suya en el mismo PR.

## 9. Definición de hecho

- [ ] Prueba escrita primero y en verde en la capa correcta.
- [ ] Sin `any`, sin duplicar constantes o tipos de `shared`.
- [ ] Fronteras respetadas y verificadas por `pnpm lint` (`docs/architecture.md` §4): servicio sin adaptadores, repo con `satisfies`, ruta sin `db.`, web sin `fetch`/`hc`/Better Auth fuera de su sitio; caso de uso con test de fakes.
- [ ] Español en sentence case; precios y roles respetados en API y UI.
- [ ] UI verificada en los tres viewports, con consola limpia y objetivos de 44 px.
- [ ] Verificación completa en verde; E2E si aplica; puertos libres.
- [ ] Commit con `Refs #N`, reporte y ledger al día, issue movido en el tablero.
