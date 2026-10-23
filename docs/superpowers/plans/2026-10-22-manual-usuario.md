# Manual de usuario (Iteración 8, MAN-1, #127)

> **Para agentes:** sub-skill obligatoria `superpowers:subagent-driven-development` (un implementador a la vez, brief por tarea, revisión Critical/Important/Minor, rulings en el ledger). Los pasos usan `- [ ]`.

- **Spec:** `docs/superpowers/specs/2026-10-16-manual-usuario-design.md` (aprobado por Nelson el 2026-10-16). El plan argumenta desde el spec: quien ejecute lee los dos.
- **Historia:** MAN-1 (#127), épica #126, hito 10. Cierra #127. MAN-2 (técnico, administración, referencia) se abre en la Tarea 9.
- **Ramas y PR** (tres entregas a `main`, cada una con los cuatro checks en verde):
  1. `feat/manual-usuario` (ya existe, con el spec): Tareas 1–3 (sitio, seed demo, tubería de capturas).
  2. `feat/manual-contenido` desde `main`: Tareas 4–6 (las tres secciones).
  3. `feat/manual-ayuda-despliegue` desde `main`: Tareas 7–9 (enlace «Ayuda», infra, cierre).
- **Ledger:** `.superpowers/sdd/2026-10-22-manual-usuario/progress.md`.
- **Objetivo:** que recepción y el mensajero aprendan a usar Dentalware sin preguntar, con un manual público en `docs.dentalware.naphsoft.dev` cuyas capturas se regeneran con un comando.

## Decisiones (no se re-litigan)

- **Alcance (Nelson, 2026-10-15):** MAN-1 = sitio + capturas + «Primeros pasos» + «Recepción» + «Mensajero». Técnico, administración y referencia son MAN-2.
- **Datos de demostración (Nelson, 2026-10-15):** `seed:demo` en la API, ficticios y fijos, sobre la BD de test. Sobrescribe el laboratorio con «Laboratorio Demo»: el seed normal escribe los datos reales de Arte Dental y el manual es público.
- **Fotos de demostración (ruling):** se generan al vuelo con sharp (un rectángulo de color, sin texto) y se suben por el `Storage`; ningún binario nuevo en el repo. Desviación acotada de la sección 4 del spec (que hablaba de dos JPG en `scripts/demo/`), por no versionar binarios.
- **Servicios en el seed (ruling):** para que `seed-demo.ts` use los mismos casos de uso que la API sin duplicar la composición, `app.ts` se parte: `createServices(deps)` en `apps/api/src/services.ts` arma los servicios y `createApp` los monta. Sin cambio de comportamiento; lo cubren los tests de rutas.
- **Capturas sin HMR (lección de #133):** la tubería escribe solo bajo `apps/docs/static/img/capturas/` y `apps/docs/capturas/.auth/`; `apps/web` no se toca durante una corrida (Tailwind solo escanea `apps/web/src`, pero la regla sigue).
- **Buscador:** `@easyops-cn/docusaurus-search-local` 0.55.3 con español. Algolia, descartado.
- **CI:** el sitio se construye en `quality` por `pnpm build`; la imagen `docs` se prueba en `infra`. No se toca la ruleset.
- **Deploy:** servicio `docs` propio (imagen con su Caddy) en `127.0.0.1:8081` detrás del nginx del VPS. DNS y nginx, solo con Nelson (Tarea 9 de la Iteración 7).
- **Reloj fijo (Nelson, 2026-10-22: «un método refinado y eficiente»):** las capturas tienen que ser **bit a bit estables** entre corridas, para que el `git diff` de las imágenes solo cambie cuando cambia la UI. La API en modo test acepta `CLOCK_FIXED_AT` (un instante ISO; `config.ts` lo rechaza fuera de `NODE_ENV=test`), `seed:demo` calcula sus fechas relativas a ese día y el navegador fija `Date` con `page.clock.setFixedTime`. Día de demostración: **2026-10-20 10:30 (America/Guayaquil)**, un martes. Única excepción conocida: `case_events.created_at` lo pone Postgres (`clock_timestamp()`), así que la captura del historial cambia de hora entre corridas; se acepta.
- **Los specs de capturas no mutan datos:** todo estado que una captura necesita lo deja `seed:demo` (también «En camino al laboratorio», con la recogida ya marcada «Recogido»); los diálogos se capturan abiertos y se cierran con «Volver». Así cualquier spec se repite en segundos sin resembrar (modo rápido) y el orden de los tests no importa.

## Método de trabajo (cómo se hace el manual sin perder tiempo)

1. **Servidores una vez, capturas muchas veces.** `pnpm capturas` (modo completo) genera la contraseña, resiembra, arranca la API con el reloj fijo y toma todo. Para iterar, `pnpm --filter @dentalware/docs capturas:servidores` deja la API lista en segundo plano (con la BD de demostración y el reloj fijo) y después cada `CAPTURAS_RAPIDO=1 pnpm capturas -- recepcion.spec.ts -g "ficha"` corre solo ese spec en segundos, reutilizando servidores y sesiones. Puertos 3000/5173: la web dev de siempre se reutiliza; la API nunca (tiene que ser la del reloj fijo).
2. **Captura primero, texto después.** Para cada guía: (a) la tabla de capturas de su tarea (nombre, qué se ve, locator) se convierte en un test del spec; (b) se corre en modo rápido y se revisan los PNG con `Read` (encuadre, nada real, nada cortado); (c) con las imágenes delante se escribe el texto con la plantilla `apps/docs/plantillas/guia.md`, nombrando los mismos pacientes y clínicas que salen en ellas; (d) `docusaurus start` para leerla en el navegador; el `build` solo antes del commit (el job `quality` lo repite).
3. **Selectores sin adivinar.** Los E2E (`apps/web/e2e/*.spec.ts`) ya saben abrir cada pantalla y diálogo: se copian sus locators (y `pickSelectOption` entero, con su comentario de #133) en `capturas/helpers.ts`. Chrome DevTools solo para lo que ningún E2E toca.
4. **Un implementador por sección** (Tareas 4, 5 y 6) con el brief que incluye la plantilla, la tabla de capturas y los datos de demostración (`seed-demo-data.ts`), para que texto y capturas cuenten la misma historia.
5. **Revisión por lotes:** las tres anchuras y Lighthouse se pasan una vez por sección, no por página; el revisor mira primero `git status` (qué imágenes cambiaron) y solo abre esas.

## Restricciones globales

Las de `CLAUDE.md`, `docs/conventions.md` y `docs/architecture.md`:

- TDD RED → GREEN; una mutación sobre el código de producción por fix para ver el test caer. Una tarea sin prueba es _Important_.
- context7 antes de usar una API de librería; versiones en el `catalog:` de `pnpm-workspace.yaml`: Docusaurus **3.10.2** (core, preset-classic, module-type-aliases, tsconfig, types), `@easyops-cn/docusaurus-search-local` **0.55.3**, `prism-react-renderer` **2.4.1**; React **19.2.8** y sharp **0.35.4** ya están.
- Español en sentence case; los textos de los botones tal cual salen en la app; literales en los tests.
- **Nada real en el manual**: ni pacientes, ni clínicas, ni el nombre, dirección o teléfonos de Arte Dental, ni contraseñas, tokens, IPs ni URLs internas. `DEMO_PASSWORD` se genera en cada corrida y nunca se escribe en archivos, informes ni capturas.
- Ningún test escribe una contraseña literal (`testPassword()`).
- `seed:demo` y `reset-test-db` solo con `NODE_ENV=test`.
- 44 px, AA y nunca solo color; Lighthouse de accesibilidad ≥ 95 en el sitio.
- Verificación completa antes de cada commit: `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` (encadenado con `&&`, nunca con `;`).
- Chrome DevTools a 1280×800, 390×844 y 360×740 con la consola limpia para el sitio y para el enlace «Ayuda».
- Puertos 3000 y 5173 libres antes de `pnpm capturas` y de los E2E; parar los servidores dev solo por PID.
- Commits pequeños con `Refs #127` y los trailers `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` y `Claude-Session: https://claude.ai/code/session_01QWXyKd64kwAcEzKZeJy9Ue`. Nunca `--no-verify`.
- Un implementador a la vez. Los revisores no corren tests de BD mientras haya implementador activo.
- Node 24 en cada shell: `export PATH=$HOME/.nvm/versions/node/v24.19.0/bin:$PATH`.

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `apps/docs/package.json`, `docusaurus.config.ts`, `sidebars.ts`, `tsconfig.json`, `vitest.config.ts` | El sitio: paquete `@dentalware/docs`, modo solo docs, español, buscador local, enlaces/imágenes rotos en `throw` |
| `apps/docs/src/css/custom.css` | Tokens de Dentalware sobre Infima; 44 px; foco; sin modo oscuro |
| `apps/docs/src/components/{captura,boton,rol}.tsx` + `.test.tsx` | Componentes MDX: `Captura`, `Boton`, `Rol` |
| `apps/docs/src/theme/MDXComponents.tsx` | Registra los tres componentes en MDX |
| `apps/docs/src/components/portada.tsx` + `.test.tsx` | Accesos por rol de la portada (`docs/index.md`) |
| `apps/docs/docs/**/*.md` | Las guías (sección 3 del spec) |
| `apps/docs/plantillas/guia.md` | Plantilla de una guía de tarea (se copia para cada página) |
| `apps/docs/scripts/capturas-servidores.sh` | Modo rápido: contraseña, reseed y API con reloj fijo en segundo plano |
| `apps/api/src/config.ts`, `main.ts`, `lib/clock.ts` + `clock.test.ts` | `CLOCK_FIXED_AT` (solo test) → `fixedClockAt` |
| `apps/docs/static/img/capturas/<seccion>/<nombre>.<proyecto>.png` | Capturas generadas |
| `apps/docs/capturas/playwright.config.ts`, `helpers.ts`, `global-setup.ts`, `*.spec.ts` | Tubería de capturas |
| `apps/docs/scripts/capturas.sh` | Genera `DEMO_PASSWORD` y corre Playwright |
| `apps/docs/capturas-referenciadas.test.ts` | Cruza specs ↔ MDX |
| `apps/docs/README.md` | Para Nelson: cómo correr, regenerar y escribir una guía |
| `apps/api/src/services.ts` | `createServices(deps)`: la composición de servicios que hoy vive en `app.ts` |
| `apps/api/src/app.ts` | Usa `createServices` |
| `apps/api/src/scripts/seed-demo.ts` + `.test.ts`, `seed-demo-data.ts` | `seed:demo` |
| `apps/web/src/features/help/help-url.ts` + `.test.ts` | `helpUrl(role)`, `HELP_PATH` |
| `apps/web/src/components/app-shell.tsx` + `.test.tsx` | Enlace «Ayuda» |
| `apps/web/src/vite-env.d.ts`, `infra/web.Dockerfile`, `infra/docker-compose.yml` | `VITE_DOCS_URL` |
| `infra/docs.Dockerfile`, `infra/Caddyfile.docs`, `infra/docker-compose.yml`, `infra/.env.example` | Servicio `docs` |
| `infra/tests/docs-image.sh`, `.github/workflows/ci.yml` | Prueba de la imagen `docs` en el job `infra` |
| `docs/operacion/despliegue.md` | DNS, nginx y actualización del manual |
| `docs/conventions.md`, `docs/architecture.md`, `CLAUDE.md`, `docs/superpowers/specs/2026-09-12-historias-de-usuario-mvp.md` | Convenciones nuevas, MAN-1 recortada y MAN-2 |
| `.prettierignore`, `.gitignore`, `eslint.config.js`, `pnpm-workspace.yaml`, `package.json`, `vitest.config.ts` | Tooling del monorepo |

---

## Tareas

### Tarea 1: El sitio vacío (`apps/docs`): Docusaurus, tema, buscador, componentes MDX y CI

**Archivos:**
- Crear: `apps/docs/package.json`, `apps/docs/docusaurus.config.ts`, `apps/docs/sidebars.ts`, `apps/docs/tsconfig.json`, `apps/docs/vitest.config.ts`, `apps/docs/src/css/custom.css`, `apps/docs/src/components/captura.tsx`, `captura.test.tsx`, `boton.tsx`, `boton.test.tsx`, `rol.tsx`, `rol.test.tsx`, `portada.tsx`, `portada.test.tsx`, `apps/docs/src/theme/MDXComponents.tsx`, `apps/docs/docs/index.md`, `apps/docs/docs/primeros-pasos/entrar-y-salir.md` (solo el esqueleto, para que la portada tenga a dónde enlazar), `apps/docs/static/img/logo.svg` (copia de `apps/web/public/icon.svg`), `apps/docs/static/img/capturas/.gitkeep`, `apps/docs/README.md`.
- Modificar: `pnpm-workspace.yaml` (catalog), `package.json` raíz (`capturas`), `vitest.config.ts` raíz (proyecto `apps/docs`), `.prettierignore`, `.gitignore`, `eslint.config.js`, `CLAUDE.md` («Entorno»).

**Interfaces:**
- Produce: componentes MDX `Captura`, `Boton`, `Rol` (abajo), la carpeta `apps/docs/static/img/capturas/` y el script `pnpm --filter @dentalware/docs build`, que las Tareas 3–6 usan.

- [ ] **Paso 1: Confirmar las APIs con context7** (`/websites/docusaurus_io`): `docusaurus.config.ts` tipado, `docs.routeBasePath: '/'`, `blog: false`, `i18n`, `onBrokenLinks`, `onBrokenAnchors`, `markdown.hooks.onBrokenMarkdownImages`, `themeConfig.colorMode.disableSwitch`, `src/theme/MDXComponents` (swizzle-free). Para el buscador, el README del plugin: `pnpm dlx npm@latest view @easyops-cn/docusaurus-search-local@0.55.3 readme | less` (opciones `hashed`, `language`, `docsRouteBasePath`, `indexBlog`, `searchBarShortcut`, `searchBarShortcutHint`, `translations`). Anota en el ledger cualquier opción cuyo nombre difiera del de este plan.

- [ ] **Paso 2: Catalog y paquete.** En `pnpm-workspace.yaml`, bajo `catalog:`, añade (comentario «# manual de usuario (apps/docs)»):

```yaml
  '@docusaurus/core': 3.10.2
  '@docusaurus/preset-classic': 3.10.2
  '@docusaurus/module-type-aliases': 3.10.2
  '@docusaurus/tsconfig': 3.10.2
  '@docusaurus/types': 3.10.2
  '@easyops-cn/docusaurus-search-local': 0.55.3
  '@mdx-js/react': 3.1.1
  prism-react-renderer: 2.4.1
```

(`@mdx-js/react`: confirma la última 3.x con `npm view @mdx-js/react version` y fija esa.) Crea `apps/docs/package.json`:

```json
{
  "name": "@dentalware/docs",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "docusaurus start --port 3100",
    "build": "docusaurus build",
    "serve": "docusaurus serve --port 3100",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "capturas": "bash scripts/capturas.sh"
  },
  "dependencies": {
    "@docusaurus/core": "catalog:",
    "@docusaurus/preset-classic": "catalog:",
    "@easyops-cn/docusaurus-search-local": "catalog:",
    "@fontsource-variable/instrument-sans": "catalog:",
    "@fontsource-variable/jetbrains-mono": "catalog:",
    "@mdx-js/react": "catalog:",
    "clsx": "catalog:",
    "prism-react-renderer": "catalog:",
    "react": "catalog:",
    "react-dom": "catalog:"
  },
  "devDependencies": {
    "@dentalware/shared": "workspace:*",
    "@docusaurus/module-type-aliases": "catalog:",
    "@docusaurus/tsconfig": "catalog:",
    "@docusaurus/types": "catalog:",
    "@playwright/test": "catalog:",
    "@testing-library/jest-dom": "catalog:",
    "@testing-library/react": "catalog:",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "jsdom": "catalog:",
    "sharp": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

Comprueba que `@fontsource-variable/*`, `clsx`, `@testing-library/jest-dom` y `jsdom` están en el catalog (los usa `apps/web`); si alguno no, añádelo con la versión que ya use `apps/web`. Luego `pnpm install` (desde la raíz; `--frozen-lockfile` no: el lockfile cambia).

- [ ] **Paso 3: tsconfig y vitest del paquete.**

`apps/docs/tsconfig.json`:

```json
{
  "extends": "@docusaurus/tsconfig",
  "compilerOptions": {
    "baseUrl": ".",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "types": ["@docusaurus/module-type-aliases", "@docusaurus/theme-classic", "vitest/globals"]
  },
  "include": ["src", "capturas", "docusaurus.config.ts", "sidebars.ts", "*.test.ts"],
  "exclude": ["build", ".docusaurus"]
}
```

`apps/docs/vitest.config.ts` (mismo patrón que `apps/web/vitest.config.ts`; cópiale `setupFiles` si allí hay uno con `@testing-library/jest-dom/vitest`, creando `apps/docs/src/test/setup.ts` con `import '@testing-library/jest-dom/vitest'`):

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'docs',
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', '*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

En `vitest.config.ts` de la raíz añade `'apps/docs/vitest.config.ts'` a `projects`.

- [ ] **Paso 4: Tooling del monorepo.**
  - `.prettierignore`: cambia la línea `docs/` por `/docs/` (sin la barra inicial ignora también `apps/docs/`) y añade `apps/docs/build` y `apps/docs/.docusaurus`.
  - `.gitignore`: añade `.docusaurus/` bajo «# builds» (`build/` ya está).
  - `eslint.config.js`, `globalIgnores`: añade `'apps/docs/build/**'` y `'apps/docs/.docusaurus/**'`. Cambia `files: ['apps/web/**/*.{ts,tsx}']` del bloque de `reactHooks` por `files: ['apps/web/**/*.{ts,tsx}', 'apps/docs/src/**/*.{ts,tsx}']`.
  - `package.json` raíz, `scripts`: `"capturas": "pnpm --filter @dentalware/docs capturas"`.
  - `CLAUDE.md`, «Entorno»: una línea «Manual: `pnpm --filter @dentalware/docs dev` (puerto 3100); capturas con `pnpm capturas` (API y web en modo test, ver `docs/conventions.md` §7).» y en la primera línea del archivo, tras `apps/web (...)`, «, `apps/docs` (manual de usuario, Docusaurus)».

- [ ] **Paso 5: Test RED de los componentes MDX.** `apps/docs/src/components/captura.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Captura } from './captura'

describe('Captura', () => {
  it('pinta la imagen de escritorio con su alt y la ruta fija de capturas', () => {
    render(<Captura nombre="recepcion/nuevo-trabajo-formulario" alt="Formulario de nuevo trabajo" />)
    const img = screen.getByRole('img', { name: 'Formulario de nuevo trabajo' })
    expect(img).toHaveAttribute('src', '/img/capturas/recepcion/nuevo-trabajo-formulario.escritorio.png')
    expect(img).toHaveAttribute('loading', 'lazy')
  })

  it('con `telefono`, añade la variante de teléfono con su propio alt', () => {
    render(
      <Captura nombre="mensajero/entregas-del-dia" alt="Entregas del día" telefono />,
    )
    const imgs = screen.getAllByRole('img')
    expect(imgs.map((i) => i.getAttribute('src'))).toEqual([
      '/img/capturas/mensajero/entregas-del-dia.escritorio.png',
      '/img/capturas/mensajero/entregas-del-dia.telefono.png',
    ])
    expect(screen.getByRole('img', { name: 'Entregas del día (en el teléfono)' })).toBeInTheDocument()
  })

  it('con `solo="telefono"`, solo la del teléfono', () => {
    render(<Captura nombre="mensajero/recogido" alt="Botón Recogido" solo="telefono" />)
    expect(screen.getAllByRole('img')).toHaveLength(1)
    expect(screen.getByRole('img')).toHaveAttribute('src', '/img/capturas/mensajero/recogido.telefono.png')
  })

  it('el pie, si lo hay, va en un figcaption', () => {
    render(<Captura nombre="x/y" alt="x" pie="Así se ve con una recogida pendiente." />)
    expect(screen.getByText('Así se ve con una recogida pendiente.').tagName).toBe('FIGCAPTION')
  })
})
```

`boton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Boton } from './boton'

describe('Boton', () => {
  it('muestra el texto del botón de la app tal cual, como <kbd> con su clase', () => {
    render(<Boton>Registrar pago</Boton>)
    const el = screen.getByText('Registrar pago')
    expect(el.tagName).toBe('KBD')
    expect(el.className).toContain('boton')
  })
})
```

`rol.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Rol } from './rol'

describe('Rol', () => {
  it('lista quién puede hacerlo, con los rótulos de la app', () => {
    render(<Rol roles={['admin', 'recepcion']} />)
    expect(screen.getByText('Administración')).toBeInTheDocument()
    expect(screen.getByText('Recepción')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Quién puede hacerlo' })).toBeInTheDocument()
  })

  it('no acepta un rol que no existe (tipo exhaustivo): el mensajero sale como «Mensajero»', () => {
    render(<Rol roles={['mensajero', 'tecnico']} />)
    expect(screen.getByText('Mensajero')).toBeInTheDocument()
    expect(screen.getByText('Técnico')).toBeInTheDocument()
  })
})
```

Corre `pnpm --filter @dentalware/docs test` → FAIL (módulos inexistentes).

- [ ] **Paso 6: Componentes (GREEN).** `captura.tsx`:

```tsx
import type { ReactNode } from 'react'

type Proyecto = 'escritorio' | 'telefono'

/** Ruta fija de una captura: la tubería (`capturas/helpers.ts`) escribe exactamente aquí y
 * `capturas-referenciadas.test.ts` cruza los nombres en las dos direcciones. */
export function rutaCaptura(nombre: string, proyecto: Proyecto): string {
  return `/img/capturas/${nombre}.${proyecto}.png`
}

export function Captura({
  nombre,
  alt,
  telefono = false,
  solo,
  pie,
}: {
  /** `<seccion>/<nombre>`, sin extensión ni proyecto. */
  nombre: string
  alt: string
  /** Añade la variante de teléfono al lado de la de escritorio. */
  telefono?: boolean
  /** Solo una de las dos. */
  solo?: Proyecto
  pie?: ReactNode
}) {
  const proyectos: Proyecto[] = solo ? [solo] : telefono ? ['escritorio', 'telefono'] : ['escritorio']
  return (
    <figure className="captura">
      <div className="captura__imagenes">
        {proyectos.map((p) => (
          <img
            key={p}
            src={rutaCaptura(nombre, p)}
            alt={p === 'telefono' && proyectos.length > 1 ? `${alt} (en el teléfono)` : alt}
            loading="lazy"
            className={`captura__img captura__img--${p}`}
          />
        ))}
      </div>
      {pie ? <figcaption>{pie}</figcaption> : null}
    </figure>
  )
}
```

`boton.tsx`:

```tsx
import type { ReactNode } from 'react'

/** El texto de un botón o enlace de la app, tal cual sale en ella (regla de redacción del spec). */
export function Boton({ children }: { children: ReactNode }) {
  return <kbd className="boton">{children}</kbd>
}
```

`rol.tsx`:

```tsx
import type { UserRole } from '@dentalware/shared'

const ROL_LABEL: Record<UserRole, string> = {
  admin: 'Administración',
  recepcion: 'Recepción',
  tecnico: 'Técnico',
  mensajero: 'Mensajero',
}

export function Rol({ roles }: { roles: readonly UserRole[] }) {
  return (
    <ul className="rol" aria-label="Quién puede hacerlo">
      {roles.map((r) => (
        <li key={r} className="rol__chip">
          {ROL_LABEL[r]}
        </li>
      ))}
    </ul>
  )
}
```

`apps/docs/src/theme/MDXComponents.tsx`:

```tsx
import MDXComponents from '@theme-original/MDXComponents'
import { Boton } from '@site/src/components/boton'
import { Captura } from '@site/src/components/captura'
import { Portada } from '@site/src/components/portada'
import { Rol } from '@site/src/components/rol'

export default { ...MDXComponents, Captura, Boton, Rol, Portada }
```

Corre `pnpm --filter @dentalware/docs test` → PASS.

- [ ] **Paso 7: Configuración del sitio.** `apps/docs/docusaurus.config.ts`:

```ts
import type { Config } from '@docusaurus/types'
import type * as Preset from '@docusaurus/preset-classic'
import { themes as prismThemes } from 'prism-react-renderer'

const config: Config = {
  title: 'Manual de Dentalware',
  tagline: 'Cómo usar el programa del laboratorio, paso a paso',
  favicon: 'img/favicon.ico',
  url: 'https://docs.dentalware.naphsoft.dev',
  baseUrl: '/',
  trailingSlash: true,
  i18n: { defaultLocale: 'es', locales: ['es'], localeConfigs: { es: { htmlLang: 'es-EC' } } },
  // Un enlace, un ancla o una imagen rotos rompen el build (y el job `quality`).
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  markdown: { hooks: { onBrokenMarkdownLinks: 'throw', onBrokenMarkdownImages: 'throw' } },
  presets: [
    [
      'classic',
      {
        docs: { routeBasePath: '/', sidebarPath: './sidebars.ts', showLastUpdateTime: false },
        blog: false,
        theme: { customCss: './src/css/custom.css' },
      } satisfies Preset.Options,
    ],
  ],
  themes: [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        language: ['es'],
        docsRouteBasePath: '/',
        indexBlog: false,
        indexPages: true,
        searchBarShortcut: true,
        searchBarShortcutHint: true,
        translations: {
          search_placeholder: 'Buscar',
          see_all_results: 'Ver todos los resultados',
          no_results: 'Sin resultados.',
          search_results_for: 'Resultados para «{{ keyword }}»',
          search_the_documentation: 'Buscar en el manual',
          count_documents_found: '{{ count }} página encontrada',
          count_documents_found_plural: '{{ count }} páginas encontradas',
          no_documents_were_found: 'No se encontró ninguna página',
        },
      },
    ],
  ],
  themeConfig: {
    colorMode: { defaultMode: 'light', disableSwitch: true, respectPrefersColorScheme: false },
    navbar: {
      title: 'Dentalware',
      logo: { alt: 'Dentalware', src: 'img/logo.svg' },
      items: [
        { to: '/primeros-pasos/entrar-y-salir/', label: 'Primeros pasos', position: 'left' },
        { to: '/recepcion/', label: 'Recepción', position: 'left' },
        { to: '/mensajero/', label: 'Mensajero', position: 'left' },
        { href: 'https://dentalware.naphsoft.dev', label: 'Abrir la app', position: 'right' },
      ],
    },
    footer: { style: 'light', copyright: `Dentalware · Manual de usuario` },
    prism: { theme: prismThemes.github },
    tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
  } satisfies Preset.ThemeConfig,
}

export default config
```

Las claves de `translations` que el README del plugin no tenga, quítalas. `apps/docs/sidebars.ts` (explícito; las páginas de las Tareas 4–6 se añaden aquí al crearlas):

```ts
import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'

const sidebars: SidebarsConfig = {
  manual: [
    'index',
    {
      type: 'category',
      label: 'Primeros pasos',
      link: { type: 'generated-index', title: 'Primeros pasos' },
      items: ['primeros-pasos/entrar-y-salir'],
    },
  ],
}

export default sidebars
```

`apps/docs/docs/index.md`:

```md
---
title: Bienvenida
description: Qué es Dentalware y cómo fluye un trabajo por el laboratorio.
sidebar_position: 1
slug: /
---

# Manual de Dentalware

Dentalware es el programa con el que el laboratorio lleva sus trabajos: desde que una clínica los pide hasta que se cobran. Este manual explica, paso a paso y con capturas, cómo usarlo.

## El flujo de un trabajo

Todo trabajo pasa por cuatro momentos: **recibir** (llega del doctor, con sus piezas y su fecha), **producir** (avanza por fases hasta terminarse), **entregar** (el mensajero lo lleva a la clínica) y **cobrar** (se registra el pago).

## Por dónde empezar

- [Entrar y salir](./primeros-pasos/entrar-y-salir.md)
```

`apps/docs/docs/primeros-pasos/entrar-y-salir.md`, de momento solo el frontmatter y el título (la Tarea 4 lo escribe):

```md
---
title: Entrar y salir
description: Cómo iniciar y cerrar sesión en Dentalware.
sidebar_position: 1
---

# Entrar y salir

(Se escribe en la Tarea 4.)
```

Copia `apps/web/public/icon.svg` a `apps/docs/static/img/logo.svg` y `apps/web/public/favicon.ico` a `apps/docs/static/img/favicon.ico`. Crea `apps/docs/static/img/capturas/.gitkeep`.

- [ ] **Paso 8: Tema con `frontend-design`.** Invoca la skill `frontend-design` y escribe `apps/docs/src/css/custom.css` sobre las variables de Infima, con la dirección de diseño de la app (`docs/superpowers/specs/2026-09-01-dentalware-design-direction.md`): primario `#0f766e` (y sus `--ifm-color-primary-dark/darker/darkest/light/lighter/lightest` calculados), fondo `#f4f6f5`, tinta `#1e2a2d`, `--ifm-font-family-base: 'Instrument Sans Variable'`, `--ifm-font-family-monospace: 'JetBrains Mono Variable'` (importa los dos `@fontsource-variable` al principio del archivo), radio 0.75rem, foco visible (`:focus-visible { outline: 2px solid var(--ifm-color-primary); outline-offset: 2px }`), objetivos táctiles ≥ 44 px en los enlaces del menú móvil y del sidebar (`min-height: 44px`), y las clases de los componentes: `.captura` (figura con borde `#e2e6e3`, radio y fondo blanco; `.captura__imagenes` en fila que se parte en columna por debajo de 768 px; `.captura__img--telefono` con `max-width: 390px`; `figcaption` en gris `#5b6a6e`), `.boton` (`kbd` con fondo `#d9efec`, texto `#0f766e`, sin sombra, padding 0.1em 0.5em, misma fuente), `.rol` (lista horizontal de chips sin viñetas: fondo `#eef1f0`, borde, radio completo, texto `#1e2a2d`). Sin `[data-theme='dark']`.

- [ ] **Paso 9: Portada.** Una sola raíz: `docs/index.md` (`slug: /`) es la portada; no hay `src/pages/index.tsx`. Los accesos por rol son el componente `Portada` (`apps/docs/src/components/portada.tsx`, registrado en `MDXComponents`): tres tarjetas grandes con `Link` de `@docusaurus/Link` (≥ 44 px, una por fila por debajo de 768 px, estilos en `custom.css` bajo `.portada`), «Primeros pasos» → `/primeros-pasos/entrar-y-salir/`, «Soy recepción» → `/recepcion/` y «Soy mensajero» → `/mensajero/`. Mientras las Tareas 5 y 6 no existan, las dos últimas apuntan también a `/primeros-pasos/entrar-y-salir/` (el build rompe con un enlace roto); las Tareas 5 y 6 ponen el destino final. Test `portada.test.tsx`: tres enlaces con esos textos y `href` (el de la Tarea 1 comprueba los provisionales; la Tarea 5 y la 6 lo actualizan). Añade `<Portada />` bajo «## Por dónde empezar» en `docs/index.md` y quita la lista de enlaces de ahí.

- [ ] **Paso 10: Verificar el sitio.** `pnpm --filter @dentalware/docs build` → termina sin «broken link». `pnpm --filter @dentalware/docs serve` y, con Chrome DevTools (`navigate_page` a `http://localhost:3100/`), a 1280×800, 390×844 y 360×740: portada, página «Entrar y salir», el buscador (teclea «entrar»: encuentra la página; el atajo `Ctrl+K` lo abre), sin scroll horizontal, consola limpia. Lighthouse de accesibilidad (`lighthouse_audit`, categoría accessibility) ≥ 95 en la portada. Guarda dos capturas (1280 y 390) en `docs/superpowers/reviews/capturas/it8/sitio-vacio-{escritorio,telefono}.png`. Para el servidor: arráncalo en segundo plano con `run_in_background` y anota el PID; al terminar, mátalo por PID.

- [ ] **Paso 11: Plantilla y README.** `apps/docs/plantillas/guia.md` (fuera de `docs/`, para que no se publique):

```md
---
title: <Verbo en infinitivo + objeto, p. ej. «Registrar un pago»>
description: <Una frase: para qué sirve, la que sale en el buscador.>
sidebar_position: <n>
---

# <El mismo título>

<Una o dos frases: para qué sirve esto y cuándo se usa.>

## Quién puede hacerlo

<Rol roles={['admin', 'recepcion']} />

## Pasos

1. Abre **Trabajos** y entra al trabajo.
2. Toca <Boton>Registrar pago</Boton>.
   <Captura nombre="recepcion/registrar-pago" alt="Diálogo Registrar pago con el reparto sugerido" telefono />
3. …

## Qué pasa después

<Qué cambia en el trabajo o en la cuenta, y quién lo ve.>

:::warning Importante
<Solo si hay algo sin vuelta atrás. Si no, borra este bloque.>
:::

## Problemas frecuentes

- **<Mensaje o situación tal cual>:** <qué hacer>.
```

`apps/docs/README.md` (para Nelson, en español): qué es, `pnpm --filter @dentalware/docs dev`, cómo se escribe una guía (copiar la plantilla; los tres componentes con un ejemplo cada uno; «captura primero, texto después»), cómo se regeneran las capturas (`pnpm capturas` y el modo rápido; se completa en la Tarea 3) y qué no puede salir en ellas.

- [ ] **Paso 12: Verificación completa y commit.** `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` en verde. Commit: `feat(docs): sitio del manual con Docusaurus, tema, buscador local y componentes MDX` + `Refs #127` + trailers.

---

### Tarea 2: `createServices` y `seed:demo`

**Archivos:**
- Crear: `apps/api/src/services.ts`, `apps/api/src/scripts/seed-demo-data.ts`, `apps/api/src/scripts/seed-demo.ts`, `apps/api/src/scripts/seed-demo.test.ts`, `apps/api/src/lib/clock.test.ts`.
- Modificar: `apps/api/src/app.ts` (usa `createServices`), `apps/api/src/config.ts` (`CLOCK_FIXED_AT`), `apps/api/src/config.test.ts` (si existe; si no, créalo para este caso), `apps/api/src/main.ts` (reloj fijo en test), `apps/api/src/lib/clock.ts` (`fixedClockAt`), `apps/api/package.json` (`"seed:demo": "tsx src/scripts/seed-demo.ts"`), `docs/architecture.md` §3 (una línea sobre `services.ts`), `docs/conventions.md` §4 («Configuración»: `CLOCK_FIXED_AT`).

**Interfaces:**
- Consume: los servicios de `app.ts` (sin cambios de firma).
- Produce: `createServices(deps: ServicesDeps)` → `{ cases, deliveries, attachments, accounts, import }`; `fixedClockAt(iso: string): Clock`; `CLOCK_FIXED_AT` en `Config` (opcional, solo test); `assertDemoEnv(nodeEnv, demoPassword)`; `seedDemo(ctx: DemoSeedContext): Promise<DemoSeedResult>` con `ctx.today` (`YYYY-MM-DD`); `DEMO_TODAY = '2026-10-20'` y `DEMO_NOW = '2026-10-20T10:30:00-05:00'` en `seed-demo-data.ts`; los nombres y correos de `DEMO_USERS` (la Tarea 3 inicia sesión con ellos); el script `pnpm --filter @dentalware/api seed:demo`.

- [ ] **Paso 0: Reloj fijo en modo test (RED → GREEN).** `apps/api/src/lib/clock.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { fixedClockAt } from './clock.ts'

describe('fixedClockAt', () => {
  it('da siempre el mismo instante y su día', () => {
    const clock = fixedClockAt('2026-10-20T10:30:00-05:00')
    expect(clock.now().toISOString()).toBe('2026-10-20T15:30:00.000Z')
    expect(clock.today()).toBe('2026-10-20')
    expect(clock.now().getTime()).toBe(clock.now().getTime())
  })
})
```

`lib/clock.ts`: `export function fixedClockAt(iso: string): Clock { const at = new Date(iso); return { today: () => toIsoDate(at), now: () => new Date(at.getTime()) } }` (`toIsoDate` usa la zona del proceso: la API corre con `TZ=America/Guayaquil` en producción y en la máquina de Nelson; en CI no se usa el reloj fijo). En `config.ts`, en el schema: `CLOCK_FIXED_AT: z.string().datetime({ offset: true }).optional()` y un `superRefine`: si `NODE_ENV !== 'test'` y viene `CLOCK_FIXED_AT`, issue «CLOCK_FIXED_AT solo se admite con NODE_ENV=test (fija el reloj de la API para las capturas del manual)». Test en `config.test.ts` (dos casos: se acepta en test; se rechaza en production con ese mensaje). En `main.ts`: `const clock = config.CLOCK_FIXED_AT ? fixedClockAt(config.CLOCK_FIXED_AT) : undefined` y `createApp({ auth, db, webOrigin: config.WEB_ORIGIN, storage, clock })`; al arrancar, si hay reloj fijo, un `console.log('Reloj fijo en ' + config.CLOCK_FIXED_AT + ' (capturas del manual)')`. `docs/conventions.md` §4, «Configuración»: una frase sobre `CLOCK_FIXED_AT`. Commit: `feat(api): CLOCK_FIXED_AT fija el reloj en modo test` + `Refs #127`.

- [ ] **Paso 1: Extraer la composición de servicios.** Crea `apps/api/src/services.ts` moviendo tal cual, desde `createApp`, la construcción de `casesRepo`, `attachmentsRepo`, `effectiveClock`, `casesUow`, `couriersQuery`, `accountsRepo`, `casesService`, `deliveriesUow`, `deliveriesService`, `importService`, `attachmentsService` y `accountsService` (con sus comentarios):

```ts
import type { Db } from './db/index.ts'
import type { Clock } from './lib/clock.ts'
import { systemClock } from './lib/clock.ts'
import type { IdGenerator } from './lib/ids.ts'
import { randomIds } from './lib/ids.ts'
import { sharpImages } from './lib/images.ts'
import type { Storage } from './lib/storage.ts'
// … los mismos imports de repos y servicios que hoy tiene app.ts

export type ServicesDeps = { db: Db; storage: Storage; clock?: Clock; ids?: IdGenerator }

/** Raíz de composición de los casos de uso: la usan `createApp` (rutas) y `scripts/seed-demo.ts`
 * (datos de demostración por los mismos servicios, sin inserts), sin duplicar el cableado. */
export function createServices({ db, storage, clock, ids }: ServicesDeps) {
  // … el bloque movido de app.ts, sin cambios …
  return {
    cases: casesService,
    deliveries: deliveriesService,
    import: importService,
    attachments: attachmentsService,
    accounts: accountsService,
  }
}
export type Services = ReturnType<typeof createServices>
```

En `app.ts`, sustituye el bloque por `const services = createServices({ db, storage, clock, ids })` y monta `casesRoutes(services.cases, importRoutes(services.import))`, `attachmentsRoutes(services.attachments)`, `deliveriesRoutes(services.deliveries)`, `accountsRoutes(services.accounts)`. Quita los imports que queden sin usar. `pnpm --filter @dentalware/api test` → todo verde (los tests de rutas cubren la composición). Commit: `refactor(api): createServices separa la composición de servicios de createApp` + `Refs #127`.

- [ ] **Paso 2: Datos de demostración.** `apps/api/src/scripts/seed-demo-data.ts` (solo constantes; nada real):

```ts
import type { LabSettingsInput, UserRole } from '@dentalware/shared'

/** Día y hora de demostración: la API (`CLOCK_FIXED_AT`), el seed (`today`) y el navegador
 * (`page.clock.setFixedTime`) usan el mismo instante, así las capturas no cambian de un día a
 * otro. Un martes, a media mañana. */
export const DEMO_TODAY = '2026-10-20'
export const DEMO_NOW = '2026-10-20T10:30:00-05:00'

/** Laboratorio ficticio: sustituye al de Arte Dental del seed normal en la BD de demostración.
 * El manual es público (LOPDP): ninguna captura puede mostrar datos reales. */
export const DEMO_LAB: LabSettingsInput = {
  name: 'Laboratorio Demo',
  ruc: null,
  address: 'Av. de los Ejemplos 123 y Calle Ficticia, Quito',
  phone: '099 000 0000',
  logoUrl: null,
  codePrefix: null,
  ivaPct: 15,
}

export const DEMO_USERS = [
  { key: 'recepcion', name: 'Carla Recepción', email: 'recepcion@demo.local', role: 'recepcion' },
  { key: 'tecnico', name: 'Diego Técnico', email: 'tecnico@demo.local', role: 'tecnico' },
  { key: 'mensajero', name: 'Marco Mensajero', email: 'mensajero@demo.local', role: 'mensajero' },
  { key: 'mensajera', name: 'Lucía Mensajera', email: 'mensajera@demo.local', role: 'mensajero' },
] as const satisfies readonly { key: string; name: string; email: string; role: UserRole }[]
export type DemoUserKey = (typeof DEMO_USERS)[number]['key']

export const DEMO_CLINICS = [
  {
    key: 'norte',
    name: 'Clínica Sonrisa Norte',
    address: 'Av. Imaginaria N45-12 y Los Cedros',
    city: 'Quito',
    phone: '02 200 0001',
    whatsapp: '+593990000001',
    doctors: ['Dra. Valeria Andrade', 'Dr. Tomás Herrera'],
    /** Precio por clínica de algún producto, por código del catálogo del seed. */
    prices: { ZR: '95.00' },
  },
  {
    key: 'alamos',
    name: 'Centro Dental Los Álamos',
    address: 'Calle Ficticia 8-20 y Av. Ejemplo',
    city: 'Quito',
    phone: '02 200 0002',
    whatsapp: null,
    doctors: ['Dr. Rafael Mena'],
    prices: {},
  },
  {
    key: 'paredes',
    name: 'Consultorio Dra. Paredes',
    address: 'Pasaje Inventado 3 y Calle 9',
    city: 'Cumbayá',
    phone: '02 200 0003',
    whatsapp: '+593990000003',
    doctors: ['Dra. Inés Paredes'],
    prices: { DL: '110.00', AC: '60.00' },
  },
] as const
export type DemoClinicKey = (typeof DEMO_CLINICS)[number]['key']

/** Un trabajo por escenario que el manual necesita enseñar. Las fechas son días relativos a hoy
 * (`recibidoHace`, `venceEn`, en días de calendario; negativo = pasado). `estado` es el estado
 * final al que `seedDemo` lo lleva con acciones reales (ver `ESCENARIOS` en seed-demo.ts). */
export const DEMO_CASES = [
  { key: 'por-recoger', clinic: 'norte', patient: 'M. P.', product: 'ZR', teeth: [11, 21], recibidoHace: 0, venceEn: 7, escenario: 'por_recoger', courier: 'mensajero' },
  { key: 'en-camino', clinic: 'paredes', patient: 'T. W.', product: 'DL', teeth: [23], recibidoHace: 0, venceEn: 7, escenario: 'en_camino', courier: 'mensajero' },
  { key: 'nuevo', clinic: 'alamos', patient: 'J. R.', product: 'DL', teeth: [14], recibidoHace: 0, venceEn: 6, escenario: 'nuevo' },
  { key: 'vence-hoy', clinic: 'norte', patient: 'A. S.', product: 'MP', teeth: [36, 37], recibidoHace: -6, venceEn: 0, escenario: 'en_proceso' },
  { key: 'atrasado', clinic: 'paredes', patient: 'L. T.', product: 'ZR', teeth: [46], recibidoHace: -10, venceEn: -2, escenario: 'en_proceso' },
  { key: 'vence-manana', clinic: 'alamos', patient: 'C. V.', product: 'AC', teeth: [], recibidoHace: -3, venceEn: 1, escenario: 'en_proceso_fase_3' },
  { key: 'en-espera', clinic: 'paredes', patient: 'R. M.', product: 'DL', teeth: [12], recibidoHace: -4, venceEn: 4, escenario: 'en_espera' },
  { key: 'en-prueba', clinic: 'norte', patient: 'E. G.', product: 'MP', teeth: [24, 25, 26], recibidoHace: -5, venceEn: 5, escenario: 'en_prueba' },
  { key: 'terminado', clinic: 'alamos', patient: 'P. Q.', product: 'ZR', teeth: [16], recibidoHace: -7, venceEn: 1, escenario: 'terminado' },
  { key: 'enviado-marco', clinic: 'norte', patient: 'D. F.', product: 'DL', teeth: [22], recibidoHace: -8, venceEn: 0, escenario: 'enviado', courier: 'mensajero' },
  { key: 'enviado-lucia', clinic: 'paredes', patient: 'N. B.', product: 'AC', teeth: [], recibidoHace: -8, venceEn: 0, escenario: 'enviado', courier: 'mensajera' },
  { key: 'entregado', clinic: 'norte', patient: 'S. L.', product: 'ZR', teeth: [11], recibidoHace: -15, venceEn: -9, escenario: 'entregado', courier: 'mensajero' },
  { key: 'entregado-2', clinic: 'norte', patient: 'K. O.', product: 'MP', teeth: [31, 41], recibidoHace: -20, venceEn: -14, escenario: 'entregado', courier: 'mensajera' },
  { key: 'cobrado', clinic: 'paredes', patient: 'B. A.', product: 'DL', teeth: [13], recibidoHace: -30, venceEn: -24, escenario: 'cobrado', courier: 'mensajero' },
  { key: 'fallida', clinic: 'alamos', patient: 'G. H.', product: 'ZR', teeth: [15], recibidoHace: -9, venceEn: -1, escenario: 'entrega_fallida', courier: 'mensajero' },
  { key: 'cancelado', clinic: 'alamos', patient: 'U. I.', product: 'AC', teeth: [], recibidoHace: -2, venceEn: 5, escenario: 'cancelado' },
] as const
```

Los escenarios (`escenario`) que `seedDemo` sabe ejecutar: `por_recoger`, `en_camino` (la recogida ya marcada «Recogido» por Marco: el trabajo sigue `por_recoger`, «En camino al laboratorio»), `nuevo`, `en_proceso`, `en_proceso_fase_3`, `en_espera`, `en_prueba`, `terminado`, `enviado`, `entregado`, `cobrado`, `entrega_fallida`, `cancelado`. Además, `seedDemo` crea una **repetición** al 50 % del trabajo `entregado-2` (queda `nuevo`), registra un **pago parcial** de la clínica «norte» (`$ 60.00` sobre `entregado`, que debe más) con `$ 20.00` sin aplicar (saldo a favor), y un **saldo inicial** de `$ 35.00` en «alamos» (ajuste sin trabajo).

- [ ] **Paso 3: Test RED del seed.** `apps/api/src/scripts/seed-demo.test.ts`:

```ts
import { count, eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { cases, clinics, labSettings, users } from '../db/schema/index.ts'
import { testPassword } from '../test/passwords.ts'
import { cleanupTestStorage, setupTestDb, truncateAll } from '../test/setup.ts'
import { ensureAdmin } from './seed.ts'
import { seedCatalogs } from './seed-data.ts'
import { assertDemoEnv, seedDemo } from './seed-demo.ts'
import { DEMO_LAB, DEMO_USERS } from './seed-demo-data.ts'

describe('assertDemoEnv', () => {
  it('se niega fuera de NODE_ENV=test: nunca pisa una BD real', () => {
    expect(() => assertDemoEnv('development', 'x')).toThrow(/solo se ejecuta con NODE_ENV=test/)
    expect(() => assertDemoEnv('production', 'x')).toThrow(/solo se ejecuta con NODE_ENV=test/)
  })
  it('exige DEMO_PASSWORD', () => {
    expect(() => assertDemoEnv('test', undefined)).toThrow(/DEMO_PASSWORD/)
    expect(() => assertDemoEnv('test', '')).toThrow(/DEMO_PASSWORD/)
  })
  it('con NODE_ENV=test y contraseña, pasa', () => {
    expect(() => assertDemoEnv('test', testPassword())).not.toThrow()
  })
})

describe('seedDemo', () => {
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  const password = testPassword()
  const admin = { email: 'admin-demo@lab.local', password: testPassword(), name: 'Admin' }

  beforeAll(async () => {
    ctx = await setupTestDb()
  })
  beforeEach(async () => {
    await truncateAll(ctx.db)
    await ensureAdmin(ctx.db, ctx.auth, admin)
    await seedCatalogs(ctx.db)
  })
  afterAll(async () => {
    await cleanupTestStorage(ctx)
    await ctx.pool.end()
  })

  const run = () =>
    seedDemo({ db: ctx.db, auth: ctx.auth, storage: ctx.storage, adminEmail: admin.email, demoPassword: password, today: '2026-10-20' })

  it('deja un laboratorio ficticio y nada de Arte Dental', async () => {
    await run()
    const [lab] = await ctx.db.select().from(labSettings)
    expect(lab?.name).toBe(DEMO_LAB.name)
    expect(lab?.address).toBe(DEMO_LAB.address)
    // Por ausencia: los valores que escribe el seed normal (seed-data.ts).
    expect(lab?.name).not.toContain('Arte Dental')
    expect(lab?.phone).not.toContain('0961440991')
    expect(lab?.address).not.toContain('Puerto Rico')
  })

  it('crea los usuarios de demostración con su rol y la contraseña dada', async () => {
    await run()
    for (const u of DEMO_USERS) {
      const [row] = await ctx.db.select({ role: users.role }).from(users).where(eq(users.email, u.email))
      expect(row?.role).toBe(u.role)
    }
    // La contraseña sirve para entrar (Better Auth).
    const signed = await ctx.auth.api.signInEmail({ body: { email: 'recepcion@demo.local', password } })
    expect(signed.user.email).toBe('recepcion@demo.local')
  })

  it('deja un trabajo en cada estado, la repetición, la entrega fallida y las cuentas', async () => {
    const result = await run()
    const byStatus = Object.fromEntries(
      (await ctx.db.select({ status: cases.status, n: count() }).from(cases).groupBy(cases.status)).map(
        (r) => [r.status, Number(r.n)],
      ),
    )
    expect(byStatus).toEqual({
      por_recoger: 2, // la recogida pendiente y la ya recogida («En camino al laboratorio»)
      nuevo: 2, // «nuevo» y la repetición
      en_proceso: 3,
      en_espera: 1,
      en_prueba: 1,
      terminado: 1,
      enviado: 3, // dos enviados y la entrega fallida reprogramada
      entregado: 2,
      cobrado: 1,
      cancelado: 1,
    })
    expect(result.cases['vence-hoy']).toMatch(/^[0-9a-f-]{36}$/)
    const [{ n }] = await ctx.db.select({ n: count() }).from(clinics)
    expect(Number(n)).toBe(3)
  })

  it('las fechas salen del día dado, no del reloj de la máquina', async () => {
    const result = await run()
    const [row] = await ctx.db.select({ dueDate: cases.dueDate }).from(cases).where(eq(cases.id, result.cases['vence-hoy']!))
    expect(row?.dueDate).toBe('2026-10-20')
  })

  it('se niega si ya hay datos de demostración (no duplica)', async () => {
    await run()
    await expect(run()).rejects.toThrow(/ya hay datos de demostración/)
  })
})
```

Corre `pnpm --filter @dentalware/api test -- seed-demo` → FAIL (módulo inexistente).

- [ ] **Paso 4: El seed (GREEN).** `apps/api/src/scripts/seed-demo.ts`. Esqueleto completo; las funciones por escenario siguen el patrón mostrado:

```ts
import { addBusinessDays, toIsoDate } from '@dentalware/shared'
import { eq } from 'drizzle-orm'
import sharp from 'sharp'
import type { Auth } from '../auth.ts'
import { createAuth } from '../auth.ts'
import { loadConfig } from '../config.ts'
import type { Db } from '../db/index.ts'
import { createDb } from '../db/index.ts'
import { runMigrations } from '../db/migrate.ts'
import { clinics, users } from '../db/schema/index.ts'
import { createClinic } from '../features/clinics/repo.ts'
import { createDoctor } from '../features/doctors/repo.ts'
import { upsertLabSettings } from '../features/lab-settings/repo.ts'
import { listProducts, upsertClinicPrice } from '../features/products/repo.ts'
import { fixedClockAt } from '../lib/clock.ts'
import { createStorage } from '../lib/create-storage.ts'
import { isMainModule } from '../lib/is-main-module.ts'
import type { RequestContext } from '../lib/request-context.ts'
import type { Storage } from '../lib/storage.ts'
import { createServices } from '../services.ts'
import { DEMO_CASES, DEMO_CLINICS, DEMO_LAB, DEMO_USERS, type DemoClinicKey, type DemoUserKey } from './seed-demo-data.ts'

export function assertDemoEnv(nodeEnv: string, demoPassword: string | undefined): void {
  if (nodeEnv !== 'test') {
    throw new Error(`seed:demo solo se ejecuta con NODE_ENV=test (recibido "${nodeEnv}"): escribiría en una BD real`)
  }
  if (!demoPassword) {
    throw new Error('seed:demo necesita DEMO_PASSWORD (la contraseña de los usuarios de demostración; genérala en cada corrida, nunca la guardes)')
  }
}

export type DemoSeedContext = {
  db: Db
  auth: Auth
  storage: Storage
  adminEmail: string
  demoPassword: string
  /** El «hoy» del seed (`YYYY-MM-DD`): el mismo día que fija `CLOCK_FIXED_AT` en la API. */
  today: string
}
export type DemoSeedResult = { users: Record<DemoUserKey, string>; clinics: Record<DemoClinicKey, string>; cases: Record<string, string> }

/** `n` días de calendario desde `today` (negativo = pasado), en fecha de negocio `YYYY-MM-DD`. */
function daysFrom(today: string, n: number): string {
  const d = new Date(`${today}T12:00:00`)
  d.setDate(d.getDate() + n)
  return toIsoDate(d)
}

/** Una foto ficticia: un rectángulo teal, generado al vuelo (ningún binario en el repo). */
async function demoPhoto(): Promise<Uint8Array> {
  return new Uint8Array(
    await sharp({ create: { width: 800, height: 600, channels: 3, background: '#0f766e' } }).jpeg().toBuffer(),
  )
}

export async function seedDemo({ db, auth, storage, adminEmail, demoPassword, today }: DemoSeedContext): Promise<DemoSeedResult> {
  const existing = await db.select({ id: clinics.id }).from(clinics).where(eq(clinics.name, DEMO_CLINICS[0].name))
  if (existing.length > 0) throw new Error('seed:demo: ya hay datos de demostración; corre reset-test-db y seed antes')
  const [admin] = await db.select({ id: users.id }).from(users).where(eq(users.email, adminEmail))
  if (!admin) throw new Error(`seed:demo: no existe el admin ${adminEmail}; corre el seed normal antes`)
  const ctx: RequestContext = { userId: admin.id, role: 'admin' }
  const daysFromToday = (n: number) => daysFrom(today, n)
  // El mismo reloj que la API con `CLOCK_FIXED_AT`: las validaciones «no anterior a hoy» miran este día.
  const services = createServices({ db, storage, clock: fixedClockAt(`${today}T10:30:00-05:00`) })

  await upsertLabSettings(db, DEMO_LAB)

  const userIds = {} as Record<DemoUserKey, string>
  for (const u of DEMO_USERS) {
    const created = await auth.api.signUpEmail({ body: { email: u.email, password: demoPassword, name: u.name } })
    await db.update(users).set({ role: u.role }).where(eq(users.id, created.user.id))
    userIds[u.key] = created.user.id
  }

  const products = await listProducts(db, false)
  const productId = (code: string) => {
    const p = products.find((x) => x.code === code)
    if (!p) throw new Error(`seed:demo: el catálogo no tiene el producto ${code}`)
    return p.id
  }
  const clinicIds = {} as Record<DemoClinicKey, string>
  const doctorIds = {} as Record<DemoClinicKey, string>
  for (const c of DEMO_CLINICS) {
    const clinic = await createClinic(db, { name: c.name, ruc: null, address: c.address, city: c.city, phone: c.phone, whatsapp: c.whatsapp, email: null, paymentTermsDays: 30, notes: null })
    clinicIds[c.key] = clinic.id
    for (const [i, name] of c.doctors.entries()) {
      const d = await createDoctor(db, { clinicId: clinic.id, name, phone: null, email: null, notes: null })
      if (i === 0) doctorIds[c.key] = d.id
    }
    for (const [code, price] of Object.entries(c.prices)) await upsertClinicPrice(db, clinic.id, productId(code), price)
  }

  const caseIds: Record<string, string> = {}
  for (const spec of DEMO_CASES) {
    const courierId = 'courier' in spec ? userIds[spec.courier] : undefined
    const conRecogida = spec.escenario === 'por_recoger' || spec.escenario === 'en_camino'
    const recogida = conRecogida && courierId ? { mensajeroId: courierId, fecha: daysFromToday(0) } : undefined
    const created = await services.cases.create(
      {
        clinicId: clinicIds[spec.clinic], doctorId: doctorIds[spec.clinic], patientRef: spec.patient,
        patientAge: null, patientSex: null, boxNumber: null, priority: 'normal',
        receivedAt: daysFromToday(spec.recibidoHace), dueDate: daysFromToday(spec.venceEn),
        shade: 'A2', shadeSystem: 'vita_classical', reference: null,
        checklist: { antagonista: true, mordida: true, color: true, fotos: false },
        observations: null, prescription: null, internalNotes: null,
        assignedTechnicianId: userIds.tecnico,
        items: [{ productId: productId(spec.product), description: null, quantity: Math.max(1, spec.teeth.length), teeth: [...spec.teeth], unitPrice: null, discountPct: 0, material: null, notes: null }],
        recogida,
      },
      ctx,
    )
    caseIds[spec.key] = created.case.id
    await runScenario(spec.escenario, created.case.id, courierId ?? userIds.mensajero)
  }

  // … repetición al 50 % de `entregado-2`, pago parcial en «norte», saldo inicial en «alamos»
  //    (ver el paso 5) …

  return { users: userIds, clinics: clinicIds, cases: caseIds }

  async function act(id: string, accion: Parameters<typeof services.cases.action>[1]['accion'], extra: Partial<Parameters<typeof services.cases.action>[1]> = {}) {
    await services.cases.action(id, { accion, ...extra } as Parameters<typeof services.cases.action>[1], ctx)
  }
  async function runScenario(escenario: (typeof DEMO_CASES)[number]['escenario'], id: string, courierId: string) {
    switch (escenario) {
      case 'por_recoger': return
      case 'en_camino': {
        // El mensajero la marca «Recogido» (`canMarkPickedUp`: solo en la suya): el trabajo sigue
        // `por_recoger` y la tarjeta dice «En camino al laboratorio» (#118).
        const detail = await services.cases.detail(id, ctx)
        const pending = detail.case.pendingDelivery
        if (!pending) throw new Error('seed:demo: la recogida no quedó pendiente')
        await services.deliveries.pickUp(pending.id, { userId: courierId, role: 'mensajero' })
        return
      }
      case 'nuevo': return
      case 'en_proceso': await act(id, 'aceptar'); return
      case 'en_proceso_fase_3':
        await act(id, 'aceptar')
        await services.cases.changeStage(id, { direccion: 'avanzar', motivo: null }, ctx)
        await services.cases.changeStage(id, { direccion: 'avanzar', motivo: null }, ctx)
        return
      case 'en_espera': await act(id, 'aceptar'); await act(id, 'pausar', { motivo: 'Falta el antagonista' }); return
      case 'en_prueba': await act(id, 'aceptar'); await act(id, 'enviar_prueba'); return
      case 'terminado': await act(id, 'aceptar'); await act(id, 'finalizar'); return
      case 'enviado':
        await act(id, 'aceptar'); await act(id, 'finalizar')
        await act(id, 'marcar_enviado', { envio: { mensajeroId: courierId, fecha: daysFromToday(0) } })
        return
      case 'entregado':
      case 'cobrado': {
        // Las fechas de envío no pueden ser anteriores a hoy: todo se envía «hoy».
        await act(id, 'aceptar'); await act(id, 'finalizar')
        await act(id, 'marcar_enviado', { envio: { mensajeroId: courierId, fecha: daysFromToday(0) } })
        const bytes = await demoPhoto()
        const proof = await services.attachments.upload({ caseId: id, filename: 'constancia.jpg', mime: 'image/jpeg', size: bytes.byteLength, bytes, kind: 'constancia' }, ctx)
        await act(id, 'marcar_entregado', { constanciaId: proof.id })
        return
      }
      case 'entrega_fallida': {
        await act(id, 'aceptar'); await act(id, 'finalizar')
        await act(id, 'marcar_enviado', { envio: { mensajeroId: courierId, fecha: daysFromToday(0) } })
        const detail = await services.cases.detail(id, ctx)
        const pending = detail.case.pendingDelivery
        if (!pending) throw new Error('seed:demo: el envío no dejó entrega pendiente')
        await services.deliveries.fail(pending.id, { motivo: 'La clínica estaba cerrada', nuevaFecha: daysFromToday(0) }, ctx)
        return
      }
      case 'cancelado': await act(id, 'cancelar', { motivo: 'El doctor retiró el pedido' }); return
    }
  }
}

async function main() {
  const config = loadConfig()
  assertDemoEnv(config.NODE_ENV, process.env.DEMO_PASSWORD)
  const { db, pool } = createDb(config.DATABASE_URL)
  try {
    await runMigrations(db)
    const auth = createAuth(db, config)
    // El día del reloj fijo de la API si lo hay (capturas); si no, el de la máquina.
    const today = config.CLOCK_FIXED_AT ? fixedClockAt(config.CLOCK_FIXED_AT).today() : toIsoDate(new Date())
    const result = await seedDemo({ db, auth, storage: createStorage(config), adminEmail: config.ADMIN_EMAIL, demoPassword: process.env.DEMO_PASSWORD!, today })
    console.log(`Datos de demostración listos (hoy = ${today}): ${Object.keys(result.cases).length} trabajos, ${Object.keys(result.clinics).length} clínicas, ${Object.keys(result.users).length} usuarios`)
  } finally {
    await pool.end()
  }
}

if (isMainModule(import.meta.url)) {
  await main()
}
```

Ajusta los nombres exactos que el compilador pida (`created.case.id` según lo que devuelve `mustGet`/`toDetail`; `proof.id` de `AttachmentView`; el tipo de `services.cases.action`): la fuente de verdad son los tipos de los servicios, no este plan. Si `patientRef` con iniciales choca con alguna regla, usa nombres inventados («Ana Demo»). Añade al `tsconfig.json` de la API lo que haga falta para que `sharp` se importe en un script (ya lo usa `lib/images.ts`).

- [ ] **Paso 5: Repetición y cuentas** (dentro de `seedDemo`, antes del `return`):

```ts
  // Una repetición al 50 % (enseña `remake` y el cargo parcial en la cuenta).
  const remake = await services.cases.createRemake(caseIds['entregado-2']!, { motivo: 'Ajuste de color pedido por el doctor', responsabilidad: 'compartida', cobroPct: 50 }, ctx)
  caseIds['repeticion'] = remake.case.id
  // Un pago parcial con saldo a favor: «norte» debe `entregado` y `entregado-2`; paga 80 y aplica 60.
  await services.accounts.registerPayment(
    { clinicaId: clinicIds.norte, monto: '80.00', metodo: 'transferencia', fecha: daysFromToday(0), referencia: 'TRX-0001', notas: null, asignaciones: [{ trabajoId: caseIds['entregado']!, monto: '60.00' }] },
    ctx,
  )
  // Un saldo inicial sin trabajo (ajuste), en «alamos».
  await services.accounts.registerAdjustment(
    { clinicaId: clinicIds.alamos, trabajoId: null, monto: '35.00', motivo: 'Saldo inicial', fecha: daysFromToday(-40) },
    ctx,
  )
```

Si `createRemake` devuelve otra forma, adapta `remake.case.id`. El `cobrado` se consigue pagando el trabajo entero: añade, antes del saldo inicial, un pago de «paredes» con `asignaciones: [{ trabajoId: caseIds['cobrado']!, monto: <su pendiente> }]`; el pendiente lo lees de `services.accounts.clinicAccount(clinicIds.paredes)` (`openCases` del trabajo). Corre el test → PASS. Si `byStatus` no cuadra, corrige el **seed** (los escenarios), no el test, salvo que el conteo esperado estuviera mal contado aquí: anótalo en el ledger.

- [ ] **Paso 6: Script y prueba manual.** `apps/api/package.json`: `"seed:demo": "tsx src/scripts/seed-demo.ts"`. Con Postgres arriba (`pnpm db:up`):

```bash
cd apps/api
export NODE_ENV=test CLOCK_FIXED_AT=2026-10-20T10:30:00-05:00
pnpm reset-test-db && pnpm seed && DEMO_PASSWORD="$(node -e 'console.log("Aa1"+require("crypto").randomBytes(9).toString("base64url"))')" pnpm seed:demo
```

Debe terminar con «Datos de demostración listos (hoy = 2026-10-20): 17 trabajos, 3 clínicas, 4 usuarios». Sin `NODE_ENV=test` debe negarse con el mensaje de `assertDemoEnv` y sin tocar la BD de desarrollo. Con `NODE_ENV=production CLOCK_FIXED_AT=…`, `loadConfig` debe negarse con su mensaje. Mide cuánto tarda el seed (`time`): anótalo en el ledger; si pasa de 30 s, mira qué escenario lo frena (las subidas con sharp) antes de seguir.

- [ ] **Paso 7: Docs, verificación y commit.** `docs/architecture.md` §3, tras el párrafo de `app.ts`: «`services.ts` (`createServices`) arma los casos de uso; `createApp` los monta y `scripts/seed-demo.ts` los usa para los datos de demostración del manual (Iteración 8), por los mismos servicios y sin inserts.» Verificación completa en verde. Commit: `feat(api): seed:demo con datos ficticios para el manual` + `Refs #127`.

---

### Tarea 3: Tubería de capturas (`pnpm capturas`)

**Archivos:**
- Crear: `apps/docs/capturas/playwright.config.ts`, `apps/docs/capturas/helpers.ts`, `apps/docs/capturas/fixtures.ts`, `apps/docs/capturas/global-setup.ts`, `apps/docs/capturas/primeros-pasos.spec.ts` (de momento una captura: la pantalla de entrar), `apps/docs/scripts/capturas.sh`, `apps/docs/scripts/capturas-servidores.sh`, `apps/docs/capturas-referenciadas.test.ts`, `apps/docs/capturas/.gitignore` (`.auth/`).
- Modificar: `apps/docs/package.json` (`capturas:servidores`), `apps/docs/README.md` (sección «Regenerar las capturas»), `docs/conventions.md` §7 (nuevo bloque «Capturas del manual»), `apps/docs/docs/primeros-pasos/entrar-y-salir.md` (usa la primera captura, para que el test cruzado tenga algo que cruzar).

**Interfaces:**
- Consume: `DEMO_USERS` (correos), `DEMO_NOW` (reloj fijo) y `ADMIN` de `.env.test`; `DEMO_PASSWORD` del entorno o de `capturas/.auth/demo-password`.
- Produce: `captura(page, nombre, locator, { testInfo, solo? })`, `sesionDe(rol)`, el `test` de `fixtures.ts` (reloj fijo en el navegador y `rol` como opción), `abrirTrabajo(page, paciente)`, `abrirDialogo(page, nombreBoton)`, `cerrarDialogo(page)`, `pickSelectOption`, los `storageState` en `capturas/.auth/<rol>.json`, los guiones `pnpm capturas` (completo) y `pnpm --filter @dentalware/docs capturas:servidores` + `CAPTURAS_RAPIDO=1` (rápido), y la convención de nombres `static/img/capturas/<seccion>/<nombre>.<proyecto>.png` que las Tareas 4–6 usan.

**Los dos modos** (sección «Método de trabajo»):

| | Completo: `pnpm capturas [-- spec -g patrón]` | Rápido: `CAPTURAS_RAPIDO=1 pnpm capturas -- spec -g patrón` |
|---|---|---|
| Contraseña | nueva, en `.auth/demo-password` (0600, gitignored) | la de `.auth/demo-password` |
| BD | `reset-test-db` → `seed` → `seed:demo` | la que hay |
| API (3000) | la arranca Playwright con `CLOCK_FIXED_AT` (el puerto tiene que estar libre) | reutiliza la de `capturas:servidores` |
| Web (5173) | reutiliza o arranca | reutiliza o arranca |
| Sesiones | se rehacen | se reutilizan si existen las cuatro |
| Cuándo | antes de un commit y en el cierre de cada tarea | mientras se diseña una captura |

`.auth/demo-password` es del mismo tipo que los `storageState` que ya guarda esa carpeta (cookies de sesión): local, ignorado por git, nunca en el repo ni en un informe. Si el modo rápido no encuentra API en 3000 o el archivo, dice qué correr y termina.

- [ ] **Paso 1: Test RED del cruce specs ↔ MDX.** `apps/docs/capturas-referenciadas.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = import.meta.dirname

function walk(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p, ext) : ext.test(f) ? [p] : []
  })
}

/** Nombres que declaran los specs: cada `captura(page, '<seccion>/<nombre>'` o `nombre: '...'`. */
function nombresEnSpecs(): Set<string> {
  const out = new Set<string>()
  for (const f of walk(join(root, 'capturas'), /\.spec\.ts$/)) {
    for (const m of readFileSync(f, 'utf8').matchAll(/captura\(\s*page,\s*'([^']+)'/g)) out.add(m[1]!)
  }
  return out
}

/** Nombres que usan los MDX: `<Captura nombre="<seccion>/<nombre>"`. */
function nombresEnDocs(): Set<string> {
  const out = new Set<string>()
  for (const f of walk(join(root, 'docs'), /\.mdx?$/)) {
    for (const m of readFileSync(f, 'utf8').matchAll(/<Captura\s[^>]*nombre="([^"]+)"/g)) out.add(m[1]!)
  }
  return out
}

describe('capturas referenciadas', () => {
  it('toda captura que usa una guía la produce un spec', () => {
    const specs = nombresEnSpecs()
    const faltan = [...nombresEnDocs()].filter((n) => !specs.has(n))
    expect(faltan).toEqual([])
  })
  it('toda captura que produce un spec la usa alguna guía (ninguna huérfana)', () => {
    const docs = nombresEnDocs()
    const huerfanas = [...nombresEnSpecs()].filter((n) => !docs.has(n))
    expect(huerfanas).toEqual([])
  })
  it('hay al menos una captura declarada', () => {
    expect(nombresEnSpecs().size).toBeGreaterThan(0)
  })
})

describe('reloj fijo de las capturas', () => {
  // El instante vive en tres sitios (seed, Playwright y el guion del modo rápido): si uno cambia
  // y los otros no, las fechas del seed y las del navegador dejan de coincidir.
  it('seed-demo-data.ts, playwright.config.ts y capturas-servidores.sh llevan el mismo instante', () => {
    const instante = /2026-10-20T10:30:00-05:00/
    for (const f of [
      join(root, '..', 'api', 'src', 'scripts', 'seed-demo-data.ts'),
      join(root, 'capturas', 'playwright.config.ts'),
      join(root, 'scripts', 'capturas-servidores.sh'),
    ]) {
      expect(readFileSync(f, 'utf8'), f).toMatch(instante)
    }
  })
})
```

`pnpm --filter @dentalware/docs test` → FAIL (no hay `capturas/` ni capturas en los MDX).

- [ ] **Paso 2: Playwright.** Confirma con context7 (`@playwright/test` 1.62): `globalSetup`, `storageState`, `webServer` múltiple, `locator.screenshot({ animations: 'disabled' })`, `devices['Pixel 7']`, `page.clock.setFixedTime` y `test.extend` con opciones (`[valor, { option: true }]`). `apps/docs/capturas/playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

/** Capturas del manual (Iteración 8). No son tests: cada «test» recorre una pantalla con los
 * datos de demostración y guarda capturas con nombre fijo. Corre con `pnpm capturas` (modo
 * completo: contraseña nueva, reseed, API propia con reloj fijo) o con `CAPTURAS_RAPIDO=1`
 * (reutiliza la API de `capturas:servidores`, la BD y las sesiones). */
if (!process.env.DEMO_PASSWORD) throw new Error('Corre las capturas con `pnpm capturas` (lee o genera DEMO_PASSWORD).')
const rapido = process.env.CAPTURAS_RAPIDO === '1'
/** El mismo instante que `DEMO_NOW` de apps/api/src/scripts/seed-demo-data.ts. */
export const CLOCK_FIXED_AT = '2026-10-20T10:30:00-05:00'

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  globalSetup: './global-setup.ts',
  outputDir: '../test-results',
  use: { baseURL: 'http://localhost:5173', locale: 'es-EC', timezoneId: 'America/Guayaquil' },
  webServer: [
    {
      command:
        'pnpm --filter @dentalware/shared build && pnpm --filter @dentalware/api reset-test-db && pnpm --filter @dentalware/api seed && pnpm --filter @dentalware/api seed:demo && pnpm --filter @dentalware/api dev',
      url: 'http://localhost:3000/api/health',
      // Completo: siempre con datos frescos. Rápido: la API de `capturas:servidores`.
      reuseExistingServer: rapido,
      timeout: 180_000,
      cwd: '../../..',
      env: { NODE_ENV: 'test', CLOCK_FIXED_AT },
    },
    {
      command: 'pnpm --filter @dentalware/shared build && pnpm --filter @dentalware/web dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 120_000,
      cwd: '../../..',
    },
  ],
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'telefono', use: { ...devices['Pixel 7'] } },
  ],
})
```

`apps/docs/capturas/helpers.ts`:

```ts
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { expect, type Browser, type Locator, type Page, type TestInfo } from '@playwright/test'
import sharp from 'sharp'

export type Rol = 'admin' | 'recepcion' | 'tecnico' | 'mensajero'

/** Credenciales de los usuarios de demostración (apps/api/src/scripts/seed-demo-data.ts) y del
 * admin de `.env.test`. La contraseña de demostración viene del entorno, nunca de un archivo. */
export const CUENTAS: Record<Rol, { email: string; password: string }> = {
  admin: { email: process.env.ADMIN_EMAIL ?? 'admin@lab.local', password: process.env.ADMIN_PASSWORD ?? 'Admin12345!' },
  recepcion: { email: 'recepcion@demo.local', password: process.env.DEMO_PASSWORD! },
  tecnico: { email: 'tecnico@demo.local', password: process.env.DEMO_PASSWORD! },
  mensajero: { email: 'mensajero@demo.local', password: process.env.DEMO_PASSWORD! },
}

export const AUTH_DIR = join(import.meta.dirname, '.auth')
export const CAPTURAS_DIR = join(import.meta.dirname, '..', 'static', 'img', 'capturas')

export const sesionDe = (rol: Rol) => join(AUTH_DIR, `${rol}.json`)

/** Inicia sesión y guarda el `storageState` del rol (lo llama `global-setup.ts` una vez por corrida). */
export async function guardarSesion(browser: Browser, rol: Rol, baseURL: string) {
  const page = await browser.newPage({ baseURL })
  await page.goto('/login')
  await page.getByLabel('Correo').fill(CUENTAS[rol].email)
  await page.getByLabel('Contraseña').fill(CUENTAS[rol].password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible()
  mkdirSync(AUTH_DIR, { recursive: true })
  await page.context().storageState({ path: sesionDe(rol) })
  await page.close()
}

/** Captura del elemento (o de la página si `pagina`) con nombre fijo
 * `static/img/capturas/<nombre>.<proyecto>.png`, comprimida con sharp. Falla si el elemento no
 * está: una guía nunca se queda con una captura vieja sin que lo note nadie. */
export async function captura(
  page: Page,
  nombre: string,
  objetivo: Locator | { pagina: true },
  opciones: { testInfo: TestInfo; solo?: 'escritorio' | 'telefono' },
) {
  const proyecto = opciones.testInfo.project.name
  if (opciones.solo && opciones.solo !== proyecto) return
  const destino = join(CAPTURAS_DIR, `${nombre}.${proyecto}.png`)
  mkdirSync(dirname(destino), { recursive: true })
  const png =
    'pagina' in objetivo
      ? await page.screenshot({ fullPage: false, animations: 'disabled' })
      : await (async () => {
          await expect(objetivo).toBeVisible()
          await objetivo.scrollIntoViewIfNeeded()
          return objetivo.screenshot({ animations: 'disabled' })
        })()
  await sharp(png).png({ compressionLevel: 9, palette: true }).toFile(destino)
}
```

Añade a `helpers.ts` los ayudantes de navegación que las Tareas 4–6 repiten (los locators salen de `apps/web/e2e/trabajos.spec.ts`, `entregas.spec.ts` y `cuentas.spec.ts`; `pickSelectOption` se copia entero de `apps/web/e2e/helpers.ts` con su comentario de #133):

```ts
/** Abre la ficha del trabajo de demostración por la referencia del paciente (`DEMO_CASES`). */
export async function abrirTrabajo(page: Page, paciente: string) {
  await page.goto('/trabajos?vista=todos')
  await page.getByRole('link', { name: new RegExp(paciente.replace(/\./g, '\\.')) }).first().click()
  await expect(page).toHaveURL(/\/trabajos\/(?!nuevo$)[^/]+$/)
}

/** Abre el diálogo del botón y espera a que termine de entrar (a mitad del `zoom-in-95` sale
 * recortado): devuelve el `dialog` listo para capturar. */
export async function abrirDialogo(page: Page, nombreBoton: string | RegExp): Promise<Locator> {
  await page.getByRole('button', { name: nombreBoton }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)))
  return dialog
}

/** Cierra con «Volver» (todo diálogo de acción cierra así): nunca se confirma nada desde un spec. */
export async function cerrarDialogo(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Volver' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}
```

`apps/docs/capturas/fixtures.ts` (el `test` que usan todos los specs: reloj fijo en el navegador y el rol como opción):

```ts
import { test as base } from '@playwright/test'
import { CLOCK_FIXED_AT } from './playwright.config'
import { sesionDe, type Rol } from './helpers'

export const test = base.extend<{ rol: Rol }>({
  rol: ['recepcion', { option: true }],
  storageState: async ({ rol }, use) => use(sesionDe(rol)),
  page: async ({ page }, use) => {
    // `Date` fijo en el navegador (los temporizadores siguen): «a las 10:30», «hoy», «martes 20».
    await page.clock.setFixedTime(new Date(CLOCK_FIXED_AT))
    await use(page)
  },
})
export { expect } from '@playwright/test'
```

`apps/docs/capturas/global-setup.ts`:

```ts
import { existsSync } from 'node:fs'
import { chromium, type FullConfig } from '@playwright/test'
import { guardarSesion, sesionDe } from './helpers'

const ROLES = ['admin', 'recepcion', 'tecnico', 'mensajero'] as const

export default async function globalSetup(config: FullConfig) {
  // Modo rápido con las cuatro sesiones ya guardadas: no se vuelve a entrar.
  if (process.env.CAPTURAS_RAPIDO === '1' && ROLES.every((r) => existsSync(sesionDe(r)))) return
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:5173'
  const browser = await chromium.launch()
  try {
    for (const rol of ROLES) await guardarSesion(browser, rol, baseURL)
  } finally {
    await browser.close()
  }
}
```

`apps/docs/capturas/.gitignore`: `.auth/`. Primer spec, `apps/docs/capturas/primeros-pasos.spec.ts`:

```ts
import { captura } from './helpers'
import { test } from './fixtures'

test.describe('Primeros pasos', () => {
  test.use({ storageState: { cookies: [], origins: [] } }) // sin sesión: la pantalla de entrar
  test('entrar', async ({ page }, testInfo) => {
    await page.goto('/login')
    await captura(page, 'primeros-pasos/entrar-formulario', page.getByRole('main'), { testInfo })
  })
})
```

Si el `<main>` del login no existe, usa `page.locator('form')`. En `entrar-y-salir.md` cambia «(Se escribe en la Tarea 4.)» por `<Captura nombre="primeros-pasos/entrar-formulario" alt="Pantalla para entrar: correo, contraseña y el botón Ingresar" telefono />`.

- [ ] **Paso 3: Los guiones.** `apps/docs/scripts/capturas.sh`:

```bash
#!/usr/bin/env bash
# Capturas del manual (Iteración 8). Modo completo: contraseña nueva, reseed y API propia con el
# reloj fijo (la arranca Playwright). Modo rápido (CAPTURAS_RAPIDO=1): reutiliza la API que dejó
# `capturas:servidores`, la BD y las sesiones; solo vuelve a tomar lo que se pida.
# La contraseña de demostración vive en capturas/.auth/demo-password (local, ignorado por git).
set -euo pipefail
cd "$(dirname "$0")/.."
auth_dir="capturas/.auth"
password_file="$auth_dir/demo-password"
port_in_use() { (echo >"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

if [ "${CAPTURAS_RAPIDO:-}" = "1" ]; then
  if ! port_in_use 3000 || [ ! -s "$password_file" ]; then
    echo "Modo rápido: primero deja la API lista con: pnpm --filter @dentalware/docs capturas:servidores" >&2
    exit 1
  fi
  DEMO_PASSWORD="$(cat "$password_file")"
else
  if port_in_use 3000; then
    echo "El puerto 3000 está ocupado: el modo completo arranca su propia API (con reloj fijo). Para la que corre o usa CAPTURAS_RAPIDO=1." >&2
    exit 1
  fi
  mkdir -p "$auth_dir"
  DEMO_PASSWORD="$(node -e 'console.log("Aa1"+require("node:crypto").randomBytes(9).toString("base64url"))')"
  (umask 077 && printf '%s' "$DEMO_PASSWORD" >"$password_file")
fi
export DEMO_PASSWORD
./node_modules/.bin/playwright test --config capturas/playwright.config.ts "$@"
echo "Capturas escritas o reescritas (git status):"
git -C ../.. status --short -- apps/docs/static/img/capturas | sed 's/^/  /'
```

`apps/docs/scripts/capturas-servidores.sh`:

```bash
#!/usr/bin/env bash
# Deja la API de demostración lista para el modo rápido de las capturas: contraseña nueva,
# reset-test-db → seed → seed:demo, y la API en modo test con el reloj fijo, en primer plano
# (córrelo en segundo plano y anota el PID para pararla después). La web dev se arranca aparte
# (`pnpm --filter @dentalware/web dev`) o la arranca Playwright.
set -euo pipefail
cd "$(dirname "$0")/.."
root="$(cd ../.. && pwd)"
auth_dir="capturas/.auth"
mkdir -p "$auth_dir"
if (echo >/dev/tcp/127.0.0.1/3000) 2>/dev/null; then
  echo "El puerto 3000 está ocupado: para esa API antes." >&2
  exit 1
fi
DEMO_PASSWORD="$(node -e 'console.log("Aa1"+require("node:crypto").randomBytes(9).toString("base64url"))')"
(umask 077 && printf '%s' "$DEMO_PASSWORD" >"$auth_dir/demo-password")
export DEMO_PASSWORD NODE_ENV=test CLOCK_FIXED_AT=2026-10-20T10:30:00-05:00
cd "$root"
pnpm --filter @dentalware/shared build
pnpm --filter @dentalware/api reset-test-db
pnpm --filter @dentalware/api seed
pnpm --filter @dentalware/api seed:demo
echo "API de demostración lista (reloj fijo en $CLOCK_FIXED_AT). Capturas: CAPTURAS_RAPIDO=1 pnpm capturas -- <spec> -g <patrón>"
exec pnpm --filter @dentalware/api dev
```

`chmod +x` a los dos; `apps/docs/package.json`: `"capturas:servidores": "bash scripts/capturas-servidores.sh"`. (Fuera de `infra/`, pero pásales `shellcheck -x` igual.) `CLOCK_FIXED_AT` aparece en tres sitios (`seed-demo-data.ts`, `playwright.config.ts`, este guion): un test de `capturas-referenciadas.test.ts` (paso 1, añade un `it`) lee los tres archivos y comprueba que llevan el mismo instante, para que no se desincronicen.

- [ ] **Paso 4: Correr y verificar los dos modos.** (a) Completo: `pnpm capturas` desde la raíz produce `apps/docs/static/img/capturas/primeros-pasos/entrar-formulario.{escritorio,telefono}.png`; ábrelas (`Read` de la imagen): el formulario de entrar sin datos. Córrelo **dos veces** seguidas: `git status` no debe mostrar las imágenes cambiadas la segunda vez (estabilidad bit a bit; si cambian, busca qué no está fijo: reloj, animaciones, fuentes). (b) Rápido: `pnpm --filter @dentalware/docs capturas:servidores` en segundo plano (`run_in_background`, anota el PID), espera a «API de demostración lista», y `CAPTURAS_RAPIDO=1 pnpm capturas -- primeros-pasos.spec.ts`: debe tardar segundos y no resembrar (en el log de la API no aparece el seed). Mide los dos tiempos y anótalos en el ledger. Para la API por PID al terminar. `pnpm --filter @dentalware/docs test` → PASS (cruce en las dos direcciones y el instante fijo igual en los tres archivos). `pnpm --filter @dentalware/docs build` → PASS (la imagen existe). Comprueba que no quedó nada escrito fuera de `static/img/capturas/` y `capturas/.auth/` (`git status --short`), y que los puertos 3000 y 5173 quedaron libres.

- [ ] **Paso 5: Convención y README.** `docs/conventions.md` §7, bloque nuevo tras «Barrido táctil»:

> - **Capturas del manual** (`apps/docs`, Iteración 8): se generan con `pnpm capturas` (Playwright en `apps/docs/capturas/`, proyectos `escritorio` 1280×800 y `telefono` Pixel 7) sobre los datos de demostración de `seed:demo` (`NODE_ENV=test`, laboratorio y clínicas ficticios). Son **estables bit a bit**: la API corre con `CLOCK_FIXED_AT`, el seed calcula sus fechas desde ese día y el navegador fija `Date` (`fixtures.ts`), todo en `2026-10-20T10:30:00-05:00`; un `git diff` de una imagen significa que cambió la UI. Los specs **no mutan datos** (todo estado lo deja el seed; los diálogos se capturan abiertos y se cierran con «Volver»), así el modo rápido (`capturas:servidores` + `CAPTURAS_RAPIDO=1 pnpm capturas -- <spec> -g <patrón>`) repite cualquier captura en segundos. La contraseña de demostración se genera en cada corrida completa y vive solo en `capturas/.auth/demo-password` (local, ignorado). Cada captura tiene nombre fijo, `static/img/capturas/<seccion>/<nombre>.<proyecto>.png`, es del elemento que se explica (`captura(page, nombre, locator)`; falla si no está) y la usa un `<Captura nombre="…">` en una guía: `capturas-referenciadas.test.ts` cruza las dos listas y no admite huérfanas ni referencias sin spec. Nada real en una captura: ni datos de Arte Dental, ni pacientes, ni credenciales, ni direcciones internas. Los locators se copian de los E2E; Chrome DevTools solo para lo que ningún E2E toca y para revisar el sitio. Durante una corrida no se edita `apps/web` (HMR, #133).

`apps/docs/README.md`: la sección «Regenerar las capturas» con los dos modos, los requisitos (Postgres arriba, puerto 3000 libre para el completo) y qué revisar en el `git diff`.

- [ ] **Paso 6: Verificación completa y commit.** Commit: `feat(docs): tubería de capturas con Playwright sobre los datos de demostración` + `Refs #127`. Después, **PR 1** (`feat/manual-usuario` → `main`): revisión final de la rama (código, docs, nada real en las capturas), `gh pr create` con `Refs #127` (no `Closes`: la historia sigue abierta) y el cuerpo con qué trae; `gh pr merge --squash --auto --delete-branch`; vigilar los cuatro checks; al mergear, `git fetch --prune`, borrar la rama local, mover nada en el tablero (sigue «En progreso»).

---

### Tarea 4: «Primeros pasos» (texto y capturas)

**Rama:** `feat/manual-contenido` desde `main` (tras el PR 1).

**Archivos:**
- Crear: `apps/docs/docs/primeros-pasos/instalar-la-app.md`, `que-ve-cada-rol.md`; capturas en `apps/docs/capturas/primeros-pasos.spec.ts`.
- Modificar: `entrar-y-salir.md` (texto completo), `apps/docs/docs/index.md`, `apps/docs/sidebars.ts`.

**Interfaces:** consume `captura`, `Captura`, `Boton`, `Rol` y las sesiones por rol (`test.use({ storageState: sesionDe('recepcion') })`).

- [ ] **Paso 1: Guías** (orden real de trabajo: primero el paso 2, las capturas; después este texto). Escribe las tres páginas copiando `apps/docs/plantillas/guia.md`. Contenido mínimo de cada una:
  - **Entrar y salir** (`sidebar_position: 1`): para qué sirve; quién (`<Rol roles={['admin','recepcion','tecnico','mensajero']} />`); pasos: abrir la dirección de la app, escribir correo y contraseña, `<Boton>Ingresar</Boton>` (captura `primeros-pasos/entrar-formulario`, ya existe), qué ves al entrar (captura `primeros-pasos/inicio-recepcion`, `page.getByRole('main')` con la sesión de recepción); salir con `<Boton>Cerrar sesión</Boton>` (captura `primeros-pasos/cerrar-sesion`, el botón, `telefono`). Problemas frecuentes: «Correo o contraseña incorrectos», «Demasiados intentos», «Usuario bloqueado» (los textos exactos de `LoginForm`: cópialos del código, `apps/web/src/features/auth/login-form.tsx`).
  - **Instalar la app** (`sidebar_position: 2`): sin capturas propias de la app (el diálogo de instalar es del sistema): pasos para Android (Chrome: menú ⋮ → «Instalar aplicación» o «Añadir a pantalla de inicio»), iPhone (Safari: Compartir → «Añadir a pantalla de inicio») y PC (Chrome: icono de instalar en la barra de direcciones). Un `:::tip Consejo` sobre que la app se actualiza sola al cerrarla y abrirla.
  - **Qué ve cada rol** (`sidebar_position: 3`): una tabla «Pantalla × rol» (Inicio, Trabajos, Entregas, Cuentas, Configuración) derivada de `NAV` de `app-shell.tsx` (`DELIVERY_ROLES`, `ACCOUNTS_ROLES`, `SETTINGS_ROLES`: copia los valores literales de `packages/shared/src/roles.ts`), y una captura del menú por rol: `primeros-pasos/menu-recepcion` (sidebar, `page.getByTestId('sidebar')`, `solo: 'escritorio'`), `primeros-pasos/menu-mensajero` (barra inferior, `page.getByTestId('bottom-nav')`, `solo: 'telefono'`). Una nota de que técnico y mensajero nunca ven precios.

- [ ] **Paso 2: Capturas (antes que el texto).** Amplía `primeros-pasos.spec.ts` con un `test.describe` por rol (el `test` de `fixtures.ts` pone el reloj fijo y la sesión del `rol`):

```ts
test.describe('con sesión de recepción', () => {
  test.use({ rol: 'recepcion' })
  test('inicio y menú', async ({ page }, testInfo) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible()
    await captura(page, 'primeros-pasos/inicio-recepcion', page.getByRole('main'), { testInfo })
    await captura(page, 'primeros-pasos/menu-recepcion', page.getByTestId('sidebar'), { testInfo, solo: 'escritorio' })
    await captura(page, 'primeros-pasos/cerrar-sesion', page.getByRole('button', { name: 'Cerrar sesión' }).first(), { testInfo })
  })
})
test.describe('con sesión de mensajero', () => {
  test.use({ rol: 'mensajero' })
  test('menú inferior', async ({ page }, testInfo) => {
    await page.goto('/')
    await captura(page, 'primeros-pasos/menu-mensajero', page.getByTestId('bottom-nav'), { testInfo, solo: 'telefono' })
  })
})
```

Con la API de `capturas:servidores` en segundo plano, `CAPTURAS_RAPIDO=1 pnpm capturas -- primeros-pasos.spec.ts`. Revisa cada PNG con `Read`: encuadre, nada real, nada cortado. Ajusta locator o estado y repite (segundos). Solo entonces escribe el texto del paso 1 con las imágenes delante.

- [ ] **Paso 3: Sidebar, build y revisión.** `sidebars.ts`: las tres páginas en «Primeros pasos». `pnpm --filter @dentalware/docs test && pnpm --filter @dentalware/docs build`. Sirve el sitio y revisa las tres páginas con Chrome DevTools a 1280, 390 y 360 (consola limpia, sin scroll horizontal, imágenes con `alt`); captura 390 de «Entrar y salir» a `docs/superpowers/reviews/capturas/it8/primeros-pasos-telefono.png`.

- [ ] **Paso 4: Verificación completa y commit.** `docs(manual): primeros pasos con capturas` + `Refs #127`.

---

### Tarea 5: «Recepción» (texto y capturas)

**Archivos:**
- Crear: `apps/docs/docs/recepcion/index.md`, `crear-un-trabajo.md`, `la-ficha-del-trabajo.md`, `estados-y-acciones.md`, `recogidas-y-entregas.md`, `cuentas-y-pagos.md`, `avisar-por-whatsapp.md`, `imprimir.md`; `apps/docs/capturas/recepcion.spec.ts`.
- Modificar: `sidebars.ts`, `docusaurus.config.ts` (nada si el navbar ya enlaza `/recepcion/`), `docs/index.md` (la tarjeta «Soy recepción» apunta a `/recepcion/`).

**Interfaces:** consume la sesión `recepcion`, los trabajos de demostración por paciente (`DEMO_CASES`: «A. S.» vence hoy, «L. T.» atrasado, «E. G.» en prueba, «P. Q.» terminado, «S. L.» entregado con saldo…), las clínicas «Clínica Sonrisa Norte» (con WhatsApp) y «Centro Dental Los Álamos» (sin WhatsApp).

- [ ] **Paso 1: Lista de capturas** (nombre → qué, locator orientativo; el implementador confirma los selectores con la app abierta en Chrome DevTools antes de escribirlos):

| Captura | Qué se ve | Locator |
|---|---|---|
| `recepcion/trabajos-lista` | Lista «Trabajos» con las vistas rápidas | `main` (`telefono`) |
| `recepcion/nuevo-trabajo-formulario` | Formulario de nuevo trabajo vacío | `form` |
| `recepcion/nuevo-trabajo-odontograma` | El odontograma con dos piezas marcadas | el `fieldset`/región del odontograma, tras tocar 11 y 21 |
| `recepcion/nuevo-trabajo-recogida` | Sección «Programar recogida» desplegada | su región |
| `recepcion/ficha-cabecera` | Cabecera de la ficha de «A. S.» (vence hoy) | la cabecera (`header` dentro de `main` o la región con el código) |
| `recepcion/ficha-acciones` | Barra de acciones del panel «Producción» | la región de acciones |
| `recepcion/ficha-historial` | Pestaña historial | su panel |
| `recepcion/ficha-adjuntos` | Pestaña adjuntos con la foto | su panel |
| `recepcion/estados-chips` | Los chips de estado en la lista (vista «Todos») | la tabla (`escritorio`) |
| `recepcion/accion-pausar` | Diálogo «Pausar» con motivo | `dialog` |
| `recepcion/accion-finalizar` | `ConfirmDialog` de «Finalizar» | `dialog` |
| `recepcion/entregas-dia` | Pantalla «Entregas» del día | `main` (`telefono`) |
| `recepcion/accion-marcar-enviado` | `ShipDialog` con mensajero y fecha | `dialog` |
| `recepcion/ficha-recibido` | Botón «Recibido» en un `por_recoger` | el botón |
| `recepcion/cuentas-lista` | «Cuentas» con las tres clínicas | `main` |
| `recepcion/cuenta-cabecera` | Cabecera de la cuenta de «Clínica Sonrisa Norte» (saldo, a favor, antigüedad) | la cabecera |
| `recepcion/registrar-pago` | Diálogo «Registrar pago» con el reparto sugerido | `dialog` (`telefono`) |
| `recepcion/aplicar-saldo` | Diálogo «Aplicar saldo a favor» | `dialog` |
| `recepcion/whatsapp-boton` | «Avisar por WhatsApp» en la ficha | el enlace |
| `recepcion/whatsapp-sin-numero` | «Sin WhatsApp registrado.» en un trabajo de «Los Álamos» | la región del aviso |
| `recepcion/imprimir-orden` | Botón «Imprimir» en la ficha y la orden impresa | la ficha (`/trabajos/:id/imprimir`, `main`) |
| `recepcion/estado-de-cuenta` | `/cuentas/:id/estado` con el periodo | `main` |

Las capturas de diálogos: `abrirDialogo` → `captura` → `cerrarDialogo` (nunca se confirma: los specs no mutan datos). Los selectores por rol o label, nunca por clase; los que ya usan `trabajos.spec.ts`, `entregas.spec.ts` y `cuentas.spec.ts` se copian de allí. Orden real: paso 3 (capturas, en modo rápido) antes que el paso 2 (texto).

- [ ] **Paso 2: Guías.** Escribe las ocho páginas copiando `apps/docs/plantillas/guia.md` (`index.md` es «Un día de recepción»: un recorrido de 8–10 líneas que enlaza las siete guías en el orden del flujo). Cada guía con la plantilla y, como mínimo, estas secciones y avisos:
  - **Crear un trabajo**: datos del paciente (solo referencia, sin nombre completo: `:::info` sobre datos mínimos), clínica y doctor (`Combobox`), líneas y piezas (odontograma por toque), fecha comprometida (días hábiles), «Programar recogida». Qué pasa después: nace `nuevo` (o `por_recoger`).
  - **La ficha del trabajo**: cabecera, panel por fase («Recogida», «Producción», «Entrega»), historial, adjuntos y fotos, «Editar».
  - **Estados y acciones**: tabla estado → qué significa → qué acción lo mueve (derivada de `CASE_TRANSITIONS`, con los rótulos de `CASE_STATUS_LABEL`/`CASE_ACTION_LABEL`: cópialos literalmente), `:::warning Importante` en «Finalizar» y «Cancelar trabajo» (no tienen vuelta).
  - **Recogidas y entregas**: programar recogida, «Recibido» al llegar, «Marcar enviado» con mensajero y fecha, «Entregas» del día, qué es «En camino al laboratorio» y «No se pudo» (lo marca el mensajero; enlaza a la guía del mensajero).
  - **Cuentas y pagos**: saldo, antigüedad, «Por cobrar», «Registrar pago» (reparto, «Queda cobrado»), «Aplicar saldo a favor», qué es el saldo a favor. `:::info` de que ajustes y anular pagos son de administración.
  - **Avisar por WhatsApp**: qué hace el botón (abre WhatsApp con el texto; no envía solo), sin número (`Sin WhatsApp registrado.` y que lo añade administración).
  - **Imprimir**: la orden (copias) y el estado de cuenta (periodo, «Imprimir»).

- [ ] **Paso 3: Capturas.** `recepcion.spec.ts` con el `test` de `fixtures.ts` (`rol` por omisión `recepcion`) y un test por guía; cada trabajo se abre con `abrirTrabajo(page, 'A. S.')`. Con la API de `capturas:servidores` en segundo plano: `CAPTURAS_RAPIDO=1 pnpm capturas -- recepcion.spec.ts -g "<guía>"` por guía; revisa cada PNG con `Read`, ajusta y repite. Al cerrar la tarea, una corrida completa (`pnpm capturas`) para confirmar que todo sale igual desde cero.

- [ ] **Paso 4: Sidebar, portada, build, revisión.** `sidebars.ts` con la categoría «Recepción» (`link: { type: 'doc', id: 'recepcion/index' }`). `docs/index.md`: «Soy recepción» → `/recepcion/`. Test y build en verde. Revisión en Chrome DevTools de las ocho páginas en los tres anchos; captura 1280 de «Cuentas y pagos» a `docs/superpowers/reviews/capturas/it8/recepcion-cuentas-escritorio.png`.

- [ ] **Paso 5: Verificación completa y commit.** `docs(manual): guías de recepción con capturas` + `Refs #127`.

---

### Tarea 6: «Mensajero» (texto y capturas)

**Archivos:**
- Crear: `apps/docs/docs/mensajero/index.md`, `entregas-del-dia.md`, `marcar-entregado.md`, `no-se-pudo.md`, `sin-senal.md`; `apps/docs/capturas/mensajero.spec.ts`.
- Modificar: `sidebars.ts`, `docs/index.md` («Soy mensajero» → `/mensajero/`).

**Interfaces:** consume la sesión `mensajero` (Marco: tiene la recogida pendiente de «M. P.» hoy, la de «T. W.» ya recogida y en camino, el envío de «D. F.» hoy y la entrega fallida reprogramada de «G. H.»).

- [ ] **Paso 1: Capturas** (todas con `telefono`, varias `solo: 'telefono'`: el mensajero usa el celular):

| Captura | Qué | Locator |
|---|---|---|
| `mensajero/entregas-del-dia` | «Entregas» de hoy con recogida, en camino, entrega y fallida reprogramada | `main` |
| `mensajero/tarjeta-recogida` | Tarjeta de la recogida de «M. P.» con «Recogido» y «Cómo llegar»/«Llamar» | la tarjeta (`article` o `li` con «M. P.») |
| `mensajero/recogido-boton` | El botón «Recogido» (sin tocarlo) | el botón |
| `mensajero/en-camino` | La tarjeta de «T. W.» («En camino al laboratorio», «Recogido por Marco Mensajero a las 10:30») | la tarjeta |
| `mensajero/ficha-corta` | La ficha corta del trabajo para el mensajero (sin precios) | `main` |
| `mensajero/marcar-entregado-dialogo` | `DeliverDialog` con la foto elegida (sube `apps/web/e2e/fixtures/foto.png` con `setInputFiles`) | `dialog` |
| `mensajero/no-se-pudo-dialogo` | Diálogo «No se pudo» con los chips de motivo | `dialog` |
| `mensajero/entrega-fallida` | Tarjeta fallida con «reprogramada para …» | la tarjeta de «G. H.» |
| `mensajero/sin-senal` | El `OfflineNotice` («Sin conexión: lo que marques se enviará al volver la señal») | la región `status` tras `context.setOffline(true)` |

Ningún test del spec cambia datos: «Recogido» no se toca (el estado «en camino» lo deja el seed en «T. W.»), y `marcar-entregado-dialogo` y `no-se-pudo-dialogo` se capturan abiertos y se cierran con `cerrarDialogo` (la constancia solo se sube al confirmar, UX4-06).

- [ ] **Paso 2: Guías.** `index.md` «Un día del mensajero» (recorrido corto). **Entregas del día**: qué sale, el mapa («Cómo llegar» abre el mapa en otra pestaña) y «Llamar», «Recogido» (un toque; qué pasa: «En camino al laboratorio»; recepción marca «Recibido»). **Marcar entregado**: la foto de constancia es obligatoria; `:::warning Importante`: no tiene vuelta; qué pasa después (el trabajo queda entregado; si no hay nada que cobrar, cobrado). **No se pudo**: motivos frecuentes (chips), nueva fecha, qué ve recepción. **Sin señal**: el aviso, que lo marcado se envía solo al volver la señal («Se enviará al volver la señal.»), y que no hay que repetir el toque.

- [ ] **Paso 3: Capturas, sidebar, portada, build, revisión** como en la Tarea 5. Captura 390 de «Entregas del día» a `docs/superpowers/reviews/capturas/it8/mensajero-entregas-telefono.png`.

- [ ] **Paso 4: Verificación completa, commit y PR 2.** `docs(manual): guías del mensajero con capturas` + `Refs #127`. Revisión final de la rama: ninguna captura con datos reales (`grep -rl "Arte Dental\|0961440991\|Puerto Rico" apps/docs/` vacío; mira las imágenes), `capturas-referenciadas` en verde, build en verde. PR 2 (`feat/manual-contenido` → `main`, `Refs #127`), auto-merge, vigilar checks, limpiar rama.

---

### Tarea 7: Enlace «Ayuda» en la app

**Rama:** `feat/manual-ayuda-despliegue` desde `main` (tras el PR 2).

**Archivos:**
- Crear: `apps/web/src/features/help/help-url.ts`, `help-url.test.ts`.
- Modificar: `apps/web/src/components/app-shell.tsx`, `app-shell.test.tsx`, `apps/web/src/vite-env.d.ts`, `infra/web.Dockerfile`, `infra/docker-compose.yml` (arg `VITE_DOCS_URL`), `infra/.env.example` (`DOCS_PUBLIC_URL`), `docs/conventions.md` §5.

**Interfaces:**
- Produce: `helpUrl(role: UserRole): string`; `HELP_PATH: Record<UserRole, string>`; `DOCS_URL`.

- [ ] **Paso 1: Test RED.** `apps/web/src/features/help/help-url.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { helpUrl } from './help-url'

describe('helpUrl', () => {
  afterEach(() => vi.unstubAllEnvs())

  it.each([
    { role: 'recepcion' as const, url: 'https://docs.dentalware.naphsoft.dev/recepcion/' },
    { role: 'mensajero' as const, url: 'https://docs.dentalware.naphsoft.dev/mensajero/' },
    // MAN-2 les da su guía; hasta entonces, la portada.
    { role: 'admin' as const, url: 'https://docs.dentalware.naphsoft.dev/' },
    { role: 'tecnico' as const, url: 'https://docs.dentalware.naphsoft.dev/' },
  ])('$role → $url', ({ role, url }) => {
    vi.stubEnv('VITE_DOCS_URL', '')
    expect(helpUrl(role)).toBe(url)
  })

  it('usa VITE_DOCS_URL sin barra doble', () => {
    vi.stubEnv('VITE_DOCS_URL', 'http://localhost:3100/')
    expect(helpUrl('recepcion')).toBe('http://localhost:3100/recepcion/')
  })
})
```

- [ ] **Paso 2: GREEN.** `help-url.ts`:

```ts
import type { UserRole } from '@dentalware/shared'

/** Manual de usuario (Iteración 8). `VITE_DOCS_URL` se fija en build (como `VITE_PUBLIC_URL`);
 * por omisión, el manual público. */
const DEFAULT_DOCS_URL = 'https://docs.dentalware.naphsoft.dev'

/** Guía de cada rol. `Record` exhaustivo: un rol nuevo no compila sin decidir su guía. MAN-2
 * cambia `admin` y `tecnico` a las suyas. */
export const HELP_PATH: Record<UserRole, string> = {
  admin: '/',
  recepcion: '/recepcion/',
  tecnico: '/',
  mensajero: '/mensajero/',
}

export function helpUrl(role: UserRole): string {
  const base = (import.meta.env.VITE_DOCS_URL || DEFAULT_DOCS_URL).replace(/\/+$/, '')
  return `${base}${HELP_PATH[role]}`
}
```

`vite-env.d.ts`: `readonly VITE_DOCS_URL?: string` con su comentario.

- [ ] **Paso 3: Test RED del AppShell** (añadir a `app-shell.test.tsx`):

```tsx
  it.each([
    { role: 'recepcion' as const, href: 'https://docs.dentalware.naphsoft.dev/recepcion/' },
    { role: 'mensajero' as const, href: 'https://docs.dentalware.naphsoft.dev/mensajero/' },
  ])('«Ayuda» abre la guía del rol $role en otra pestaña, en la barra lateral y en la cabecera móvil', async ({ role, href }) => {
    renderWithQueryAndRouter(<AppShell user={{ name: 'Ana', role }}>contenido</AppShell>)
    const links = await screen.findAllByRole('link', { name: 'Ayuda (abre el manual en otra pestaña)' })
    expect(links).toHaveLength(2)
    for (const link of links) {
      expect(link).toHaveAttribute('href', href)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener')
    }
  })
```

- [ ] **Paso 4: GREEN en `app-shell.tsx`.** Importa `CircleHelp` de `lucide-react` y `helpUrl`. En la barra lateral, dentro del `div` del pie (antes de «Cerrar sesión»), un enlace con el estilo de `NAV_LINK_BASE` + `NAV_LINK_INACTIVE` y `min-h-11`: `<a href={helpUrl(user.role)} target="_blank" rel="noopener" aria-label="Ayuda (abre el manual en otra pestaña)" className={…}><CircleHelp className="size-4" /> Ayuda</a>`. En la cabecera móvil, antes del botón de cerrar sesión, el mismo enlace como icono (`Button asChild variant="ghost" size="icon"` con el mismo `aria-label`). Objetivo de 44 px en los dos.

- [ ] **Paso 5: Build y compose.** `infra/web.Dockerfile`: `ARG VITE_DOCS_URL` y `ENV VITE_DOCS_URL=$VITE_DOCS_URL` junto a `VITE_PUBLIC_URL`. `infra/docker-compose.yml`, `caddy.build.args`: `VITE_DOCS_URL: ${DOCS_PUBLIC_URL}`. `infra/.env.example`: `DOCS_PUBLIC_URL=https://docs.lab.midominio.com` con comentario («URL pública del manual; se incrusta en la web, como PUBLIC_URL: cambiarla exige --build»). `docs/conventions.md` §5, bullet nuevo: «**Ayuda**: el menú de usuario enlaza al manual (`features/help/help-url.ts`, `HELP_PATH` exhaustivo por rol sobre `VITE_DOCS_URL`), en otra pestaña con `aria-label` «(abre el manual en otra pestaña)».»

- [ ] **Paso 6: Chrome DevTools.** Con la web dev (`pnpm dev` o solo `apps/web`, API en modo test con la BD sembrada: `NODE_ENV=test pnpm --filter @dentalware/api seed` y la sesión de admin de `.env.test`), a 1280, 390 y 360: el enlace se ve, mide ≥ 44 px, abre otra pestaña, consola limpia. Captura 390 a `docs/superpowers/reviews/capturas/it8/ayuda-telefono.png`. Parar servidores por PID.

- [ ] **Paso 7: Verificación completa y commit.** `feat(web): enlace «Ayuda» al manual por rol` + `Refs #127`.

---

### Tarea 8: Imagen `docs`, compose, prueba de infra y despliegue

**Archivos:**
- Crear: `infra/docs.Dockerfile`, `infra/Caddyfile.docs`, `infra/tests/docs-image.sh`.
- Modificar: `infra/docker-compose.yml` (servicio `docs`), `infra/.env.example` (`DOCS_SITE_ADDRESS`), `.github/workflows/ci.yml` (job `infra`), `docs/operacion/despliegue.md` (DNS, nginx, actualización), `docs/architecture.md` §7.

**Interfaces:** consume `pnpm --filter @dentalware/docs build` (Tarea 1). Produce el servicio `docs` en `127.0.0.1:8081` (VPS) y el test `docs-image.sh`.

- [ ] **Paso 1: Test RED.** `infra/tests/docs-image.sh` (mismo esqueleto que `caddy-headers.sh`: `set -euo pipefail`, `tmp`, `cleanup` con `trap`, `fail`, `header_of`, `status_of`, `expect_header`):

```bash
#!/usr/bin/env bash
# Prueba de la imagen del manual (Iteración 8): construye infra/docs.Dockerfile, la levanta en
# un puerto libre (como detrás del nginx del VPS) y comprueba que sirve el sitio, las cabeceras
# de caché y de seguridad, y que llega a «healthy».
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
project="dw-docs-test"
port="${DOCS_TEST_PORT:-18081}"
base="http://127.0.0.1:${port}"
tmp="$(mktemp -d)"
failures=0

cleanup() {
  docker compose -p "$project" -f "$root/infra/docker-compose.yml" -f "$tmp/override.yml" \
    --env-file "$tmp/.env" down -v --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT

{
  echo "PUBLIC_URL=http://127.0.0.1:${port}"
  echo "DOCS_PUBLIC_URL=http://127.0.0.1:${port}"
  echo "SITE_ADDRESS=:80"
  echo "DOCS_SITE_ADDRESS=:80"
  echo "POSTGRES_USER=dw"
  echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
  echo "POSTGRES_DB=dw"
  echo "BETTER_AUTH_SECRET=$(openssl rand -hex 24)"
  echo "ADMIN_EMAIL=prueba@example.com"
  echo "ADMIN_PASSWORD=$(openssl rand -hex 24)"
  echo "ADMIN_NAME=Prueba"
} >"$tmp/.env"

cat >"$tmp/override.yml" <<YML
services:
  docs:
    ports: !override
      - '127.0.0.1:${port}:80'
YML

compose() {
  docker compose -p "$project" -f "$root/infra/docker-compose.yml" -f "$tmp/override.yml" \
    --env-file "$tmp/.env" "$@"
}
fail() { echo "FALLA: $*" >&2; failures=$((failures + 1)); }
header_of() {
  curl -sI "${base}$1" | tr -d '\r' | awk -v h="$2" 'tolower($1) == tolower(h) ":" { sub(/^[^:]*: */, ""); print }'
}
status_of() { curl -s -o /dev/null -w '%{http_code}' "${base}$1"; }
expect_header() {
  local path="$1" name="$2" expected="$3" actual
  actual="$(header_of "$path" "$name")"
  [ "$actual" = "$expected" ] || fail "${path}: ${name} esperado «${expected}», llegó «${actual}»"
}

echo "Construyendo y levantando el manual (puede tardar unos minutos)..."
compose up -d --build --no-deps docs

for _ in $(seq 1 60); do
  [ "$(status_of /)" = "200" ] && break
  sleep 1
done

# Las páginas del manual: portada y una guía de cada sección de MAN-1.
for path in / /primeros-pasos/entrar-y-salir/ /recepcion/ /mensajero/; do
  [ "$(status_of "$path")" = "200" ] || fail "${path}: no responde 200"
  expect_header "$path" Cache-Control "no-cache"
done
# Una página que no existe es 404, no la portada.
[ "$(status_of /no-existe/)" = "404" ] || fail "/no-existe/: debe responder 404"
# Los assets con hash son inmutables.
asset="$(curl -s "${base}/" | grep -oE '/assets/[^"]+\.js' | head -n 1 || true)"
if [ -z "$asset" ]; then
  fail "la portada no enlaza ningún archivo de /assets/"
else
  [ "$(status_of "$asset")" = "200" ] || fail "${asset}: no responde 200"
  expect_header "$asset" Cache-Control "public, max-age=31536000, immutable"
fi
# Las capturas se sirven.
captura="$(curl -s "${base}/primeros-pasos/entrar-y-salir/" | grep -oE '/img/capturas/[^"]+\.png' | head -n 1 || true)"
[ -n "$captura" ] && [ "$(status_of "$captura")" = "200" ] || fail "la guía no sirve su captura (${captura:-ninguna enlazada})"
# Cabeceras de seguridad.
[ "$(header_of / Strict-Transport-Security | grep -c .)" = "1" ] || fail "/: falta Strict-Transport-Security"
expect_header / X-Content-Type-Options "nosniff"
# Healthy.
cid="$(compose ps -q docs)"
health="starting"
for _ in $(seq 1 60); do
  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}sin-healthcheck{{end}}' "$cid")"
  [ "$health" = "healthy" ] && break
  sleep 2
done
[ "$health" = "healthy" ] || fail "el contenedor docs no llegó a healthy (estado: ${health})"

if [ "$failures" -gt 0 ]; then
  echo "${failures} comprobación(es) fallaron." >&2
  exit 1
fi
echo "Manual: la imagen sirve el sitio con sus cabeceras y llega a healthy."
```

`shellcheck -x infra/tests/docs-image.sh` limpio (también con 0.10 y 0.9 en contenedor, memoria `shellcheck-version-ci`). Córrelo → FAIL (no hay servicio `docs`).

- [ ] **Paso 2: Imagen y Caddyfile.** `infra/docs.Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1
# Manual de usuario (Iteración 8): construye el sitio de Docusaurus y lo sirve Caddy.
FROM node:24-alpine AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true HUSKY=0
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/docs/package.json apps/docs/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @dentalware/docs...
COPY packages/shared packages/shared
COPY apps/docs apps/docs
RUN pnpm --filter @dentalware/shared build && pnpm --filter @dentalware/docs build

FROM caddy:2-alpine
COPY infra/Caddyfile.docs /etc/caddy/Caddyfile
COPY --from=build /app/apps/docs/build /srv
```

(`@dentalware/shared` solo por el `Rol`: si el build del sitio no lo necesita en runtime, igual lo compila el `--filter ...`.) `infra/Caddyfile.docs`:

```caddyfile
{$SITE_ADDRESS}

encode zstd gzip

header {
	Strict-Transport-Security "max-age=31536000; includeSubDomains"
	X-Content-Type-Options "nosniff"
	Referrer-Policy "strict-origin-when-cross-origin"
	Content-Security-Policy "frame-ancestors 'none'"
	-Server
}

# Docusaurus pone hash en sus assets: inmutables. Solo archivos que existen (404 si no).
handle /assets/* {
	header Cache-Control "public, max-age=31536000, immutable"
	root * /srv
	file_server
}

# Páginas, capturas y el índice del buscador: no-cache (se revalidan en cada visita).
handle {
	header Cache-Control "no-cache"
	root * /srv
	try_files {path} {path}/index.html
	file_server
}
```

Con `trailingSlash: true`, cada página es `<ruta>/index.html`; una ruta inexistente da el 404 de Caddy (sin `try_files` a la portada). Si quieres la página 404 de Docusaurus, añade `handle_errors { @404 expression {http.error.status_code} == 404 … }`: opcional, no lo exige el test.

- [ ] **Paso 3: Compose y env.** En `infra/docker-compose.yml`, tras `caddy`:

```yaml
  docs:
    build: { context: .., dockerfile: infra/docs.Dockerfile }
    restart: unless-stopped
    ports:
      - '127.0.0.1:8081:80'
    environment:
      SITE_ADDRESS: ${DOCS_SITE_ADDRESS}
    healthcheck:
      test: ['CMD-SHELL', 'wget -qO- http://127.0.0.1:2019/config/ >/dev/null']
      interval: 30s
      timeout: 5s
      retries: 3
```

Sin nginx delante (`DOCS_SITE_ADDRESS` = dominio), Caddy necesitaría 80/443, que ya usa `caddy`: documenta en `.env.example` que el manual detrás del nginx es el caso soportado (`DOCS_SITE_ADDRESS=:80`) y que sin nginx hay que dar al servicio `docs` un puerto propio con TLS a mano (fuera de alcance). `infra/.env.example`:

```dotenv
# Manual de usuario (apps/docs), servido por el servicio `docs` en 127.0.0.1:8081 detrás del
# nginx del VPS (docs/operacion/despliegue.md, paso 8 bis).
DOCS_SITE_ADDRESS=:80
DOCS_PUBLIC_URL=https://docs.lab.midominio.com
```

Corre `bash infra/tests/docs-image.sh` → PASS. También `bash infra/tests/caddy-headers.sh` y `api-image.sh` siguen en verde (el `.env` de prueba de los tres debe tener `DOCS_SITE_ADDRESS` y `DOCS_PUBLIC_URL`, o compose avisa de variables vacías: añádelas a los tres).

- [ ] **Paso 4: CI.** `.github/workflows/ci.yml`, job `infra`: `- run: bash infra/tests/docs-image.sh` tras `api-image.sh`; el comentario del job menciona la imagen del manual. `timeout-minutes` de `infra` a 20.

- [ ] **Paso 5: Despliegue.** `docs/operacion/despliegue.md`:
  - Paso 4 (DNS): el registro `A` de `docs.dentalware` con la misma IP.
  - Nuevo **Paso 8 bis — El manual en nginx**: sitio `/etc/nginx/sites-available/docs-dentalware` con `server_name docs.dentalware.naphsoft.dev` y `proxy_pass http://127.0.0.1:8081` (sin `client_max_body_size`), `ln -s`, `nginx -t`, `certbot --nginx -d docs.dentalware.naphsoft.dev`, `curl -sI https://docs.dentalware.naphsoft.dev | head -3`.
  - Paso 5 (`.env`): `DOCS_SITE_ADDRESS=:80` y `DOCS_PUBLIC_URL=https://docs.dentalware.naphsoft.dev`.
  - «Actualizar a una versión nueva»: una línea: «`dw up -d --build` reconstruye también el manual (servicio `docs`); si cambias `DOCS_PUBLIC_URL`, hace falta `--build` (va dentro de la web, en el enlace «Ayuda»).»
  - Tabla de diagnóstico: `docs` junto a `caddy`.
  Todo lo que toca el VPS queda escrito para hacerlo con Nelson (Tarea 9 de la Iteración 7); aquí no se ejecuta nada contra el VPS ni el DNS.
  `docs/architecture.md` §7: bullet `docs` en la lista de contenedores («sirve el manual (`apps/docs`) con su propio Caddy en `127.0.0.1:8081`, detrás del nginx; imagen `infra/docs.Dockerfile`») y en `infra`: «la imagen del manual (`infra/tests/docs-image.sh`)».

- [ ] **Paso 6: Verificación completa y commit.** `feat(infra): servicio docs con el manual detrás del nginx` + `Refs #127`.

---

### Tarea 9: Cierre: docs, MAN-2, revisión UI/UX del sitio, verificación y PR 3

**Archivos:**
- Modificar: `docs/superpowers/specs/2026-09-12-historias-de-usuario-mvp.md` (MAN-1 recortada, MAN-2), `docs/conventions.md` (§7 capturas, si falta algo; §5 «Ayuda»), `docs/architecture.md` §3 Web (`features/help`), `apps/docs/README.md`, `.remember`/ledger.
- GitHub: issue MAN-2 (`historia`, `docs`, hito 10, sub-issue de #126), issue «Revisión UI/UX de la Iteración 8 con frontend-design» (regla 6: `historia`, `area:web`, hito siguiente), PR 3 con `Closes #127`.

- [ ] **Paso 1: Historias.** En `2026-09-12-historias-de-usuario-mvp.md`, bajo MAN-1, un párrafo «Recorte (Nelson, 2026-10-15)» con el alcance de MAN-1 y la nueva **MAN-2** («Como técnico o administrador… guías de técnico, administración y referencia», versión mínima: las tres secciones con la misma plantilla y tubería; criterios: cada guía con captura, `HELP_PATH` de `admin` y `tecnico` a su guía, glosario y diagrama de estados desde `CASE_TRANSITIONS`). Crea el issue MAN-2 con `gh issue create` (título «`MAN-2` · manual: técnico, administración y referencia»), etiquetas `historia`, `docs`, hito 10, y añádelo como sub-issue de #126 (misma mutación GraphQL que usamos para #127; ver `github-tracking-dentalware`). Ponlo en el tablero en Backlog.

- [ ] **Paso 2: Issue de revisión UI/UX** (regla 6 de `CLAUDE.md`): «Revisión UI/UX de la Iteración 8 con frontend-design», con el checklist de la regla aplicado al sitio del manual (portada, las tres secciones, buscador, enlace «Ayuda» en la app) a 1280, 390 y 360, Lighthouse ≥ 95, y «los hallazgos se corrigen en una ola de fixes antes de MAN-2». Hito: el siguiente que exista (si no hay, créalo: «Iteración 9»); etiquetas `historia`, `area:web`, `docs`. Backlog.

- [ ] **Paso 3: Docs al día.** `docs/architecture.md` §3 Web: `features/help` en la lista de componentes transversales («enlace al manual por rol»). `docs/conventions.md`: relee §5 y §7 por si la Tarea 3 o la 7 dejaron algo sin anotar. `apps/docs/README.md`: sección «Qué falta (MAN-2)». `CLAUDE.md` ya cambió en la Tarea 1.

- [ ] **Paso 4: Lighthouse y revisión final del sitio.** `pnpm --filter @dentalware/docs build && pnpm --filter @dentalware/docs serve`; Lighthouse de accesibilidad en la portada, una guía de recepción y una del mensajero: las tres ≥ 95; anota los valores en el ledger. Revisión final de la rama (`feat/manual-ayuda-despliegue`): leer el diff entero contra `main`, comprobar `grep -rn "Arte Dental\|0961440991\|0996081498\|Puerto Rico N27" apps/docs/` vacío, nada de `DEMO_PASSWORD` con valor en ningún archivo, `git status` limpio, puertos libres.

- [ ] **Paso 5: Verificación completa, E2E y PR 3.** `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`; `pnpm e2e:pr` (toca `app-shell.tsx`: el barrido táctil de `accesibilidad.spec.ts` mide el enlace nuevo) con los puertos libres. Commit de cierre `docs: cierre de MAN-1 (historias, MAN-2, revisión de la It8)` + `Refs #127`. PR 3 con `Closes #127`, cuerpo con el resumen de las tres entregas y lo que queda para Tarea 9 de la It7 (DNS, nginx, probar el manual desde el teléfono), `gh pr merge --squash --auto --delete-branch`, vigilar los cuatro checks, al mergear: #127 a «Hecho», `git fetch --prune`, borrar rama local, actualizar `.remember/remember.md`, borrar el workspace SDD.

---

## Autorrevisión del plan (hecha al escribirlo)

- **Cobertura del spec:** §2 sitio → T1; §3 contenido → T4–T6; §4 seed → T2; §5 capturas → T3 (+T4–T6); §6 «Ayuda» → T7; §7 despliegue → T8; §8 pruebas → cada tarea; §9 docs → T1, T2, T3, T7, T8, T9; §10 orden → el de las tareas. Desviación anotada: fotos de demostración generadas al vuelo (Decisiones).
- **Placeholders:** ninguno; las guías se escriben en su tarea con la plantilla y la lista de capturas fijada aquí.
- **Consistencia de nombres:** `captura(page, nombre, locator, { testInfo, solo })` (T3) ↔ regex de `capturas-referenciadas.test.ts` (`captura(\s*page,\s*'…'`) ↔ `<Captura nombre="…">` (T1); el `test` de `fixtures.ts` con la opción `rol` (T3) ↔ `test.use({ rol })` en T4–T6; `abrirTrabajo`/`abrirDialogo`/`cerrarDialogo` (T3) ↔ T5–T6; `createServices` (T2) ↔ `app.ts`; `fixedClockAt`/`CLOCK_FIXED_AT` (T2) ↔ `playwright.config.ts` y `capturas-servidores.sh` (T3) ↔ `DEMO_NOW` (T2), con el test que los cruza; `seedDemo({ …, today })` (T2) ↔ su test; `helpUrl`/`HELP_PATH` (T7); `DOCS_SITE_ADDRESS`/`DOCS_PUBLIC_URL` (T7, T8); `DEMO_USERS` correos (T2) ↔ `CUENTAS` (T3).
- **Eficiencia (pedido de Nelson, 2026-10-22):** reloj fijo (capturas estables), specs sin mutaciones (repetibles), modo rápido (segundos por iteración), captura primero y texto después, locators de los E2E, plantilla por guía, un implementador por sección, revisión por lotes.
