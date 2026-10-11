# Iteración 7 — Cierre MVP: plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** el laboratorio puede empezar a usar Dentalware con datos reales:
- recepción avisa a la clínica por WhatsApp desde la ficha;
- técnicos y mensajeros instalan la app en el celular;
- el sistema corre en el VPS con TLS;
- los datos y las fotos se respaldan cada noche fuera del VPS, cifrados, y la recuperación está escrita y probada.

**Architecture:**
- **AVI-4** no tiene backend nuevo. La ficha del trabajo trae además el `whatsapp` de la clínica, como ya trae su teléfono. El texto del aviso es una regla pura de `shared` (`caseWhatsappText`), sin precios por construcción (no recibe importes). La web arma el enlace `wa.me` (`whatsappUrl`, en `lib/map-link.ts`, junto a `telUrl`).
- **PEM-1** se queda en la configuración de `vite-plugin-pwa`: un manifiesto completo, el icono `maskable` separado del `any` y un `favicon.ico` de verdad, protegidos por un test.
- **Infraestructura:**
  - Caddy sin caché por defecto, salvo `/assets/*`, y con su propio healthcheck (#19).
  - Imagen de la API con solo lo que corre, vía `pnpm deploy` (#23).
  - Respaldos con **restic** (en su contenedor oficial: el VPS solo necesita Docker) a **Backblaze B2**. Los dispara un timer de systemd versionado en `infra/backup/`, avisan a healthchecks.io y tienen restauración, simulacro mensual y un job de CI que hace el viaje completo respaldo → borrado → restauración (#111, PEM-3).

**Tech Stack:** pnpm 11, Node 24, Hono + Drizzle + Postgres 17, React 19 + TanStack, `vite-plugin-pwa`, Caddy 2, Docker Compose, restic, systemd, Vitest, Playwright y GitHub Actions.

**Spec:**
- historias AVI-4, PEM-1 y PEM-3 en `docs/superpowers/specs/2026-09-12-historias-de-usuario-mvp.md` (issues #90, #91 y #93; épica #9);
- tareas técnicas #111 (respaldos y recuperación: alcance, RPO 24 h y RTO 4 h), #19 (Caddy) y #23 (imagen de la API);
- ADR 33 de `docs/architecture.md`, que deja PEM-2 (histórico de VEVI) y el driver S3 (#48) en Post-MVP.

Dos PR y una puesta en marcha:
- **PR 1** = Tareas 1–3 (app: AVI-4 y PEM-1), rama `feat/iteracion-7-app`.
- **PR 2** = Tareas 4–8 (infraestructura, respaldos y docs de operación), rama `feat/iteracion-7-infra`, desde `main` tras mergear el PR 1.
- **Tarea 9** = puesta en marcha en el VPS **con Nelson**: cuentas externas, secretos, despliegue, simulacro y teléfonos reales. Nada de ella la hace un subagente solo.
- **Tarea 10** = cierre.

Ledger: `.superpowers/sdd/2026-10-10-iteracion-7-cierre-mvp/progress.md`.

## Decisiones

De las historias y de #111 (Nelson, 2026-10-03), que no se re-litigan:
1. **AVI-4 es solo un enlace `wa.me`.** No hay backend, ni registro de avisos, ni envío automático. El botón abre WhatsApp con el texto listo y la persona decide si lo envía.
2. **RPO 24 h, RTO 4 h.** Destino Backblaze B2, cifrado en el cliente y retención 7 diarias / 4 semanales / 12 mensuales. La copia local se guarda 3 días.
3. **Antes de cargar datos reales**, los respaldos tienen que estar funcionando y el simulacro de recuperación, pasado (#111).

Del plan:

4. **Quién avisa por WhatsApp.** `CASE_NOTIFY_ROLES = ['admin', 'recepcion']` (nueva, en `roles.ts`). El `whatsapp` de la clínica no es dinero, así que la API lo da a cualquier rol, igual que el teléfono (UX4-07). La web solo ofrece el botón a `hasRole(CASE_NOTIFY_ROLES)`.
5. **Sin WhatsApp registrado**, la ficha dice «{Clínica} no tiene WhatsApp registrado.» y cómo añadirlo, según quién la mira:
   - el admin (`SETTINGS_ROLES`, que son quienes editan clínicas) ve el enlace «Añadirlo», a `/configuracion/clinicas?editar={clinicId}`, que abre ya el diálogo de esa clínica;
   - recepción lee «Pídele al administrador que lo añada en Configuración › Clínicas.».
6. **El texto del aviso** (`caseWhatsappText`): «Hola, le escribimos de {laboratorio}. El trabajo {código} (paciente {paciente}) {qué le pasa}.». El laboratorio sale de `useLabSettings`; si no hay datos, dice «del laboratorio». «Qué le pasa» viene de `CASE_WHATSAPP_STATUS_TEXT`, un `Record<CaseStatus, string>` exhaustivo. No lleva doctor, precios ni notas.
7. **Respaldos «a prueba de VPS comprometido»: Object Lock en vez de una clave sin borrado.** #111 pedía una clave de B2 sin `deleteFiles`, pero no funciona con restic:
   - restic necesita borrar sus archivos de bloqueo en cada `backup`;
   - `forget --prune` necesita borrar (documentación de restic, «Security considerations in append-only mode»).

   Se hace así:
   - restic usa el backend **S3** de B2 (`s3:https://s3.<región>.backblazeb2.com/<bucket>`);
   - el bucket se crea con **versionado y Object Lock** (retención por omisión de 30 días) y una regla de ciclo de vida que purga las versiones ocultas a los 30 días;
   - un borrado desde el VPS solo deja una marca de borrado, y la versión anterior sigue recuperable 30 días;
   - la clave de la aplicación se limita a ese bucket.

   Se anota como ADR 36. Si la documentación de B2 que se consulte en la Tarea 6 lo contradice, se para y se consulta a Nelson.
8. **restic corre en contenedor** (`restic/restic`, con la versión fijada en `infra/backup/restic.env`). El VPS no instala nada salvo Docker y systemd, que ya tiene. Los scripts son bash con `set -euo pipefail` y `shellcheck` limpio. Su prueba es de punta a punta: el job de CI `respaldo` (Tarea 6).
9. **Secretos:**
   - viven solo en el `.env` de producción (`infra/.env`, gitignored) y en `/etc/dentalware/restic-password` (`chmod 600`);
   - la contraseña de restic y las claves de B2 se guardan también en el gestor de contraseñas de Nelson;
   - los scripts nunca hacen `echo` de un secreto ni corren con `set -x`;
   - en CI, solo valores de prueba generados en el job.
10. **Healthchecks.io** recibe `start`, éxito y `fail` (con las últimas líneas del log, sin secretos) en `BACKUP_HEALTHCHECK_URL`. Si la variable está vacía, el script no hace ping y lo dice en el log.

**Pendiente de Nelson** (no bloquea los PR 1 y 2; sí bloquea la Tarea 9):
- dominio y DNS;
- crear el bucket de B2 con Object Lock y su clave;
- cuenta de healthchecks.io;
- guardar los secretos en su gestor;
- si se activan los snapshots de Hostinger como capa extra (#111);
- rotar el token de Hostinger;
- probar en un Android y un iPhone reales (PEM-1, absorbe #25).

## Restricciones globales

- Lo de `CLAUDE.md`, `docs/conventions.md` y `docs/architecture.md`.
- TDD: RED visto → GREEN → al menos una mutación por comportamiento clave. En infraestructura, el «test» es el script de verificación o el job de CI, que se ve fallar antes del cambio.
- Contraseñas de prueba solo con `testPassword()`; nunca un literal. En CI y en los scripts de prueba, los secretos se generan en el momento (`openssl rand -hex 24`).
- context7 antes de usar una API de librería o herramienta: `vite-plugin-pwa`, `@vite-pwa/assets-generator`, restic, Caddy y `pnpm deploy`.
- Español en sentence case. 44 px, contraste AA y nunca solo color.
- `Record` exhaustivos y reglas en `shared` con tests literales. Mocks solo de `api.ts`.
- Verificación completa antes de cada commit: `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`. Los scripts de `infra/`, además, con `shellcheck`.
- Commits con `Refs #N`.
- Chrome DevTools a 1280×800, 390×844 y 360×740 en la UI.
- Puertos 3000 y 5173 libres al terminar; nunca `pkill` ni `killall`. Los contenedores que arranque una prueba local se paran por nombre de proyecto (`docker compose -p <proyecto> down -v`).
- Ninguna acción contra el VPS, B2, healthchecks.io ni el DNS fuera de la Tarea 9, y en ella solo con Nelson presente.
- El tablero es el Project 2: mover cada issue al empezar, al abrir el PR y al mergear.

---

## PR 1 — app (AVI-4 y PEM-1)

### Tarea 1: shared + API — texto del aviso y WhatsApp de la clínica en la ficha (AVI-4, #90)

**Files:**
- Modify: `packages/shared/src/roles.ts` (+ `roles.test.ts`): `CASE_NOTIFY_ROLES`.
- Create: `packages/shared/src/case-notify.ts` y `case-notify.test.ts`.
- Modify: `packages/shared/src/index.ts` (exporta `case-notify.ts`).
- Modify:
  - `apps/api/src/features/cases/ports.ts:26`: `clinic` gana `whatsapp: string | null`;
  - `apps/api/src/features/cases/repo.ts:284` y `:381`: `whatsapp: true` en las columnas de `clinic` de `byId` y `byCode`;
  - `apps/api/src/features/cases/fakes.ts:91-97`: `whatsapp: '+593991234567'` en la clínica del fake.
- Test: `apps/api/src/features/cases/routes.test.ts`, el `describe` del detalle (`GET /api/trabajos/:id`).

**Produces** (los usa la Tarea 2):
```ts
// roles.ts
/** Quién avisa a la clínica por WhatsApp desde la ficha (AVI-4): quien la atiende. */
export const CASE_NOTIFY_ROLES: readonly UserRole[] = ['admin', 'recepcion']

// case-notify.ts
export const CASE_WHATSAPP_STATUS_TEXT: Record<CaseStatus, string>
export function caseWhatsappText(input: {
  labName: string | null
  code: string
  patientRef: string
  status: CaseStatus
}): string
```
Y en la ficha (`GET /api/trabajos/:id` y por código): `case.clinic.whatsapp: string | null`, en E.164 con `+` (`+593991234567`), tal como lo guarda `clinicSchema`.

- [ ] **Paso 1: test literal de `CASE_NOTIFY_ROLES`** en `roles.test.ts`:
  ```ts
  it('CASE_NOTIFY_ROLES: admin y recepción avisan a la clínica (AVI-4)', () => {
    expect(CASE_NOTIFY_ROLES).toEqual(['admin', 'recepcion'])
  })
  ```
- [ ] **Paso 2: tests de `case-notify.test.ts`, con valores literales:**
  ```ts
  import { describe, expect, it } from 'vitest'
  import { CASE_WHATSAPP_STATUS_TEXT, caseWhatsappText } from './case-notify.ts'

  describe('CASE_WHATSAPP_STATUS_TEXT (AVI-4)', () => {
    it('dice qué le pasa al trabajo en cada estado, en palabras de la clínica', () => {
      expect(CASE_WHATSAPP_STATUS_TEXT).toEqual({
        por_recoger: 'está registrado y pasaremos a recogerlo',
        nuevo: 'ya llegó al laboratorio',
        en_proceso: 'está en producción',
        en_espera: 'está en espera: necesitamos hablar con ustedes para continuar',
        en_prueba: 'va a su clínica para la prueba',
        terminado: 'está terminado y listo para entregar',
        enviado: 'va en camino a su clínica',
        entregado: 'fue entregado',
        cobrado: 'fue entregado',
        cancelado: 'fue cancelado',
      })
    })
  })

  describe('caseWhatsappText (AVI-4)', () => {
    it('saluda en nombre del laboratorio y dice código, paciente y estado', () => {
      expect(
        caseWhatsappText({
          labName: 'Arte Dental',
          code: '26-00087',
          patientRef: 'Ana Ruiz',
          status: 'terminado',
        }),
      ).toBe(
        'Hola, le escribimos de Arte Dental. El trabajo 26-00087 (paciente Ana Ruiz) está terminado y listo para entregar.',
      )
    })

    it('sin datos del laboratorio, «del laboratorio»', () => {
      expect(
        caseWhatsappText({ labName: null, code: '26-00087', patientRef: 'Ana Ruiz', status: 'enviado' }),
      ).toBe(
        'Hola, le escribimos del laboratorio. El trabajo 26-00087 (paciente Ana Ruiz) va en camino a su clínica.',
      )
    })

    it('un nombre de laboratorio en blanco cuenta como sin datos', () => {
      expect(
        caseWhatsappText({ labName: '  ', code: '26-00001', patientRef: 'X', status: 'nuevo' }),
      ).toMatch(/^Hola, le escribimos del laboratorio\./)
    })

    it('nunca lleva un importe', () => {
      for (const status of Object.keys(CASE_WHATSAPP_STATUS_TEXT) as CaseStatus[]) {
        expect(
          caseWhatsappText({ labName: 'Arte Dental', code: '26-00001', patientRef: 'X', status }),
        ).not.toMatch(/\$|\d+\.\d{2}/)
      }
    })
  })
  ```
- [ ] **Paso 3:** correr `pnpm --filter @dentalware/shared test` → **FAIL** (el módulo no existe).
- [ ] **Paso 4: implementar** `case-notify.ts`:
  ```ts
  import type { CaseStatus } from './case-status.ts'

  /** Qué le pasa al trabajo, dicho a la clínica (AVI-4). Exhaustivo: un estado nuevo no compila
   * sin decidir cómo se le cuenta a la clínica. `cobrado` se cuenta como entregado: el cobro no
   * se anuncia por WhatsApp. */
  export const CASE_WHATSAPP_STATUS_TEXT: Record<CaseStatus, string> = {
    por_recoger: 'está registrado y pasaremos a recogerlo',
    nuevo: 'ya llegó al laboratorio',
    en_proceso: 'está en producción',
    en_espera: 'está en espera: necesitamos hablar con ustedes para continuar',
    en_prueba: 'va a su clínica para la prueba',
    terminado: 'está terminado y listo para entregar',
    enviado: 'va en camino a su clínica',
    entregado: 'fue entregado',
    cobrado: 'fue entregado',
    cancelado: 'fue cancelado',
  }

  /** Texto del aviso por WhatsApp (AVI-4): código, paciente y estado. No recibe importes, así
   * que nunca puede llevar un precio. */
  export function caseWhatsappText(input: {
    labName: string | null
    code: string
    patientRef: string
    status: CaseStatus
  }): string {
    const lab = input.labName?.trim()
    const from = lab ? `de ${lab}` : 'del laboratorio'
    return `Hola, le escribimos ${from}. El trabajo ${input.code} (paciente ${input.patientRef}) ${CASE_WHATSAPP_STATUS_TEXT[input.status]}.`
  }
  ```
  Añadir `CASE_NOTIFY_ROLES` a `roles.ts` y el `export * from './case-notify.ts'` a `index.ts`.
- [ ] **Paso 5:** correr los tests de shared → PASS. Mutación: cambiar `cobrado` a `'fue cobrado'` → el test literal falla; revertir.
- [ ] **Paso 6: test de ruta (RED).** En el `describe` del detalle de `routes.test.ts`:
  - crear la clínica con `whatsapp: '+593991234567'`;
  - comprobar que `GET /api/trabajos/:id` responde `case.clinic.whatsapp === '+593991234567'`, como admin y también como técnico (no es dinero);
  - con una clínica sin WhatsApp, `null`.

  Correr `pnpm --filter @dentalware/api test -- routes` → **FAIL** (`undefined`).
- [ ] **Paso 7:** añadir `whatsapp: true` a las dos selecciones de `repo.ts`, el tipo de `ports.ts` y el fake. Si algún test de servicio compara la clínica completa con `toEqual`, se actualiza. Correr → PASS.
- [ ] **Paso 8:** hacer la verificación completa y commit: `feat(api): la ficha del trabajo trae el WhatsApp de la clínica y shared escribe el aviso` con `Refs #90`.

### Tarea 2: web — «Avisar por WhatsApp» en la ficha (AVI-4, #90)

**Files:**
- Modify: `apps/web/src/lib/map-link.ts` (+ `map-link.test.ts`): `whatsappUrl`.
- Create: `apps/web/src/features/cases/case-whatsapp.tsx` y `case-whatsapp.test.tsx`.
- Modify:
  - `apps/web/src/features/cases/case-header.tsx`: recibe `labName: string | null` y pinta `<CaseWhatsapp>` bajo la línea «clínica · doctor»;
  - `apps/web/src/routes/_app/trabajos/$caseId.tsx`: `useLabSettings()` y pasa `labName={lab.data?.name ?? null}` (un fallo o una carga lenta de los datos del laboratorio no bloquea la ficha);
  - `apps/web/src/routes/_app/configuracion/clinicas.tsx`: `validateSearch` tolerante con `editar?: string`. Con la lista cargada, abre el diálogo de esa clínica una sola vez; al cerrarlo, quita `editar` de la URL con `replace`.
- Test: `case-header.test.tsx` (el componente aparece), la prueba de la ruta de clínicas si existe, o una en `clinics` para `?editar`, y E2E en `apps/web/e2e/trabajos.spec.ts`.

**Consumes:** `CASE_NOTIFY_ROLES`, `SETTINGS_ROLES`, `hasRole` y `caseWhatsappText` de shared; `case.clinic.whatsapp` de la Tarea 1.

**Produces:**
```ts
// lib/map-link.ts
/** Enlace `wa.me` (AVI-4): el número en E.164 sin `+` y el texto codificado. No envía nada. */
export function whatsappUrl(e164: string, text: string): string
```

- [ ] **Paso 1: tests de `whatsappUrl` (RED):**
  ```ts
  it('wa.me con el número sin «+» y el texto codificado (AVI-4)', () => {
    expect(whatsappUrl('+593991234567', 'Hola, ¿cómo están? 26-00087 #3')).toBe(
      'https://wa.me/593991234567?text=Hola%2C%20%C2%BFc%C3%B3mo%20est%C3%A1n%3F%2026-00087%20%233',
    )
  })
  it('un número guardado sin «+» se usa tal cual', () => {
    expect(whatsappUrl('593991234567', 'x')).toBe('https://wa.me/593991234567?text=x')
  })
  ```
- [ ] **Paso 2: implementar:**
  ```ts
  export function whatsappUrl(e164: string, text: string): string {
    return `https://wa.me/${e164.replace(/^\+/, '')}?text=${encodeURIComponent(text)}`
  }
  ```
  Correr → PASS.
- [ ] **Paso 3: tests de `CaseWhatsapp` (RED)**, con `renderWithRouter`:
  - **recepción con WhatsApp:** el enlace «Avisar por WhatsApp a Clínica Sur (se abre en otra pestaña)»:
    - tiene `href` igual a `whatsappUrl('+593991234567', caseWhatsappText({...}))`;
    - `target="_blank"` y `rel` con `noopener`;
    - el texto decodificado del `href` no contiene `$` aunque el trabajo tenga `total: '120.00'`.
  - **admin con WhatsApp:** el mismo enlace.
  - **técnico y mensajero:** no se pinta nada (`container` vacío), tengan o no WhatsApp.
  - **recepción sin WhatsApp:**
    - no hay enlace;
    - se lee «Clínica Sur no tiene WhatsApp registrado.» y «Pídele al administrador que lo añada en Configuración › Clínicas.»;
    - no hay enlace «Añadirlo».
  - **admin sin WhatsApp:** el mismo aviso y el enlace «Añadirlo» a `/configuracion/clinicas?editar=<clinicId>`.
  - **El enlace mide 44 px:** clase `h-11` o `min-h-11`.
- [ ] **Paso 4: implementar `case-whatsapp.tsx`:**
  ```tsx
  import type { UserRole } from '@dentalware/shared'
  import { CASE_NOTIFY_ROLES, SETTINGS_ROLES, caseWhatsappText, hasRole } from '@dentalware/shared'
  import { Link } from '@tanstack/react-router'
  import { ExternalLink, MessageCircle } from 'lucide-react'
  import { Button } from '@/components/ui/button'
  import { whatsappUrl } from '@/lib/map-link'
  import type { CaseDetail } from './api'

  /** «Avisar por WhatsApp» (AVI-4): abre WhatsApp con el aviso escrito; no envía nada por sí
   * solo. Solo para quien atiende a la clínica (`CASE_NOTIFY_ROLES`). Sin WhatsApp registrado,
   * dice cómo añadirlo: el admin, que edita clínicas, con un enlace al diálogo de esa clínica. */
  export function CaseWhatsapp({
    case: c,
    role,
    labName,
  }: {
    case: CaseDetail
    role: UserRole
    labName: string | null
  }) {
    if (!hasRole(CASE_NOTIFY_ROLES, role) || !c.clinic) return null
    const { clinic } = c
    if (!clinic.whatsapp) {
      return (
        <p className="text-sm text-muted-foreground">
          {clinic.name} no tiene WhatsApp registrado.{' '}
          {hasRole(SETTINGS_ROLES, role) ? (
            <Link
              to="/configuracion/clinicas"
              search={{ editar: clinic.id }}
              className="inline-flex min-h-11 items-center text-primary underline underline-offset-2"
            >
              Añadirlo
            </Link>
          ) : (
            'Pídele al administrador que lo añada en Configuración › Clínicas.'
          )}
        </p>
      )
    }
    const text = caseWhatsappText({
      labName,
      code: c.code,
      patientRef: c.patientRef,
      status: c.status,
    })
    return (
      <Button asChild variant="outline" className="h-11 self-start">
        <a
          href={whatsappUrl(clinic.whatsapp, text)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Avisar por WhatsApp a ${clinic.name} (se abre en otra pestaña)`}
        >
          <MessageCircle aria-hidden />
          Avisar por WhatsApp
          <ExternalLink aria-hidden className="size-3.5 opacity-70" />
        </a>
      </Button>
    )
  }
  ```
  Si `CaseDetail` (inferido de la API) no deja `c.clinic` como opcional, el `!c.clinic` se quita (el header ya usa `c.clinic?.name`; se sigue el mismo criterio). Correr → PASS. Mutación: quitar el `hasRole(CASE_NOTIFY_ROLES…)` → falla el test del técnico; revertir.
- [ ] **Paso 5: cabecera y ruta.**
  - Test en `case-header.test.tsx`: con `role="recepcion"` y una clínica con WhatsApp, el enlace aparece. Sin `labName`, el componente se monta con `null`.
  - Implementar la prop `labName` (opcional, por omisión `null`, para no tocar a los llamadores de test) y montar `<CaseWhatsapp>` justo después del `<p>` de clínica · doctor.
  - En `$caseId.tsx`, pasar el nombre desde `useLabSettings()`.
- [ ] **Paso 6: `?editar` en «Clínicas».**
  - Test (RED): con la URL `/configuracion/clinicas?editar=<id>`, al cargar la lista se abre el diálogo «Editar clínica» con el nombre de esa clínica.
  - Test: al cerrarlo con «Volver», la URL ya no tiene `editar`.
  - Test: con un `editar` desconocido, no se abre nada ni hay error.
  - Implementar con `validateSearch: z.object({ editar: z.string() }).partial().catch({})`, como manda `docs/conventions.md` §5, y un efecto que, con la lista cargada, llame a `setEditing(clinic)` y navegue con `replace` quitando `editar`.
- [ ] **Paso 7: E2E `@clave`** en `trabajos.spec.ts`, «recepción avisa por WhatsApp desde la ficha (AVI-4)»:
  - admin crea una clínica con `whatsapp: '+593991234567'` (por API; ampliar `createClinicWithDoctor` con `whatsapp?` en su `contact`) y un trabajo de esa clínica;
  - con `createStaff(page, 'recepcion')` en un contexto aparte (cerrado en `finally`), abre la ficha;
  - el enlace «Avisar por WhatsApp…» tiene `href` que empieza por `https://wa.me/593991234567?text=`;
  - el texto decodificado contiene el código del trabajo y no contiene `$`.

  Un segundo caso, con una clínica sin WhatsApp: admin ve «Añadirlo» y, al seguirlo, el diálogo de la clínica abierto.
- [ ] **Paso 8: Chrome DevTools** a 1280×800, 390×844 y 360×740. Comprobar:
  - la ficha como recepción, con y sin WhatsApp, y como admin, sin WhatsApp;
  - el botón no parte la cabecera y mide 44 px;
  - el aviso sin WhatsApp se lee en una o dos líneas a 360;
  - la consola, limpia.

  Abrir el enlace no hace falta: basta con el `href`. Capturas en el directorio del ledger.
- [ ] **Paso 9:** añadir a `docs/conventions.md` §5 una línea «**Avisos por WhatsApp**» con la decisión 4–6: `CaseWhatsapp`, `caseWhatsappText` y `whatsappUrl`, sin precios y para `CASE_NOTIFY_ROLES`. Barrido táctil: añadir la ficha con el botón a `accesibilidad.spec.ts` si la ficha no está ya barrida como recepción.
- [ ] **Paso 10:** hacer la verificación completa, correr el E2E de `trabajos.spec.ts` (escritorio y android) y commit: `feat(web): «Avisar por WhatsApp» en la ficha del trabajo` con `Refs #90`.

### Tarea 3: PWA instalable — manifiesto, iconos y favicon (PEM-1, #91; parte de #23)

**Files:**
- Create: `apps/web/src/pwa-manifest.ts` (el objeto `manifest` y la lista de `includeAssets`, exportados) y `apps/web/src/pwa-manifest.test.ts`.
- Modify: `apps/web/vite.config.ts`, para usar el objeto de `pwa-manifest.ts`.
- Create: `apps/web/pwa-assets.config.ts`, la configuración de `@vite-pwa/assets-generator` desde `public/icon.svg`.
- Modify: `apps/web/package.json`, con el script `"icons": "pwa-assets-generator"` y la devDependency por `catalog:` (añadir al `catalog` de `pnpm-workspace.yaml`).
- Regenerate: `apps/web/public/`:
  - `favicon.ico` (ICO de verdad, no PNG renombrado);
  - `pwa-64x64.png`, `pwa-192x192.png` y `pwa-512x512.png`;
  - `maskable-icon-512x512.png`;
  - `apple-touch-icon-180x180.png` (o `apple-touch-icon.png`, según el preset).
- Modify: `apps/web/index.html`, si cambia el nombre del icono de Apple.

**Produces:** el manifiesto con `id: '/'`, `scope: '/'`, `start_url: '/'`, `display: 'standalone'`, `lang: 'es'`. El icono `maskable` va en su propia entrada (`purpose: 'maskable'`), y los `any`, en las suyas: no `'any maskable'`, que Chrome desaconseja porque recorta el icono `any`.

- [ ] **Paso 1: context7.** Consultar `vite-plugin-pwa` y `@vite-pwa/assets-generator`: el preset vigente (`minimal-2023` o el que lo sustituya), los nombres de archivo que genera y cómo se declara el manifiesto. Anotar la versión en el reporte.
- [ ] **Paso 2: test (RED)** en `pwa-manifest.test.ts`, con `node:fs` sobre `public/`:
  - **Campos del manifiesto:** `name`, `short_name`, `lang`, `display`, `start_url`, `scope` e `id`, con valores literales.
  - **Iconos:**
    - hay un `any` de 192 y uno de 512;
    - hay un `maskable` de 512;
    - ninguna entrada tiene `purpose` con dos valores.
  - **Archivos:** cada `src` de `icons` y cada `includeAssets` existe en `public/`. Las dimensiones del PNG coinciden con `sizes`: se leen del IHDR, bytes 16–23, sin dependencias.
  - **Favicon:** `favicon.ico` empieza por los bytes ICO `00 00 01 00`. Hoy falla: es un PNG.
  - **`index.html`:** referencia un `apple-touch-icon` que existe en `public/`.
- [ ] **Paso 3:** correr `pnpm --filter @dentalware/web test -- pwa-manifest` → **FAIL** (ICO y `maskable`).
- [ ] **Paso 4:** generar los iconos con `pnpm --filter @dentalware/web icons`. Mover el manifiesto a `pwa-manifest.ts`, separar el `maskable` y añadir `id` y `scope`. Usar el `theme_color` actual (`#0f766e`), salvo que no cuadre con `--primary` de `index.css`; en ese caso se usa el token y se anota en el reporte. Actualizar `includeAssets` y `index.html`. Correr → PASS.
- [ ] **Paso 5: comprobar en un build real.**
  - `pnpm --filter @dentalware/web build && pnpm --filter @dentalware/web preview --port 4173`, con la API en 3000 si hace falta para el login.
  - En Chrome DevTools:
    - Application › Manifest, sin errores ni avisos de instalabilidad;
    - el service worker activo;
    - Lighthouse (categoría PWA o, si ya no existe, las comprobaciones de instalabilidad del panel Application).
  - Abrir `/` sin sesión → `/login`.
  - Capturas del manifiesto y de los iconos en el directorio del ledger. Parar `preview` por su PID.
- [ ] **Paso 6:** en `docs/architecture.md` §3 «PWA», anotar el manifiesto en `pwa-manifest.ts`, el icono `maskable` separado y que los iconos se regeneran con `pnpm --filter @dentalware/web icons`.
- [ ] **Paso 7:** hacer la verificación completa y commit: `feat(web): PWA instalable con iconos maskable y favicon de verdad` con `Refs #91 #23`.

La prueba en teléfonos reales (Android «Instalar», iPhone «Añadir a pantalla de inicio» a pantalla completa, actualización al reabrir) necesita el despliegue con TLS: va en la Tarea 9, con Nelson.

**Cierre del PR 1:**
- revisión final de la rama, su ronda de fixes y E2E de escritorio y android;
- PR «Iteración 7 (1/2): aviso por WhatsApp y PWA instalable», con `Closes #90` y `Refs #91 #23` (PEM-1 se cierra tras el teléfono real);
- automerge con CI en verde y la rama borrada.

---

## PR 2 — infraestructura, respaldos y operación

### Tarea 4: Caddy — sin caché por defecto y con healthcheck (#19)

**Files:**
- Modify: `infra/Caddyfile`.
- Modify: `infra/docker-compose.yml`: `healthcheck` del servicio `caddy`.
- Create: `infra/tests/caddy-headers.sh`, que construye la imagen web, levanta solo Caddy con `SITE_ADDRESS=:80` en un puerto libre y comprueba cabeceras con `curl -sI`.
- Modify: `.github/workflows/ci.yml`: job nuevo `infra`, que corre `shellcheck infra/**/*.sh` y `infra/tests/caddy-headers.sh`.

- [ ] **Paso 1: context7 (Caddy).** Consultar el orden de las directivas `header` y `handle`, los matchers y que un `header` con matcher se evalúa contra la ruta **pedida**, no contra la que reescribe `try_files`. Así se explica el fallo de #19.
- [ ] **Paso 2: test (RED)** `infra/tests/caddy-headers.sh`, que comprueba:
  - `/`, `/login` y `/trabajos/x` responden 200 con `Cache-Control: no-cache`; hoy no lo traen, y ahí está el fallo;
  - `/sw.js` y `/manifest.webmanifest`, con `no-cache`;
  - un archivo real de `/assets/` (se toma el primero de `index.html`), con `public, max-age=31536000, immutable`;
  - las cabeceras de seguridad (`Strict-Transport-Security`, `X-Content-Type-Options`), presentes.

  El script falla con un mensaje claro por cada cabecera, limpia su contenedor con `trap` y usa un nombre de contenedor propio. Correrlo en local → **FAIL** en `/login`.
- [ ] **Paso 3: implementar.** En el `Caddyfile`, quitar el matcher `@nocache` y poner:
  ```caddyfile
  # El shell, el service worker y el manifiesto nunca se cachean: no-cache por defecto (#19).
  # El matcher por ruta no servía: se evalúa con la ruta pedida (/login), no con la que
  # reescribe try_files (/index.html). Los assets llevan hash en el nombre: inmutables.
  header Cache-Control "no-cache"
  header /assets/* Cache-Control "public, max-age=31536000, immutable"
  ```
  Comprobar con context7 que la segunda directiva gana sobre la primera en `/assets/*` (orden de `header` y `defer`). El test lo dice en cualquier caso.
- [ ] **Paso 4: healthcheck** del servicio `caddy` en `docker-compose.yml`:
  - con `wget -qO- http://localhost:2019/config/ >/dev/null` (API de administración, solo local en el contenedor) o un `respond /healthz 200` en el `Caddyfile` que lo cubra; se elige lo que confirme context7 y se dice en el reporte;
  - `interval: 30s`, `timeout: 5s` y `retries: 3`.

  El script de prueba comprueba que el contenedor llega a `healthy`.
- [ ] **Paso 5:** correr el script → PASS; `shellcheck` limpio. Añadir el job `infra` a `ci.yml` en paralelo con los otros dos, sin servicios.
- [ ] **Paso 6:** commit `fix(infra): Caddy sin caché por defecto salvo assets, y healthcheck` con `Refs #19`.

### Tarea 5: imagen de la API liviana y Postgres de desarrollo solo en local (#23)

**Files:**
- Modify: `infra/api.Dockerfile`.
- Modify: `infra/docker-compose.dev.yml`: `'127.0.0.1:5433:5432'`.
- Create: `infra/tests/api-image.sh`, que construye la imagen y comprueba su tamaño y que arranca: compose efímero con Postgres, la API migra y `/api/health` responde 200.
- Modify: `.github/workflows/ci.yml`: el job `infra` corre también `api-image.sh`.

- [ ] **Paso 1: context7 (`pnpm deploy`).** Consultar `pnpm --filter @dentalware/api deploy --prod <dir>` en pnpm 11: si exige `inject-workspace-packages=true` o `--legacy`, cómo incluye `@dentalware/shared` (su `dist/`, según el `files` de su `package.json`) y si respeta `files` de la API (hoy no tiene: añadir `"files": ["dist", "drizzle"]` si hace falta).
- [ ] **Paso 2: test (RED)** `infra/tests/api-image.sh`:
  - `docker build -f infra/api.Dockerfile -t dentalware-api:test .`;
  - el tamaño (`docker image inspect -f '{{.Size}}'`) es menor que un umbral de 350 MB; anotar en el reporte el tamaño antes y después; hoy son ≈ 653 MB;
  - la imagen no contiene `apps/api/src`, `apps/web` ni `tsconfig.base.json` (`docker run --rm --entrypoint sh … -c 'test ! -e …'`);
  - con un `docker compose -p dw-api-test` efímero (Postgres + API, secretos generados con `openssl rand -hex 24` y `ADMIN_PASSWORD` igual), el contenedor `api` llega a `healthy` y `curl /api/health` da 200; después, `down -v`.

  Correr → **FAIL** por tamaño y por los archivos de fuentes.
- [ ] **Paso 3: implementar** el Dockerfile:
  - en `build`, después del `build`, `pnpm --filter @dentalware/api deploy --prod /prod/api`, con la opción que pida pnpm 11;
  - en `runtime`, `COPY --from=build --chown=node:node /prod/api /app`, `WORKDIR /app` y `CMD ["node", "dist/main.js"]`;
  - las migraciones siguen en `/app/drizzle`: `apps/api/src/db/migrate.ts` las busca en `new URL('../../drizzle', import.meta.url)`, que desde `/app/dist/db/migrate.js` resuelve a `/app/drizzle`; comprobarlo en el test de arranque (la API migra al arrancar);
  - el `HEALTHCHECK` no cambia.
- [ ] **Paso 4:** correr el script → PASS. `docker-compose.dev.yml` con `127.0.0.1:5433:5432`; comprobar que `pnpm db:up` y los tests de la API siguen pasando en local.
- [ ] **Paso 5:** commit `perf(infra): imagen de la API solo con lo que corre (pnpm deploy)` con `Refs #23`.

### Tarea 6: respaldo y restauración con restic, probados de punta a punta en CI (#111, PEM-3 #93)

**Files:**
- Create: `infra/backup/restic.env`, versionado y sin secretos:
  - `RESTIC_IMAGE=restic/restic:<versión vigente>`;
  - la retención (`KEEP_DAILY=7`, `KEEP_WEEKLY=4`, `KEEP_MONTHLY=12`);
  - `LOCAL_KEEP_DAYS=3`.
- Create: `infra/backup/lib.sh`, con las funciones comunes:
  - cargar `infra/.env` y `restic.env`;
  - `restic_run` (el `docker run --rm` de restic con las variables y montajes necesarios);
  - `hc_ping`;
  - `log`.
- Create: `infra/backup/backup.sh`, que sustituye a `infra/backup.sh`. Se deja una línea en el viejo que redirige al nuevo durante un PR; después se borra en este mismo PR, si nada lo referencia.
- Create: `infra/backup/restore.sh`.
- Create: `infra/tests/backup-roundtrip.sh`.
- Modify: `.github/workflows/ci.yml`: job `respaldo`, que corre `backup-roundtrip.sh`.
- Modify: `infra/.env.example` (ya existe; valores de ejemplo, nunca reales). `infra/.env` existe en la máquina de Nelson y está en `.gitignore`: **no se lee ni se toca**; las pruebas generan el suyo en un directorio temporal. Variables nuevas:
  - `RESTIC_REPOSITORY`;
  - `RESTIC_PASSWORD_FILE`;
  - `AWS_ACCESS_KEY_ID`;
  - `AWS_SECRET_ACCESS_KEY`;
  - `BACKUP_HEALTHCHECK_URL`;
  - `BACKUP_LOCAL_DIR`.

**Produces** (los usan las Tareas 7 y 8):
- `infra/backup/backup.sh`. Sin argumentos:
  1. toma un `flock` en `/run/lock/dentalware-backup.lock` o `$BACKUP_LOCAL_DIR/.lock`; si ya hay uno corriendo, sale con 75 y lo registra;
  2. hace ping `start`;
  3. hace `pg_dump -Fc` con `docker compose exec -T postgres` a `$BACKUP_LOCAL_DIR/db/dentalware-<fecha>.dump`;
  4. ejecuta `restic backup`, con la etiqueta `diario` y estas rutas:
     - el volumen `dentalware_uploads`, montado de solo lectura en `/data/uploads`;
     - el dump del día, en `/backup/db/`;
     - la configuración (`infra/.env` e `infra/Caddyfile`), en `/backup/config/`;
  5. aplica `restic forget --keep-daily … --prune` y `find "$BACKUP_LOCAL_DIR/db" -mtime +$LOCAL_KEEP_DAYS -delete`;
  6. hace ping de éxito con un resumen (`snapshot <id>`, tamaño añadido).

  Cualquier fallo dispara el `trap ERR`, que hace ping `fail` con las últimas 20 líneas del log y sale con un código ≠ 0.
- `infra/backup/restore.sh [--snapshot <id>|latest] [--solo-archivos <ruta>] [--con-config <dir>]`. Restaura en un directorio temporal y después:
  1. para `api`;
  2. hace `pg_restore --clean --if-exists --no-owner` del dump en la BD de `docker compose`;
  3. copia `/data/uploads` al volumen (`docker run --rm -v dentalware_uploads:/data alpine cp -a`);
  4. arranca `api`.

  `--solo-archivos` restaura únicamente los archivos que casan con la ruta, para un borrado accidental, y no toca la BD. `--con-config` deja `.env` y `Caddyfile` en ese directorio para revisarlos, sin sobrescribir los vigentes.
- Las dos leen `COMPOSE_PROJECT_NAME`, que por omisión es `dentalware`, y `COMPOSE_FILE`. Así la prueba usa un proyecto propio.

- [ ] **Paso 1: context7 (restic) y la documentación de B2.**
  - restic: la versión vigente de la imagen; `backup` con varias rutas, `--tag` y `--host`; `forget --prune`; `restore --target` con `--include`; `snapshots --json`; `check --read-data-subset`; el backend `s3:` con B2 (las variables `AWS_*` y la región en la URL).
  - B2: Object Lock y versionado por la API S3, qué hace un `DeleteObject` sin versión (una marca de borrado) y la regla de ciclo de vida.

  Si algo contradice la decisión 7, se para y se consulta. Anotar las fuentes en el reporte.
- [ ] **Paso 2: test (RED)** `infra/tests/backup-roundtrip.sh`, de punta a punta, sin red externa:
  1. Genera un `.env` temporal con secretos aleatorios, un `RESTIC_REPOSITORY` local (`/tmp/dw-restic-<rand>`, montado en el contenedor de restic por `lib.sh` cuando el repositorio es una ruta) y una contraseña de restic en un archivo `chmod 600`.
  2. Levanta `docker compose -p dw-backup-test` con Postgres y la API (imagen de la Tarea 5), espera a `healthy` y ejecuta `restic init`.
  3. Crea datos:
     - por la API, con el admin del `.env` temporal: una clínica, un doctor, un producto y un trabajo;
     - un adjunto subido por `POST /api/adjuntos/trabajo/:caseId` (multipart), con `apps/web/e2e/fixtures/foto.png`.

     Guarda los conteos de `cases`, `clinics` y `attachments` y el `sha256` del archivo en el volumen.
  4. Corre `infra/backup/backup.sh` → hay 1 snapshot (`restic snapshots --json`).
  5. **Desastre:** `docker compose down -v`, que borra la BD y el volumen de adjuntos.
  6. Levanta Postgres vacío y la API, y corre `infra/backup/restore.sh --snapshot latest`.
  7. Comprueba:
     - los mismos conteos;
     - el mismo `sha256`;
     - que `GET /api/adjuntos/:id` (con sesión) da 200 con el mismo tamaño: «las fotos accesibles desde las fichas».
  8. `--solo-archivos`: borra el archivo del volumen, restaura solo ese archivo y vuelve a comprobar el `sha256`.
  9. Corre `backup.sh` dos veces a la vez: una sale con 75 («ya hay un respaldo en curso»).
  10. Con un `BACKUP_HEALTHCHECK_URL` que apunta a un `nc -l` o a un contenedor `mendhak/http-https-echo` local, comprueba que llegaron `/start` y el ping de éxito. Con un `pg_dump` forzado a fallar (`POSTGRES_DB` inexistente en una copia del `.env`), llega `/fail` y el script sale ≠ 0.
  11. `trap` final: `down -v` y borra los temporales.

  Correr → **FAIL** (no existen `backup/backup.sh` ni `restore.sh`).
- [ ] **Paso 3: implementar** `lib.sh`, `backup.sh` y `restore.sh` hasta que pase. Reglas:
  - `set -euo pipefail`; nunca `set -x`; nada de `echo` de variables de secreto;
  - las variables de restic llegan al contenedor con `--env-file` filtrado o `-e VAR` sin valor (hereda del entorno), nunca en la línea de comandos;
  - el log va a stdout con fecha ISO (`journald` lo guarda en la Tarea 7).
- [ ] **Paso 4:** `shellcheck infra/**/*.sh` limpio; el script de prueba pasa en local dos veces seguidas (idempotencia de la limpieza).
- [ ] **Paso 5:** job `respaldo` en `ci.yml`: `ubuntu-latest`, sin servicios (usa su propio compose) y `timeout-minutes: 20`. Corre en el PR y en `main`.
- [ ] **Paso 6:** borrar `infra/backup.sh` si ya no lo referencia nada (`grep -rn "infra/backup.sh"`), y actualizar las referencias (`docs/architecture.md` §6 dice `infra/backup.sh`). Commit `feat(infra): respaldo cifrado con restic y restauración probada de punta a punta` con `Refs #111 #93`.

### Tarea 7: programación, alertas y verificación automática (#111)

**Files:**
- Create: en `infra/backup/systemd/`:
  - `dentalware-backup.service` y `dentalware-backup.timer`;
  - `dentalware-backup-check.service` y `dentalware-backup-check.timer`;
  - `dentalware-restore-drill.service` y `dentalware-restore-drill.timer`.
- Create: `infra/backup/check.sh`, que ejecuta `restic check --read-data-subset=5%` con ping a su propio check de healthchecks (`BACKUP_CHECK_HEALTHCHECK_URL`).
- Create: `infra/backup/drill.sh`, el simulacro mensual:
  1. restaura `latest` en un directorio temporal;
  2. levanta un Postgres temporal (`docker run --rm --name dw-drill-pg` en una red propia);
  3. ejecuta `pg_restore`;
  4. compara contra producción:
     - los conteos restaurados de `cases`, `clinics` y `attachments` son mayores que 0;
     - son ≥ los de producción filtrados por `created_at <= hora del snapshot`, porque lo creado después no está y lo borrado después sí;
  5. comprueba que N = 5 adjuntos al azar del dump existen en los archivos restaurados con el mismo tamaño;
  6. hace ping a `BACKUP_DRILL_HEALTHCHECK_URL` y lo limpia todo con `trap`.
- Create: `infra/backup/install.sh`, idempotente, como root:
  1. comprueba que existen `infra/.env` con las variables de respaldo y `RESTIC_PASSWORD_FILE` con permisos `600`; si falta algo, dice cuál, sin mostrar valores;
  2. copia las unidades a `/etc/systemd/system/` sustituyendo `@DENTALWARE_DIR@` por la ruta del repo;
  3. hace `daemon-reload` y `enable --now` de los tres timers;
  4. ejecuta `restic snapshots` para comprobar el acceso, o `restic init` si el repositorio no existe y se pasa `--init`;
  5. muestra `systemctl list-timers 'dentalware-*'`.
- Modify: `infra/tests/backup-roundtrip.sh`, que cubre también `drill.sh` y `check.sh` contra el repositorio local.
- Modify: `infra/.env.example`, con `BACKUP_CHECK_HEALTHCHECK_URL` y `BACKUP_DRILL_HEALTHCHECK_URL`.

**Timers**, todos con `Persistent=true`, porque si el VPS estaba apagado corren al arrancar:
- `backup`: `OnCalendar=*-*-* 03:00:00 America/Guayaquil` y `RandomizedDelaySec=10m`.
- `check`: `OnCalendar=Sun *-*-* 05:00:00 America/Guayaquil`.
- `drill`: `OnCalendar=*-*-01 05:30:00 America/Guayaquil`.

Los servicios son `Type=oneshot`, con `WorkingDirectory=@DENTALWARE_DIR@/infra` y `Nice=10`. `backup` lleva `TimeoutStartSec=2h`, y el log va a journald (`journalctl -u dentalware-backup`).

- [ ] **Paso 1: test (RED).**
  - En `backup-roundtrip.sh`, tras el respaldo:
    - `drill.sh` pasa con el repositorio local y el compose de prueba como «producción»;
    - con un adjunto borrado del repositorio restaurado, el simulacro falla (se simula pasándole un `DRILL_SAMPLE` que apunta a un archivo que no existe);
    - `check.sh` pasa.
  - Un test de las unidades: `systemd-analyze verify` sobre las unidades con la ruta sustituida (en CI, `ubuntu-latest` tiene systemd) y `systemd-analyze calendar` de cada `OnCalendar`.

  Correr → FAIL.
- [ ] **Paso 2:** implementar `check.sh`, `drill.sh`, las unidades y `install.sh`. `install.sh` se prueba en CI con `--dry-run`: imprime lo que copiaría y haría, sin tocar `/etc`.
- [ ] **Paso 3:** shellcheck limpio y el test, en verde en local y en CI.
- [ ] **Paso 4:** commit `feat(infra): respaldo programado con systemd, alertas y simulacro mensual` con `Refs #111`.

### Tarea 8: docs de operación — despliegue y recuperación (#111, PEM-3)

**Files:**
- Create: `docs/operacion/despliegue.md`. Cubre:
  - requisitos del VPS (Docker, systemd y puertos 80/443);
  - DNS (registro A del dominio a la IP del VPS);
  - clonar en `/opt/dentalware`;
  - el `infra/.env` a partir de `.env.example`: qué es cada variable, cómo generar los secretos (`openssl rand -hex 32`), `SITE_ADDRESS` = dominio (Caddy saca el certificado solo) y `PUBLIC_URL` = `https://dominio`;
  - `docker compose -f infra/docker-compose.yml up -d --build`;
  - comprobar el TLS, `/api/health` y el login del admin;
  - instalar los respaldos (`install.sh`);
  - actualizar (`git pull && docker compose up -d --build`, recordando que `PUBLIC_URL` exige `--build`);
  - qué mirar si algo falla (`docker compose logs`, `journalctl`).
- Create: `docs/operacion/recuperacion.md`. Cubre los tres casos de #111:
  - **pérdida total del VPS**, en orden: VPS nuevo, Docker, clonar, recuperar del gestor de Nelson la contraseña de restic y las claves de B2, `restic restore --con-config`, revisar y colocar el `.env`, `up`, `restore.sh`, DNS, verificar con la lista de abajo y anotar el tiempo;
  - **BD corrupta o borrada a una fecha:** `restic snapshots`, elegir y `restore.sh --snapshot <id>`;
  - **archivos borrados:** `restore.sh --solo-archivos <ruta>`.

  Con una lista de verificación final: trabajos, clínicas, fotos que abren en la ficha, login y el respaldo siguiente en verde. Y una sección «Si el VPS estuvo comprometido»: rotar todos los secretos y recuperar versiones previas del bucket (Object Lock, 30 días).
- Create: `docs/operacion/respaldos.md`. Explica:
  - qué se respalda, cuándo y dónde;
  - la retención;
  - las alertas;
  - cómo ver el estado (`systemctl list-timers`, `journalctl`, `restic snapshots`);
  - dónde están los secretos (en el gestor de Nelson; el repositorio no los tiene);
  - cómo crear el bucket de B2 con versionado, Object Lock a 30 días, ciclo de vida y una clave limitada a ese bucket.
- Modify: `docs/architecture.md`:
  - §6, «Respaldos» → los tres docs;
  - §7: los jobs `infra` y `respaldo` de CI, el deploy y Caddy sin caché por defecto;
  - ADR 36: restic a B2 con Object Lock (decisión 7) y restic en contenedor (decisión 8).
- Modify: `docs/conventions.md` §8: los scripts de `infra/` con `shellcheck` y su prueba en `infra/tests/`.

- [ ] **Paso 1:** escribir los tres documentos siguiendo los scripts reales de las Tareas 6 y 7. Todos los comandos deben existir; se copian de los scripts, no se inventan.
- [ ] **Paso 2: ensayo en seco local del runbook de pérdida total.** Seguir `recuperacion.md` paso a paso en la máquina local, con un proyecto compose aparte y el repositorio de restic local (el «bucket» es un directorio). Cronometrarlo y corregir el documento donde falle. Anotar en el reporte el tiempo medido y los cambios.
- [ ] **Paso 3:** commit `docs: despliegue, respaldos y recuperación del laboratorio` con `Refs #111 #93`.

**Cierre del PR 2:**
- revisión final de la rama (con foco en secretos: `git grep` de patrones de claves y GitGuardian en verde) y su ronda de fixes;
- PR «Iteración 7 (2/2): Caddy, imagen de la API y respaldos fuera del VPS», con `Closes #19 #23` y `Refs #111 #93`, que se cierran en la Tarea 9, tras el simulacro real;
- automerge con CI en verde y la rama borrada.

---

## Tarea 9: puesta en marcha en el VPS (con Nelson)

Todo lo de esta tarea ocurre fuera del repositorio y toca cuentas y servidores de Nelson. **Cada paso se confirma con él antes de hacerlo.** Los secretos los escribe él o se generan en el VPS, sin pasar por el chat.

- [ ] **Paso 1: Nelson decide.**
  - Dominio (`SITE_ADDRESS` y `PUBLIC_URL`).
  - Si se activan los snapshots semanales de Hostinger (#111).
  - Si se rota el token de la API de Hostinger antes de usar el MCP.
- [ ] **Paso 2: Nelson crea** (con `docs/operacion/respaldos.md` delante):
  - el bucket privado de B2, en una región distinta a la del VPS, con versionado, Object Lock a 30 días y ciclo de vida;
  - la clave de aplicación limitada a ese bucket;
  - la cuenta de healthchecks.io, con tres checks (diario con 2 h de gracia, semanal y mensual);
  - las entradas de su gestor de contraseñas: contraseña de restic, claves de B2 y `.env` de producción.
- [ ] **Paso 3: despliegue.** Seguir `docs/operacion/despliegue.md` en el VPS, por SSH, con Nelson:
  - DNS;
  - `.env`;
  - `up -d --build`;
  - TLS válido (`curl -I https://<dominio>`);
  - login del admin;
  - Chrome DevTools contra el dominio a 1280, 390 y 360, con la consola limpia.
- [ ] **Paso 4: respaldos.** Ejecutar `install.sh --init` y lanzar un primer `systemctl start dentalware-backup`. Comprobar:
  - el snapshot en `restic snapshots`;
  - el ping verde en healthchecks;
  - el archivo en el bucket.

  Al día siguiente, comprobar el respaldo automático de la noche y que un adjunto subido ayer está en él (criterio de PEM-3).
- [ ] **Paso 5: simulacro real** (criterio de #111). Seguir `recuperacion.md` («pérdida total») en una máquina limpia (un VPS temporal o la máquina de Nelson), solo con el documento y los secretos del gestor:
  - cronometrar;
  - verificar que trabajos, clínicas y fotos se ven en las fichas;
  - anotar el RTO medido (objetivo ≤ 4 h);
  - corregir el documento en un PR pequeño si algo falló.
- [ ] **Paso 6: teléfonos reales** (PEM-1, absorbe #25). Nelson, con un Android (Chrome, «Instalar») y un iPhone (Safari, «Añadir a pantalla de inicio»), comprueba:
  - el icono y el nombre;
  - que abre a pantalla completa;
  - que sin sesión abre en `/login`;
  - la cámara al subir una foto;
  - que tras un despliegue nuevo, al cerrar y reabrir la app, carga la versión nueva.

  Capturas al issue.
- [ ] **Paso 7:** cerrar #93, #111, #91 y #25 con un comentario que enlace las pruebas (RTO medido, snapshot, capturas). Mover en el tablero. Hasta aquí no se cargan datos reales.

## Tarea 10: cierre de la iteración

- La épica #9 menciona la carga de datos reales de Arte Dental. Es operación de Nelson con las importaciones CSV que ya existen (clínicas, productos y precios) y el «Saldo inicial» de cada clínica (CTA-3). Se abre un issue `tarea` «Carga de datos reales de Arte Dental» con la lista, en el hito 7, y se acompaña cuando Nelson quiera. La importación del histórico (PEM-2) sigue en Post-MVP.
- Issue «Revisión UI/UX de la Iteración 7 con frontend-design» (regla 6 de `CLAUDE.md`), en el hito Post-MVP, con el checklist de siempre. Sus pantallas nuevas: el aviso por WhatsApp de la ficha y la app instalada (pantalla completa en Android e iPhone, iconos, `safe-area` con `viewport-fit=cover`).
- Historias AVI-4, PEM-1 y PEM-3 marcadas «_(Hecha en la Iteración 7.)_» en el documento de historias.
- Cerrar la épica #9 y el hito 7 cuando sus issues estén cerrados. Actualizar `.remember/remember.md` y la memoria de seguimiento.
