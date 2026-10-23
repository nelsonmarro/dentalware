import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { UserRole } from '@dentalware/shared'
import { expect, type Browser, type Locator, type Page, type TestInfo } from '@playwright/test'
import sharp from 'sharp'
import { esProyecto, rutaCaptura, type Proyecto } from '../src/capturas-rutas'
import { recorte } from './recorte'

// `__dirname` y no `import.meta.dirname`: apps/docs no lleva `"type": "module"` (rompe el SSR de
// Docusaurus), así que Playwright carga estos archivos como CommonJS.
export const AUTH_DIR = join(__dirname, '.auth')
export const STATIC_DIR = join(__dirname, '..', 'static')

/** Variables de `apps/api/.env.test`: el admin de las capturas es el mismo que el de la API en
 * modo test, leído de ahí y no copiado en este archivo. */
function envTest(): Record<string, string> {
  const texto = readFileSync(join(__dirname, '..', '..', 'api', '.env.test'), 'utf8')
  return Object.fromEntries(
    texto
      .split('\n')
      .map((linea) => /^([A-Z_]+)=(.*)$/.exec(linea.trim()))
      .filter((m) => m !== null)
      .map((m): [string, string] => [m[1] ?? '', m[2] ?? '']),
  )
}

/** Variable de entorno o, si falta, de `.env.test`; sin ninguna de las dos, se para con un aviso. */
function requerida(nombre: string, env: Record<string, string> = {}): string {
  const valor = process.env[nombre] ?? env[nombre]
  if (!valor) throw new Error(`Falta ${nombre}: corre las capturas con \`pnpm capturas\`.`)
  return valor
}

/** Credenciales de los usuarios de demostración (apps/api/src/scripts/seed-demo-data.ts) y del
 * admin de `.env.test`. La contraseña de demostración viene del entorno (`capturas.sh` la lee de
 * `.auth/demo-password`), nunca de un archivo del repo. */
function cuenta(rol: UserRole): { email: string; password: string } {
  if (rol === 'admin') {
    const env = envTest()
    return { email: requerida('ADMIN_EMAIL', env), password: requerida('ADMIN_PASSWORD', env) }
  }
  return { email: `${rol}@demo.local`, password: requerida('DEMO_PASSWORD') }
}

export const sesionDe = (rol: UserRole) => join(AUTH_DIR, `${rol}.json`)

/** Inicia sesión y guarda el `storageState` del rol (lo llama `global-setup.ts` una vez por corrida). */
export async function guardarSesion(browser: Browser, rol: UserRole, baseURL: string) {
  const { email, password } = cuenta(rol)
  const page = await browser.newPage({ baseURL })
  await page.goto('/login')
  await page.getByLabel('Correo').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible()
  mkdirSync(AUTH_DIR, { recursive: true })
  await page.context().storageState({ path: sesionDe(rol) })
  await page.close()
}

/** Los botones de TanStack Router/Query Devtools: solo existen en `vite dev` (la web de las
 * capturas), nunca en producción, y no pueden salir en el manual. */
const SIN_DEVTOOLS = `.TanStackRouterDevtools, .tsqd-parent-container, .tsqd-transitions-container {
  display: none !important;
}`

/** Captura del elemento (o de la página si `pagina`, tras ver `esperar`) con nombre fijo
 * `static/img/capturas/<nombre>.<proyecto>.png`, comprimida con sharp. Falla si el elemento no
 * está: una guía nunca se queda con una captura vieja sin que lo note nadie. La de página también
 * espera a un elemento propio de la pantalla, para no capturarla a medio cargar. Con `margen`
 * (en px de CSS), el recorte deja ese aire de fondo de la página alrededor del elemento, que
 * tiene que caber en la ventana (si no, `recorte` lanza). */
export async function captura(
  page: Page,
  nombre: string,
  objetivo: Locator | { pagina: true; esperar: Locator },
  opciones: { testInfo: TestInfo; solo?: Proyecto; margen?: number },
) {
  const proyecto = opciones.testInfo.project.name
  if (!esProyecto(proyecto)) throw new Error(`Proyecto de capturas desconocido: ${proyecto}`)
  if (opciones.solo && opciones.solo !== proyecto) return
  // La misma ruta que pinta `<Captura>` en el sitio.
  const destino = join(STATIC_DIR, rutaCaptura(nombre, proyecto))
  mkdirSync(dirname(destino), { recursive: true })
  const comun = { animations: 'disabled', style: SIN_DEVTOOLS } as const
  const png =
    'pagina' in objetivo
      ? await (async () => {
          await expect(objetivo.esperar).toBeVisible()
          return page.screenshot({ ...comun, fullPage: false })
        })()
      : await (async () => {
          await expect(objetivo).toBeVisible()
          await objetivo.scrollIntoViewIfNeeded()
          if (!opciones.margen) return objetivo.screenshot(comun)
          const caja = await objetivo.boundingBox()
          const ventana = page.viewportSize()
          if (!caja || !ventana) throw new Error(`No se pudo medir el elemento de ${nombre}.`)
          return page.screenshot({ ...comun, clip: recorte(caja, ventana, opciones.margen) })
        })()
  await sharp(png).png({ compressionLevel: 9, palette: true }).toFile(destino)
}

/** Abre la ficha del trabajo de demostración por la referencia del paciente (`DEMO_CASES`). El
 * enlace solo lleva el código: se busca la fila (escritorio) o la tarjeta (teléfono) del
 * paciente, y de un paciente con repetición («K. O.»), la primera, que es el original. */
export async function abrirTrabajo(page: Page, paciente: string) {
  await page.goto('/trabajos?vista=todos')
  await page
    .getByRole('main')
    .getByRole('row')
    .or(page.getByRole('main').getByRole('listitem'))
    .filter({ has: page.getByText(paciente, { exact: true }) })
    .first()
    .getByRole('link')
    .first()
    .click()
  await expect(page).toHaveURL(/\/trabajos\/(?!nuevo$)[^/]+$/)
  await expect(page.getByRole('heading', { level: 1, name: /^\d{2}-\d{5}$/ })).toBeVisible()
  // El puntero se queda donde estaba el enlace, sobre un botón de la ficha: sin moverlo, ese botón
  // sale en su color de `hover`.
  await page.mouse.move(0, 0)
}

/** Abre el diálogo del botón y espera a que termine de entrar (a mitad del `zoom-in-95` sale
 * recortado): devuelve el `dialog` listo para capturar. */
export async function abrirDialogo(page: Page, nombreBoton: string | RegExp): Promise<Locator> {
  await page.getByRole('button', { name: nombreBoton }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
  )
  return dialog
}

/** Cierra con «Volver» (todo diálogo de acción cierra así): nunca se confirma nada desde un spec. */
export async function cerrarDialogo(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Volver' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

/**
 * Copia de `apps/web/e2e/helpers.ts` (no se importa entre paquetes).
 * Elige una opción de un `Select` de Radix (el de mensajero) por teclado: abre el disparador,
 * enfoca la opción exacta y la confirma con Enter (el ítem de Radix selecciona con Enter o
 * espacio). Con un clic sobre la opción, en una lista larga (la BD del CI acumula decenas de
 * mensajeros) el puntero pasa por el botón de scroll del listbox, Radix lo autodesplaza y la
 * opción se mueve bajo el cursor: Playwright reintentaba hasta agotar el tiempo (#133). El
 * typeahead de Radix (escribir el nombre) tampoco sirve: con nombres casi iguales empareja por
 * prefijo con otro.
 */
export async function pickSelectOption(page: Page, trigger: Locator, name: string) {
  await trigger.click()
  const option = page.getByRole('option', { name, exact: true })
  await option.scrollIntoViewIfNeeded()
  await option.press('Enter')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(trigger).toHaveText(name)
}
