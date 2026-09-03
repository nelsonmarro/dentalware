import { expect, test } from '@playwright/test'

const EMAIL = process.env.ADMIN_EMAIL ?? 'admin@lab.local'
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin12345!'

test('redirige a /login sin sesión', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'Dentalware' })).toBeVisible()
})

test('muestra errores de validación en español', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Correo').fill('no-es-email')
  await page.getByLabel('Contraseña').fill('123')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByText('Correo inválido')).toBeVisible()
  await expect(page.getByText('La contraseña debe tener al menos 8 caracteres')).toBeVisible()
})

test('inicia sesión y ve el inicio con la API conectada', async ({ page, isMobile }) => {
  await page.goto('/login')
  await page.getByLabel('Correo').fill(EMAIL)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible()
  await expect(page.getByTestId('api-status')).toHaveText('API: conectada')

  if (isMobile) {
    await expect(page.getByTestId('bottom-nav')).toBeVisible()
    await expect(page.getByTestId('sidebar')).toBeHidden()
  } else {
    await expect(page.getByTestId('sidebar')).toBeVisible()
    await expect(page.getByTestId('bottom-nav')).toBeHidden()
  }

  await page.getByRole('link', { name: 'Trabajos' }).first().click()
  await expect(page.getByRole('heading', { name: 'Trabajos' })).toBeVisible()
})

test('cierra sesión', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Correo').fill(EMAIL)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL('/')
  await page.getByRole('button', { name: 'Cerrar sesión' }).first().click()
  await expect(page).toHaveURL(/\/login/)
})
