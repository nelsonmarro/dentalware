import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { createClinicWithDoctor, createProduct, login, loginAsAdmin } from './helpers'

const FOTO_PATH = path.join(import.meta.dirname, 'fixtures', 'foto.png')

/** Crea un trabajo mínimo por API (sesión admin ya iniciada en `page`). */
async function createCase(
  page: Page,
  opts: { clinicId: string; doctorId: string; productId: string; teeth?: number[] },
) {
  const res = await page.request.post('/api/trabajos', {
    data: {
      clinicId: opts.clinicId,
      doctorId: opts.doctorId,
      patientRef: `Paciente E2E ${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      receivedAt: new Date().toISOString().slice(0, 10),
      items: [
        {
          productId: opts.productId,
          quantity: 1,
          teeth: opts.teeth ?? [],
          unitPrice: null,
          discountPct: 0,
        },
      ],
    },
  })
  expect(res.ok()).toBe(true)
  const { case: created } = (await res.json()) as { case: { id: string; code: string } }
  return created
}

test.describe('Trabajos', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('crea un trabajo con odontograma y lo ve en la lista', async ({ page }, testInfo) => {
    const { clinic, doctor } = await createClinicWithDoctor(page)
    const product = await createProduct(page)
    const patientRef = `Paciente E2E ${Date.now()}`

    await page.goto('/trabajos/nuevo')

    await page.getByRole('combobox', { name: 'Clínica' }).click()
    await page.getByRole('option', { name: clinic.name }).click()
    await page.getByRole('combobox', { name: 'Doctor' }).click()
    await page.getByRole('option', { name: doctor.name }).click()
    await page.getByLabel('Referencia del paciente').fill(patientRef)

    await page.getByRole('button', { name: 'Agregar línea' }).click()
    await page.getByRole('combobox', { name: 'Producto' }).click()
    await page.getByRole('option', { name: new RegExp(product.code) }).click()

    await page.getByRole('button', { name: 'Piezas (0)' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: /^11 ·/ }).click()
    await dialog.getByRole('button', { name: /^12 ·/ }).click()
    await expect(dialog.getByText('2 piezas')).toBeVisible()

    if (testInfo.project.name === 'android') {
      expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
    }

    await dialog.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByRole('button', { name: 'Piezas (2)' })).toBeVisible()

    await page.getByRole('button', { name: 'Guardar', exact: true }).click()

    await expect(page).toHaveURL(/\/trabajos\/[^/]+$/)
    const code = await page.getByText(/^\d{2}-\d{5}$/).textContent()
    expect(code).toMatch(/^\d{2}-\d{5}$/)

    await page.goto('/trabajos?vista=nuevos')
    await page.getByLabel('Buscar por código, paciente o caja').fill(code!)
    await expect(page.getByRole('link', { name: code! })).toBeVisible()
  })

  test('comenta y sube una foto', async ({ page }) => {
    const { clinic, doctor } = await createClinicWithDoctor(page)
    const product = await createProduct(page)
    const created = await createCase(page, {
      clinicId: clinic.id,
      doctorId: doctor.id,
      productId: product.id,
    })

    await page.goto(`/trabajos/${created.id}`)

    const comentario = `Comentario E2E ${Date.now()}`
    await page.getByRole('tab', { name: /^Historial/ }).click()
    await page.getByLabel('Comentario').fill(comentario)
    await page.getByRole('button', { name: 'Comentar' }).click()
    const commentEvent = page.getByRole('listitem').filter({ hasText: comentario })
    await expect(commentEvent).toBeVisible()
    await expect(commentEvent.getByText('Administrador')).toBeVisible()

    await page.getByRole('tab', { name: /^Fotos/ }).click()
    await page.getByLabel('Subir archivo').setInputFiles(FOTO_PATH)
    await expect(page.getByRole('img', { name: 'foto.png' })).toBeVisible()

    await page.getByRole('tab', { name: /^Historial/ }).click()
    await expect(page.getByText('Adjunto agregado')).toBeVisible()
  })

  test('un técnico ve el trabajo sin precios', async ({ page, browser }) => {
    const { clinic, doctor } = await createClinicWithDoctor(page)
    const product = await createProduct(page)
    const created = await createCase(page, {
      clinicId: clinic.id,
      doctorId: doctor.id,
      productId: product.id,
      teeth: [21],
    })

    const email = `tecnico-e2e-${Date.now()}@t.local`
    const password = 'Tecnico1234'
    const createdUser = await page.request.post('/api/users', {
      data: { name: 'Técnico E2E', email, password, role: 'tecnico' },
    })
    expect(createdUser.ok()).toBe(true)

    const tecnicoContext = await browser.newContext()
    const tecnicoPage = await tecnicoContext.newPage()
    await login(tecnicoPage, { email, password })
    await expect(tecnicoPage).toHaveURL('/')

    await tecnicoPage.goto(`/trabajos/${created.id}`)
    const bodyText = await tecnicoPage.locator('body').innerText()
    expect(bodyText).not.toContain('$')
    expect(bodyText).not.toContain('Total')

    const comentario = `Comentario técnico E2E ${Date.now()}`
    await tecnicoPage.getByRole('tab', { name: /^Historial/ }).click()
    await tecnicoPage.getByLabel('Comentario').fill(comentario)
    await tecnicoPage.getByRole('button', { name: 'Comentar' }).click()
    await expect(tecnicoPage.getByText(comentario)).toBeVisible()

    await tecnicoPage.goto(`/trabajos/${created.id}/editar`)
    await expect(tecnicoPage).toHaveURL(`/trabajos/${created.id}`)

    await tecnicoContext.close()
  })

  test('importa dos trabajos desde CSV', async ({ page }) => {
    const { clinic, doctor } = await createClinicWithDoctor(page)
    const product = await createProduct(page)
    const suffix = Date.now()

    const header = [
      'clinica',
      'doctor',
      'paciente',
      'producto',
      'piezas',
      'cantidad',
      'color',
      'fecha_deseada',
      'caja',
      'observaciones',
    ]
    const row1 = [
      clinic.name,
      doctor.name,
      `Paciente import 1 ${suffix}`,
      product.code,
      '',
      '',
      '',
      '',
      '',
      '',
    ]
    const row2 = [
      clinic.name,
      doctor.name,
      `Paciente import 2 ${suffix}`,
      product.code,
      '',
      '',
      '',
      '',
      '',
      '',
    ]
    const csv = [header, row1, row2].map((r) => r.join(',')).join('\n')

    await page.goto('/trabajos')
    await page.getByRole('button', { name: 'Importar' }).click()
    await page.getByLabel('Archivo CSV').setInputFiles({
      name: 'trabajos.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv, 'utf-8'),
    })
    await page.getByRole('button', { name: 'Validar' }).click()
    await expect(page.getByText('2 filas → 2 trabajos')).toBeVisible()

    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/trabajos/importar?confirmar=true')),
      page.getByRole('button', { name: 'Importar 2 trabajos' }).click(),
    ])
    const report = (await response.json()) as { created: string[] }
    expect(report.created).toHaveLength(2)

    await page.goto('/trabajos?vista=nuevos')
    for (const code of report.created) {
      await page.getByLabel('Buscar por código, paciente o caja').fill(code)
      await expect(page.getByRole('link', { name: code })).toBeVisible()
    }
  })
})
