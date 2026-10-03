import { expect, test, type Page } from '@playwright/test'
import {
  ADMIN,
  createClinicWithDoctor,
  createProduct,
  loginAsAdmin,
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

      // Primera fase activa sembrada por `seed-data.ts` (`STAGES`): "Recepción"; "Avanzar
      // fase" la mueve a la siguiente, "Modelo" (mismo criterio que `trabajos.spec.ts`).
      await page.getByRole('button', { name: 'Avanzar fase' }).click()
      // UX3-11: el toast nombra la fase nueva; `exact` para no chocar con «Fase: Modelo».
      await expect(toasts(page).getByText('Fase: Modelo')).toBeVisible()
      await expect(page.getByText('Modelo', { exact: true })).toBeVisible()
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
})
