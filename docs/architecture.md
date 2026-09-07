# Arquitectura — Dentalware

Arquitectura de referencia del sistema: lo que siempre debe cumplirse al añadir código, y el registro de decisiones tomadas para este producto. Complementa `docs/conventions.md` (cómo se escribe) y las specs en `docs/superpowers/specs/` (qué se construye). Se actualiza en el mismo PR que cambia una frontera o toma una decisión nueva.

## 1. Contexto y alcance

- **Producto**: gestión interna de un solo laboratorio dental (Arte Dental, Ecuador), 3–15 usuarios, uso en PC y móvil (PWA instalable). Roles: `admin`, `recepcion`, `tecnico`, `mensajero`.
- **Núcleo del dominio**: el **trabajo** (orden de la clínica) con su ciclo de vida (`nuevo → en_proceso ⇄ en_espera | en_prueba → terminado → enviado → entregado`, `cancelado`), sus líneas (producto × cantidad × piezas FDI × precio), fases de producción, adjuntos, historial/auditoría, entregas y cuenta por clínica.
- **Fuera de alcance del MVP** (decidido): facturación electrónica SRI (solo se anota el número), portal del doctor, integración con escáneres/CAD, inventario con lotes, notificaciones push nativas, multi-laboratorio, microservicios.
- **Restricciones reales**: un desarrollador, despliegue en un VPS Hostinger con Docker, datos de pacientes minimizados (LOPDP: alias/referencia, no nombre completo), técnicos con celular y guantes (objetivos táctiles de 44 px), conectividad normal (sin escritura offline).

## 2. Estilo arquitectónico

**Monolito modular en un monorepo**, con separación por capas dentro de cada aplicación y organización por features (feature-sliced). No es DDD pesado ni hexagonal estricto: se toman de esos estilos solo las fronteras que aportan valor a este tamaño.

```
packages/shared   dominio puro y contratos (zod, máquina de estados, dinero, FDI, CSV)
      ▲                    ▲
apps/api          adaptador HTTP (Hono) + repositorios (Drizzle/Postgres) + servicios de infraestructura
      ▲ (solo tipos: AppType, Auth)
apps/web          adaptador de UI (React) + estado de servidor (TanStack Query) + rutas
```

Reglas de dependencia (se verifican en revisión):

1. `shared` no depende de nada salvo `zod` y no hace I/O. Es la **única fuente de verdad** de DTOs, enums, reglas puras (transiciones, días hábiles, totales, código de trabajo, readiness).
2. `api` depende de `shared`; nunca de `web`.
3. `web` depende de `shared` y solo de **tipos** de `api` (`@dentalware/api/app` para `hc<AppType>`, `@dentalware/api/auth`); nunca de su runtime.
4. Dentro de `api` y `web`, una feature no importa internals de otra (`repo`, hooks); comparte a través de `shared`, de `lib/` o de un módulo explícito.
5. Las rutas (`apps/web/src/routes`) son adaptadores: componen features y componentes, no contienen lógica de negocio.

## 3. Capas y patrones por aplicación

### 3.1 `packages/shared` — dominio puro

- **Schema-first / contratos compartidos**: cada entidad tiene su schema zod (`caseInputSchema`, `clinicSchema`, `importRowSchema`…) del que derivan `z.input` (formulario) y `z.output` (API).
- **Máquina de estados** (`case-status.ts`): tabla de transiciones válidas con roles y reglas; la API y la UI preguntan `canTransition(from, to, role)`; la UI solo muestra acciones válidas; la API responde 409 ante transiciones inválidas.
- **Value objects funcionales**: dinero en centavos (`money.ts`), piezas FDI (`fdi.ts`), fechas ISO (`isoDate`), código anual (`case-code.ts`). Sin clases: funciones puras y `as const`.
- **Readiness** (`case-readiness.ts`): `missingForAccept(case)` centraliza qué falta para aceptar un trabajo; se muestra en formulario y ficha y bloquea `aceptar` en la API.

### 3.2 `apps/api` — aplicación y persistencia

- **Raíz de composición** (`createApp({ auth, db, webOrigin, storage })`): inyección de dependencias explícita; `main.ts` construye las dependencias reales y los tests las sustituyen (BD de test, `storage` temporal). Nada global ni singletons ocultos.
- **Feature = schema + repo + routes**: `routes.ts` es el adaptador HTTP (validación, sesión/rol, códigos), `repo.ts` el **repositorio** (consultas Drizzle, transacciones, reglas que necesitan datos), `schema.ts` las tablas. Los repos exponen `xTx(tx, …)` + wrapper `x(db, …)` (unidad de trabajo por transacción) para componer operaciones (p. ej. importación crea N trabajos en una sola transacción).
- **Cadena de middlewares**: `requireAuth` → `requireRole(...)`; `bodyLimit` antes de parsear cuerpos; `validate()` con los schemas de shared. Las respuestas de error tienen una sola forma (`{ message, issues? }`).
- **Enmascarado por rol en la frontera de datos**: `stripPrices` / `maskPriceEvents` / `internalNotes: null` se aplican en repo/rutas según el rol de la sesión; la UI es una segunda capa, nunca la única.
- **Auditoría por eventos** (`case_events`): cada mutación de un trabajo escribe un evento tipado (`CASE_EVENT_TYPES`) en la misma transacción; el historial y los comentarios se leen de ahí (event log ligero, no event sourcing: el estado vive en las tablas).
- **Puertos e implementaciones**: `Storage` (interfaz) con `LocalStorage` (disco del VPS) hoy y un driver S3/R2 previsto (#48); `images.ts` (sharp) normaliza y genera miniaturas. Cualquier integración externa futura (correo, WhatsApp, SRI) entra igual: interfaz en `lib/`, implementación inyectada en `createApp`.
- **Persistencia**: Postgres 17 con Drizzle (relations v2), migraciones versionadas, seed idempotente, secuencia anual de códigos con bloqueo `FOR UPDATE`, borrado lógico en catálogos, trabajos nunca borrados.
- **Autenticación**: Better Auth (email/contraseña, sesión por cookie HttpOnly + SameSite, plugin admin para gestión de usuarios con su superficie HTTP bloqueada; rate limit en login). Roles en la tabla de usuarios y en la sesión.

### 3.3 `apps/web` — interfaz

- **Feature-sliced**: `features/<f>/` con `api.ts` (cliente `hc` tipado end-to-end), hooks de TanStack Query (`use-*.ts`, claves en `lib/query-keys.ts`), formularios (react-hook-form + zod de shared), tablas/tarjetas y componentes propios; `components/` transversales; `components/ui/` primitivas shadcn ajustadas a la dirección de diseño.
- **Estado**: el servidor es la fuente de verdad (TanStack Query con invalidación por claves); la URL guarda vista/filtros/página (`validateSearch`); el estado de UI vive en el componente. Sin store global.
- **Rutas como guardias**: `beforeLoad` decide sesión y rol (redirige); `_app` es el cascarón (sidebar en PC, barra inferior + acciones al pie en móvil).
- **Componentes**: compound components y hooks headless para lo transversal (`FormDialog`, `ConfirmDialog`, `DataTable` → futuro `DataGrid` #53), variantes por `cva`, una sola UI responsive (tabla ↔ tarjetas por `useMediaQuery`).
- **PWA**: shell y assets cacheados (Workbox, `autoUpdate`); sin escritura offline. Cámara vía `<input capture>`; compresión de imagen en el navegador.

## 4. Datos (resumen)

Configuración: `lab_settings`, `users` (+ tablas de Better Auth), `clinics`, `doctors`, `product_categories`, `products`, `clinic_product_prices`, `stages`. Operación: `cases`, `case_items`, `case_events`, `attachments`, `case_sequences` (código anual); previstas: `case_tryins`, `deliveries`, `account_adjustments`, `payments`, `invoice_refs`. Saldo de clínica = Σ trabajos entregados + Σ ajustes − Σ pagos (calculado, no almacenado). Detalle en la spec §4.

## 5. Seguridad y privacidad

- Autorización en cada ruta (403 uniforme), precios y notas internas ocultos a técnico/mensajero en la API, validación zod en la frontera, límites de tamaño y MIME real en subidas, archivos servidos solo con sesión y nombrados por UUID, cookies HttpOnly/SameSite, rate limit en login, audit trail en `case_events`.
- Datos mínimos del paciente (referencia/alias, edad, sexo). Backups cifrables con retención (infra/backup.sh). Secretos fuera del repo.

## 6. Despliegue y operación

- `infra/docker-compose.yml`: `caddy` (TLS automático, sirve `apps/web/dist`, proxy `/api`), `api` (Node 24 alpine, migra al arrancar), `postgres` (volumen), volumen `uploads`. Desarrollo: `docker-compose.dev.yml` con Postgres en 5433 y BD `dentalware_test` para pruebas.
- CI (GitHub Actions): job `quality` (build, lint, format, typecheck, unit) y job `e2e` (Playwright con Postgres efímero `dentalware_test`, tres proyectos). Deploy manual por SSH (`git pull && docker compose up -d --build`).

## 7. Pruebas (pirámide)

Unit en `shared` (reglas puras) → integración de API contra Postgres real (rutas, permisos, transacciones) → componentes web con Testing Library → E2E Playwright del flujo principal por iteración (escritorio + android; iphone en CI) + barrido de accesibilidad táctil. TDD obligatorio en todas las capas.

## 8. Registro de decisiones (ADR resumido)

| # | Decisión | Motivo | Estado |
|---|---|---|---|
| 1 | TypeScript en todo el stack, monorepo pnpm | un solo lenguaje para un solo desarrollador; tipado end-to-end sin codegen (`hc<AppType>`) | vigente |
| 2 | PWA responsive (React) en vez de app nativa; Capacitor opcional post-MVP | una sola UI para PC y móvil; iOS sin push en PWA se acepta en el MVP | vigente |
| 3 | Hono + Drizzle + Postgres + Better Auth | ligeros, tipados, sin magia; Better Auth cubre sesiones y admin | vigente |
| 4 | Monolito modular por features, sin microservicios ni DDD pesado | tamaño del equipo y del sistema; fronteras por capa y por feature bastan | vigente |
| 5 | Contratos zod en `shared` como única fuente de verdad | evita duplicar validación y tipos entre API y web | vigente |
| 6 | Dinero como cadena decimal transportada y centavos enteros en cálculo | evita flotantes; precios por clínica con fallback al precio base | vigente |
| 7 | Precios y notas internas enmascarados en la API por rol | la seguridad no depende de la UI | vigente |
| 8 | Auditoría con `case_events` en la misma transacción que la mutación | historial, comentarios y trazabilidad sin infraestructura extra | vigente |
| 9 | Notación FDI; odontograma por selección táctil (sin arrastre para puentes) | estándar en Ecuador; el arrastre no aporta y complica móvil | vigente |
| 10 | Adjuntos en disco del VPS tras interfaz `Storage`; S3/R2 después (#48) | simple hoy, migrable sin tocar features | vigente |
| 11 | Importación solo CSV (plantilla descargable), sin XLSX | evita dependencias pesadas; Excel exporta CSV | vigente |
| 12 | Columnas de iteraciones futuras creadas ya como `nullable` | no repetir migraciones sobre `cases` | vigente |
| 13 | E2E contra `dentalware_test` con `.env.test` y reset antes del seed | los E2E no ensucian la BD de desarrollo | vigente |
| 14 | Objetivos táctiles de 44 px por defecto en las primitivas UI; 36 px solo en tablas densas de escritorio con `pointer-coarse:` → 44 | técnicos con guantes; regla de la dirección de diseño | vigente |
| 15 | Tablas sobre un `DataGrid` modular con TanStack Table (paginación, sorting, grouping, resizing, filtros, filtros avanzados, columnas fijas activables) | homogeneizar 7 tablas y las que vienen (#53) | pendiente |
| 16 | Estados `por_recoger`/`cobrado`, avisos a clínicas, `requires_shade` en productos | diferidos a iteraciones 3–6 | diferido |

## 9. Cómo evolucionar sin romper la arquitectura

- **Nueva entidad**: schema zod en `shared` → tabla + migración → `repo.ts` → `routes.ts` con `validate`/roles → tests de API → `api.ts` + hooks + componentes en `web` → E2E del flujo. Todo dentro de `features/<nombre>/` en cada app.
- **Nueva regla de negocio**: si es pura (no necesita datos), va a `shared` con test unitario; si necesita la BD, al `repo` dentro de la transacción; nunca en la UI.
- **Nueva integración externa**: interfaz en `apps/api/src/lib/`, implementación inyectada en `createApp`, fake en tests.
- **Nuevo rol o permiso**: `roles.ts` en shared, `requireRole` en rutas, enmascarado en repo, `beforeLoad` en la web, test de 403 y de enmascarado.
- Señales de que algo está mal ubicado: una ruta con `db.` directo, un componente que calcula un total, un `repo` importado desde otra feature, una lista de estados escrita a mano fuera de `shared`, un precio visible que no pasó por `stripPrices`.
