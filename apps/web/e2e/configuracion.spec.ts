import { expect, test } from '@playwright/test'
import { login, loginAsAdmin } from './helpers'

test.describe('Configuración', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('crea una clínica y la ve en la lista', { tag: '@esencial' }, async ({ page }) => {
    const name = `Clínica E2E ${Date.now()}`
    await page.goto('/configuracion/clinicas')
    await page.getByRole('button', { name: 'Nueva clínica' }).first().click()
    // Se acota al diálogo: la cabecera de la tabla de clínicas ya trae un botón "Ordenar por
    // WhatsApp" (feature `sorting` del DataGrid) y `getByLabel` no descarta el fondo por
    // `aria-hidden` (a diferencia de `getByRole`), así que `page.getByLabel('WhatsApp')` sin
    // acotar resuelve ambos y falla en modo estricto.
    const dialog = page.getByRole('dialog', { name: 'Nueva clínica' })
    await dialog.getByLabel('Nombre').fill(name)
    await dialog.getByLabel('WhatsApp').fill('+593991234567')
    await dialog.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Clínica creada')).toBeVisible()
    await expect(page.getByRole('link', { name })).toBeVisible()
  })

  test('crea un producto y rechaza el código duplicado', { tag: '@clave' }, async ({ page }) => {
    const code = `E2E${Date.now().toString().slice(-5)}`
    await page.goto('/configuracion/productos')
    await page.getByRole('button', { name: 'Nuevo producto' }).first().click()
    // Acotado al diálogo: la cabecera de la tabla de productos (DataGrid) trae un botón "Ordenar
    // por Código" y un asa "Redimensionar Código" que también matchean `getByLabel('Código')` sin
    // acotar (mismo motivo que la clínica más arriba).
    let dialog = page.getByRole('dialog', { name: 'Nuevo producto' })
    await dialog.getByLabel('Código').fill(code)
    await dialog.getByLabel('Nombre').fill('Producto E2E')
    await dialog.getByLabel('Precio base (USD)').fill('12.50')
    await dialog.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Producto creado')).toBeVisible()
    await page.getByRole('button', { name: 'Nuevo producto' }).first().click()
    dialog = page.getByRole('dialog', { name: 'Nuevo producto' })
    await dialog.getByLabel('Código').fill(code)
    await dialog.getByLabel('Nombre').fill('Otro')
    await dialog.getByLabel('Precio base (USD)').fill('1')
    await dialog.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Ya existe un producto con ese código')).toBeVisible()
  })

  test(
    'agrupa productos por categoría y filtra con el filtro avanzado',
    { tag: '@clave' },
    async ({ page }, testInfo) => {
      // La fila de grupo («Prótesis fija (n)») solo existe en la tabla del DataGrid (`≥ lg`): en
      // móvil `grouping` pinta un `<h3>` dentro de una tarjeta, no un `role="row"` (`parts/cards.tsx`).
      test.skip(
        testInfo.project.name !== 'escritorio',
        'La fila de grupo con role="row" solo aplica a la tabla de escritorio',
      )
      await page.goto('/configuracion/productos')
      await page.getByLabel('Agrupar por').selectOption('category')
      await expect(page.getByRole('row', { name: /Prótesis fija \(\d+\)/ })).toBeVisible()
      await page.getByRole('button', { name: 'Filtro avanzado' }).click()
      await page.getByRole('button', { name: 'Añadir condición' }).click()
      await page.getByLabel('Columna 1').selectOption('name')
      await page.getByLabel('Operador 1').selectOption('contiene')
      await page.getByLabel('Valor 1').fill('zirconio')
      await page.getByRole('button', { name: 'Aplicar' }).click()
      await expect(page.getByText('Producto contiene zirconio')).toBeVisible()
      await expect(page.getByRole('row', { name: /Prótesis removible/ })).toHaveCount(0)
    },
  )

  test(
    'la tabla de productos no exige scroll horizontal a 1280 px y el CTA de cabecera sigue la pestaña activa',
    { tag: '@clave' },
    async ({ page }, testInfo) => {
      test.skip(
        testInfo.project.name !== 'escritorio',
        'Solo aplica al ancho de escritorio (1280 px)',
      )

      await page.goto('/configuracion/productos')

      // UX1-03: sin scroll horizontal interno a 1280 px, con "Estado" visible.
      const tabla = page.locator('[data-slot="table-container"]')
      expect(await tabla.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
      await expect(page.getByRole('columnheader', { name: 'Estado' })).toBeInViewport()

      // UX1-10: el CTA de cabecera cambia según la pestaña activa, sin duplicarse.
      await expect(page.getByRole('button', { name: 'Nuevo producto' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Nueva categoría' })).toHaveCount(0)

      await page.getByRole('tab', { name: 'Categorías' }).click()
      await expect(page.getByRole('button', { name: 'Nueva categoría' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Nuevo producto' })).toHaveCount(0)
    },
  )

  test('un técnico no ve Configuración', { tag: '@esencial' }, async ({ page, browser }) => {
    const email = `tecnico-e2e-${Date.now()}@t.local`
    const password = 'Tecnico1234'
    const created = await page.request.post('/api/users', {
      data: { name: 'Técnico E2E', email, password, role: 'tecnico' },
    })
    expect(created.ok()).toBe(true)

    const tecnicoContext = await browser.newContext()
    const tecnicoPage = await tecnicoContext.newPage()
    await login(tecnicoPage, { email, password })
    await expect(tecnicoPage).toHaveURL('/')
    await expect(tecnicoPage.getByRole('link', { name: 'Configuración' })).toHaveCount(0)

    await tecnicoPage.goto('/configuracion/laboratorio')
    await expect(tecnicoPage).toHaveURL('/')

    await tecnicoContext.close()
  })
})
