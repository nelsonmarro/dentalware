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

/** Crea una clínica y un doctor únicos por API (sesión admin ya iniciada en `page`). */
export async function createClinicWithDoctor(page: Page) {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`

  const clinicRes = await page.request.post('/api/config/clinicas', {
    data: { name: `Clínica E2E ${suffix}` },
  })
  expect(clinicRes.ok()).toBe(true)
  const { clinic } = (await clinicRes.json()) as { clinic: { id: string; name: string } }

  const doctorRes = await page.request.post('/api/config/doctores', {
    data: { clinicId: clinic.id, name: `Dr. E2E ${suffix}` },
  })
  expect(doctorRes.ok()).toBe(true)
  const { doctor } = (await doctorRes.json()) as { doctor: { id: string; name: string } }

  return { clinic, doctor }
}

/** Crea un producto único "por pieza" por API, en la primera categoría existente. */
export async function createProduct(page: Page) {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`

  const categoriesRes = await page.request.get('/api/config/productos/categorias')
  expect(categoriesRes.ok()).toBe(true)
  const { categories } = (await categoriesRes.json()) as { categories: { id: string }[] }

  const productRes = await page.request.post('/api/config/productos', {
    data: {
      code: `E2E${suffix}`.slice(0, 20),
      name: `Producto E2E ${suffix}`,
      categoryId: categories[0]!.id,
      pricingUnit: 'por_pieza',
      basePrice: '25.00',
      turnaroundDays: 5,
      requiresTryIn: false,
    },
  })
  expect(productRes.ok()).toBe(true)
  const { product } = (await productRes.json()) as {
    product: { id: string; code: string; name: string }
  }
  return product
}
