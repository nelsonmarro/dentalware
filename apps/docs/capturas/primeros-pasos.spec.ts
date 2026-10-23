import { captura } from './helpers'
import { expect, test } from './fixtures'

test.describe('Primeros pasos', () => {
  test.use({ storageState: { cookies: [], origins: [] } }) // sin sesión: la pantalla de entrar
  test('entrar', async ({ page }, testInfo) => {
    await page.goto('/login')
    // La pantalla de entrar no tiene `<main>`: la tarjeta con el nombre y el formulario.
    const tarjeta = page
      .locator('[data-slot=card]')
      .filter({ has: page.getByRole('button', { name: 'Ingresar' }) })
    // Solo la de escritorio: en el teléfono la tarjeta es la misma.
    await captura(page, 'primeros-pasos/entrar-formulario', tarjeta, {
      testInfo,
      solo: 'escritorio',
    })
  })
})

test.describe('con sesión de recepción', () => {
  test.use({ rol: 'recepcion' })
  test('inicio y menú', async ({ page }, testInfo) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible()
    // El contenido de `main` con aire alrededor, no `main`: ocupa todo el alto de la ventana
    // (vacío debajo) y, en el teléfono, la barra inferior fija lo tapa.
    const inicio = page.getByRole('main').locator(':scope > div')
    await captura(page, 'primeros-pasos/inicio-recepcion', inicio, { testInfo, margen: 16 })
    // En escritorio, el botón de la barra lateral; en el teléfono, la cabecera entera (el icono
    // solo, sin «Dentalware» al lado, no dice dónde está).
    const cerrarSesion =
      testInfo.project.name === 'telefono'
        ? page.getByRole('banner')
        : page.getByRole('button', { name: 'Cerrar sesión' }).locator('visible=true')
    await captura(page, 'primeros-pasos/cerrar-sesion', cerrarSesion, { testInfo })
    // La barra lateral ocupa el alto de la ventana: con una ventana baja no sale un hueco de
    // 600 px entre el menú y «Cerrar sesión». Va al final porque cambia la ventana.
    if (testInfo.project.name === 'escritorio') {
      await page.setViewportSize({ width: 1280, height: 420 })
    }
    await captura(page, 'primeros-pasos/menu-recepcion', page.getByTestId('sidebar'), {
      testInfo,
      solo: 'escritorio',
    })
  })
})

test.describe('con sesión de mensajero', () => {
  test.use({ rol: 'mensajero' })
  test('menú inferior', async ({ page }, testInfo) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible()
    await captura(page, 'primeros-pasos/menu-mensajero', page.getByTestId('bottom-nav'), {
      testInfo,
      solo: 'telefono',
    })
  })
})
