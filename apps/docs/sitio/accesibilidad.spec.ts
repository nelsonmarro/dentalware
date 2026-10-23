import { expect, type Page, test } from '@playwright/test'
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

// UX8-01: el buscador se anuncia en español, en el navbar y en la página de búsqueda. En escritorio
// el campo ya se ve sin tocarlo (lo que audita Lighthouse); el plugin lo convierte en combobox al
// tocarlo (en el teléfono, al abrir la lupa) y el nombre tiene que seguir ahí después.
test('el campo del buscador se llama «Buscar en el manual»', async ({ page, isMobile }) => {
  await page.goto('/')
  if (!isMobile) {
    await expect(page.getByRole('textbox', { name: 'Buscar en el manual' })).toBeVisible()
  }
  await page.locator('.navbar__search-input, .navbar__search button').first().click()
  await expect(page.getByRole('combobox', { name: 'Buscar en el manual' })).toBeVisible()
  await page.goto('/search/?q=recogida')
  // El del navbar también está aquí: el de la página tiene su propio nombre y va en main.
  await expect(
    page.getByRole('main').getByRole('searchbox', { name: 'Buscar en el manual: términos' }),
  ).toBeVisible()
  await expectObjetivosTactiles(page, 'input[class*="searchQueryInput"]')
})

// UX8-13: la página de búsqueda tiene un landmark main.
test('la página de búsqueda tiene main', async ({ page }) => {
  await page.goto('/search/?q=recogida')
  await expect(page.getByRole('main')).toHaveCount(1)
})

// UX8-04: cada captura reserva su sitio antes de cargar (`width`/`height` de `dimensiones.json`),
// así la página no salta mientras llegan las imágenes.
test('toda captura declara width y height', async ({ page }) => {
  await page.goto('/recepcion/crear-un-trabajo/')
  const imagenes = page.locator('img.captura__img')
  const atributos = await imagenes.evaluateAll((imgs) =>
    imgs.map((img) => ({
      src: img.getAttribute('srcset') ?? '',
      width: Number(img.getAttribute('width')),
      height: Number(img.getAttribute('height')),
    })),
  )
  expect(atributos.length, 'ninguna captura en la guía').toBeGreaterThan(0)
  expect(atributos.filter((a) => !(a.width > 0 && a.height > 0))).toEqual([])
})

// UX8-05: «Primeros pasos» tiene una sola página, la misma desde sus tres puertas.
test.describe('las tres puertas de Primeros pasos llevan a su página', () => {
  const llegaAlIndice = async (page: Page) => {
    await expect(page).toHaveURL(/\/primeros-pasos\/$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Primeros pasos' })).toBeVisible()
  }

  test('la tarjeta de la portada', async ({ page }) => {
    await page.goto('/')
    await page.locator('.portada__acceso', { hasText: 'Primeros pasos' }).click()
    await llegaAlIndice(page)
  })

  test('el navbar', async ({ page, isMobile }) => {
    test.skip(isMobile, 'en el teléfono el navbar es el menú lateral')
    await page.goto('/mensajero/')
    await page.locator('.navbar__items').getByRole('link', { name: 'Primeros pasos' }).click()
    await llegaAlIndice(page)
  })

  test('la categoría del menú lateral', async ({ page, isMobile }) => {
    test.skip(isMobile, 'el menú lateral del teléfono se abre con la hamburguesa')
    await page.goto('/mensajero/')
    await page
      .locator('.theme-doc-sidebar-menu')
      .getByRole('link', { name: 'Primeros pasos', exact: true })
      .click()
    await llegaAlIndice(page)
  })
})

// UX8-06: los rótulos de Docusaurus están en español natural.
test('los rótulos del menú del teléfono están en español', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'menú del teléfono')
  await page.goto('/recepcion/crear-un-trabajo/')
  await page.getByRole('button', { name: 'Abrir el menú' }).click()
  await expect(page.locator('.navbar-sidebar')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cerrar el menú' })).toBeVisible()
})

test('el enlace de ancla de un título dice a qué sección va', async ({ page }) => {
  await page.goto('/primeros-pasos/entrar-y-salir/')
  const ancla = page.locator('h2:has-text("Quién puede hacerlo") .hash-link')
  await expect(ancla).toHaveAttribute('title', 'Enlace a la sección «Quién puede hacerlo»')
})

// UX8-10: la 404 ofrece una salida que se ve y se toca igual en el teléfono y en la computadora.
test('la 404 ofrece volver a la portada', async ({ page }) => {
  await page.goto('/no-existe/')
  const volver = page.getByRole('main').getByRole('link', { name: 'Ir a la portada' })
  await expect(volver).toBeVisible()
  await expectObjetivosTactiles(page, 'a.portada__volver')
  await volver.click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Manual de Dentalware' })).toBeVisible()
})

// UX8-08: la flecha de las tarjetas es decoración: no entra en el nombre del enlace.
test('la flecha de las tarjetas no entra en el nombre del enlace', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('link', {
      name: 'Primeros pasos Entrar, instalar la app y qué ve cada rol.',
      exact: true,
    }),
  ).toBeVisible()
})
