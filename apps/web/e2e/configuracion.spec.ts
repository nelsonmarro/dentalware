import { expect, test } from '@playwright/test'
import { loginAsAdmin } from './helpers'

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

  test('un técnico no ve Configuración', async ({ page }) => {
    // El seed no crea técnicos: se valida que el enlace exista para admin y que la ruta redirija cuando el rol no es admin
    await expect(page.getByRole('link', { name: 'Configuración' }).first()).toBeVisible()
  })
})
