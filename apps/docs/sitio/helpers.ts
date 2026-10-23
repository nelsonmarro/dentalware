import { expect, type Locator, type Page } from '@playwright/test'

/** Todas las páginas del manual (las de `sidebars.ts` más la portada). Si una guía nueva no está
 * aquí, el barrido no la ve: `capturas-referenciadas.test.ts` no la cruza, así que la lista es
 * explícita a propósito. */
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
export async function expectObjetivosTactiles(target: Page | Locator, selector: string, min = 44) {
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
