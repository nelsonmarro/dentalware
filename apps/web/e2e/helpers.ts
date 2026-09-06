import { expect, type Page } from '@playwright/test'

export const ADMIN = {
  email: process.env.ADMIN_EMAIL ?? 'admin@lab.local',
  password: process.env.ADMIN_PASSWORD ?? 'Admin12345!',
}

export async function login(page: Page, credentials: { email: string; password: string }) {
  await page.goto('/login')
  await page.getByLabel('Correo').fill(credentials.email)
  await page.getByLabel('Contraseña').fill(credentials.password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
}

export async function loginAsAdmin(page: Page) {
  await login(page, ADMIN)
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible()
}
