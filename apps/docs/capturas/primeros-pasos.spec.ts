import { captura } from './helpers'
import { test } from './fixtures'

test.describe('Primeros pasos', () => {
  test.use({ storageState: { cookies: [], origins: [] } }) // sin sesión: la pantalla de entrar
  test('entrar', async ({ page }, testInfo) => {
    await page.goto('/login')
    // La pantalla de entrar no tiene `<main>`: la tarjeta con el nombre y el formulario.
    const tarjeta = page
      .locator('[data-slot=card]')
      .filter({ has: page.getByRole('button', { name: 'Ingresar' }) })
    await captura(page, 'primeros-pasos/entrar-formulario', tarjeta, { testInfo })
  })
})
