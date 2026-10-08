# Arquitectura — Dentalware

Fronteras que siempre se cumplen y decisiones tomadas. Complementa `docs/conventions.md` (cómo se escribe) y `docs/superpowers/specs/` (qué se construye). Se actualiza en el mismo PR que cambia una frontera o toma una decisión.

## 1. Contexto

- **Producto**: gestión interna de un laboratorio dental (Arte Dental, Ecuador), 3–15 usuarios, PWA para PC y móvil. Roles: `admin`, `recepcion`, `tecnico`, `mensajero`.
- **Núcleo**: el **trabajo** y su ciclo de vida (`por_recoger → nuevo → en_proceso ⇄ en_espera | en_prueba → terminado → enviado → entregado ⇄ cobrado`, `cancelado`; `cobrado` lo ponen y lo quitan las cuentas cuando lo asignado cubre el neto del trabajo, nunca una acción), con líneas (producto × piezas FDI × precio), fases, adjuntos, historial, entregas y cuenta por clínica. Flujo del MVP: **recibir → producir → entregar → cobrar** (ADR 33).
- **Fuera del MVP**: facturación electrónica SRI, portal del doctor, CAD/escáneres, inventario, push nativo, avisos automáticos por correo o WhatsApp (solo enlace `wa.me`), calendario e ICS, histórico de VEVI, producción por persona, multi-laboratorio.
- **Restricciones**: un desarrollador, un VPS Hostinger con Docker, datos de paciente mínimos (LOPDP), técnicos con guantes (44 px), sin escritura offline.

Por eso: de la arquitectura hexagonal se toma lo que aísla el dominio y lo hace testeable, sin contenedores de DI, DDD táctico, CQRS ni event sourcing.

## 2. Estilo: hexagonal pragmática

Monolito modular por features. El centro es `packages/shared` (reglas puras y contratos) más los casos de uso de cada feature (`service.ts`). Hono, Drizzle, Better Auth, `sharp`, el disco y React son adaptadores.

```
routes.ts (Hono) · scripts · React          ← adaptadores que entran
        │
        ▼
service.ts  →  ports.ts  ←  repo.ts (Drizzle) · Storage · sharp · Clock   ← adaptadores que salen
        │
        ▼
packages/shared (máquina de estados, dinero, FDI, readiness, schemas zod)
```

1. **Las flechas no se invierten**: un servicio conoce interfaces, nunca `hono`, `drizzle-orm`, `repo.ts` ni `schema.ts`.
2. `shared` solo depende de `zod` y no hace I/O: única fuente de DTOs, enums y reglas puras.
3. `api` depende de `shared`; `web` depende de `shared` y solo de **tipos** de `api` (`hc<AppType>`).
4. Entre features solo se comparten **puertos** inyectados en la raíz de composición, nunca adaptadores (excepciones acotadas: ADR 24–26).
5. Regla de ubicación: si se puede escribir sin BD, reloj ni red, va a `shared` con su test; si coordina datos o pasos, al servicio; si es SQL, al repo; **nunca en la ruta ni en la UI**.

## 3. Piezas por capa

### API (`apps/api/src/features/<f>/`)

| Archivo | Papel |
|---|---|
| `ports.ts` | Interfaces que consume el caso de uso (repositorios, `Storage`, `Clock`, `IdGenerator`, `UnitOfWork`, puertos de otras features). Tipos de fila con `import type` de su propio `schema.ts` (ADR 25). |
| `service.ts` | Casos de uso como factoría (`createXService(deps)`); recibe `RequestContext { userId, role }`; enmascara por rol; sin Hono, Drizzle ni `process.env`. |
| `errors.ts` | Errores de dominio, que la ruta traduce a HTTP (`CaseInputError` → 422, `CaseStateError` → 409, `CaseNotFoundError` → 404). |
| `repo.ts` | Adaptador Drizzle `createXRepo(db \| tx) satisfies XRepository`; `drizzleUnitOfWork` recrea los repos sobre `tx`. |
| `routes.ts` | Adaptador Hono: `validate`, `requireAuth`/`requireRole`, `ctxFrom(c)`, traducción de errores. |
| `schema.ts` | Tablas Drizzle; solo las ve su `repo.ts` (y `ports.ts` como tipo). |
| `fakes.ts` + `*.test.ts` | Servicio probado con fakes en memoria y rutas probadas contra Postgres real. |

`app.ts` (`createApp(deps)`) es la raíz de composición: construye adaptadores, arma servicios y monta rutas. `main.ts` es lo único que toca el mundo real. Implementación de referencia: `features/cases`.

**Entregas** (`features/deliveries`, Iteración 4): recogidas y entregas del día, «No se pudo», «Recogido» y lista de mensajeros, con su propio `UnitOfWork`. «Recogido» (`POST /api/entregas/:id/recogido`, sin cuerpo, #118) cierra la recogida pendiente sin cambiar el estado del trabajo, que sigue `por_recoger` hasta «Recibido»: 422 sobre una entrega, 403 si `canMarkPickedUp` es falso y 409 si ya no está pendiente; a quien no puede actuar sobre esa entrega (`canHandleDelivery`), 403 antes que el 409 o el 422, para no revelar nada de una entrega ajena. Las transiciones del trabajo que abren o cierran una entrega viven en `cases` y escriben por su puerto `DeliveryLog` (ADR 34). La ficha del trabajo lee su entrega pendiente, la última entrega hecha y la última recogida hecha (`lastPickedUp`, para «En camino al laboratorio») por el puerto de lectura `CaseDeliveriesQuery` de `cases`, que cumple `createCaseDeliveryInfoQuery` de `deliveries` en `app.ts`. A su vez, `attachments` lee las entregas por sus puertos `PendingDeliveryLookup` (la entrega pendiente de quien sube una constancia) y `DeliveryProofLookup` (las constancias que ligó una entrega hecha), que cumple `createDeliveriesRepo` en `app.ts`. Un `repo.ts` puede traducir a un error de dominio la violación de **una** FK concreta, identificada por su nombre (`isForeignKeyViolation` de `db/pg-errors.ts`); cualquier otra violación sale tal cual. Así, la FK `RESTRICT` `deliveries.proof_attachment_id` (`DELIVERY_PROOF_FK`) da `AttachmentInUseError` (409) al borrar una constancia ya ligada y `DeliveryProofMissingError` (422 en `constanciaId`) al ligar una ya borrada. Reglas del día (`GET /api/entregas`): el mensajero solo ve las suyas; el día de hoy suma las pendientes atrasadas y toda recogida hecha cuyo trabajo sigue `por_recoger` (en camino, hasta «Recibido»), sin mirar su fecha programada (también la marcada «Recogido» antes de su día) y sin repetirla; cada fila trae la ciudad de la clínica (para el mapa) y, si es fallida, `rescheduledFor`, la fecha de la pendiente que creó «No se pudo» (`null` en la anulada por cancelación). «No se pudo» no acepta una fecha anterior a hoy ni un motivo con el prefijo de la cancelación (422).

**Cuentas** (`features/accounts`, Iteración 5): saldo, antigüedad, «Por cobrar» y movimientos de cada clínica (CTA-1), y los pagos y ajustes que los mueven. El cargo de un trabajo no tiene tabla: el repo lee los trabajos `entregado` y `cobrado` de `cases` por join de solo lectura (ADR 24), con la suma de sus ajustes y de las asignaciones de pagos vigentes; los ajustes, pagos y asignaciones son de la feature. Todas las reglas salen de `shared` (`caseChargeCents`, `caseOutstandingCents`, `isSettled`, `suggestAllocation`, `releaseExcess`, `agingBuckets`, `oldestOpenDays`, montos con signo con `toSignedCents`/`fromSignedCents`) y el servicio solo las compone: SQL nunca calcula saldos ni antigüedad. `GET /api/cuentas` (`ACCOUNTS_ROLES`) lista las clínicas con movimientos (también inactivas, porque la deuda no se va con la clínica) y, con `?todas=1`, además las activas sin nada, de mayor a menor saldo; `GET /api/cuentas/:id` da saldo, saldo a favor, antigüedad, días de vencido, «Por cobrar» y movimientos con signo (el pago resta y trae `remaining`, lo que le queda sin asignar, para «Aplicar saldo a favor»; el anulado lleva `voided`, `remaining` en cero y no cuenta), y 404 si la clínica no existe. Sin sesión, 401; técnico y mensajero, 403. `accounts` cambia el estado del trabajo (`entregado ⇄ cobrado`, con `paid_at`) y escribe sus eventos por su puerto de escritura `CaseSettlement`, que `app.ts` cumple con `createCaseSettlement` de `cases` sobre la misma `tx` de su `AccountsUnitOfWork` (ADR 35, patrón de ADR 34). Pagos (CTA-2): `POST /api/cuentas/pagos` (`ACCOUNTS_ROLES`, 201) registra el pago y su reparto; `POST /api/cuentas/pagos/:id/asignaciones` (`ACCOUNTS_ROLES`, 201) aplica lo que le queda a favor, y `POST /api/cuentas/pagos/:id/anular` (`ACCOUNT_ADMIN_ROLES`, 200) lo anula; el servicio vuelve a comprobar el rol. Cada uno corre en `uow.run`. Registrar bloquea los trabajos, valida y solo después crea el pago (no hay pago previo que bloquear); aplicar el saldo a favor y anular bloquean primero el pago (`lockPayment`, antes de leer sus asignaciones) y después los trabajos (`FOR NO KEY UPDATE`, en orden de id, como `byIdForUpdate`). Después lee el pendiente ya dentro de la transacción, valida (422 con el campo: trabajo de otra clínica, no entregado o ya cobrado, más que su pendiente, más que el pago o que lo que le queda) antes de escribir, crea las asignaciones o marca la anulación, escribe `payment_applied` (monto; método y referencia en `reason`) o `payment_voided` (monto devuelto, sumado por trabajo; motivo) y reevalúa `isSettled`. Así, dos pagos simultáneos al mismo trabajo no lo sobrepagan: el segundo ve el pendiente nuevo. 404 si el pago no existe; 409 si está anulado. Ajustes (CTA-3): `POST /api/cuentas/ajustes` (`ACCOUNT_ADMIN_ROLES`, 201, con motivo) corre en `uow.run`; con trabajo, lo bloquea, valida que sea de la clínica y esté `entregado` o `cobrado` (422 en `trabajoId`) y que no deje su neto (cargo + Σ ajustes del trabajo) por debajo de 0 (422 en `monto`: «El descuento supera lo que vale el trabajo; regístralo sin trabajo»); si lo asignado supera el neto (un descuento sobre un trabajo ya pagado), libera el exceso en la misma transacción: reduce las asignaciones vigentes de la más reciente a la más antigua (`releaseExcess` de shared; la que llega a 0 se borra) y el exceso vuelve como `remaining` de su pago, que se aplica después con «Aplicar saldo a favor». Escribe `adjustment_added` (monto con signo; en `reason`, el motivo y, si liberó algo, «Se devolvieron $X al saldo a favor») y reevalúa `isSettled`: un descuento puede cerrarlo y un recargo reabrir uno cobrado. Bloquea en el orden de todo `accounts`, pago antes que trabajo: primero los pagos con asignaciones vigentes al trabajo (en orden de id), después el trabajo, y vuelve a leer sus asignaciones; si apareció la de un pago que no bloqueó (otro pago confirmado entre medio), empieza de nuevo, y al tercer intento responde 409. La respuesta trae `released`. Sin trabajo («Saldo inicial»), solo mueve el saldo y entra en la antigüedad por su fecha. La fecha de un pago o de un ajuste no puede ser posterior a hoy (reloj del servicio; 422 en `fecha`). «Marcar entregado» de un trabajo sin nada que cobrar (una repetición al 0 % o uno que vale 0) lo deja `cobrado` en la misma transacción de `cases`, sin pasar por `accounts`: con las mismas reglas de shared (`caseChargeCents`, `caseOutstandingCents`, `isSettled`; al entregar aún no tiene ajustes ni asignaciones), fija `delivered_at` y `paid_at` y escribe `delivered` y `status_changed` (de `entregado` a `cobrado`), en ese orden. La ficha del trabajo trae `account { charge, adjustments, allocated, outstanding, paidAt }` solo para `ACCOUNTS_ROLES` y si el trabajo carga a la clínica (`isBilled`: `entregado` o `cobrado`); para técnico y mensajero es `null`, enmascarado en el servicio sin consultarla. La lee el puerto de lectura `CaseAccountQuery` de `cases`, que cumple `createAccountsRepo` de `accounts` en `app.ts` (como `CaseDeliveriesQuery` con `deliveries`).

**Cuándo hace falta `service.ts`**: siempre en una feature nueva, o si la feature usa más de un puerto, tiene reglas o autorización más allá de `requireRole`, necesita transacción, enmascara por rol u orquesta varios pasos. Un CRUD simple (`clinics`, `doctors`, `stages`, `lab-settings`) puede llamar al repo desde la ruta; con su primera regla gana servicio en ese mismo PR. Las features viejas se migran cuando se tocan (boy-scout): faltan `users` (Drizzle en la ruta) y `products` (reglas en la ruta), excluidas del lint de rutas hasta entonces.

### Web (`apps/web/src`)

- `features/<f>/api.ts` es la única frontera con la red (`hc<AppType>` + `throwIfNotOk`). `use-*.ts` es la capa de aplicación (TanStack Query). Componentes y `routes/` son adaptadores de UI, sin reglas: totales, estados y readiness vienen de `shared`.
- **Identidad**: `authClient` confinado en `features/auth/`; el resto usa `getSession`/`signIn`/`signOut`/`useSession`. `getSessionStatus()` distingue `ok`, `anonymous` e `invalid-role`; un rol desconocido nunca cuenta como rol. Sin red, `getAppSession()` (el `beforeLoad` de `_app`) deja pasar con la última sesión válida conocida: la API sigue exigiendo sesión en cada petición (UX4-26).
- **Estado**: el servidor es la fuente de verdad, la URL guarda vista, filtros y página, y no hay store global.
- **Componentes transversales**: `FormDialog` y `ConfirmDialog` (con `useReturnFocus`), `DataGrid` (`docs/data-grid.md`), `Combobox`, `LoadError`, `OfflineNotice` y `ClinicContact` (con `lib/map-link.ts`). Una sola UI responsive.
- **PWA**: shell cacheado con `autoUpdate`, sin escritura offline; cámara vía `<input capture>`.

## 4. Fronteras verificadas por `pnpm lint`

`eslint.config.js` las hace cumplir con `@typescript-eslint/no-restricted-imports` y `no-restricted-globals`, sin plugins extra (ADR 21). Si una regla no está aquí, no la vigila nadie.

| Archivos | Prohibido |
|---|---|
| `service.ts`, `errors.ts` | `hono`, `drizzle-orm`, `db/**`, `better-auth`, `sharp`, `node:fs`, `node:crypto`; `schema.ts`, `repo.ts`, `routes.ts` propios o ajenos; `service.ts` ajeno. Los adaptadores de `lib/` (`storage`, `images`, `ids`, `clock`) solo como `import type`. |
| `ports.ts` | Lo mismo, salvo `./schema.ts` como tipo. Sí se permiten `../*/ports.ts` y `../*/errors.ts`, la vía legítima entre features. |
| `routes.ts` | `drizzle-orm`, `db/schema/**`, cualquier `schema.ts` y el `repo.ts` ajeno; `db` solo como tipo. |
| `repo.ts` | `hono`; `repo.ts`, `routes.ts` y `service.ts` ajenos. El `schema.ts` ajeno se permite para joins de solo lectura. |
| web `**` | `fetch`, `window.fetch` y `globalThis.fetch` fuera de `api.ts` (excepción documentada: `attachments-api.ts`, que sube `form`); `hono/client` fuera de `lib/api.ts`; `better-auth` y `auth-client` fuera de `features/auth/`; runtime de `@dentalware/api`. |
| web `routes/**` | Además, el runtime de `@/lib/api` y de `features/*/api`. |
| `components/data-grid/**` | `features/` y `routes/` de la app. El núcleo no importa features del grid, y una feature del grid no importa el núcleo ni a otra feature. |

En la API, los tests y `fakes.ts` quedan fuera de estas reglas. En la web sí entran, salvo `src/test/**`.

**Señales de algo mal ubicado**:
- una ruta con `db.`;
- `new Date()`, `randomUUID()` o `process.env` dentro de la lógica;
- un caso de uso que solo se prueba con Postgres;
- una regla duplicada en la ruta y en el componente;
- un componente que calcula un total;
- una lista de estados escrita a mano fuera de `shared`;
- un precio que no pasó por el enmascarado del servicio.

## 5. Datos

- **Configuración**: `lab_settings`, `users` (+ Better Auth), `clinics`, `doctors`, `product_categories`, `products`, `clinic_product_prices` y `stages`.
- **Operación**: `cases` (con `parent_case_id` para las repeticiones), `case_items`, `case_events`, `attachments`, `case_tryins` y `case_sequences`.
- **Entregas**: `deliveries` (recogida o entrega, mensajero, fecha, estado `pendiente`/`hecha`/`fallida`, motivo y constancia; `proof_attachment_id` con `ON DELETE RESTRICT`).
- **Cuentas**: `account_adjustments` (con signo y CHECK ≠ 0; `case_id` opcional: ligado a un trabajo cambia su neto, sin él solo mueve el saldo, como el «Saldo inicial»), `payments` (monto > 0, método, fecha de pago, referencia y notas; se anulan con `voided_at`, `voided_by` y `void_reason`, que el CHECK `payments_void_check` exige juntos, y nunca se editan ni se borran) y `payment_allocations` (parte de un pago asignada a un trabajo, > 0; la de un pago anulado deja de contar sin borrarse; un ajuste que deja un trabajo pagado de más la reduce, o la borra si llega a 0, y el exceso vuelve al pago como saldo a favor, que queda escrito en el `reason` de `adjustment_added`).

Saldo de clínica = Σ cargos de los trabajos entregados y cobrados + Σ ajustes − Σ pagos vigentes. Se calcula, no se guarda, y cuadra con Σ pendientes + Σ ajustes sin trabajo − saldo a favor (ADR 35). El saldo a favor es lo no asignado de los pagos vigentes (también lo que un ajuste liberó de ellos) más el pendiente negativo de cada trabajo (defensa: ningún ajuste lo deja ya, porque ninguno deja el neto por debajo de 0): resta en la antigüedad, de la partida más antigua a la más nueva, y ese trabajo no está «Por cobrar».

`cases.remake_charge_pct` es un **modificador diferido**: el `total` de una repetición guarda el 100 % de sus líneas, y el saldo de la clínica debe sumar `total × remake_charge_pct / 100`. Para técnico y mensajero se enmascara igual que los importes.

## 6. Seguridad

- El rol se valida en cada frontera:
  - en la API, `requireAuth`, `requireRole` y `ctxFrom` lo comprueban con `userRoleSchema`;
  - en la web, un rol desconocido cuenta como sesión no válida;
  - en la BD, un CHECK derivado de `USER_ROLES`.
- **Visibilidad**: los precios y las notas internas se ocultan en el servicio, antes de salir del hexágono.
- **Subidas**: límite de tamaño, MIME real, nombre UUID, y solo se sirven con sesión.
- **Sesión**: cookies HttpOnly/SameSite y rate limit en el login.
- **Auditoría**: queda en `case_events`.
- **Datos del paciente**: los mínimos.
- **Secretos**: solo en `config.ts`.
- **Respaldos**: `infra/backup.sh`.

## 7. Despliegue y CI

- `infra/docker-compose.yml` levanta tres contenedores y un volumen:
  - `caddy`: TLS, sirve la web y hace de proxy de `/api`;
  - `api`: Node 24, migra al arrancar;
  - `postgres`;
  - volumen `uploads`.
- **Desarrollo**: Postgres en el puerto 5433, con la BD `dentalware_test`.
- **`PUBLIC_URL`**: se incrusta en el bundle (QR de la orden), así que cambiarlo exige `--build`.
- **CI**: `quality` y `e2e` en paralelo; los niveles de E2E por evento están en `docs/conventions.md` §7.
- **Deploy**: manual por SSH (`git pull && docker compose up -d --build`).

## 8. Decisiones (ADR)

| # | Decisión | Motivo |
|---|---|---|
| 1 | TypeScript en todo el stack, monorepo pnpm | un lenguaje, tipos de punta a punta sin codegen |
| 2 | PWA responsive; Capacitor solo post-MVP | una UI para PC y móvil |
| 3 | Hono + Drizzle + Postgres + Better Auth | ligeros, tipados, sin magia |
| 4 | Monolito modular por features | tamaño del equipo y del sistema |
| 5 | Contratos zod en `shared` como única fuente | no duplicar validación ni tipos |
| 6 | Dinero como cadena decimal, cálculo en centavos; precio por clínica con fallback | sin flotantes |
| 7 | Precios y notas internas enmascarados por rol en el servicio | la seguridad no depende de la UI |
| 8 | `case_events` en la misma transacción que la mutación | historial sin infraestructura extra |
| 9 | Notación FDI; odontograma por toque, sin arrastre | estándar local; móvil |
| 10 | Adjuntos en disco tras el puerto `Storage`, driver elegido por `STORAGE_DRIVER` con `createStorage`, suite de contrato `storage.contract.ts`; nube (#48) = driver nuevo que pase el contrato | simple en el MVP sin acoplarse al disco |
| 11 | Importación solo CSV | sin dependencias pesadas |
| 12 | Columnas de iteraciones futuras ya `nullable` | no repetir migraciones |
| 13 | E2E contra `dentalware_test` con `.env.test` | no ensuciar la BD de desarrollo |
| 14 | 44 px por defecto; 36 px solo en tablas densas de escritorio | técnicos con guantes |
| 15 | Tablas sobre `DataGrid` (TanStack Table v9) con features modulares | UI propia sobre shadcn |
| 16 | Estados `por_recoger`/`cobrado` y `requires_shade` llegan con sus historias | no adelantar modelo |
| 17 | Hexagonal pragmática: `ports.ts` + `service.ts`, excepción para CRUD simple, migración boy-scout | probar casos de uso sin BD y cambiar infraestructura sin tocar reglas |
| 18 | DI por factorías, sin contenedor ni decoradores | `erasableSyntaxOnly`; tipos exactos sin magia |
| 19 | `UnitOfWork.run(fn)` con repos recreados sobre `tx` | atomicidad sin que el servicio conozca Drizzle |
| 20 | `RequestContext` como parámetro; errores de dominio traducidos en la ruta | servicios reutilizables fuera de HTTP |
| 21 | Fronteras verificadas por ESLint | con un solo desarrollador, lo que no falla en lint se erosiona |
| 22 | Avisos por correo con puerto `Mailer` (Resend); WhatsApp después — **diferido a Post-MVP** | canal sustituible sin tocar casos de uso |
| 23 | Producción por persona y puntos fuera del MVP | derivable después de `case_events` |
| 24 | Un `repo.ts` puede leer el `schema.ts` de otra feature para joins de solo lectura | evita puertos artificiales para un `select` |
| 25 | `ports.ts` deriva tipos de fila con `import type` de su `schema.ts` | no duplicar la forma de la fila |
| 26 | `errors.ts` puede reexportar errores de dominio de otra feature | un error es contrato, no adaptador |
| 27 | Una sola ruta de transiciones (`POST /api/trabajos/:id/acciones`): `CASE_ACTION_ROLES` en la ruta y `canPerform` en el servicio | el rol depende de la acción |
| 28 | La fase es un recurso aparte del estado (`PUT …/fase`), solo en `en_proceso`; «Finalizar» lo sirve solo la barra de acciones | fase y estado avanzan a ritmos distintos |
| 29 | `GET /api/trabajos/tecnicos` en el router de trabajos, devuelve solo `{ id, name }`; `GET …/:id/eventos` resuelve los nombres de técnico de los `assigned` leyendo `users` (ADR 24, solo lectura, una consulta) | recepción no necesita más datos de usuarios |
| 30 | Fecha comprometida en días hábiles sin feriados (`addBusinessDays(inicio, días, [])`) | sin calendario de feriados en el MVP |
| 31 | Reglas de rol y estado en `shared` (`hidesPrices`, `*_ROLES`, `canChangeStage`…), con `Record` exhaustivos | web y API no divergen; lo nuevo no compila sin decidir |
| 32 | Una sola definición por vista rápida (`viewCondition`) para la lista y el resumen del inicio, probada contra Postgres con reloj fijo | los contadores coinciden con sus listas y son correctos |
| 33 | Recorte del MVP a recibir → producir → entregar → cobrar. Entregas con recogidas y cobro por trabajo completos; CAL-1, CAL-3, CTA-4, AVI-1 a AVI-3 y PEM-2 a Post-MVP | lanzar antes sin tocar el flujo que paga al laboratorio |
| 34 | Entregas en su feature; las transiciones que abren o cierran una entrega escriben por un puerto de `cases` (`DeliveryLog`) en la misma transacción, con la factoría inyectada en `drizzleUnitOfWork` desde `app.ts`; al revés, «No se pudo» escribe `delivery_failed` por el puerto `CaseEventLog` de `deliveries`, con su propio `DeliveriesUnitOfWork` compuesto en `app.ts`; `pickup_scheduled` y `shipped` guardan el nombre del mensajero en `reason` (copia en el momento) y la fecha en `toValue`, y `delivery_failed` guarda el tipo (`recogida`/`entrega`) en `fromValue`, el motivo en `reason` y la nueva fecha en `toValue`; las entregas se cierran solo si siguen pendientes (`markDone`/`markFailed` condicionales, 409 si otra petición la cerró antes); `picked_up` lo escribe «Recogido» (`DeliveriesService.pickUp`, por `CaseEventLog`) con el nombre del mensajero asignado en `reason` y `fromValue`/`toValue` nulos, y `recibir` escribe `received` (#118) | el evento y la entrega no se separan; ninguna feature importa el `repo.ts` de la otra; el historial no cambia si el mensajero se renombra; «No se pudo» y las acciones que cierran la misma entrega no se pisan |
| 35 | Cuentas en su feature `accounts`, sin tabla de cargos: el cargo de un trabajo es su `total` o, si es repetición, `total × remake_charge_pct / 100`; neto = cargo + Σ ajustes del trabajo y pendiente = neto − Σ asignaciones vigentes, en centavos. Un ajuste ligado a un trabajo cambia lo que se debe por él; uno sin trabajo solo mueve el saldo. Los pagos no se editan: los anula el admin con motivo, y la anulación deja de contar sus asignaciones (sin borrarlas), devuelve a `entregado` lo que había cerrado y escribe un evento en cada trabajo. Lo no asignado de un pago vigente queda a favor (el saldo puede ser negativo) y se aplica después con asignaciones del mismo pago. `entregado` pasa a `cobrado` (con `paid_at`) cuando el pendiente es ≤ 0 y vuelve cuando deja de serlo, con una sola regla (`isSettled`) que se reevalúa al entregar, asignar, ajustar y anular. Un ajuste que deja lo asignado por encima del neto libera el exceso (de la asignación más reciente a la más antigua) y lo devuelve al saldo a favor de su pago; un ajuste ligado no deja el neto del trabajo por debajo de 0 (lo que exceda va sin trabajo), y el pendiente negativo de un trabajo, que así ya no deja ningún ajuste, cuenta como saldo a favor (defensa). Saldo = Σ cargos de entregados y cobrados + Σ ajustes − Σ pagos vigentes, calculado y nunca guardado; la antigüedad (`agingBuckets`) descuenta lo que resta de la partida más antigua a la más nueva. `accounts` cambia el estado y escribe eventos por su puerto `CaseSettlement`, cumplido en `app.ts` por el repo de `cases` sobre la misma `tx` | el saldo sale siempre de los mismos datos y no se desincroniza; un pago mal registrado deja rastro en vez de desaparecer; anticipos y pagos de más no se pierden; ninguna feature importa el `repo.ts` de la otra |
