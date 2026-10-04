import { expect, test, type Page } from '@playwright/test'
import {
  ADMIN,
  createClinicWithDoctor,
  createCourier,
  createProduct,
  FOTO_PATH,
  login,
  loginAsAdmin,
  todayIso,
  toasts,
  trackConsoleErrors,
  uniqueSuffix,
} from './helpers'

/**
 * Trabajo aceptado y en producción (`en_proceso`, primera fase activa de `seed-data.ts`:
 * "Recepción"), listo para entrar por `/t/:code` (sesión admin ya iniciada en `page`). Mismos
 * datos que `createCompleteCase` de `trabajos.spec.ts`: piezas, fecha deseada y prescripción,
 * para que `missingForAccept` no reclame nada al aceptar por API.
 */
async function createAcceptedCase(
  page: Page,
  opts: { clinicId: string; doctorId: string; productId: string },
) {
  const res = await page.request.post('/api/trabajos', {
    data: {
      clinicId: opts.clinicId,
      doctorId: opts.doctorId,
      patientRef: `Paciente E2E ${uniqueSuffix()}`,
      receivedAt: new Date().toISOString().slice(0, 10),
      dueDate: '2026-12-31',
      prescription: 'Prescripción E2E: corona completa',
      items: [
        { productId: opts.productId, quantity: 1, teeth: [11], unitPrice: null, discountPct: 0 },
      ],
    },
  })
  expect(res.ok()).toBe(true)
  const { case: created } = (await res.json()) as { case: { id: string; code: string } }

  const accepted = await page.request.post(`/api/trabajos/${created.id}/acciones`, {
    data: { accion: 'aceptar', motivo: null },
  })
  expect(accepted.ok()).toBe(true)

  return created
}

test.describe('Ficha corta del QR (/t/:code, FIC-2 #72 / FIC-3 #73)', () => {
  let consoleErrors: string[] = []
  test.beforeEach(async ({ page }) => {
    consoleErrors = trackConsoleErrors(page)
  })

  // #34: ningún flujo de la iteración deja errores de consola ni excepciones sin capturar.
  test.afterEach(() => {
    expect(consoleErrors).toEqual([])
  })

  test(
    'abre un trabajo por su código corto y avanza la fase',
    { tag: '@clave' },
    async ({ page }) => {
      await loginAsAdmin(page)
      const { clinic, doctor } = await createClinicWithDoctor(page)
      const product = await createProduct(page)
      const trabajo = await createAcceptedCase(page, {
        clinicId: clinic.id,
        doctorId: doctor.id,
        productId: product.id,
      })

      await page.goto(`/t/${trabajo.code}`)
      await expect(page.getByRole('heading', { level: 1, name: trabajo.code })).toBeVisible()

      // Primera fase activa sembrada por `seed-data.ts` (`STAGES`): "Recepción"; el botón
      // nombra la siguiente, "Modelo" (UX3-27; mismo criterio que `trabajos.spec.ts`).
      await page.getByRole('button', { name: 'Avanzar a Modelo' }).click()
      // UX3-11: el toast nombra la fase nueva; `exact` para no chocar con «Fase: Modelo».
      await expect(toasts(page).getByText('Fase: Modelo')).toBeVisible()
      await expect(page.getByText('Modelo', { exact: true })).toBeVisible()
    },
  )

  // UX3-08 / UX3-22: con guantes, el técnico necesita ver que la foto entró y para cuándo es.
  test(
    'dice la entrega y confirma la foto subida con el contador',
    { tag: '@clave' },
    async ({ page }) => {
      await loginAsAdmin(page)
      const { clinic, doctor } = await createClinicWithDoctor(page)
      const product = await createProduct(page)
      const trabajo = await createAcceptedCase(page, {
        clinicId: clinic.id,
        doctorId: doctor.id,
        productId: product.id,
      })

      await page.goto(`/t/${trabajo.code}`)
      await expect(page.getByRole('heading', { level: 1, name: trabajo.code })).toBeVisible()
      await expect(
        page.getByText(/^Fecha (comprometida|deseada): \d{2}\/\d{2}\/\d{4}$/),
      ).toBeVisible()
      await expect(page.getByText('Fotos: 0')).toBeVisible()

      await page.getByLabel('Añadir foto').setInputFiles(FOTO_PATH)
      await expect(toasts(page).getByText('Foto añadida')).toBeVisible()
      await expect(page.getByText('Fotos: 1')).toBeVisible()
    },
  )

  test(
    'sin sesión, /t/:code pide login y vuelve a la ficha corta',
    { tag: '@clave' },
    async ({ page, context }) => {
      await loginAsAdmin(page)
      const { clinic, doctor } = await createClinicWithDoctor(page)
      const product = await createProduct(page)
      const trabajo = await createAcceptedCase(page, {
        clinicId: clinic.id,
        doctorId: doctor.id,
        productId: product.id,
      })

      await context.clearCookies()
      await page.goto(`/t/${trabajo.code}`)
      await expect(page).toHaveURL(/\/login\?redirect=/)

      await page.getByLabel('Correo').fill(ADMIN.email)
      await page.getByLabel('Contraseña').fill(ADMIN.password)
      await page.getByRole('button', { name: 'Ingresar' }).click()

      await expect(page).toHaveURL(new RegExp(`/t/${trabajo.code}$`))
      await expect(page.getByRole('heading', { level: 1, name: trabajo.code })).toBeVisible()
    },
  )

  // #105 + ENT-4: el mensajero escanea el QR de un trabajo que lleva, toma la foto de
  // constancia y lo marca entregado desde la ficha corta, con el mismo diálogo de la ficha.
  test(
    'el mensajero entrega desde la ficha corta con la foto de constancia',
    { tag: '@clave' },
    async ({ page, browser }) => {
      await loginAsAdmin(page)
      const { clinic, doctor } = await createClinicWithDoctor(page, {
        address: 'Av. Amazonas N34-12',
        phone: '02 255 1234',
      })
      const product = await createProduct(page)
      const trabajo = await createAcceptedCase(page, {
        clinicId: clinic.id,
        doctorId: doctor.id,
        productId: product.id,
      })
      const courier = await createCourier(page)
      const finished = await page.request.post(`/api/trabajos/${trabajo.id}/acciones`, {
        data: { accion: 'finalizar' },
      })
      expect(finished.ok()).toBe(true)
      const shipped = await page.request.post(`/api/trabajos/${trabajo.id}/acciones`, {
        data: { accion: 'marcar_enviado', envio: { mensajeroId: courier.id, fecha: todayIso() } },
      })
      expect(shipped.ok()).toBe(true)

      // Contexto aparte: el de `page` tiene la sesión de admin.
      const courierContext = await browser.newContext()
      try {
        const courierPage = await courierContext.newPage()
        const courierErrors = trackConsoleErrors(courierPage)
        await login(courierPage, { email: courier.email, password: courier.password })
        await courierPage.goto(`/t/${trabajo.code}`)
        await expect(
          courierPage.getByRole('heading', { level: 1, name: trabajo.code }),
        ).toBeVisible()
        // UX4-07: le dice qué hacer, cuándo y dónde, no la fecha comprometida con la clínica.
        await expect(
          courierPage.getByRole('heading', { level: 2, name: `Entregar hoy en ${clinic.name}` }),
        ).toBeVisible()
        await expect(courierPage.getByText(/^Fecha comprometida/)).toHaveCount(0)
        await expect(courierPage.getByRole('link', { name: /Av\. Amazonas N34-12/ })).toBeVisible()
        await expect(courierPage.getByRole('link', { name: /02 255 1234/ })).toHaveAttribute(
          'href',
          'tel:022551234',
        )
        // Su foto es la constancia: no hay «Añadir foto» genérico.
        await expect(courierPage.getByRole('button', { name: 'Añadir foto' })).toHaveCount(0)

        await courierPage.getByRole('button', { name: 'Marcar entregado' }).click()
        const dialog = courierPage.getByRole('dialog', { name: 'Marcar entregado' })
        await dialog.getByLabel('Foto de constancia').setInputFiles(FOTO_PATH)
        await expect(dialog.getByRole('img', { name: 'Foto de constancia' })).toBeVisible()
        await dialog.getByRole('button', { name: 'Marcar entregado' }).click()

        await expect(toasts(courierPage).getByText('Marcado como entregado')).toBeVisible()
        await expect(courierPage.getByText('Entregado', { exact: true })).toBeVisible()
        await expect(courierPage.getByRole('button', { name: 'Marcar entregado' })).toHaveCount(0)
        expect(courierErrors).toEqual([])
      } finally {
        await courierContext.close()
      }

      // UX4-09: en la ficha completa, recepción ve quién lo entregó y abre la constancia.
      await page.goto(`/trabajos/${trabajo.id}`)
      const panel = page.getByRole('region', { name: 'Producción' })
      await expect(
        panel.getByText(new RegExp(`^Entregado el \\d{2}/\\d{2}/\\d{4} por ${courier.name}$`)),
      ).toBeVisible()
      await expect(panel.getByRole('link', { name: 'Ver constancia' })).toBeVisible()
    },
  )
})
