# Ola de fixes UI/UX de la Iteración 8 (#137)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** cerrar los hallazgos UX8-01 a UX8-13 de la revisión UI/UX de la Iteración 8 (manual de usuario y enlace «Ayuda») antes de construir MAN-2.

**Architecture:** casi todo vive en `apps/docs` (CSS del tema, tres wrappers de componentes del tema de Docusaurus, el componente `Captura`, la tubería de capturas y los textos de `code.json`); dos hallazgos tocan `apps/web` (la barra lateral fija y los nombres accesibles de tres contenedores de la ficha). La ola trae además un barrido de Playwright del sitio construido (`apps/docs/sitio/`) que protege los arreglos de CSS y accesibilidad que ningún test unitario puede ver, y que corre en el job `e2e` del CI.

**Tech Stack:** Docusaurus 3.10.2 (swizzle «wrap» con `@theme-original/*`), Infima, Playwright 1.62.1, Vitest + Testing Library (jsdom), React 19 (app), Tailwind 4 (app).

**Spec:** `docs/superpowers/reviews/2026-10-23-revision-ui-ux-iteracion-8.md` (los hallazgos, con su propuesta y archivos). Diseño del manual: `docs/superpowers/specs/2026-10-16-manual-usuario-design.md`.

- **Origen:** la revisión de arriba, con los hallazgos UX8-01 a UX8-13 (0 Critical, 4 Important, 9 Minor).
- **Rama:** `fix/revision-ui-ux-it8`.
- **Ledger:** `.superpowers/sdd/2026-10-23-ola-fixes-ui-ux-it8/progress.md`.
- Cierra #137. Por la regla 6 de `CLAUDE.md`, la ola va antes de MAN-2 (#138).

## Decisiones (no se re-litigan)

- **Barrido del sitio en Playwright** (ruling, 2026-10-23): los arreglos de CSS y de atributos del DOM del manual (UX8-01, 02, 05, 06, 07, 10, 13) se protegen con un spec de Playwright sobre el sitio construido (`apps/docs/sitio/accesibilidad.spec.ts`, `pnpm --filter @dentalware/docs sitio`), que corre en el job `e2e` del CI (es el que tiene los navegadores). No sustituye a los tests de Vitest de los componentes: lo que es una función o un componente se prueba también en jsdom.
- **44 px en todo el manual** (ruling): el sitio no tiene tablas densas de escritorio, así que los 36 px con puntero fino no aplican; migas, navbar, tabla de contenidos, «En esta página», campo de búsqueda y marca miden 44 en todos los anchos.
- **«Primeros pasos» con página propia** (ruling): `primeros-pasos/index.md`, como «Un día de recepción» y «Un día del mensajero»; navbar, portada y menú lateral llevan a `/primeros-pasos/`. `HELP_PATH` de la app no cambia.
- **Dimensiones de las capturas en un JSON junto a los PNG** (ruling): `static/img/capturas/dimensiones.json`, que la tubería actualiza al escribir cada PNG y `capturas-referenciadas.test.ts` cruza con la cabecera de cada PNG. Nunca se escribe a mano.
- **Barra lateral fija en escritorio** (ruling): `sticky` de la altura de la ventana, con el `<nav>` desplazable y el pie («Ayuda», «Cerrar sesión») siempre a la vista.
- **Enlaces en línea del texto y enlaces de ancla de los títulos**: descartados en la revisión; no se tocan.
- **Rótulos de «Instalar la app»**: fuera de la ola (Tarea 9 de la It7, con Nelson). El comentario MDX que lo recuerda se queda.

## Restricciones globales

Las de `CLAUDE.md`, `docs/conventions.md` y `docs/architecture.md`:
- TDD (RED → GREEN, con mutación sobre código de producción); una tarea sin prueba es Important;
- español en sentence case; nada real en el manual (datos ficticios, sin teléfonos ni direcciones del laboratorio);
- 44 px, AA y nunca solo color;
- `apps/docs/**` solo importa `import type` de `@dentalware/shared`, nunca `api` ni `web` (ADR 37; lo vigila ESLint);
- un componente por archivo; tests junto al código; `vitest.config.mts` del paquete ya incluye `src/**`, `*.test.ts`, `scripts/**`, `capturas/**`: lo que vaya en `sitio/**` se añade al `include` solo si lleva tests de Vitest (no debería: son specs de Playwright);
- las capturas del manual son estables bit a bit: una tarea que regenera capturas debe dejar `git status` sin PNG cambiados salvo los que la tarea cambia a propósito;
- durante una corrida de capturas no se edita `apps/web` (HMR, #133);
- `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` antes de cada commit; puertos 3000, 3100 y 5173 libres al terminar;
- commits pequeños en español con `Refs #137` y los trailers `Co-Authored-By` y `Claude-Session`;
- un implementador a la vez; sin subagentes desde el implementador.

Modo rápido de capturas (Tareas 3, 5 y 6): `pnpm --filter @dentalware/docs capturas:servidores` en segundo plano (contraseña nueva, reseed, API con reloj fijo) + la web dev (`pnpm --filter @dentalware/web dev`, o la arranca Playwright) + `CAPTURAS_RAPIDO=1 pnpm --filter @dentalware/docs capturas -- <spec> -g <patrón>`; ver `docs/conventions.md` §7. Al terminar, parar la API por su PID (`apps/docs/capturas/.auth/api.pid`) y la web; nunca `pkill`.

## Tareas

| # | Tarea | Hallazgos | Modelo |
|---|---|---|---|
| 1 | Barrido del sitio (`apps/docs/sitio/`) + objetivos táctiles, títulos de avisos y chip de botón (CSS) | UX8-02, UX8-07, UX8-09 | opus |
| 2 | Buscador y página de búsqueda accesibles (wrappers de `SearchBar` y `SearchPage`) | UX8-01, UX8-13 | opus |
| 3 | Capturas con `width`/`height` (dimensiones.json desde la tubería) | UX8-04 | opus |
| 4 | Portada, «Primeros pasos», rótulos de Docusaurus y 404 | UX8-05, UX8-06, UX8-08, UX8-10 | sonnet |
| 5 | App: barra lateral fija y contenedores con nombre accesible; locators por rol en las capturas | UX8-03, UX8-12 | opus |
| 6 | Campos de fecha vacíos en las capturas | UX8-11 | sonnet |
| 7 | Cierre: resultado de la ola, docs y PR | — | sonnet |

Orden: 1 → 2 → 3 → 4 → 5 → 6 → 7. La Tarea 1 deja el barrido; cada tarea siguiente añade a ese spec los tests de sus hallazgos (RED) antes de arreglarlos (GREEN).

---

### Task 1: Barrido del sitio y arreglos de CSS (UX8-02, UX8-07, UX8-09)

**Files:**
- Create: `apps/docs/sitio/playwright.config.ts`, `apps/docs/sitio/accesibilidad.spec.ts`, `apps/docs/sitio/helpers.ts`
- Modify: `apps/docs/package.json` (script `sitio`), `apps/docs/tsconfig.json` (`include` + `sitio`), `apps/docs/src/css/custom.css`, `apps/docs/src/components/boton.tsx` (solo si el hueco de UX8-09 viene del componente), `.github/workflows/ci.yml` (job `e2e`), `docs/conventions.md` §7 «Sitio del manual», `apps/docs/README.md`

**Interfaces:**
- Produces: `apps/docs/sitio/helpers.ts` con `PAGINAS: readonly string[]` (las 18 rutas del manual, de `/` a `/mensajero/sin-senal/`), `expectObjetivosTactiles(target: Page | Locator, selector: string, min = 44)` (falla si no mide nada, como `expectTouchTargets` de la web), `sinScrollHorizontal(page)` y `consola(page): string[]` (errores y `pageerror`). Las tareas 2–6 añaden `test(...)` a `accesibilidad.spec.ts` con estos helpers.

- [ ] **Step 1: la configuración de Playwright del sitio**

`apps/docs/sitio/playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

/** Barrido del manual construido (revisión UI/UX de la It8, #137): objetivos táctiles, scroll
 * horizontal, consola, rótulos en español y landmarks, a 1280, 390 y 360. No necesita la API ni
 * datos: `docusaurus serve --build` construye el sitio y lo sirve en 3100. En local, con el sitio
 * ya servido (`pnpm --filter @dentalware/docs serve`), lo reutiliza. */
export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  outputDir: '../test-results/sitio',
  use: { baseURL: 'http://localhost:3100', locale: 'es-EC' },
  webServer: {
    command: 'pnpm exec docusaurus serve --build --port 3100 --no-open',
    url: 'http://localhost:3100/',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    cwd: '..',
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'telefono', use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } } },
    { name: 'telefono-360', use: { ...devices['Pixel 5'], viewport: { width: 360, height: 740 } } },
  ],
})
```

`apps/docs/package.json`: `"sitio": "playwright test --config sitio/playwright.config.ts"`. `apps/docs/tsconfig.json`: añadir `"sitio"` al `include`.

- [ ] **Step 2: los helpers**

`apps/docs/sitio/helpers.ts`:

```ts
import { expect, type Locator, type Page } from '@playwright/test'

/** Todas las páginas del manual (las de `sidebars.ts` más la portada y la de búsqueda). Si una guía
 * nueva no está aquí, el barrido no la ve: `capturas-referenciadas.test.ts` no la cruza, así que
 * la lista es explícita a propósito. */
export const PAGINAS = [
  '/',
  '/primeros-pasos/',
  '/primeros-pasos/entrar-y-salir/',
  '/primeros-pasos/instalar-la-app/',
  '/primeros-pasos/que-ve-cada-rol/',
  '/recepcion/',
  '/recepcion/crear-un-trabajo/',
  '/recepcion/la-ficha-del-trabajo/',
  '/recepcion/estados-y-acciones/',
  '/recepcion/recogidas-y-entregas/',
  '/recepcion/avisar-por-whatsapp/',
  '/recepcion/cuentas-y-pagos/',
  '/recepcion/imprimir/',
  '/mensajero/',
  '/mensajero/entregas-del-dia/',
  '/mensajero/marcar-entregado/',
  '/mensajero/no-se-pudo/',
  '/mensajero/sin-senal/',
] as const

/** Controles que se tocan: enlaces, botones y campos visibles. Los enlaces en línea del texto
 * (`.markdown p a`, `li a`, `td a`) y los enlaces de ancla de los títulos (`.hash-link`) quedan
 * fuera por decisión de la revisión (UX8, descartados). */
export const CONTROLES =
  'a[href]:not(.hash-link):not(.markdown :is(p, li, td) > a), button, input:not([type=hidden]), [role=button]'

/** Cada control visible mide al menos `min` × `min`; falla si no midió nada. */
export async function expectObjetivosTactiles(
  target: Page | Locator,
  selector: string,
  min = 44,
) {
  const items = target.locator(selector)
  const n = await items.count()
  let medidos = 0
  const cortos: string[] = []
  for (let i = 0; i < n; i++) {
    const el = items.nth(i)
    if (!(await el.isVisible())) continue
    const caja = await el.boundingBox()
    if (!caja) continue
    medidos++
    if (caja.width < min - 0.5 || caja.height < min - 0.5) {
      const nombre = (await el.getAttribute('aria-label')) ?? (await el.innerText()).trim()
      cortos.push(`«${nombre.slice(0, 40)}» ${Math.round(caja.width)}×${Math.round(caja.height)}`)
    }
  }
  expect(medidos, `nada que medir con ${selector}`).toBeGreaterThan(0)
  expect(cortos).toEqual([])
}

export async function sinScrollHorizontal(page: Page) {
  const { ancho, ventana } = await page.evaluate(() => ({
    ancho: document.documentElement.scrollWidth,
    ventana: window.innerWidth,
  }))
  expect(ancho, 'scroll horizontal').toBeLessThanOrEqual(ventana)
}

/** Errores de consola y excepciones de la página, para `expect(errores).toEqual([])`. */
export function consola(page: Page): string[] {
  const errores: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text())
  })
  page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`))
  return errores
}
```

- [ ] **Step 3: el spec, con lo que ya pasa y lo que falla (RED)**

`apps/docs/sitio/accesibilidad.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { CONTROLES, consola, expectObjetivosTactiles, PAGINAS, sinScrollHorizontal } from './helpers'

test.describe('todas las páginas', () => {
  for (const ruta of PAGINAS) {
    test(`${ruta}: sin scroll horizontal, consola limpia y un solo h1`, async ({ page }) => {
      const errores = consola(page)
      await page.goto(ruta)
      await sinScrollHorizontal(page)
      await expect(page.locator('h1')).toHaveCount(1)
      expect(errores).toEqual([])
    })
  }
})

// UX8-02: migas, «En esta página», marca, navbar y tabla de contenidos a 44 px en todos los anchos.
test('los controles de navegación de una guía miden 44 px', async ({ page }) => {
  await page.goto('/recepcion/crear-un-trabajo/')
  await expectObjetivosTactiles(page, '.breadcrumbs__link')
  await expectObjetivosTactiles(page, '.navbar__brand')
  await expectObjetivosTactiles(page, CONTROLES)
})

test('el menú del teléfono mide 44 px', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'menú del teléfono')
  await page.goto('/recepcion/crear-un-trabajo/')
  await page.locator('.navbar__toggle').click()
  const menu = page.locator('.navbar-sidebar')
  await expect(menu).toBeVisible()
  await expectObjetivosTactiles(menu, 'a[href], button')
})

// UX8-07: los títulos de los avisos en sentence case, como todo el manual.
test('los títulos de los avisos no van en mayúsculas', async ({ page }) => {
  await page.goto('/mensajero/entregas-del-dia/')
  const titulo = page.locator('.theme-admonition').first().locator(':scope > div').first()
  await expect(titulo).toHaveText(/Precios/)
  await expect(titulo).toHaveCSS('text-transform', 'none')
})

// UX8-09: el chip de un botón no deja aire antes de la puntuación que le sigue.
test('un chip de botón va pegado a la puntuación', async ({ page }) => {
  await page.goto('/recepcion/crear-un-trabajo/')
  const hueco = await page.locator('kbd.boton').first().evaluate((kbd) => {
    const r = kbd.getBoundingClientRect()
    const siguiente = kbd.nextSibling
    if (!siguiente || siguiente.nodeType !== Node.TEXT_NODE) return 0
    const rango = document.createRange()
    rango.setStart(siguiente, 0)
    rango.setEnd(siguiente, 1)
    return rango.getBoundingClientRect().left - r.right
  })
  expect(hueco).toBeLessThan(2)
})
```

Run: `pnpm --filter @dentalware/docs sitio`
Expected: las páginas pasan; «miden 44 px», «menú del teléfono» (por la marca), «avisos» y «chip» fallan.

- [ ] **Step 4: los arreglos en `custom.css`**

Al final del bloque de objetivos táctiles:

```css
/* UX8-02: migas, marca, enlaces del navbar y «En esta página» a 44 px; la tabla de contenidos de
 * escritorio, con cada entrada a 44 (sin tablas densas en el manual, no hay 36 con puntero fino) */
.breadcrumbs__link,
.navbar__brand,
.navbar__link,
.tocCollapsibleButton_,
button[class*='tocCollapsibleButton'] {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
}

.table-of-contents__link {
  display: flex;
  align-items: center;
  min-height: 44px;
  margin: 0;
}

.table-of-contents li {
  margin: 0;
}

/* UX8-07: los títulos de los avisos en sentence case */
.theme-admonition > div:first-child {
  text-transform: none;
  letter-spacing: 0;
}
```

Para UX8-09, medir primero en DevTools (`$0.getBoundingClientRect()` del `kbd` y el rango del texto siguiente) de dónde sale el hueco: si es de `padding` o `margin` del `kbd` (Infima no le da margen; `kbd.boton` tiene `padding: 0.1em 0.5em`), la solución es un `padding-inline` menor (0.35em) sin margen; si el hueco está dentro del chip (texto con espacio al final), es `Boton` quien lo recorta (`children` como texto `.trim()`). Dejar la causa en un comentario del CSS.

Run: `pnpm --filter @dentalware/docs sitio`
Expected: todo en verde en los tres proyectos.

- [ ] **Step 5: CI y docs**

`.github/workflows/ci.yml`, job `e2e`, tras el paso de Playwright de la web (y antes del `upload-artifact`):

```yaml
      # Barrido del manual construido (#137): objetivos táctiles, rótulos, landmarks.
      - run: pnpm --filter @dentalware/docs sitio
```

y en el `upload-artifact`, añadir `apps/docs/test-results` a `path`.

`docs/conventions.md` §7, apartado «Sitio del manual»: una frase: «`pnpm --filter @dentalware/docs sitio` (Playwright sobre `docusaurus serve --build`, en el job `e2e`) barre todas las páginas a 1280, 390 y 360: scroll horizontal, consola, un `h1`, 44 px en migas, navbar, menú, tabla de contenidos y buscador, rótulos en español y landmarks; una guía nueva se añade a `PAGINAS` de `sitio/helpers.ts`.» `apps/docs/README.md`: el comando en la lista de comandos.

- [ ] **Step 6: verificación y commit**

`pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`; `pnpm --filter @dentalware/docs sitio`.

```bash
git add apps/docs/sitio apps/docs/package.json apps/docs/tsconfig.json apps/docs/src/css/custom.css .github/workflows/ci.yml docs/conventions.md apps/docs/README.md
git commit -m "fix(docs): barrido del manual en Playwright y controles de navegación a 44 px

UX8-02, UX8-07 y UX8-09 de la revisión UI/UX de la Iteración 8.

Refs #137"
```

---

### Task 2: Buscador y página de búsqueda accesibles (UX8-01, UX8-13)

**Files:**
- Create: `apps/docs/src/theme/buscador-accesible.ts`, `apps/docs/src/theme/buscador-accesible.test.ts`, `apps/docs/src/theme/SearchBar/index.tsx`, `apps/docs/src/theme/SearchPage/index.tsx`, `apps/docs/src/theme/theme-original.d.ts`
- Modify: `apps/docs/sitio/accesibilidad.spec.ts`, `apps/docs/src/css/custom.css` (campo de la página de búsqueda a 44 px)

**Interfaces:**
- Produces: `etiquetarBuscador(raiz: ParentNode): void` — pone `aria-label="Buscar en el manual"` a todo `input.navbar__search-input` y a `input[class*="searchQueryInput"]` bajo `raiz`, y `role="main"` al `.container.margin-vert--lg` de la página de búsqueda si no hay ya un `main` en el documento. Idempotente.

- [ ] **Step 1: tests de la función (RED)**

`apps/docs/src/theme/buscador-accesible.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { etiquetarBuscador } from './buscador-accesible'

function dom(html: string) {
  document.body.innerHTML = html
  return document.body
}

describe('etiquetarBuscador', () => {
  it('nombra en español el campo del navbar, que el plugin deja en «Search»', () => {
    const raiz = dom('<input class="navbar__search-input" aria-label="Search" placeholder="Buscar">')
    etiquetarBuscador(raiz)
    expect(raiz.querySelector('input')).toHaveAttribute('aria-label', 'Buscar en el manual')
  })

  it('nombra el campo de la página de búsqueda', () => {
    const raiz = dom('<input class="searchQueryInput_abc" placeholder="Buscar">')
    etiquetarBuscador(raiz)
    expect(raiz.querySelector('input')).toHaveAttribute('aria-label', 'Buscar en el manual')
  })

  it('marca como main el contenedor de resultados si la página no tiene ninguno', () => {
    const raiz = dom('<div class="container margin-vert--lg"><h1>Buscar</h1></div>')
    etiquetarBuscador(raiz)
    expect(raiz.querySelector('.container')).toHaveAttribute('role', 'main')
  })

  it('no añade un segundo main si ya hay uno', () => {
    const raiz = dom('<main></main><div class="container margin-vert--lg"></div>')
    etiquetarBuscador(raiz)
    expect(raiz.querySelector('.container')).not.toHaveAttribute('role')
  })

  it('es idempotente y no toca otros campos', () => {
    const raiz = dom('<input class="navbar__search-input"><input aria-label="Otro">')
    etiquetarBuscador(raiz)
    etiquetarBuscador(raiz)
    expect(raiz.querySelector('[aria-label="Otro"]')).toBeInTheDocument()
    expect(raiz.querySelectorAll('[aria-label="Buscar en el manual"]')).toHaveLength(1)
  })
})
```

Run: `pnpm --filter @dentalware/docs test -- buscador-accesible`
Expected: FAIL (módulo inexistente).

- [ ] **Step 2: la función**

`apps/docs/src/theme/buscador-accesible.ts`:

```ts
/** Nombre accesible en español del buscador (UX8-01): `@easyops-cn/docusaurus-search-local`
 * 0.55.3 escribe `aria-label="Search"` fijo en el campo del navbar y deja sin nombre el de la
 * página de búsqueda; y esa página no tiene `main` (UX8-13). Los wrappers de `SearchBar` y
 * `SearchPage` lo corrigen en el DOM, al montar y ante cada cambio (el teléfono vuelve a montar el
 * campo al abrirlo). Idempotente. */
export const ETIQUETA_BUSCADOR = 'Buscar en el manual'

export function etiquetarBuscador(raiz: ParentNode): void {
  for (const input of raiz.querySelectorAll<HTMLInputElement>(
    'input.navbar__search-input, input[class*="searchQueryInput"]',
  )) {
    if (input.getAttribute('aria-label') !== ETIQUETA_BUSCADOR)
      input.setAttribute('aria-label', ETIQUETA_BUSCADOR)
  }
  const documento = raiz.ownerDocument ?? (raiz as Document)
  if (!documento.querySelector('main')) {
    raiz.querySelector('.container.margin-vert--lg')?.setAttribute('role', 'main')
  }
}
```

(`raiz.ownerDocument` es `null` cuando `raiz` es el propio `Document`.)

- [ ] **Step 3: tests en verde**

Run: `pnpm --filter @dentalware/docs test -- buscador-accesible`
Expected: 5 PASS.

- [ ] **Step 4: los wrappers y los tipos de `@theme-original`**

`apps/docs/src/theme/theme-original.d.ts`:

```ts
// Los componentes del tema que se envuelven (swizzle «wrap»): el bundler de Docusaurus resuelve
// `@theme-original/*`; TypeScript solo necesita sus props.
declare module '@theme-original/SearchBar' {
  import type { ComponentType } from 'react'
  const SearchBar: ComponentType<Record<string, unknown>>
  export default SearchBar
}
declare module '@theme-original/SearchPage' {
  import type { ComponentType } from 'react'
  const SearchPage: ComponentType<Record<string, unknown>>
  export default SearchPage
}
declare module '@theme-original/NotFound/Content' {
  import type { ComponentType } from 'react'
  const Content: ComponentType<{ className?: string }>
  export default Content
}
```

`apps/docs/src/theme/SearchBar/index.tsx`:

```tsx
import SearchBar from '@theme-original/SearchBar'
import { useEffect, useRef, type ComponentProps } from 'react'
import { etiquetarBuscador } from '../buscador-accesible'

/** `SearchBar` del plugin con el campo nombrado en español (UX8-01). `display: contents` para no
 * cambiar la fila del navbar. */
export default function SearchBarAccesible(props: ComponentProps<typeof SearchBar>) {
  const raiz = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = raiz.current
    if (!el) return
    etiquetarBuscador(el)
    const observador = new MutationObserver(() => etiquetarBuscador(el))
    observador.observe(el, { childList: true, subtree: true })
    return () => observador.disconnect()
  }, [])
  return (
    <div ref={raiz} style={{ display: 'contents' }}>
      <SearchBar {...props} />
    </div>
  )
}
```

`apps/docs/src/theme/SearchPage/index.tsx`: igual, sobre `@theme-original/SearchPage`, con el `useEffect` llamando a `etiquetarBuscador(document)` (el `Layout` del plugin pinta el navbar y el contenedor fuera de cualquier `div` que podamos poner alrededor), observando `document.body`.

`custom.css`: `input[class*='searchQueryInput'] { min-height: 44px; }`.

Comprobar que Docusaurus toma los wrappers: `pnpm --filter @dentalware/docs build` sin avisos de swizzle y, servido, `document.querySelector('.navbar__search-input').getAttribute('aria-label')` da «Buscar en el manual».

- [ ] **Step 5: el barrido (RED → GREEN)**

En `apps/docs/sitio/accesibilidad.spec.ts`:

```ts
// UX8-01: el buscador se anuncia en español, en el navbar y en la página de búsqueda.
test('el campo del buscador se llama «Buscar en el manual»', async ({ page, isMobile }) => {
  await page.goto('/')
  if (isMobile) await page.locator('.navbar__search-input, .navbar__search button').first().click()
  await expect(page.getByRole('combobox', { name: 'Buscar en el manual' })).toBeVisible()
  await page.goto('/search/?q=recogida')
  await expect(page.getByRole('searchbox', { name: 'Buscar en el manual' }).or(page.getByRole('textbox', { name: 'Buscar en el manual' }))).toBeVisible()
  await expectObjetivosTactiles(page, 'input[class*="searchQueryInput"]')
})

// UX8-13: la página de búsqueda tiene un landmark main.
test('la página de búsqueda tiene main', async ({ page }) => {
  await page.goto('/search/?q=recogida')
  await expect(page.getByRole('main')).toHaveCount(1)
})
```

Escribir los tests antes que los wrappers (fallan con «Search»); después, verde. Lighthouse de la página de búsqueda: 100 (`pnpm dlx lighthouse http://localhost:3100/search/?q=recogida --only-categories=accessibility --quiet --chrome-flags="--headless=new" --output=json --output-path=/tmp/lh.json`; anotar el resultado en el reporte).

- [ ] **Step 6: verificación y commit**

Verificación completa + `sitio`. Commit: `fix(docs): el buscador se anuncia en español y la búsqueda tiene main` (UX8-01, UX8-13; `Refs #137`).

---

### Task 3: Capturas con `width`/`height` (UX8-04)

**Files:**
- Create: `apps/docs/capturas/dimensiones.ts`, `apps/docs/capturas/dimensiones.test.ts`, `apps/docs/static/img/capturas/dimensiones.json`
- Modify: `apps/docs/capturas/helpers.ts`, `apps/docs/src/components/captura.tsx`, `apps/docs/src/components/captura.test.tsx`, `apps/docs/capturas-referenciadas.test.ts`, `apps/docs/package.json` (script `capturas:dimensiones`), `apps/docs/sitio/accesibilidad.spec.ts`, `apps/docs/README.md`, `docs/conventions.md` §7

**Interfaces:**
- Produces: `leerDimensionesPng(ruta: string): { ancho: number; alto: number }` (de la cabecera IHDR, sin sharp: bytes 16–19 y 20–23 big-endian), `registrarDimensiones(nombre: string, proyecto: Proyecto, png: string, archivoJson = DIMENSIONES_JSON): void` (lee el JSON si existe, pone `"<nombre>.<proyecto>": [ancho, alto]` en píxeles del PNG y lo escribe con las claves ordenadas y salto final), `DIMENSIONES_JSON` (ruta absoluta a `static/img/capturas/dimensiones.json`). `Captura` importa el JSON (`import dimensiones from '@site/static/img/capturas/dimensiones.json'`) y pinta `width={ancho / 2}` y `height={alto / 2}` (son 2x).

- [ ] **Step 1: tests de la lectura y el registro (RED)**

`apps/docs/capturas/dimensiones.test.ts`: con un PNG de 3×2 escrito en un directorio temporal (`mkdtempSync`; se puede generar con `sharp({ create: { width: 3, height: 2, channels: 3, background: '#fff' } }).png().toBuffer()` en el test, sharp ya es devDependency), `leerDimensionesPng` devuelve `{ ancho: 3, alto: 2 }`; `registrarDimensiones('a/b', 'telefono', png, json)` crea el JSON con `{"a/b.telefono":[3,2]}`; llamada dos veces con nombres distintos, los conserva ordenados; con un archivo que no es PNG, lanza «no es un PNG».

- [ ] **Step 2: el módulo**

`apps/docs/capturas/dimensiones.ts` (Node puro, sin Playwright): `readFileSync`, comprobar la firma `89 50 4E 47 0D 0A 1A 0A`, `readUInt32BE(16)` y `readUInt32BE(20)`; JSON con `JSON.stringify(ordenado, null, 2) + '\n'`.

- [ ] **Step 3: la tubería escribe el JSON y un script lo regenera entero**

En `helpers.ts`, tras `await sharp(png)…toFile(destino)`: `registrarDimensiones(nombre, proyecto, destino)`. Script `apps/docs/scripts/dimensiones.ts` (con `isMainModule` no hace falta: no lo importa ningún test): recorre `static/img/capturas/**/*.png`, borra las entradas que no tienen PNG y registra todas; `"capturas:dimensiones": "tsx scripts/dimensiones.ts"` (comprobar que `tsx` está disponible en el paquete, como en `apps/api`; si no, `node --experimental-strip-types`). Correrlo una vez y commitear el JSON (63 entradas).

- [ ] **Step 4: `Captura` pinta las dimensiones (RED → GREEN)**

En `captura.test.tsx`: «declara `width` y `height` a la mitad de los píxeles del PNG» (`recepcion/nuevo-trabajo-formulario` escritorio → los valores del JSON entre 2) y «sin entrada en el JSON, no pone dimensiones (y no revienta)». `captura.tsx`: `const dim = (dimensiones as Record<string, [number, number] | undefined>)[`${nombre}.${p}`]`; `width={dim && dim[0] / 2}` `height={dim && dim[1] / 2}`. `tsconfig`: `resolveJsonModule` ya viene con `@docusaurus/tsconfig`; comprobar con `pnpm --filter @dentalware/docs typecheck`.

- [ ] **Step 5: el test cruzado y el barrido**

`capturas-referenciadas.test.ts`: «cada PNG referenciado tiene su entrada en `dimensiones.json` y coincide con su cabecera» y «ninguna entrada sin PNG». `sitio/accesibilidad.spec.ts`: «toda captura declara `width` y `height`» (`img.captura__img` con los dos atributos > 0, en `/recepcion/crear-un-trabajo/`).

- [ ] **Step 6: docs, verificación y commit**

`docs/conventions.md` §7 «Capturas del manual»: «cada PNG lleva su tamaño en `static/img/capturas/dimensiones.json`, que escribe la tubería (`capturas:dimensiones` lo regenera entero) y pinta `<Captura>` como `width`/`height` para que la página no salte al cargarlas». README del manual: el script. Commit: `fix(docs): las capturas declaran su tamaño y la página no salta al cargarlas` (UX8-04).

---

### Task 4: Portada, «Primeros pasos», rótulos y 404 (UX8-05, UX8-06, UX8-08, UX8-10)

**Files:**
- Create: `apps/docs/docs/primeros-pasos/index.md`, `apps/docs/src/theme/NotFound/Content/index.tsx`, `apps/docs/src/theme/NotFound/Content/content.test.tsx`
- Modify: `apps/docs/src/components/portada.tsx`, `apps/docs/src/components/portada.test.tsx`, `apps/docs/src/css/custom.css`, `apps/docs/sidebars.ts`, `apps/docs/docusaurus.config.ts`, `apps/docs/i18n/es/code.json`, `apps/docs/docs/index.md`, `apps/docs/sitio/accesibilidad.spec.ts`

- [ ] **Step 1: tests de la portada (RED)**

En `portada.test.tsx`: el acceso «Primeros pasos» lleva a `/primeros-pasos/`; «la flecha es un nodo oculto al lector» (`container.querySelectorAll('.portada__flecha')` con 3, todos `aria-hidden="true"` y texto «→»); «el nombre accesible del acceso no incluye la flecha» (`toHaveAccessibleName(/^Primeros pasos Entrar/)`).

- [ ] **Step 2: la portada**

`portada.tsx`: `to: '/primeros-pasos/'` y `<span className="portada__titulo">{a.titulo}<span className="portada__flecha" aria-hidden="true">→</span></span>`. `custom.css`: quitar `.portada__titulo::after` y su `hover`; `.portada__flecha { display: inline-block; margin-left: 0.25rem; color: var(--dw-teal-lab); transition: transform 150ms ease }`, `.portada__acceso:hover .portada__flecha { transform: translateX(3px) }`, y la flecha en el bloque de `prefers-reduced-motion`.

- [ ] **Step 3: «Primeros pasos» con página propia**

`apps/docs/docs/primeros-pasos/index.md` (frontmatter `title: Primeros pasos`, `description: Entrar en Dentalware, instalarla como app y saber qué ve cada rol.`, `sidebar_position: 1`): un párrafo de qué es la sección y para quién (todos los roles, la primera vez), y la lista de las tres guías en orden con una línea cada una, enlazadas con rutas relativas (`./entrar-y-salir.md`…), con el mismo tono que `recepcion/index.md`. `sidebars.ts`: `link: { type: 'doc', id: 'primeros-pasos/index' }`. `docusaurus.config.ts`: el ítem del navbar a `/primeros-pasos/`. `docs/index.md`: el texto de «Por dónde empezar» sigue igual (enlaza a las tres guías); la tarjeta lleva al índice. El build con `onBrokenLinks: 'throw'` comprueba las rutas.

- [ ] **Step 4: rótulos de Docusaurus**

`i18n/es/code.json`, tres claves nuevas:

```json
  "theme.docs.sidebar.closeSidebarButtonAriaLabel": { "message": "Cerrar el menú" },
  "theme.docs.sidebar.toggleSidebarButtonAriaLabel": { "message": "Abrir el menú" },
  "theme.common.headingLinkTitle": { "message": "Enlace a la sección «{heading}»" }
```

- [ ] **Step 5: la 404 con una acción (RED → GREEN)**

`content.test.tsx`: renderiza el wrapper con `@theme-original/NotFound/Content` sustituido por un stub (alias en `vitest.config.mts`: `'@theme-original/NotFound/Content': './src/test/not-found-content.tsx'`, que pinta `<main><h1>Página no encontrada</h1></main>`) y comprueba el enlace «Ir a la portada» con `href="/"` y la clase `button`. El wrapper:

```tsx
import Link from '@docusaurus/Link'
import Content from '@theme-original/NotFound/Content'

/** La 404 del tema más una salida (UX8-10): en el teléfono «el menú» es una hamburguesa y «el
 * buscador», una lupa; un enlace a la portada es más claro. */
export default function NotFoundContent(props: { className?: string }) {
  return (
    <>
      <Content {...props} />
      <div className="container margin-bottom--xl">
        <div className="row">
          <div className="col col--6 col--offset-3">
            <Link className="button button--primary portada__volver" to="/">
              Ir a la portada
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
```

(`.portada__volver { min-height: 44px; display: inline-flex; align-items: center }` en el CSS; el `button--primary` de Infima ya usa `--ifm-color-primary`.)

- [ ] **Step 6: el barrido (RED → GREEN)**

`sitio/accesibilidad.spec.ts`: «las tres puertas de Primeros pasos llevan a su página» (navbar en escritorio, la tarjeta de la portada y la categoría del menú lateral → URL `/primeros-pasos/` y `h1` «Primeros pasos»); «los rótulos del menú del teléfono están en español» (hamburguesa `aria-label` «Abrir el menú», cerrar «Cerrar el menú», en móvil); «el enlace de ancla de un título dice a qué sección va» (`.hash-link` con `title` «Enlace a la sección «Quién puede hacerlo»»); «la 404 ofrece volver a la portada» (`/no-existe/` → enlace «Ir a la portada» de 44 px que lleva a `/`); «la flecha de las tarjetas no entra en el nombre del enlace» (`getByRole('link', { name: 'Primeros pasos Entrar, instalar la app y qué ve cada rol.' })` exacto).

- [ ] **Step 7: verificación y commit**

Verificación completa + `sitio`. Commit: `fix(docs): «Primeros pasos» con su página, flecha sin content, rótulos y 404 con salida` (UX8-05/06/08/10).

---

### Task 5: App: barra lateral fija y contenedores con nombre accesible (UX8-03, UX8-12)

**Files:**
- Modify: `apps/web/src/components/app-shell.tsx`, `apps/web/src/components/app-shell.test.tsx`, `apps/web/e2e/accesibilidad.spec.ts`, `apps/web/src/features/cases/case-header.tsx` (+ test), `apps/web/src/features/cases/pickup-fields.tsx` (+ su test o el de `case-form`), `apps/web/src/features/cases/case-whatsapp.tsx` o el bloque que agrupa código/clínica/WhatsApp en `case-header.tsx` (+ test), `apps/docs/capturas/recepcion.spec.ts`, `docs/conventions.md` §5

- [ ] **Step 1: la barra lateral (RED → GREEN)**

`app-shell.test.tsx`: «la barra lateral de escritorio es fija y de la altura de la ventana, con el menú desplazable» (`aside.className` contiene `lg:sticky`, `lg:top-0`, `lg:h-svh`; el `nav` «Principal» contiene `overflow-y-auto`). `app-shell.tsx`: `<aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card lg:sticky lg:top-0 lg:flex lg:h-svh print:hidden">` y `<nav … className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">`. Comprobar en el navegador a 1280×800 con el técnico de demostración (`tecnico@demo.local`, contraseña en `apps/docs/capturas/.auth/demo-password` tras `capturas:servidores`): «Ayuda» y «Cerrar sesión» a la vista con la página desplazada.

`accesibilidad.spec.ts` (web, `@extendida`, solo `escritorio`): con una lista de trabajos que supere la ventana (crear por API 12 trabajos con `createCase`), en `/trabajos?vista=todos` desplazar al final (`page.mouse.wheel(0, 4000)`) y comprobar que el enlace «Ayuda (abre el manual en otra pestaña)» sigue dentro de la ventana (`boundingBox().y + height <= viewport.height`).

- [ ] **Step 2: nombres accesibles (RED → GREEN)**

En los tests de cada componente (`case-header.test.tsx`, `case-form.test.tsx`), «la cabecera es una región llamada "Datos del trabajo"» (`getByRole('region', { name: 'Datos del trabajo' })` contiene el `h1`), «el bloque del código y la clínica es un grupo "Clínica y aviso"` (o el nombre que mejor describa: contiene el `h1`, la clínica y «Avisar por WhatsApp»/«Sin WhatsApp registrado.»), «"Programar recogida" es una región con ese nombre» (`getByRole('region', { name: 'Programar recogida' })` contiene el botón). Implementación: `<section aria-labelledby={id}>` con el `id` del `h1` o del título de la tarjeta (`useId`), o `aria-label` donde no hay título visible. Nada visible cambia.

- [ ] **Step 3: locators por rol en las capturas**

`apps/docs/capturas/recepcion.spec.ts`: `cabeceraFicha = (page) => page.getByRole('region', { name: 'Datos del trabajo' })`, la recogida con `page.getByRole('region', { name: 'Programar recogida' })` y el bloque de WhatsApp con el grupo; borrar los tres comentarios de deuda. Regenerar en modo rápido las capturas de `recepcion.spec.ts` que usan esos locators (`-g "ficha|recogida|whatsapp"`) y comprobar `git status`: **ningún PNG cambia** (si cambia alguno, la sección cambió de forma: investigar antes de aceptar).

- [ ] **Step 4: docs, verificación y commit**

`docs/conventions.md` §5: en «Accesibilidad», «los bloques que agrupan datos de un trabajo (cabecera, «Programar recogida», código y clínica) son `region`/`group` con nombre, para que las capturas y los lectores de pantalla los encuentren por rol». Verificación completa + `pnpm e2e --project=escritorio --project=android -g "accesibilidad"` + capturas sin diff. Commit: `fix(web): barra lateral fija en escritorio y regiones con nombre en la ficha` (UX8-03, UX8-12).

---

### Task 6: Campos de fecha vacíos en las capturas (UX8-11)

**Files:**
- Modify: `apps/docs/capturas/*.spec.ts` (los que capturen un `input[type=date]` vacío), los PNG afectados en `apps/docs/static/img/capturas/`, `dimensiones.json` (lo actualiza la tubería)

- [ ] **Step 1: encontrar las capturas afectadas**

Con los servidores de demostración en modo rápido, un spec temporal (no se commitea) o `page.evaluate` en cada pantalla capturada: listar los `input[type=date]` con `value === ''` visibles en el momento de cada `captura(...)`. Alternativa rápida: buscar «dd/mm/yyyy» a ojo en los PNG de las guías con formularios (`nuevo-trabajo-formulario`, `registrar-pago`, `aplicar-saldo`, `estado-de-cuenta`, `no-se-pudo-dialogo`, `accion-marcar-enviado`, `nuevo-trabajo-recogida`).

- [ ] **Step 2: rellenar sin guardar**

Para cada una, en el spec, `fill` de la fecha con un valor coherente con el reloj fijo (p. ej., «Fecha deseada» = `2026-10-27`) antes de la captura; el formulario no se envía. Regenerar solo esas capturas (`CAPTURAS_RAPIDO=1 pnpm --filter @dentalware/docs capturas -- recepcion.spec.ts -g "<patrón>"`); comprobar que solo cambian esos PNG y que el texto de la guía sigue describiendo la captura (ajustar el `alt` si nombra la fecha).

- [ ] **Step 3: verificación y commit**

Verificación completa (el test cruzado y `dimensiones.json`). Commit: `fix(docs): capturas sin campos de fecha vacíos` (UX8-11). Si ninguna captura muestra «dd/mm/yyyy», no hay commit: anotarlo en el reporte.

---

### Task 7: Cierre

**Files:**
- Modify: `docs/superpowers/reviews/2026-10-23-revision-ui-ux-iteracion-8.md` (sección «Resultado de la ola»), `docs/architecture.md` §7 (el job `e2e` corre también el barrido del manual), `CLAUDE.md` (el comando `sitio` en «Entorno»), `apps/docs/README.md` (si falta algo)

- [ ] **Step 1: «Resultado de la ola»**: tabla hallazgo → commit → qué se hizo (como en la revisión de la It7), «Descartados», «Fuera de la ola» (rótulos de «Instalar la app», Tarea 9) y «Capturas «después»» (portada, menú del teléfono con los rótulos nuevos, 404 con el enlace, la ficha con la barra fija a 1280 con el técnico): nuevas en `docs/superpowers/reviews/capturas/it8/` con prefijo `despues-`.
- [ ] **Step 2: docs**: `architecture.md` §7 CI (`e2e` + barrido del manual); `CLAUDE.md` «Entorno»: «barrido del manual con `pnpm --filter @dentalware/docs sitio`».
- [ ] **Step 3: Lighthouse** de la portada, la búsqueda y una guía por sección (móvil y escritorio): todo 100; anotarlo en el resultado.
- [ ] **Step 4: commit** `docs: resultado de la ola de fixes UI/UX de la Iteración 8` y, tras la revisión final de la rama, PR «Ola de fixes UI/UX de la Iteración 8» con `Closes #137`, auto-merge, y el tablero (#137 → En revisión → Hecho).
