import { toIsoDate } from '@dentalware/shared'
import { expect, test, type Page } from '@playwright/test'
import {
  createClinicWithDoctor,
  createCourier,
  createProduct,
  createStaff,
  FOTO_PATH,
  login,
  loginAsAdmin,
  nextBusinessDayIso,
  todayIso,
  tomorrowIso,
  toasts,
  trackConsoleErrors,
  uniqueSuffix,
} from './helpers'

/** Datos que `missingForAccept` (shared) exige para aceptar: piezas, fecha deseada y
 * prescripción. La fecha deseada queda lejos de «hoy» y «mañana» para no caer en las vistas de
 * fechas salvo que el test lo pida (`dueDate`). */
const PRESCRIPCION = 'Prescripción E2E: corona completa'

function farDueDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 60)
  return toIsoDate(d)
}

/** Trabajo completo por API (sesión con permiso de escritura ya iniciada en `page`). */
async function createCase(
  page: Page,
  opts: { clinicId: string; doctorId: string; productId: string; dueDate?: string },
) {
  const res = await page.request.post('/api/trabajos', {
    data: {
      clinicId: opts.clinicId,
      doctorId: opts.doctorId,
      patientRef: `Paciente E2E ${uniqueSuffix()}`,
      receivedAt: todayIso(),
      dueDate: opts.dueDate ?? farDueDate(),
      prescription: PRESCRIPCION,
      items: [
        { productId: opts.productId, quantity: 1, teeth: [11], unitPrice: null, discountPct: 0 },
      ],
    },
  })
  expect(res.ok()).toBe(true)
  const { case: created } = (await res.json()) as { case: { id: string; code: string } }
  return created
}

async function runAction(page: Page, caseId: string, data: Record<string, unknown>) {
  const res = await page.request.post(`/api/trabajos/${caseId}/acciones`, { data })
  expect(res.ok(), `${String(data.accion)}: ${await res.text()}`).toBe(true)
}

/** Trabajo `terminado`, listo para que el test lo envíe con el mensajero que necesite. */
async function createFinishedCase(page: Page, clinic: { id: string }, doctor: { id: string }) {
  const product = await createProduct(page)
  const trabajo = await createCase(page, {
    clinicId: clinic.id,
    doctorId: doctor.id,
    productId: product.id,
  })
  await runAction(page, trabajo.id, { accion: 'aceptar' })
  await runAction(page, trabajo.id, { accion: 'finalizar' })
  return trabajo
}

test.describe('Entregas (Iteración 4, #35)', () => {
  let consoleErrors: string[] = []
  test.beforeEach(async ({ page }) => {
    consoleErrors = trackConsoleErrors(page)
    await loginAsAdmin(page)
  })

  // #34: ningún flujo de la iteración deja errores de consola ni excepciones sin capturar.
  test.afterEach(() => {
    expect(consoleErrors).toEqual([])
  })

  // ENT-1, ENT-2, ENT-4, ENT-5 e INI-3: la recogida, el envío y la entrega con constancia, cada
  // paso con la sesión de quien lo hace. Aceptar y finalizar van por API para abreviar.
  test(
    'recepción programa la recogida, el mensajero la trae y entrega el trabajo con constancia',
    { tag: '@esencial' },
    async ({ page, browser }) => {
      const { clinic, doctor } = await createClinicWithDoctor(page)
      const product = await createProduct(page)
      const courier = await createCourier(page)
      const recepcion = await createStaff(page, 'recepcion')
      const patientRef = `Paciente E2E ${uniqueSuffix()}`

      // Recepción, con su propia sesión en la misma página.
      await page.context().clearCookies()
      await login(page, { email: recepcion.email, password: recepcion.password })

      await page.goto('/trabajos/nuevo')
      await page.getByRole('combobox', { name: 'Clínica' }).click()
      await page.getByRole('option', { name: clinic.name }).click()
      await page.getByRole('combobox', { name: 'Doctor' }).click()
      await page.getByRole('option', { name: doctor.name }).click()
      await page.getByLabel('Referencia del paciente').fill(patientRef)
      await page.getByLabel('Fecha deseada').fill(farDueDate())
      await page.getByLabel('Prescripción', { exact: true }).fill(PRESCRIPCION)
      await page.getByRole('button', { name: 'Agregar línea' }).click()
      await page.getByRole('combobox', { name: 'Producto' }).click()
      await page.getByRole('option', { name: new RegExp(product.code) }).click()
      await page.getByRole('button', { name: 'Piezas (0)' }).click()
      const piezas = page.getByRole('dialog')
      await piezas.getByRole('button', { name: /^11 ·/ }).click()
      await piezas.getByRole('button', { name: 'Guardar' }).click()
      await expect(page.getByRole('button', { name: 'Piezas (1)' })).toBeVisible()

      // 1. Programar la recogida con el mensajero, para hoy (la fecha por omisión).
      await page.getByRole('button', { name: 'Programar recogida' }).click()
      await page.getByRole('combobox', { name: 'Mensajero' }).click()
      await page.getByRole('option', { name: courier.name }).click()
      await expect(page.getByLabel('Fecha de recogida')).toHaveValue(todayIso())
      await page.getByRole('button', { name: 'Guardar', exact: true }).click()

      // `(?!nuevo$)`: `/trabajos/nuevo` también casa con «un segmento tras /trabajos/», y leer el
      // id antes de que termine la navegación tomaba «nuevo» como id.
      await expect(page).toHaveURL(/\/trabajos\/(?!nuevo$)[^/]+$/)
      const caseId = page.url().split('/').pop()!
      await expect(page.getByText('Por recoger', { exact: true })).toBeVisible()
      const code = (await page
        .getByText(/^\d{2}-\d{5}$/)
        .first()
        .textContent())!

      // 2. El mensajero ve la recogida en su inicio y en «Entregas», y marca «Recibido».
      const courierContext = await browser.newContext()
      try {
        const courierPage = await courierContext.newPage()
        const courierErrors = trackConsoleErrors(courierPage)
        await login(courierPage, { email: courier.email, password: courier.password })
        await expect(courierPage.getByRole('heading', { name: 'Entregas de hoy' })).toBeVisible()
        await expect(
          courierPage.getByRole('region', { name: clinic.name }).getByRole('link', { name: code }),
        ).toBeVisible()

        await courierPage.goto('/entregas')
        await expect(courierPage.getByRole('heading', { level: 1, name: 'Entregas' })).toBeVisible()
        const parada = courierPage.getByRole('region', { name: clinic.name })
        await parada.getByRole('button', { name: 'Recibido' }).click()
        await expect(toasts(courierPage).getByText('Trabajo recibido')).toBeVisible()
        await expect(parada.getByText('Hecha', { exact: true })).toBeVisible()
        await expect(parada.getByRole('button', { name: 'Recibido' })).toHaveCount(0)

        // 3. Recepción acepta y finaliza (por API) y marca enviado con el mensajero.
        await runAction(page, caseId, { accion: 'aceptar' })
        await runAction(page, caseId, { accion: 'finalizar' })
        await page.goto(`/trabajos/${caseId}`)
        await expect(page.getByText('Terminado', { exact: true })).toBeVisible()
        await page.getByRole('button', { name: 'Marcar enviado' }).click()
        const envio = page.getByRole('dialog', { name: 'Marcar enviado' })
        await envio.getByRole('combobox', { name: 'Mensajero' }).click()
        await page.getByRole('option', { name: courier.name }).click()
        await envio.getByRole('button', { name: 'Marcar enviado' }).click()
        await expect(page.getByText('Enviado', { exact: true })).toBeVisible()

        // 4. El mensajero lo ve en «Entregas», toma la foto y marca entregado.
        await courierPage.reload()
        await parada.getByRole('button', { name: 'Marcar entregado' }).click()
        const entrega = courierPage.getByRole('dialog', { name: 'Marcar entregado' })
        await entrega.getByLabel('Foto de constancia').setInputFiles(FOTO_PATH)
        await expect(entrega.getByRole('img', { name: 'Foto de constancia' })).toBeVisible()
        await entrega.getByRole('button', { name: 'Marcar entregado' }).click()
        await expect(toasts(courierPage).getByText('Marcado como entregado')).toBeVisible()
        await expect(parada.getByRole('button', { name: 'Marcar entregado' })).toHaveCount(0)
        expect(courierErrors).toEqual([])
      } finally {
        await courierContext.close()
      }

      // 5. La ficha dice «Entregado» y «Adjuntos» tiene la constancia, marcada como la de la
      // entrega y sin «Eliminar» (UX4-06); el historial la enlaza (UX4-16).
      await page.reload()
      await expect(page.getByText('Entregado', { exact: true })).toBeVisible()
      await page.getByRole('tab', { name: 'Adjuntos (1)' }).click()
      await expect(page.getByRole('img', { name: 'foto.png' })).toBeVisible()
      await expect(page.getByText('Constancia de entrega')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Eliminar foto.png' })).toHaveCount(0)
      await page.getByRole('tab', { name: /^Historial/ }).click()
      // Acotado al historial: el panel «Entrega» también enlaza la constancia (UX4-09).
      await expect(
        page
          .getByRole('tabpanel', { name: /^Historial/ })
          .getByRole('link', { name: 'Ver constancia' }),
      ).toHaveAttribute('href', /^\/api\/adjuntos\/[0-9a-f-]+$/)
      await expect(
        page.getByRole('region', { name: 'Entrega' }).getByRole('link', { name: 'Ver constancia' }),
      ).toBeVisible()
    },
  )

  // ENT-5: «No se pudo» cierra la entrega de hoy como fallida y programa otra con el mismo
  // mensajero; el estado del trabajo no cambia y el historial lo registra.
  test(
    'una entrega fallida sale de los pendientes de hoy y aparece mañana',
    { tag: '@clave' },
    async ({ page, browser }) => {
      const { clinic, doctor } = await createClinicWithDoctor(page)
      const courier = await createCourier(page)
      const trabajo = await createFinishedCase(page, clinic, doctor)
      await runAction(page, trabajo.id, {
        accion: 'marcar_enviado',
        envio: { mensajeroId: courier.id, fecha: todayIso() },
      })
      const motivo = `Clínica cerrada (E2E ${uniqueSuffix()})`

      const courierContext = await browser.newContext()
      try {
        const courierPage = await courierContext.newPage()
        const courierErrors = trackConsoleErrors(courierPage)
        await login(courierPage, { email: courier.email, password: courier.password })
        await courierPage.goto('/entregas')
        const parada = courierPage.getByRole('region', { name: clinic.name })
        await parada.getByRole('button', { name: 'No se pudo' }).click()

        const dialog = courierPage.getByRole('dialog', { name: 'No se pudo entregar' })
        await dialog.getByLabel('Motivo').fill(motivo)
        await dialog.getByLabel('Nueva fecha').fill(tomorrowIso())
        await dialog.getByRole('button', { name: 'Reprogramar' }).click()
        await expect(toasts(courierPage).getByText(/^Reprogramada para el /)).toBeVisible()

        // Hoy: queda fallida, con su motivo y sin acciones.
        await expect(parada.getByText('Fallida', { exact: true })).toBeVisible()
        await expect(parada.getByText(`Motivo: ${motivo}`)).toBeVisible()
        await expect(parada.getByRole('button', { name: 'Marcar entregado' })).toHaveCount(0)
        await expect(courierPage.getByText('0 pendientes')).toBeVisible()

        // En su inicio (solo lo pendiente de hoy) ya no está.
        await courierPage.goto('/')
        await expect(courierPage.getByText('Terminaste las entregas de hoy.')).toBeVisible()
        await expect(courierPage.getByRole('link', { name: trabajo.code })).toHaveCount(0)

        // Mañana: pendiente otra vez, con su acción.
        await courierPage.goto('/entregas')
        await courierPage.getByRole('button', { name: 'Día siguiente' }).click()
        await expect(courierPage).toHaveURL(new RegExp(`dia=${tomorrowIso()}`))
        const manana = courierPage.getByRole('region', { name: clinic.name })
        await expect(manana.getByRole('link', { name: trabajo.code })).toBeVisible()
        await expect(manana.getByRole('button', { name: 'Marcar entregado' })).toBeVisible()
        expect(courierErrors).toEqual([])
      } finally {
        await courierContext.close()
      }

      // El trabajo sigue enviado y el historial tiene el evento.
      await page.goto(`/trabajos/${trabajo.id}`)
      await expect(page.getByText('Enviado', { exact: true })).toBeVisible()
      await page.getByRole('tab', { name: /^Historial/ }).click()
      await expect(page.getByText('Entrega fallida', { exact: true })).toBeVisible()
    },
  )

  // Decisión 7 del plan: el mensajero ve solo lo suyo, en la pantalla y en la API (que ignora
  // el `mensajeroId` que le pidan y fuerza el suyo).
  test(
    'un mensajero no ve las entregas de otro mensajero',
    { tag: '@clave' },
    async ({ page, browser }) => {
      const { clinic, doctor } = await createClinicWithDoctor(page)
      const otro = await createCourier(page)
      const yo = await createCourier(page)
      const trabajo = await createFinishedCase(page, clinic, doctor)
      await runAction(page, trabajo.id, {
        accion: 'marcar_enviado',
        envio: { mensajeroId: otro.id, fecha: todayIso() },
      })

      const courierContext = await browser.newContext()
      try {
        const courierPage = await courierContext.newPage()
        const courierErrors = trackConsoleErrors(courierPage)
        await login(courierPage, { email: yo.email, password: yo.password })
        await expect(courierPage.getByText('No tienes entregas hoy')).toBeVisible()

        await courierPage.goto(`/entregas?mensajeroId=${otro.id}`)
        await expect(courierPage.getByRole('heading', { level: 1, name: 'Entregas' })).toBeVisible()
        await expect(courierPage.getByText('No tienes entregas hoy')).toBeVisible()
        await expect(courierPage.getByRole('region', { name: clinic.name })).toHaveCount(0)
        await expect(courierPage.getByRole('link', { name: trabajo.code })).toHaveCount(0)

        const res = await courierPage.request.get(
          `/api/entregas?dia=${todayIso()}&mensajeroId=${otro.id}`,
        )
        expect(res.ok()).toBe(true)
        const { entregas } = (await res.json()) as { entregas: { case: { id: string } }[] }
        expect(entregas.map((e) => e.case.id)).not.toContain(trabajo.id)
        expect(courierErrors).toEqual([])
      } finally {
        await courierContext.close()
      }
    },
  )

  // CAL-2: el contador «Vencen mañana» del inicio coincide con el total de su lista. Con el
  // reloj real, la vista llega hasta el siguiente día hábil (`addBusinessDays`) y su rótulo dice
  // «Vencen mañana» o «Vencen hasta el lunes» (UX4-04), así que el test no depende del día de la semana.
  test(
    '«Vencen mañana»: el contador del inicio coincide con la lista',
    { tag: '@clave' },
    async ({ page }) => {
      const { clinic, doctor } = await createClinicWithDoctor(page)
      const product = await createProduct(page)
      const trabajo = await createCase(page, {
        clinicId: clinic.id,
        doctorId: doctor.id,
        productId: product.id,
        dueDate: nextBusinessDayIso(),
      })

      // Otros tests corren a la vez contra la misma BD: si uno cambia la vista entre leer el
      // contador y leer la lista, se vuelve a leer todo.
      await expect(async () => {
        await page.goto('/')
        const card = page.getByRole('link', { name: /^Vencen (mañana|hasta el \S+) \d+$/ })
        await expect(card).toBeVisible()
        const count = Number((await card.getAttribute('aria-label'))!.split(' ').pop())
        expect(count).toBeGreaterThanOrEqual(1)

        await card.click()
        await expect(page).toHaveURL(/vista=vencen_manana/)
        const total = page.getByText(/^Mostrando \d+ a \d+ de \d+$/)
        await expect(total).toHaveText(new RegExp(` de ${count}$`))
      }).toPass()

      await page.getByLabel('Buscar por código, paciente o caja').fill(trabajo.code)
      await expect(page.getByRole('link', { name: trabajo.code })).toBeVisible()
    },
  )
})
