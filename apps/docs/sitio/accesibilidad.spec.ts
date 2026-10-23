import { expect, test } from '@playwright/test'
import {
  CONTROLES,
  consola,
  expectObjetivosTactiles,
  PAGINAS,
  sinScrollHorizontal,
} from './helpers'

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

// UX8-09: el chip de un botón no deja aire antes de la puntuación que le sigue. El aire es el
// relleno del chip (su fondo es muy claro y se lee como un espacio), así que se mide desde el
// texto del chip, no desde su caja: a lo sumo 0.4em.
test('un chip de botón va pegado a la puntuación', async ({ page }) => {
  await page.goto('/recepcion/crear-un-trabajo/')
  const { caja, texto } = await page
    .locator('kbd.boton')
    .first()
    .evaluate((kbd) => {
      const siguiente = kbd.nextSibling
      if (!siguiente || siguiente.nodeType !== Node.TEXT_NODE) throw new Error('sin puntuación')
      const puntuacion = document.createRange()
      puntuacion.setStart(siguiente, 0)
      puntuacion.setEnd(siguiente, 1)
      const contenido = document.createRange()
      contenido.selectNodeContents(kbd)
      const em = parseFloat(getComputedStyle(kbd).fontSize)
      const inicio = puntuacion.getBoundingClientRect().left
      return {
        caja: inicio - kbd.getBoundingClientRect().right,
        texto: (inicio - contenido.getBoundingClientRect().right) / em,
      }
    })
  expect(caja, 'margen entre el chip y la puntuación (px)').toBeLessThan(2)
  expect(texto, 'aire entre el texto del chip y la puntuación (em)').toBeLessThanOrEqual(0.4)
})
