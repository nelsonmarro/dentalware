import { expect, test } from '@playwright/test'
import { login, loginAsAdmin } from './helpers'

test.describe('Configuración', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('crea una clínica y la ve en la lista', async ({ page }) => {
    const name = `Clínica E2E ${Date.now()}`
    await page.goto('/configuracion/clinicas')
    await page.getByRole('button', { name: 'Nueva clínica' }).first().click()
    await page.getByLabel('Nombre').fill(name)
    await page.getByLabel('WhatsApp').fill('+593991234567')
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Clínica creada')).toBeVisible()
    await expect(page.getByRole('link', { name })).toBeVisible()
  })

  test('crea un producto y rechaza el código duplicado', async ({ page }) => {
    const code = `E2E${Date.now().toString().slice(-5)}`
    await page.goto('/configuracion/productos')
    await page.getByRole('button', { name: 'Nuevo producto' }).first().click()
    await page.getByLabel('Código').fill(code)
    await page.getByLabel('Nombre').fill('Producto E2E')
    await page.getByLabel('Precio base (USD)').fill('12.50')
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Producto creado')).toBeVisible()
    await page.getByRole('button', { name: 'Nuevo producto' }).first().click()
    await page.getByLabel('Código').fill(code)
    await page.getByLabel('Nombre').fill('Otro')
    await page.getByLabel('Precio base (USD)').fill('1')
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Ya existe un producto con ese código')).toBeVisible()
  })

  test('la tabla de productos no exige scroll horizontal a 1280 px y el CTA de cabecera sigue la pestaña activa', async ({
    page,
  }, testInfo) => {
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
  })

  test('un técnico no ve Configuración', async ({ page, browser }) => {
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
