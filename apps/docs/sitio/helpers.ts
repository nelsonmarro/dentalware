import { expect, type Locator, type Page } from '@playwright/test'

export { PAGINAS } from './paginas'

/** Controles que se tocan: enlaces, botones y campos visibles. Los enlaces en línea del texto
 * (`.markdown p a`, `li a`, `td a`) y los enlaces de ancla de los títulos (`.hash-link`) quedan
 * fuera por decisión de la revisión (UX8, descartados). */
export const CONTROLES =
  'a[href]:not(.hash-link):not(.markdown :is(p, li, td) > a), button, input:not([type=hidden]), [role=button]'

/** Cada control visible mide al menos `min` × `min`; falla si no midió nada. Mide todos en una sola
 * ida y vuelta al navegador (`evaluateAll`): uno a uno, el barrido de todas las páginas tarda
 * minutos. Visible es lo mismo que para Playwright: caja no vacía y sin `visibility: hidden`. */
export async function expectObjetivosTactiles(target: Page | Locator, selector: string, min = 44) {
  const medidas = await target.locator(selector).evaluateAll((els) =>
    els.flatMap((el) => {
      const caja = el.getBoundingClientRect()
      if (caja.width === 0 || caja.height === 0) return []
      if (getComputedStyle(el).visibility !== 'visible') return []
      const nombre = el.getAttribute('aria-label') ?? (el as HTMLElement).innerText.trim()
      return [{ nombre, ancho: caja.width, alto: caja.height }]
    }),
  )
  const cortos = medidas
    .filter((m) => m.ancho < min - 0.5 || m.alto < min - 0.5)
    .map((m) => `«${m.nombre.slice(0, 40)}» ${Math.round(m.ancho)}×${Math.round(m.alto)}`)
  expect(medidas.length, `nada que medir con ${selector}`).toBeGreaterThan(0)
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
