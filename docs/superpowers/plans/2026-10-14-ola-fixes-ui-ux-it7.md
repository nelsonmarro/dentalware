# Ola de fixes UI/UX de la Iteración 7 (#129)

> **Para agentes:** sub-skill obligatoria `superpowers:subagent-driven-development` (un implementador a la vez, brief por tarea, revisión Critical/Important/Minor, rulings en el ledger). Los pasos usan `- [ ]`.

- **Origen:** `docs/superpowers/reviews/2026-10-13-revision-ui-ux-iteracion-7.md`, hallazgos UX7-01 a UX7-12 (0 Critical, 3 Important, 9 Minor) más la deuda de tests que el informe deja anotada.
- **Rama:** `fix/revision-ui-ux-it7` desde `main` (0295532).
- **Ledger:** `.superpowers/sdd/2026-10-14-ola-fixes-ui-ux-it7/progress.md`.
- **Objetivo:** que avisar a una clínica sin WhatsApp sea un viaje de ida y vuelta desde la ficha (también en la app instalada, sin botón atrás), que el diálogo de la clínica no destroce el nombre ni esconda el campo, que la PWA respete las zonas seguras del teléfono, y cerrar los 9 Minor. Cierra #129. Por la regla 6 de `CLAUDE.md`, la ola va antes de la Iteración 8 (manual de usuario).

## Decisiones (no se re-litigan)

- **UX7-11** (Nelson, 2026-10-14): `theme_color` = color de fondo (`#F4F6F5`), en el manifiesto y en el `<meta name="theme-color">`. La marca ya está en el icono y en los primarios; la barra de estado de la app instalada se funde con la cabecera clara.
- **UX7-01** (ruling): la ida y vuelta se hace con la URL, como `?editar`: «Añadir WhatsApp» enlaza a `/configuracion/clinicas?editar={clinicId}&volver=/trabajos/{caseId}&campo=whatsapp`; al guardar o cancelar se vuelve a `volver` (siempre pasado por `safeRedirect`), y si se guardó un número, con `?foco=whatsapp`, que la ficha consume (enfoca «Avisar por WhatsApp») y quita de la URL con `replace`. Sin `volver`, Clínicas se comporta como hoy. Nada de estado global.
- **UX7-02** (ruling): `FormDialog` enfoca por omisión el primer campo **sin seleccionar su texto** (cursor al final) y admite `initialFocusId` para enfocar otro (el campo WhatsApp cuando se llega con `campo=whatsapp`). Vale para todos los diálogos de edición.
- **UX7-05** (ruling): `?editar` con una clínica que no está en la lista pide `GET /api/config/clinicas/:id`; si existe (inactiva), abre el diálogo con la nota «Clínica inactiva: actívala para que vuelva a salir en las listas.»; si es 404, el toast «Esa clínica ya no existe».
- **UX7-06** (ruling): la normalización vive en `shared` (`normalizeWhatsapp`), dentro del schema: así la API y el formulario aceptan «099 123 4567» y guardan `+593991234567`. Queda descartado el diferido «`whatsappUrl` limpia solo dígitos».
- **UX7-07** (ruling): por debajo de `sm`, «Avisar por WhatsApp» a ancho completo y «Imprimir»/«Editar» repartidos en una fila a ancho completo; desde `sm`, como hoy.
- **Descartados** (informe): limpieza de dígitos en `whatsappUrl`; `density` en `gen-icons.mjs`.
- **Capturas:** las de la revisión se perdieron con el `/tmp`; las capturas «después» se guardan en `docs/superpowers/reviews/capturas/it7/` en la Tarea 5.

## Restricciones globales

Las de `CLAUDE.md`, `docs/conventions.md` y `docs/architecture.md`:

- TDD (RED → GREEN; una mutación sobre el código de producción por fix para ver el test caer);
- español en sentence case; textos con literales en los tests;
- 44 px, AA y nunca solo color;
- reglas en `shared`; nada de `role === 'admin'` para permisos (`hasRole`);
- mocks solo de `api.ts`; `testPassword()`; `uniqueSuffix()`;
- `routes/` sin lógica: los schemas de `search` viven en `features/` con su test;
- verificación completa antes de cada commit: `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`;
- Chrome DevTools a 1280×800, 390×844 y 360×740 con la consola limpia (sesión de admin del MCP ya abierta; no cerrarla; nunca crear administradores);
- E2E al cerrar la tarea que los toque, con los puertos 3000 y 5173 libres (parar los servidores dev solo por PID);
- commits pequeños con `Refs #129` y los trailers `Co-Authored-By` y `Claude-Session`;
- un implementador a la vez.

Node 24 en cada shell: `export PATH=$HOME/.nvm/versions/node/v24.19.0/bin:$PATH`.

## Mapa de archivos

| Archivo | Responsabilidad en la ola |
|---|---|
| `packages/shared/src/whatsapp.ts` (nuevo) + `.test.ts` | `normalizeWhatsapp(raw)`: de «099 123 4567» a `+593991234567` |
| `packages/shared/src/schemas/config.ts` + `.test.ts` | `whatsappE164` normaliza antes de validar; mensaje nuevo |
| `packages/shared/src/case-notify.ts` + `.test.ts` | «Hola, les escribimos…» |
| `packages/shared/src/index.ts` | exporta `normalizeWhatsapp` |
| `apps/web/src/features/cases/case-whatsapp.tsx` + `.test.tsx` | aviso corto, «Añadir WhatsApp» con `volver`/`campo`, `aria-label` «(abre WhatsApp)», `autoFocus`, ancho completo en móvil |
| `apps/web/src/features/cases/case-header.tsx` | columna y grupo de acciones a ancho completo por debajo de `sm`; pasa `focusWhatsapp` |
| `apps/web/src/features/cases/case-search.ts` (nuevo) + `.test.ts` | `parseCaseSearch`: `{ foco?: 'whatsapp' }` |
| `apps/web/src/routes/_app/trabajos/$caseId.tsx` | `validateSearch`, consume y limpia `foco`; `useLabSettings` solo para `CASE_NOTIFY_ROLES` |
| `apps/web/src/features/config/use-lab-settings.ts` + `.test.tsx` (nuevo) | `useLabSettings(enabled = true)` |
| `apps/web/src/features/clinics/clinics-search.ts` (nuevo) + `.test.ts` | `parseClinicsSearch`: `{ editar?, volver?, campo? }` con `safeRedirect` |
| `apps/web/src/routes/_app/configuracion/clinicas.tsx` | `validateSearch: parseClinicsSearch`; pasa `returnTo` y `focusField`; limpia la URL |
| `apps/web/src/features/clinics/clinics-page.tsx` + `.test.tsx` | ida y vuelta, clínica fuera de la lista (inactiva/404), «no se reabre» |
| `apps/web/src/features/clinics/use-clinics.ts` | `useClinic(id, enabled)`, `doneText` en `useSaveClinic` |
| `apps/web/src/features/clinics/clinic-form.tsx` + `.test.tsx` (nuevo) | `focusField`, nota de inactiva, ayuda del WhatsApp con `aria-describedby`, sin placeholder |
| `apps/web/src/components/form-dialog.tsx` + `.test.tsx` | foco inicial sin seleccionar; `initialFocusId` |
| `apps/web/src/test/render.tsx` | `renderWithQueryAndRouter` devuelve también `router` |
| `apps/web/e2e/trabajos.spec.ts` | E2E `@clave` del viaje completo sin número → con número |
| `apps/web/src/components/app-shell.tsx` + `.test.tsx` | `safe-area` a los lados y arriba |
| `apps/web/scripts/gen-icons.mjs`, `apps/web/public/*.png`, `favicon.ico` | `apple-touch-icon` opaco |
| `apps/web/src/pwa-manifest.ts` + `.test.ts`, `apps/web/index.html` | `theme_color` claro; tests de iconos (firma PNG, 180×180, esquinas) |
| `docs/conventions.md`, `docs/architecture.md`, informe de la revisión | convenciones nuevas y «Resultado de la ola» |

## Tareas

| # | Tarea | Hallazgos | Tests |
|---|---|---|---|
| 1 | `shared`: el WhatsApp se escribe como se habla y el aviso concuerda en plural | UX7-06, UX7-09 | `whatsapp.test.ts`, `config.test.ts`, `case-notify.test.ts` (literales) |
| 2 | Ficha: aviso corto con «Añadir WhatsApp» hacia la ida y vuelta, `aria-label` real, botones a ancho completo en móvil, `foco=whatsapp`, `useLabSettings` solo para quien avisa | UX7-01 (ida), UX7-04, UX7-07, UX7-08, UX7-12 | `case-whatsapp.test.tsx`, `case-search.test.ts`, `use-lab-settings.test.tsx` |
| 3 | Clínicas: vuelta a la ficha al guardar o cancelar, diálogo que enfoca el campo WhatsApp sin seleccionar nada, clínica inactiva o inexistente con aviso, `search` con test; E2E del viaje completo | UX7-01 (vuelta), UX7-02, UX7-05, deuda `validateSearch` | `form-dialog.test.tsx`, `clinic-form.test.tsx`, `clinics-page.test.tsx`, `clinics-search.test.ts`, `trabajos.spec.ts` |
| 4 | PWA: `safe-area` a los lados y arriba, `apple-touch-icon` opaco, `theme_color` claro, tests de iconos | UX7-03, UX7-10, UX7-11, deuda de iconos | `app-shell.test.tsx`, `pwa-manifest.test.ts` |
| 5 | Cierre: docs, «Resultado de la ola» con capturas «después», verificación completa y E2E | — | E2E escritorio y android |

Orden: 1 → 2 → 3 (3 usa los textos de 1 y el enlace de 2) → 4 → 5. Después, revisión final de la rama, ronda de fixes y el PR «Ola de fixes UI/UX de la Iteración 7» con `Closes #129`.

---

### Tarea 1: `shared` — normalización del WhatsApp y plural del aviso

**Archivos:**
- Crear: `packages/shared/src/whatsapp.ts`, `packages/shared/src/whatsapp.test.ts`
- Modificar: `packages/shared/src/schemas/config.ts` (`whatsappE164`, líneas 49–56), `packages/shared/src/schemas/config.test.ts`, `packages/shared/src/case-notify.ts:29`, `packages/shared/src/case-notify.test.ts`, `packages/shared/src/index.ts`

**Interfaces:**
- Produce: `normalizeWhatsapp(raw: string): string` (exportada desde `@dentalware/shared`). `clinicSchema.shape.whatsapp` sigue dando `string | null` en E.164. El mensaje de error nuevo es `'Escribe el WhatsApp como 099 123 4567 o +593 99 123 4567'` (la Tarea 3 lo usa en la ayuda del campo).

- [ ] **Paso 1: RED de `normalizeWhatsapp`** — `whatsapp.test.ts`, casos con literales:

```ts
import { describe, expect, it } from 'vitest'
import { normalizeWhatsapp } from './whatsapp.ts'

describe('normalizeWhatsapp (UX7-06)', () => {
  it.each([
    ['099 123 4567', '+593991234567'],
    ['0991234567', '+593991234567'],
    ['(099) 123-4567', '+593991234567'],
    ['099.123.4567', '+593991234567'],
    ['+593 99 123 4567', '+593991234567'],
    ['00593 99 123 4567', '+593991234567'],
    ['+593991234567', '+593991234567'],
  ])('«%s» → «%s»', (raw, e164) => {
    expect(normalizeWhatsapp(raw)).toBe(e164)
  })

  it.each(['099123456', '99 123 4567', 'abc', '+593 99 123 45678 9'])(
    'deja «%s» como está (sin espacios) para que el schema lo rechace',
    (raw) => {
      expect(normalizeWhatsapp(raw)).toBe(raw.replace(/[\s\-().]/g, ''))
    },
  )
})
```

- [ ] **Paso 2: correr** `pnpm --filter @dentalware/shared test -- whatsapp` → falla (módulo inexistente).
- [ ] **Paso 3: GREEN** — `whatsapp.ts`:

```ts
/** Cómo se escribe un número en Ecuador («099 123 4567») a E.164 (`+593991234567`), UX7-06:
 * quita espacios, guiones, paréntesis y puntos; `00` internacional pasa a `+`; un número local
 * de 10 dígitos que empieza por 0 recibe el +593. Lo demás se devuelve limpio de separadores,
 * y es el schema quien lo acepta o lo rechaza. No valida: solo normaliza. */
export function normalizeWhatsapp(raw: string): string {
  const digits = raw.replace(/[\s\-().]/g, '')
  if (digits.startsWith('00')) return `+${digits.slice(2)}`
  if (/^0\d{9}$/.test(digits)) return `+593${digits.slice(1)}`
  return digits
}
```

Exportarla en `index.ts` (`export * from './whatsapp.ts'`).

- [ ] **Paso 4: RED del schema** — en `config.test.ts`, junto al test «clinic valida whatsapp…» (línea 22): `clinicSchema.safeParse({ name: 'X', whatsapp: '099 123 4567' })` → `success` y `data.whatsapp === '+593991234567'`; `{ name: 'X', whatsapp: '12345' }` → falla con el mensaje literal `'Escribe el WhatsApp como 099 123 4567 o +593 99 123 4567'`. Cambiar en ese archivo el literal viejo («El WhatsApp debe ir en formato internacional…») por el nuevo. Correr: fallan.
- [ ] **Paso 5: GREEN** — `whatsappE164`:

```ts
const whatsappE164 = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? normalizeWhatsapp(v) : null))
  .refine((v) => v === null || /^\+[1-9]\d{7,14}$/.test(v), {
    error: 'Escribe el WhatsApp como 099 123 4567 o +593 99 123 4567',
  })
```

(`import { normalizeWhatsapp } from '../whatsapp.ts'`). Comprobar que la API sigue compilando y que su test de rutas de clínicas pasa (`pnpm --filter @dentalware/api test -- clinics`): el 422 cambia de mensaje si algún test lo tenía literal.

- [ ] **Paso 6: plural del aviso (UX7-09)** — RED: en `case-notify.test.ts`, los literales de las líneas 32, 45 y 52 pasan a «Hola, les escribimos …». Correr: fallan. GREEN: `case-notify.ts:29` → `` `Hola, les escribimos ${from}. …` ``. Mutación: volver a «le» un momento y ver caer el test.
- [ ] **Paso 7: verificación completa y commit**

```bash
git add packages/shared
git commit -m "fix(shared): el WhatsApp se escribe como se habla y el aviso concuerda en plural

UX7-06: normalizeWhatsapp pasa «099 123 4567» a +593991234567 antes de validar.
UX7-09: «Hola, les escribimos…», que concuerda con «su clínica» y «ustedes».

Refs #129"
```

---

### Tarea 2: Ficha — aviso corto, «Añadir WhatsApp» con ida y vuelta, botones en móvil, `foco`, `useLabSettings`

**Archivos:**
- Modificar: `apps/web/src/features/cases/case-whatsapp.tsx`, `case-whatsapp.test.tsx`, `apps/web/src/features/cases/case-header.tsx:70-120`, `apps/web/src/routes/_app/trabajos/$caseId.tsx`, `apps/web/src/features/config/use-lab-settings.ts`
- Crear: `apps/web/src/features/cases/case-search.ts`, `case-search.test.ts`, `apps/web/src/features/config/use-lab-settings.test.tsx`

**Interfaces:**
- Consume: nada nuevo de la Tarea 1 salvo que los literales ya están en plural.
- Produce: el enlace «Añadir WhatsApp» → `/configuracion/clinicas?editar={clinic.id}&volver=/trabajos/{case.id}&campo=whatsapp` (la Tarea 3 lee `volver` y `campo`). La ficha acepta `?foco=whatsapp` (`parseCaseSearch`) y lo limpia. `CaseWhatsapp` recibe `focus?: boolean`; `CaseHeader`, `focusWhatsapp?: boolean`. `useLabSettings(enabled = true)`.

- [ ] **Paso 1: RED en `case-whatsapp.test.tsx`** (sustituir los tests de «sin WhatsApp» y el nombre accesible):
  - el `aria-label` del enlace es `'Avisar por WhatsApp a Clínica Sur (abre WhatsApp)'` (UX7-08), y su `className` incluye `w-full` y `sm:w-auto` (UX7-07);
  - recepción sin WhatsApp lee exactamente `'Sin WhatsApp registrado. Pídele al administrador que lo registre.'` (`findByText`, texto normalizado) y no hay enlace; el texto **no** contiene «Clínica Sur» (UX7-04);
  - admin sin WhatsApp lee `'Sin WhatsApp registrado.'`, no lee «Pídele…», y el enlace `{ name: 'Añadir WhatsApp' }` tiene `href` exactamente `'/configuracion/clinicas?editar=clinica-9&volver=%2Ftrabajos%2Fcaso-1&campo=whatsapp'` (comprobar cómo serializa el router: si deja `/` sin codificar, el literal es `volver=/trabajos/caso-1`; fijar el que salga y anotarlo en el reporte) y `className` con `min-h-11` (UX7-01);
  - con `focus` y WhatsApp, tras el render `document.activeElement` es el enlace; sin `focus`, no.
- [ ] **Paso 2: correr** `pnpm --filter @dentalware/web test -- case-whatsapp` → fallan.
- [ ] **Paso 3: GREEN en `case-whatsapp.tsx`:**

```tsx
export function CaseWhatsapp({ case: c, role, labName, focus = false }: { …; focus?: boolean }) {
  if (!hasRole(CASE_NOTIFY_ROLES, role) || !c.clinic) return null
  const { clinic } = c
  if (!clinic.whatsapp) {
    return (
      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <MessageCircle aria-hidden className="size-4 shrink-0" />
          Sin WhatsApp registrado.
          {!hasRole(SETTINGS_ROLES, role) && ' Pídele al administrador que lo registre.'}
        </p>
        {hasRole(SETTINGS_ROLES, role) && (
          <Link
            to="/configuracion/clinicas"
            search={{ editar: clinic.id, volver: `/trabajos/${c.id}`, campo: 'whatsapp' }}
            className="inline-flex min-h-11 items-center self-start text-primary underline underline-offset-2"
          >
            Añadir WhatsApp
          </Link>
        )}
      </div>
    )
  }
  …
  <Button asChild variant="outline" className="h-11 w-full sm:w-auto sm:self-start">
    <a … aria-label={`Avisar por WhatsApp a ${clinic.name} (abre WhatsApp)`} autoFocus={focus}>
```

Ojo con el espacio en «registrado. Pídele»: el test usa el texto normalizado del nodo `<p>`; comprobar que no queda doble espacio ni se pierde.

- [ ] **Paso 4: `case-header.tsx` (UX7-07)** — la columna de identidad pasa a `flex w-full flex-col gap-1 sm:w-auto`; el grupo de acciones a `flex w-full gap-2 sm:w-auto`, y cada `Button` de «Imprimir»/«Editar» añade `flex-1 sm:flex-none`. Prop nueva `focusWhatsapp?: boolean` → `<CaseWhatsapp … focus={focusWhatsapp} />`. Un test en `case-header.test.tsx` (si existe; si no, en `case-whatsapp.test.tsx` no aplica: añadirlo donde se prueba `CaseHeader`): el enlace «Imprimir» tiene `flex-1`.
- [ ] **Paso 5: `foco` en la URL** — RED `case-search.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseCaseSearch } from './case-search'

describe('parseCaseSearch (search de /trabajos/$caseId)', () => {
  it('acepta foco=whatsapp', () => {
    expect(parseCaseSearch({ foco: 'whatsapp' })).toEqual({ foco: 'whatsapp' })
  })
  it.each([{ foco: 'otro' }, { foco: 1 }, 'basura', null, {}])('descarta %j', (input) => {
    expect(parseCaseSearch(input)).toEqual({})
  })
})
```

GREEN `case-search.ts` (patrón de `accounts-search.ts`): `z.object({ foco: z.literal('whatsapp').optional().catch(undefined) })`, `.catch({})`, sin claves `undefined`. Tipo `CaseSearch = { foco?: 'whatsapp' }`.

- [ ] **Paso 6: ruta `$caseId.tsx`** — `validateSearch: parseCaseSearch`; `const { foco } = Route.useSearch()`; `<CaseHeader … focusWhatsapp={foco === 'whatsapp'} />`; y, **después de que haya datos** (si se limpia antes, el enlace aún no está montado y no recibe el foco):

```tsx
useEffect(() => {
  if (foco && q.data) {
    void navigate({ to: '/trabajos/$caseId', params: { caseId }, search: {}, replace: true })
  }
}, [foco, q.data, caseId, navigate])
```

El efecto va antes de los `return` tempranos (reglas de hooks). `autoFocus` de React enfoca al montar el enlace, en el mismo commit en que llega `q.data`; el `replace` posterior no lo desmonta.

- [ ] **Paso 7: `useLabSettings` solo para quien avisa (UX7-12)** — RED `use-lab-settings.test.tsx` (mock de `./api`, `renderHook` con `QueryClientProvider`): con `useLabSettings(false)`, `fetchLabSettings` no se llama y `isPending` queda `true` con `fetchStatus: 'idle'`; con `useLabSettings()` sí se llama. GREEN: `export function useLabSettings(enabled = true) { return useQuery({ queryKey: queryKeys.labSettings, queryFn: fetchLabSettings, enabled }) }`. En `$caseId.tsx`: `useLabSettings(hasRole(CASE_NOTIFY_ROLES, user.role))` (importar `CASE_NOTIFY_ROLES`, `hasRole` de shared).
- [ ] **Paso 8: Chrome** a 1280/390/360: ficha con número (admin): botón a ancho completo en móvil y «Imprimir | Editar» en una fila; ficha sin número (admin y recepción): 1–2 líneas a 360, «Añadir WhatsApp» en su fila de 44 px; `href` del enlace con `volver` y `campo`; con `?foco=whatsapp` en la URL de una ficha con número, el enlace queda enfocado y la URL se limpia. Consola limpia, sin scroll horizontal.
- [ ] **Paso 9: verificación completa y commit**

```bash
git commit -m "fix(web): la ficha dice «Sin WhatsApp registrado» y «Añadir WhatsApp» lleva de vuelta

UX7-01 (ida), UX7-04, UX7-07, UX7-08, UX7-12. La ficha acepta ?foco=whatsapp y lo limpia.

Refs #129"
```

---

### Tarea 3: Clínicas — vuelta a la ficha, foco en el campo WhatsApp, inactiva/inexistente con aviso, E2E

**Archivos:**
- Crear: `apps/web/src/features/clinics/clinics-search.ts`, `clinics-search.test.ts`, `apps/web/src/features/clinics/clinic-form.test.tsx`
- Modificar: `apps/web/src/components/form-dialog.tsx`, `form-dialog.test.tsx`, `apps/web/src/features/clinics/clinic-form.tsx`, `clinics-page.tsx`, `clinics-page.test.tsx`, `use-clinics.ts`, `apps/web/src/routes/_app/configuracion/clinicas.tsx`, `apps/web/src/test/render.tsx`, `apps/web/e2e/trabajos.spec.ts:254-274`

**Interfaces:**
- Consume: el enlace de la Tarea 2 (`editar`, `volver`, `campo=whatsapp`), `?foco=whatsapp` de la ficha, el mensaje de error de la Tarea 1.
- Produce: `parseClinicsSearch(input): { editar?: string; volver?: string; campo?: 'whatsapp' }`; `FormDialog` con `initialFocusId?: string`; `ClinicForm` con `focusField?: 'whatsapp' | null`; `ClinicsPage` con `returnTo?: string | null` y `focusField?: 'whatsapp' | null`; `useClinic(id, enabled = true)`; `useSaveClinic` acepta `doneText?: string`; `renderWithQueryAndRouter` devuelve `router`.

- [ ] **Paso 1: `FormDialog` enfoca sin seleccionar (UX7-02)** — RED en `form-dialog.test.tsx`:
  - abierto con `<input aria-label="Nombre" defaultValue="Clínica Sur" />` como primer campo: `document.activeElement` es ese input y `selectionStart === selectionEnd === 'Clínica Sur'.length` (hoy Radix hace `select()`: 0–11);
  - con `initialFocusId="clinic-whatsapp"` y dos inputs (`id="clinic-name"`, `id="clinic-whatsapp"`), el foco cae en el segundo;
  - con solo `<p>` en el cuerpo, no falla y el foco queda dentro del diálogo (`screen.getByRole('dialog').contains(document.activeElement)`).
- [ ] **Paso 2: correr** → fallan los dos primeros.
- [ ] **Paso 3: GREEN** en `form-dialog.tsx`:

```tsx
const FIELD_SELECTOR =
  'input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [role=combobox]:not([disabled])'
const TEXT_TYPES = new Set(['text', 'search', 'tel', 'url', 'password'])

/** Enfoca sin seleccionar el texto (Radix hace `select()` del primer campo: una tecla borra el
 * nombre de la clínica, UX7-02). Cursor al final en los campos de texto; `scrollIntoView` para
 * que el campo quede a la vista dentro del cuerpo desplazable (y por encima del teclado). */
function focusField(el: HTMLElement) {
  el.focus({ preventScroll: true })
  if (
    (el instanceof HTMLInputElement && TEXT_TYPES.has(el.type)) ||
    el instanceof HTMLTextAreaElement
  ) {
    const end = el.value.length
    el.setSelectionRange(end, end)
  }
  el.scrollIntoView?.({ block: 'center' })
}
```

Prop `initialFocusId?: string`. En `DialogContent`: `onOpenAutoFocus={(e) => { const root = e.currentTarget as HTMLElement; const el = (initialFocusId && root.querySelector<HTMLElement>(`#${CSS.escape(initialFocusId)}`)) || root.querySelector<HTMLElement>(FIELD_SELECTOR); if (el) { e.preventDefault(); focusField(el) } }}`. Si `e.currentTarget` no es el contenido en Radix 1.x (comprobar con el test: si sale `null`, usar un `ref` al `DialogContent`), ajustar. `CSS.escape` existe en jsdom y en los navegadores; si no, escapar a mano.

- [ ] **Paso 4: `ClinicForm`** — RED `clinic-form.test.tsx` (render directo, `open`, `onSubmit` vacío):
  - con `focusField="whatsapp"` y una clínica, el input «WhatsApp» es `document.activeElement`; sin `focusField`, lo es «Nombre», con el cursor al final;
  - el input «WhatsApp» tiene descripción accesible `'Ej.: 099 123 4567 o +593 99 123 4567. Se usa para los avisos.'` (`toHaveAccessibleDescription`) y **no** tiene `placeholder`;
  - con una clínica `active: false`, el diálogo tiene descripción accesible `'Clínica inactiva: actívala para que vuelva a salir en las listas.'`; con una activa, ninguna;
  - al enviar «099 123 4567», `onSubmit` recibe `whatsapp: '+593991234567'` (el schema de la Tarea 1 a través del resolver).
- [ ] **Paso 5: GREEN** — `ClinicForm` recibe `focusField?: 'whatsapp' | null` → `<FormDialog initialFocusId={focusField ? `clinic-${focusField}` : undefined} description={clinic && !clinic.active ? 'Clínica inactiva: actívala para que vuelva a salir en las listas.' : undefined} …>`. En el helper `text()`: `descId = `clinic-${name}-desc``, `errId = `clinic-${name}-error``; `<FieldDescription id={descId}>`, `<FieldError id={errId} …>` (`FieldError` acepta props de `div`), y en el `Input` `aria-describedby={[description ? descId : null, fieldState.invalid ? errId : null].filter(Boolean).join(' ') || undefined}`. El campo WhatsApp: `{ type: 'tel', inputMode: 'tel' }` sin placeholder y ayuda `'Ej.: 099 123 4567 o +593 99 123 4567. Se usa para los avisos.'`. Si el tipo de `clinic` no trae `active` (comprobar `Clinic` en `api.ts`), ampliar el prop a `Pick<…>` con `active`.
- [ ] **Paso 6: `search` de Clínicas con test (deuda)** — RED `clinics-search.test.ts`:

```ts
describe('parseClinicsSearch (search de /configuracion/clinicas)', () => {
  it('acepta editar, volver interno y campo=whatsapp', () => {
    expect(
      parseClinicsSearch({ editar: 'c1', volver: '/trabajos/t1', campo: 'whatsapp' }),
    ).toEqual({ editar: 'c1', volver: '/trabajos/t1', campo: 'whatsapp' })
  })
  it.each(['https://otro.sitio/x', '//otro.sitio', '/\\otro', ''])(
    'descarta volver=%s y conserva editar',
    (volver) => {
      expect(parseClinicsSearch({ editar: 'c1', volver })).toEqual({ editar: 'c1' })
    },
  )
  it('descarta un campo desconocido y conserva lo demás', () => {
    expect(parseClinicsSearch({ editar: 'c1', campo: 'nombre' })).toEqual({ editar: 'c1' })
  })
  it.each(['basura', null, 7, {}])('devuelve {} con %j', (input) => {
    expect(parseClinicsSearch(input)).toEqual({})
  })
})
```

GREEN `clinics-search.ts`: schema con `editar: z.string().min(1).optional().catch(undefined)`, `volver: z.string().optional().catch(undefined)`, `campo: z.literal('whatsapp').optional().catch(undefined)`, `.catch({})`; después `volver = safeRedirect(volver) ?? undefined` (`import { safeRedirect } from '@/features/auth/safe-redirect'`), y sin claves `undefined`. La ruta `clinicas.tsx` pasa a `validateSearch: parseClinicsSearch` y entrega `editId={editar}`, `returnTo={volver ?? null}`, `focusField={campo ?? null}`; `clearEdit` sigue limpiando toda la `search` con `replace`.

- [ ] **Paso 7: `ClinicsPage` ida y vuelta e inactiva/404** — primero `renderWithQueryAndRouter` devuelve además `router` (añadir `router` al objeto que retorna). RED en `clinics-page.test.tsx` (mock de `sonner` como en `import-dialog.test.tsx`; `fetchClinic` ya está en el mock de `./api`):
  - `editId="c2" returnTo="/trabajos/t1" focusField="whatsapp"`: se abre «Editar clínica» con el input «WhatsApp» enfocado; se escribe `099 123 4567`, se pulsa «Guardar» (`updateClinic` resuelve la clínica con el número) → `toast.success` con `'WhatsApp de Clínica Dos guardado'` y `router.state.location.href` termina en `/trabajos/t1?foco=whatsapp`;
  - mismo caso, se pulsa «Cancelar» → sin toast, el diálogo se cierra y la URL es `/trabajos/t1` (sin `foco`);
  - sin `returnTo`, guardar deja la URL en `/` y el toast es `'Clínica actualizada'` (como hoy);
  - `editId="c9"` que no está en la lista: `fetchClinic` resuelve `{ …clínica, id: 'c9', name: 'Clínica Vieja', active: false, doctors: [] }` → se abre «Editar clínica» con «Nombre» = «Clínica Vieja» y descripción accesible `'Clínica inactiva: actívala para que vuelva a salir en las listas.'`, `onHandled` llamado una vez;
  - `editId="zzz"`: `fetchClinic` rechaza con `new ApiError('La clínica no existe', 404)` → `toast.error('Esa clínica ya no existe')`, ningún diálogo, `onHandled` una vez (sustituye al test «un editar desconocido no abre nada»);
  - `editId="zzz"` con `fetchClinic` rechazando `new ApiError('Error', 500)` → `toast.error('Error')` (`toastApiError`) y ningún diálogo;
  - deuda «no se reabre»: con `editId="c2"`, cerrar el diálogo con «Cancelar» y `rerender` con el mismo `editId="c2"` → no vuelve a haber diálogo.
- [ ] **Paso 8: GREEN** en `clinics-page.tsx` y `use-clinics.ts`:
  - `useClinic(id: string, enabled = true)` → `useQuery({ …, enabled })`; `useSaveClinic`: variables `{ id?: string; input: ClinicInput; doneText?: string }` y `toast.success(doneText ?? (id ? 'Clínica actualizada' : 'Clínica creada'))`.
  - Props nuevas `returnTo?: string | null`, `focusField?: 'whatsapp' | null`. Estado `request` (`{ returnTo: string | null; field: 'whatsapp' | null } | null`) que se fija en el mismo ajuste durante el render en que se abre por `editId`; `lookupId` (`string | null`) cuando `editId` no está en la lista → `const lookup = useClinic(lookupId ?? '', lookupId !== null)`; un efecto: con `lookup.data`, `setEditing(lookup.data)` y `setLookupId(null)`; con `lookup.isError`, `isNotFoundError(lookup.error) ? toast.error('Esa clínica ya no existe') : toastApiError(lookup.error)` y `setLookupId(null)`.
  - `const navigate = useNavigate()`. `close()` = `setEditing(null)`; si `request?.returnTo`, `void navigate({ href: request.returnTo })` y `setRequest(null)`. `ClinicForm onOpenChange={(o) => !o && close()}`.
  - `submit(input)`: `doneText = request?.field === 'whatsapp' && input.whatsapp ? `WhatsApp de ${input.name} guardado` : undefined`; en `onSuccess`: `setEditing(null)`; si `request?.returnTo`: `void navigate({ href: doneText ? `${request.returnTo}?foco=whatsapp` : request.returnTo })` y `setRequest(null)`.
  - `focusField` → `<ClinicForm focusField={request?.field ?? null} …>` (solo cuando se abrió por `editar`; «Nueva clínica» y «Editar» desde la lista no lo llevan).
  - `navigate({ href })` existe en TanStack Router 1.170 (`NavigateOptions.href`, comprobado en context7).
- [ ] **Paso 9: E2E del viaje completo** — sustituir «sin WhatsApp, el admin lo añade desde la ficha (AVI-4)» (`@clave`):

```ts
await page.goto(`/trabajos/${created.id}`)
await expect(page.getByText('Sin WhatsApp registrado.')).toBeVisible()
await page.getByRole('link', { name: 'Añadir WhatsApp' }).click()
const dialog = page.getByRole('dialog', { name: 'Editar clínica' })
await expect(dialog).toBeVisible()
await expect(dialog.getByLabel('Nombre')).toHaveValue(clinic.name)
await expect(dialog.getByLabel('WhatsApp')).toBeFocused()
await dialog.getByLabel('WhatsApp').fill('099 123 4567')
await dialog.getByRole('button', { name: 'Guardar' }).click()
await expect(page).toHaveURL(new RegExp(`/trabajos/${created.id}$`))
await expect(toasts(page).getByText(`WhatsApp de ${clinic.name} guardado`)).toBeVisible()
const link = page.getByRole('link', { name: `Avisar por WhatsApp a ${clinic.name} (abre WhatsApp)` })
await expect(link).toBeVisible()
await expect(link).toBeFocused()
expect(((await link.getAttribute('href')) ?? '').startsWith('https://wa.me/593991234567?text=')).toBe(true)
```

Comprobar `toasts()` en `helpers.ts` para el locator del toast. Correr `pnpm e2e --project=escritorio --project=android -- trabajos.spec.ts` (y `configuracion.spec.ts`, que rellena WhatsApp). Puertos libres antes.

- [ ] **Paso 10: Chrome** a 1280/390/360: desde la ficha sin número → «Añadir WhatsApp» → el diálogo abre con WhatsApp enfocado y a la vista, sin texto seleccionado; guardar «099 123 4567» → vuelta a la ficha con el toast y el foco en «Avisar por WhatsApp», URL sin `foco`; «Cancelar» → vuelta sin toast; `?editar=` con «Clínica It7 inactiva» (BD dev) → diálogo con la nota; con un UUID inventado → toast «Esa clínica ya no existe». Consola limpia.
- [ ] **Paso 11: verificación completa y commits** (dos: `FormDialog` + `ClinicForm`; `ClinicsPage` + search + E2E):

```bash
git commit -m "fix(web): los diálogos de edición enfocan sin seleccionar y Clínicas enfoca el WhatsApp

UX7-02 y UX7-06 (ayuda y aria-describedby del campo). Refs #129"
git commit -m "fix(web): «Añadir WhatsApp» vuelve a la ficha y ?editar avisa de la clínica inactiva o inexistente

UX7-01 y UX7-05; parseClinicsSearch con safeRedirect y test. E2E @clave del viaje completo.

Refs #129"
```

---

### Tarea 4: PWA — `safe-area`, `apple-touch-icon` opaco, `theme_color` claro, tests de iconos

**Archivos:**
- Modificar: `apps/web/src/components/app-shell.tsx:80-98`, `app-shell.test.tsx`, `apps/web/scripts/gen-icons.mjs:14-20`, `apps/web/src/pwa-manifest.ts:15`, `pwa-manifest.test.ts`, `apps/web/index.html:7`, `docs/architecture.md` (§3 Web → PWA)
- Regenerados: `apps/web/public/apple-touch-icon.png` (y los demás PNG y `favicon.ico`, que el script reescribe igual)

**Interfaces:** ninguna hacia otras tareas.

- [ ] **Paso 1: RED `app-shell.test.tsx` (UX7-03)** — con el `AppShell` montado (como los tests existentes): `screen.getByRole('banner')` (la cabecera móvil) tiene en `className` `env(safe-area-inset-left)`, `env(safe-area-inset-right)` y `env(safe-area-inset-top)`; `screen.getByRole('main')` tiene las dos laterales; `screen.getByTestId('bottom-nav')` tiene las dos laterales y la inferior. Si `<header>` no sale como `banner` por estar dentro de un `div` (jsdom aplica las reglas de ARIA: dentro de `div` sí es `banner`), usar `data-testid="mobile-header"`.
- [ ] **Paso 2: GREEN** — clases:
  - cabecera: `pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3` (en lugar de `px-4 py-3`);
  - `main`: `p-4` → `py-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]`, conservando `pb-24 lg:p-8 lg:pb-8 print:p-0`;
  - barra inferior: añadir `pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]` junto al `pb-[env(safe-area-inset-bottom)]`.
  Comentario de una línea: «UX7-03: con `viewport-fit=cover` los márgenes de la muesca los pone la página (horizontal y barra de estado).» Comprobar con `pnpm build` que Tailwind 4 genera las utilidades arbitrarias (buscar `safe-area-inset-left` en `dist/assets/*.css`).
- [ ] **Paso 3: RED `pwa-manifest.test.ts`** (UX7-10, UX7-11 y deuda de iconos). Añadir `sharp` (ya es devDependency de web) para leer píxeles:

```ts
import sharp from 'sharp'
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
async function cornerAlpha(file: string) {
  const { data } = await sharp(pub(file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return data[3] // alfa del píxel (0,0)
}
```

Tests:
  - `theme_color` del manifiesto es `'#F4F6F5'` y `background_color` también; el `<meta name="theme-color">` de `index.html` tiene el mismo `content` que `manifest.theme_color` (regex sobre el HTML);
  - los cuatro PNG (`pwa-192x192`, `pwa-512x512`, `maskable-icon-512x512`, `apple-touch-icon`) empiezan por la firma PNG;
  - `apple-touch-icon.png` mide `180x180` y su esquina es opaca (`await cornerAlpha(...)` → 255);
  - `maskable-icon-512x512.png` esquina opaca (255) y `pwa-512x512.png` esquina transparente (0): el `maskable` no es una copia del `any`;
  - el test existente que espera `theme_color: '#0f766e'` cambia al nuevo valor.
- [ ] **Paso 4: GREEN** — `pwa-manifest.ts`: `theme_color: '#F4F6F5'`; `index.html`: `<meta name="theme-color" content="#F4F6F5" />`. `gen-icons.mjs`: el `apple-touch-icon` sale del bucle y se genera a sangre:

```js
// Apple pide un icono cuadrado y opaco (iOS pone su propia máscara y rellena de negro lo
// transparente, UX7-10): el logo sobre el color de marca, sin esquinas redondeadas.
await writeFile(
  path.join(out, 'apple-touch-icon.png'),
  await sharp({ create: { width: 180, height: 180, channels: 4, background: BRAND } })
    .composite([{ input: await png(180), gravity: 'center' }])
    .png()
    .toBuffer(),
)
```

Regenerar con `pnpm --filter @dentalware/web icons` y comprobar que solo `apple-touch-icon.png` cambia de contenido (los demás, idénticos o con bytes distintos pero igual tamaño; si cambian, se commitean igual). Ver el icono resultante (Read del PNG) para confirmar que es un cuadrado teal con el logo blanco.

- [ ] **Paso 5: docs** — `docs/architecture.md`, §3 Web → **PWA**: añadir «`theme_color` es el color de fondo (`#F4F6F5`), para que la barra de estado de la app instalada se funda con la cabecera (UX7-11); con `viewport-fit=cover`, la cabecera móvil, el `main` y la barra inferior ponen los márgenes de `env(safe-area-inset-*)` (UX7-03); el `apple-touch-icon` es cuadrado y opaco (UX7-10) y `pwa-manifest.test.ts` comprueba firma, medidas y esquinas de cada icono.»
- [ ] **Paso 6: Chrome** a 390 y 360 (Inicio y ficha): nada cambia de sitio sin muesca (`env()` vale 0) y no hay scroll horizontal. Lo de la muesca real queda para Nelson en la Tarea 9 (anotarlo en el reporte).
- [ ] **Paso 7: verificación completa y commit**

```bash
git commit -m "fix(web): zonas seguras del teléfono, apple-touch-icon opaco y barra de estado clara

UX7-03, UX7-10 y UX7-11; tests de firma, medidas y esquinas de los iconos. Refs #129"
```

---

### Tarea 5: Cierre — docs, resultado de la ola con capturas, verificación y E2E

**Archivos:**
- Modificar: `docs/conventions.md` (§5 «Avisos por WhatsApp» y «Diálogos de acción»/«Formularios»), `docs/superpowers/reviews/2026-10-13-revision-ui-ux-iteracion-7.md` (sección «Resultado de la ola»), `apps/web/e2e/accesibilidad.spec.ts` si hace falta
- Crear: `docs/superpowers/reviews/capturas/it7/*.png`

- [ ] **Paso 1: `docs/conventions.md`** — en §5:
  - «Avisos por WhatsApp» (línea 70): sustituir la frase final por: «Sin WhatsApp en la clínica, la ficha dice «Sin WhatsApp registrado.» (sin repetir el nombre, UX7-04) y el admin (`SETTINGS_ROLES`) ve «Añadir WhatsApp», a `/configuracion/clinicas?editar={clinicId}&volver=/trabajos/{caseId}&campo=whatsapp` (`parseClinicsSearch`, con `volver` por `safeRedirect`): Clínicas abre el diálogo de esa clínica una vez con el campo WhatsApp enfocado, quita la `search` de la URL y, al guardar o cancelar, vuelve a la ficha; si guardó un número, con `?foco=whatsapp`, que la ficha consume para enfocar «Avisar por WhatsApp» y limpia (UX7-01/02). Una clínica que no está en la lista se pide por id: inactiva, se edita con la nota «Clínica inactiva…»; inexistente, el toast «Esa clínica ya no existe» (UX7-05). El campo WhatsApp acepta cómo se escribe en Ecuador («099 123 4567»): `normalizeWhatsapp` de shared lo pasa a E.164 dentro del schema (UX7-06). El `aria-label` del enlace dice «(abre WhatsApp)», no «otra pestaña» (UX7-08), y el aviso va en plural, «les escribimos» (UX7-09).»
  - «Diálogos de acción»: añadir «Al abrirse, `FormDialog` enfoca el primer campo **sin seleccionar su texto** (cursor al final) y, con `initialFocusId`, el campo que se pide; nunca el `select()` de Radix, con el que una tecla borra el nombre (UX7-02).»
  - «Formularios»: «La ayuda de un campo (`FieldDescription`) y su error se ligan al input con `aria-describedby`; sin placeholders que parezcan valores guardados (UX7-06).»
- [ ] **Paso 2: capturas «después»** con Chrome DevTools (datos de la BD dev, sin datos reales) en `docs/superpowers/reviews/capturas/it7/`: `ficha-con-whatsapp-admin-1280.png`, `ficha-con-whatsapp-admin-360.png`, `ficha-sin-whatsapp-admin-360.png`, `ficha-sin-whatsapp-recepcion-360.png`, `clinicas-editar-desde-ficha-390.png` (WhatsApp enfocado), `clinica-whatsapp-formato-local-360.png` (aceptado), `iconos-any-maskable-apple.png` (los tres PNG lado a lado sobre negro, con `sharp` o con Read). Recepción: solo con un usuario de prueba existente (`recepcion.it7…`) o uno nuevo con `testPassword()`; nunca un admin.
- [ ] **Paso 3: «Resultado de la ola»** al final del informe: tabla hallazgo → commit → qué se hizo; la deuda de tests cerrada (`parseClinicsSearch`, «no se reabre», firma/medidas/esquinas de iconos, `clinic-form`); los descartados; «Pendiente para Nelson en teléfonos reales (Tarea 9): ida y vuelta en la PWA de iPhone (UX7-01), horizontal con muesca (UX7-03), icono en iPhone (UX7-10) y barra de estado en Android (UX7-11)»; y las capturas.
- [ ] **Paso 4: barrido táctil** — comprobar que `accesibilidad.spec.ts` (ficha) sigue en verde con el enlace nuevo; si la ficha sin número no entra en ningún barrido, añadir al barrido de la ficha una clínica sin WhatsApp (el enlace «Añadir WhatsApp» debe medir 44 px).
- [ ] **Paso 5: verificación completa** (`pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`) y E2E completos en escritorio y android (`pnpm e2e --project=escritorio --project=android`), puertos libres antes y después.
- [ ] **Paso 6: commit**

```bash
git commit -m "docs: convenciones de la ola UI/UX de la Iteración 7 y resultado con capturas

Refs #129"
```

Después: revisión final de la rama (`final-reviewer-instructions.md`), ronda de fixes si hace falta, PR «Ola de fixes UI/UX de la Iteración 7» con `Closes #129`, automerge con CI en verde, #129 a «Hecho», rama borrada.
