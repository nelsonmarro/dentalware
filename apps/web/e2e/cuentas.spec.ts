import { toIsoDate } from '@dentalware/shared'
import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  createClinicWithDoctor,
  createCourier,
  createProduct,
  createStaff,
  login,
  loginAsAdmin,
  shipAndDeliver,
  todayIso,
  toasts,
  trackConsoleErrors,
  uniqueSuffix,
} from './helpers'

/** Trabajo completo por API (sesión admin ya iniciada en `page`): una pieza del producto de
 * prueba (`$ 25.00` por pieza), con lo que `missingForAccept` (shared) exige para aceptar. */
async function createCase(
  page: Page,
  opts: { clinicId: string; doctorId: string; productId: string },
) {
  const res = await page.request.post('/api/trabajos', {
    data: {
      clinicId: opts.clinicId,
      doctorId: opts.doctorId,
      patientRef: `Paciente E2E ${uniqueSuffix()}`,
      receivedAt: todayIso(),
      dueDate: '2026-12-31',
      prescription: 'Prescripción E2E: corona completa',
      items: [
        { productId: opts.productId, quantity: 1, teeth: [11], unitPrice: null, discountPct: 0 },
      ],
    },
  })
  expect(res.ok()).toBe(true)
  const { case: created } = (await res.json()) as { case: { id: string; code: string } }
  return created
}

/** Lleva un trabajo nuevo a `entregado` por el flujo de siempre (aceptar, finalizar, enviar con
 * mensajero y entregar con constancia), todo por API: el flujo de entrega ya lo prueba
 * `entregas.spec.ts` por la UI; aquí solo hace falta que el trabajo cargue a la cuenta. */
async function deliverCase(page: Page, caseId: string, courierId: string) {
  for (const accion of ['aceptar', 'finalizar']) {
    const res = await page.request.post(`/api/trabajos/${caseId}/acciones`, { data: { accion } })
    expect(res.ok(), `${accion}: ${await res.text()}`).toBe(true)
  }
  await shipAndDeliver(page, caseId, courierId)
}

/** Hace `days` días de calendario, como fecha de negocio `YYYY-MM-DD`. */
function daysAgoIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return toIsoDate(d)
}

/** El cubo de antigüedad `label` («0–30 días») de la cabecera de la cuenta. */
function agingBucket(summary: Locator, label: string): Locator {
  return summary
    .locator('dl > div')
    .filter({ has: summary.page().getByText(label, { exact: true }) })
}

/**
 * Cuentas y cobro (Iteración 5, #36): el recorrido de punta a punta de CTA-1, CTA-2, CTA-3 y
 * CTA-5 sobre una clínica nueva, con dos trabajos de `$ 25.00` entregados.
 */
test.describe('Cuentas', () => {
  let consoleErrors: string[] = []
  test.beforeEach(async ({ page }) => {
    consoleErrors = trackConsoleErrors(page)
    await loginAsAdmin(page)
  })
  test.afterEach(() => {
    expect(consoleErrors).toEqual([])
  })

  test(
    'cobra una clínica: saldo inicial, pago que cierra el trabajo más antiguo, saldo a favor aplicado, anulación y estado de cuenta',
    { tag: '@clave' },
    async ({ page, browser }) => {
      // Un recorrido con dos sesiones y cuatro diálogos: el triple del tiempo por omisión.
      test.slow()
      const { clinic, doctor } = await createClinicWithDoctor(page)
      const product = await createProduct(page)
      const courier = await createCourier(page)
      const recepcion = await createStaff(page, 'recepcion')
      // El primero se entrega antes: es el «más antiguo», el primero en el reparto del pago.
      const oldest = await createCase(page, {
        clinicId: clinic.id,
        doctorId: doctor.id,
        productId: product.id,
      })
      await deliverCase(page, oldest.id, courier.id)
      const newest = await createCase(page, {
        clinicId: clinic.id,
        doctorId: doctor.id,
        productId: product.id,
      })
      await deliverCase(page, newest.id, courier.id)

      // 1. Admin carga el «Saldo inicial» (CTA-3) con fecha de hace 45 días y ve el saldo y la
      //    antigüedad: los dos trabajos en 0–30 y el saldo inicial en 31–60.
      await page.goto(`/cuentas/${clinic.id}`)
      await expect(page.getByRole('heading', { level: 1, name: clinic.name })).toBeVisible()
      const summary = page.getByRole('region', { name: 'Saldo' })
      await expect(summary).toContainText('$ 50.00')
      await page.getByRole('button', { name: 'Registrar ajuste' }).click()
      const ajuste = page.getByRole('dialog', { name: 'Registrar ajuste' })
      await ajuste.getByRole('button', { name: 'Saldo inicial' }).click()
      await expect(ajuste.getByRole('button', { name: 'Recargo' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      await expect(ajuste.getByLabel('Motivo')).toHaveValue('Saldo inicial')
      await ajuste.getByLabel('Monto').fill('100.00')
      await ajuste.getByLabel('Fecha').fill(daysAgoIso(45))
      await ajuste.getByRole('button', { name: 'Registrar ajuste' }).click()
      await expect(ajuste).toBeHidden()
      await expect(toasts(page)).toContainText('Ajuste registrado')
      await expect(summary).toContainText('$ 150.00')
      await expect(summary).toContainText('Más antiguo: 45 días')
      await expect(agingBucket(summary, '0–30 días')).toContainText('$ 50.00')
      await expect(agingBucket(summary, '31–60 días')).toContainText('$ 100.00')

      // 2-3. Recepción registra un pago de $ 30.00 que cubre solo el más antiguo (pasa a
      //      «Cobrado») y deja $ 5.00 a favor; después aplica ese saldo a favor al otro trabajo.
      const recepcionContext = await browser.newContext()
      try {
        const rp = await recepcionContext.newPage()
        const recepcionErrors = trackConsoleErrors(rp)
        await login(rp, recepcion)
        // Recepción entra a «Cuentas» desde su navegación (en móvil, la barra inferior: las
        // devtools de `vite dev` ya no la tapan, M1 de la revisión final del PR 2).
        await rp
          .getByRole('link', { name: 'Cuentas', exact: true })
          .filter({ visible: true })
          .click()
        await expect(rp.getByRole('heading', { level: 1, name: 'Cuentas' })).toBeVisible()
        await rp.getByLabel('Buscar clínica').fill(clinic.name)
        await rp.getByRole('link', { name: new RegExp(clinic.name) }).click()
        await expect(rp.getByRole('heading', { level: 1, name: clinic.name })).toBeVisible()
        // Recepción registra pagos, pero no ajustes.
        await expect(rp.getByRole('button', { name: 'Registrar ajuste' })).toHaveCount(0)

        await rp.getByRole('button', { name: 'Registrar pago' }).click()
        const pago = rp.getByRole('dialog', { name: 'Registrar pago' })
        await pago.getByLabel('Monto', { exact: true }).fill('30.00')
        // El reparto sugerido va de la entrega más antigua a la más nueva.
        await expect(pago.getByLabel(`Monto para ${oldest.code}`)).toHaveValue('25.00')
        await expect(pago.getByLabel(`Monto para ${newest.code}`)).toHaveValue('5.00')
        await pago.getByLabel(`Monto para ${newest.code}`).fill('')
        await expect(pago.getByRole('status')).toHaveText('Asignado $ 25.00 · Queda a favor $ 5.00')
        await pago.getByRole('combobox', { name: 'Método' }).click()
        await rp.getByRole('option', { name: 'Transferencia' }).click()
        await pago.getByLabel('Referencia').fill('TRX-E2E')
        await pago.getByRole('button', { name: 'Registrar pago' }).click()
        await expect(pago).toBeHidden()
        await expect(toasts(rp)).toContainText(
          'Pago registrado: 1 trabajo cobrado y $ 5.00 a favor',
        )

        const rpSummary = rp.getByRole('region', { name: 'Saldo' })
        await expect(rpSummary).toContainText('$ 120.00')
        await expect(rpSummary).toContainText('Saldo a favor $ 5.00')
        // El saldo a favor se descuenta de lo más antiguo: el saldo inicial.
        await expect(agingBucket(rpSummary, '31–60 días')).toContainText('$ 95.00')
        await expect(rp.getByRole('tab', { name: 'Por cobrar (1)' })).toBeVisible()
        await expect(rp.getByRole('link', { name: oldest.code })).toHaveCount(0)

        await rp.getByRole('tab', { name: /^Movimientos/ }).click()
        await expect(rp.getByText('Le quedan $ 5.00 a favor')).toBeVisible()
        await rp.getByRole('button', { name: /^Aplicar saldo a favor de \$ 5\.00/ }).click()
        const aplicar = rp.getByRole('dialog', { name: 'Aplicar saldo a favor' })
        await expect(aplicar.getByLabel(`Monto para ${newest.code}`)).toHaveValue('5.00')
        await aplicar.getByRole('button', { name: 'Aplicar saldo a favor' }).click()
        await expect(aplicar).toBeHidden()
        await expect(toasts(rp)).toContainText('Saldo a favor aplicado')
        await expect(rpSummary).toContainText('$ 120.00')
        await expect(rpSummary).not.toContainText('Saldo a favor')
        await expect(rp.getByText('Le quedan $ 5.00 a favor')).toHaveCount(0)
        // Recepción no anula pagos.
        await expect(rp.getByRole('button', { name: /^Anular pago/ })).toHaveCount(0)

        // El más antiguo quedó «Cobrado» en su ficha.
        await rp.goto(`/trabajos/${oldest.id}`)
        await expect(rp.getByText('Cobrado', { exact: true })).toBeVisible()
        await expect(rp.getByText(/^Cobrado el \d{2}\/\d{2}$/)).toBeVisible()
        expect(recepcionErrors).toEqual([])
      } finally {
        await recepcionContext.close()
      }

      // 4. Admin anula el pago: el más antiguo vuelve a «Entregado» y los $ 5.00 aplicados al
      //    otro dejan de contar.
      await page.reload()
      await expect(page.getByRole('heading', { level: 1, name: clinic.name })).toBeVisible()
      await page.getByRole('tab', { name: /^Movimientos/ }).click()
      await page.getByRole('button', { name: /^Anular pago de/ }).click()
      const anular = page.getByRole('dialog', { name: 'Anular pago' })
      await expect(anular).toContainText('Los trabajos que cerró este pago vuelven a «Entregado»')
      await anular.getByLabel('Motivo').fill('Se registró en la clínica equivocada')
      await anular.getByRole('button', { name: 'Anular pago' }).click()
      await expect(anular).toBeHidden()
      await expect(
        page.getByText(/^Anulado por .+: Se registró en la clínica equivocada$/),
      ).toBeVisible()
      await expect(summary).toContainText('$ 150.00')
      await expect(page.getByRole('tab', { name: 'Por cobrar (2)' })).toBeVisible()

      await page.goto(`/trabajos/${oldest.id}`)
      await expect(page.getByText('Entregado', { exact: true })).toBeVisible()
      await expect(page.getByText('Pendiente $ 25.00 de $ 25.00')).toBeVisible()

      // 5. El estado de cuenta (CTA-5) cuadra con el saldo de la cuenta. Del 1 del mes a hoy (el
      //    periodo por omisión), el saldo inicial de hace 45 días entra en el saldo de apertura;
      //    con un periodo que lo incluye, sale como movimiento. El pago anulado no suma.
      await page.getByRole('link', { name: 'Ver cuenta de la clínica' }).click()
      await expect(page.getByRole('heading', { level: 1, name: clinic.name })).toBeVisible()
      await page.getByRole('link', { name: 'Estado de cuenta' }).click()
      await expect(page.getByRole('heading', { level: 1, name: 'Estado de cuenta' })).toBeVisible()
      await expect(page.getByText(clinic.name, { exact: true })).toBeVisible()
      const movimientos = page.getByRole('table', { name: 'Movimientos' })
      const apertura = movimientos.getByRole('row').nth(1)
      const cierre = movimientos.getByRole('row').last()
      await expect(apertura).toContainText('$ 100.00')
      await expect(movimientos).toContainText('Transferencia · TRX-E2E')
      await expect(movimientos).toContainText('No suma')
      // M5: el estado de cuenta va a la clínica y no dice quién anuló el pago ni por qué.
      await expect(movimientos).not.toContainText('Se registró en la clínica equivocada')
      await expect(cierre).toContainText(/Saldo al \d{2}\/\d{2}\/\d{4}/)
      await expect(cierre).toContainText('$ 150.00')

      await page.getByLabel('Desde').fill(daysAgoIso(60))
      await page.getByRole('button', { name: 'Ver periodo' }).click()
      await expect(movimientos).toContainText('Saldo inicial')
      await expect(apertura).toContainText('$ 0.00')
      await expect(cierre).toContainText('$ 150.00')
      await expect(page.getByRole('button', { name: 'Imprimir' })).toBeVisible()
    },
  )

  test(
    'técnico y mensajero no ven «Cuentas» ni entran por URL',
    { tag: '@clave' },
    async ({ page, browser }) => {
      const { clinic } = await createClinicWithDoctor(page)
      const users = [await createStaff(page, 'tecnico'), await createStaff(page, 'mensajero')]
      for (const user of users) {
        const context = await browser.newContext()
        try {
          const other = await context.newPage()
          const errors = trackConsoleErrors(other)
          await login(other, user)
          await expect(other.getByRole('link', { name: 'Cuentas' })).toHaveCount(0)
          await other.goto('/cuentas')
          await expect(other).toHaveURL('/')
          await other.goto(`/cuentas/${clinic.id}`)
          await expect(other).toHaveURL('/')
          const res = await other.request.get('/api/cuentas')
          expect(res.status()).toBe(403)
          expect(errors).toEqual([])
        } finally {
          await context.close()
        }
      }
    },
  )
})
