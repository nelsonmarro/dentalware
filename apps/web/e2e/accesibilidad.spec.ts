import { expect, test, type Page } from '@playwright/test'
import {
  createClinicWithDoctor,
  createProduct,
  expectTouchTargets,
  loginAsAdmin,
  TOUCH_CONTROLS,
  TOUCH_SWITCHES,
} from './helpers'

/** Crea un trabajo mínimo por API (sesión admin ya iniciada en `page`). */
async function createCase(
  page: Page,
  opts: {
    clinicId: string
    doctorId: string
    productId: string
    teeth?: number[]
    dueDate?: string
    prescription?: string
  },
) {
  const res = await page.request.post('/api/trabajos', {
    data: {
      clinicId: opts.clinicId,
      doctorId: opts.doctorId,
      patientRef: `Paciente E2E ${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      receivedAt: new Date().toISOString().slice(0, 10),
      dueDate: opts.dueDate ?? null,
      prescription: opts.prescription ?? null,
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

/**
 * Crea un trabajo completo por API (mismo criterio que `createCompleteCase` de
 * `trabajos.spec.ts`): piezas, fecha deseada y prescripción, listo para "Aceptar" sin que
 * `missingForAccept` (shared) reclame nada.
 */
async function createCompleteCase(
  page: Page,
  opts: { clinicId: string; doctorId: string; productId: string },
) {
  return createCase(page, {
    ...opts,
    teeth: [11],
    dueDate: '2026-12-31',
    prescription: 'Prescripción E2E: corona completa',
  })
}

/** Ejecuta una acción de estado por API (`POST /api/trabajos/:id/acciones`, sesión admin ya
 * iniciada en `page`): para llevar un trabajo a `en_proceso`/`entregado` sin pasar por la UI,
 * que es justo lo que el barrido táctil va a examinar (M-6, ola de fixes del PR 1, lote B). */
async function runCaseAction(page: Page, caseId: string, accion: string) {
  const res = await page.request.post(`/api/trabajos/${caseId}/acciones`, { data: { accion } })
  expect(res.ok()).toBe(true)
}

/** Avanza una fase por API (`PUT /api/trabajos/:id/fase`): deja un trabajo recién aceptado en
 * la segunda fase activa, para que "Retroceder fase" quede habilitado (hay una fase anterior a
 * la que volver) — un trabajo recién aceptado está en la primera fase, sin fase previa. */
async function advanceStage(page: Page, caseId: string) {
  const res = await page.request.put(`/api/trabajos/${caseId}/fase`, {
    data: { direccion: 'avanzar', motivo: null },
  })
  expect(res.ok()).toBe(true)
}

/**
 * Barre los objetivos táctiles (UX1-01, UX2-01, UX2-02, UX2-08, UX2-11) en las pantallas
 * más usadas por recepción y técnicos: lista y ficha de trabajos, formulario nuevo con el
 * diálogo de piezas, Configuración (Usuarios/Clínicas/Fases) e Importar. Solo corre en el
 * proyecto `android` (Pixel 7): es la única forma de detectar el problema real — el bug de
 * UX2-01 (Select en 32 px) es una regla CSS, no de layout, así que también se ve en
 * `escritorio`, pero el objetivo de 44 px es específicamente para dispositivos táctiles
 * (variante `pointer-coarse:`), que solo `android`/`iphone` emulan.
 */
test.describe('Accesibilidad — objetivos táctiles ≥ 44 px', () => {
  test.skip(({ isMobile }) => !isMobile, 'objetivo táctil: solo en proyectos móviles')

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('trabajos: lista, filtros y pestañas', { tag: '@extendida' }, async ({ page }) => {
    await page.goto('/trabajos')
    await expect(page.getByRole('heading', { name: 'Trabajos' })).toBeVisible()
    await expectTouchTargets(page, TOUCH_CONTROLS)
  })

  test('nuevo trabajo: selects y diálogo de piezas', { tag: '@extendida' }, async ({ page }) => {
    const { clinic, doctor } = await createClinicWithDoctor(page)
    const product = await createProduct(page)

    await page.goto('/trabajos/nuevo')
    await expectTouchTargets(page, TOUCH_CONTROLS)

    await page.getByRole('combobox', { name: 'Clínica' }).click()
    await page.getByRole('option', { name: clinic.name }).click()
    await page.getByRole('combobox', { name: 'Doctor' }).click()
    await page.getByRole('option', { name: doctor.name }).click()

    await page.getByRole('button', { name: 'Agregar línea' }).click()
    await page.getByRole('combobox', { name: 'Producto' }).click()
    await page.getByRole('option', { name: new RegExp(product.code) }).click()

    await page.getByRole('button', { name: 'Piezas (0)' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    // El pie del diálogo (Guardar/Cancelar) y los botones de arcada (UX2-08).
    await expectTouchTargets(dialog, TOUCH_CONTROLS)
  })

  test('ficha de un trabajo: pestañas', { tag: '@extendida' }, async ({ page }) => {
    const { clinic, doctor } = await createClinicWithDoctor(page)
    const product = await createProduct(page)
    const created = await createCase(page, {
      clinicId: clinic.id,
      doctorId: doctor.id,
      productId: product.id,
    })

    await page.goto(`/trabajos/${created.id}`)
    await expectTouchTargets(page, TOUCH_CONTROLS)
  })

  // M-6 (ola de fixes del PR 1, lote B): un trabajo `nuevo` (el único caso que cubría el test
  // de arriba) no monta la tarjeta de fase (`StageControl`) ni el `<select>` de técnico
  // (`TechnicianSelect`, de solo lectura mientras no hay sesión de trabajo en curso) ni sus
  // diálogos ("Retroceder fase", "Repetir"); y `TOUCH_CONTROLS` no medía `<select>` nativos
  // (ver el comentario de `TOUCH_CONTROLS` en `helpers.ts`). Dos trabajos por API: uno
  // `en_proceso` (fase, técnico y "Retroceder fase") y uno `entregado` (diálogo "Repetir").
  test(
    'ficha de un trabajo en proceso: fase, técnico responsable y "Retroceder fase"',
    { tag: '@extendida' },
    async ({ page }) => {
      const { clinic, doctor } = await createClinicWithDoctor(page)
      const product = await createProduct(page)
      const created = await createCompleteCase(page, {
        clinicId: clinic.id,
        doctorId: doctor.id,
        productId: product.id,
      })
      await runCaseAction(page, created.id, 'aceptar')
      // La segunda fase activa (seed: Recepción, Modelo, …): la primera no tiene fase
      // anterior, así que "Retroceder fase" nace deshabilitado y no se puede abrir su diálogo.
      await advanceStage(page, created.id)

      await page.goto(`/trabajos/${created.id}`)
      await expectTouchTargets(page, TOUCH_CONTROLS)

      await page.getByRole('button', { name: 'Retroceder fase' }).click()
      const backDialog = page.getByRole('dialog')
      await expect(backDialog).toBeVisible()
      await expectTouchTargets(backDialog, TOUCH_CONTROLS)
    },
  )

  test(
    'ficha de un trabajo entregado: diálogo "Repetir"',
    { tag: '@extendida' },
    async ({ page }) => {
      const { clinic, doctor } = await createClinicWithDoctor(page)
      const product = await createProduct(page)
      const created = await createCompleteCase(page, {
        clinicId: clinic.id,
        doctorId: doctor.id,
        productId: product.id,
      })
      for (const accion of ['aceptar', 'finalizar', 'marcar_enviado', 'marcar_entregado']) {
        await runCaseAction(page, created.id, accion)
      }

      await page.goto(`/trabajos/${created.id}`)
      await page.getByRole('button', { name: 'Repetir' }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expectTouchTargets(dialog, TOUCH_CONTROLS)
    },
  )

  test(
    'importar: enlace de plantilla y controles del diálogo',
    { tag: '@extendida' },
    async ({ page }) => {
      await page.goto('/trabajos')
      await page.getByRole('button', { name: 'Importar' }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expectTouchTargets(dialog, TOUCH_CONTROLS)
    },
  )

  test('configuración → usuarios: acciones de fila', { tag: '@extendida' }, async ({ page }) => {
    await page.goto('/configuracion/usuarios')
    await expect(page.getByRole('heading', { name: 'Usuarios' })).toBeVisible()
    await expectTouchTargets(page, TOUCH_CONTROLS)
    // DataGrid (Tarea 19): buscador de la toolbar. `expectTouchTargets` pasa vacuamente con 0
    // coincidencias (`helpers.ts`, cuenta con `items.count()`), y el buscador debe existir
    // siempre en esta pantalla (a diferencia de la paginación, ver abajo): se afirma aparte para
    // que su desaparición rompa el test en vez de pasar en silencio.
    await expect(page.locator('[role=search] input')).toHaveCount(1)
    await expectTouchTargets(page, '[role=search] input, [role=search] select')
    // El seed de usuarios no llega a 26 filas, así que el selector de paginación puede no
    // encontrar nodos: aquí sí es correcto que el barrido tolere 0 coincidencias.
    await expectTouchTargets(page, 'nav[aria-label="Paginación"] button')
  })

  test(
    'configuración → clínicas: acciones de fila y switches',
    { tag: '@extendida' },
    async ({ page }) => {
      await createClinicWithDoctor(page)
      await page.goto('/configuracion/clinicas')
      await expect(page.getByRole('heading', { name: 'Clínicas' })).toBeVisible()
      await expectTouchTargets(page, TOUCH_CONTROLS)
      await expectTouchTargets(page, TOUCH_SWITCHES, { minHeight: 24 })
      // DataGrid (Tarea 19): buscador de la toolbar. Debe existir siempre en esta pantalla, así
      // que se afirma aparte de la paginación (ver más abajo) para que su desaparición rompa el
      // test en vez de pasar vacuamente con 0 coincidencias.
      await expect(page.locator('[role=search] input')).toHaveCount(1)
      await expectTouchTargets(page, '[role=search] input, [role=search] select')
      // El seed de clínicas no llega a 26 filas, así que el selector de paginación puede no
      // encontrar nodos — aquí sí es correcto que el barrido tolere 0 coincidencias.
      await expectTouchTargets(page, 'nav[aria-label="Paginación"] button')
    },
  )

  test(
    'configuración → fases: acciones de fila y switches',
    { tag: '@extendida' },
    async ({ page }) => {
      await page.goto('/configuracion/fases')
      await expect(page.getByRole('heading', { name: 'Fases de producción' })).toBeVisible()
      await expectTouchTargets(page, TOUCH_CONTROLS)
      await expectTouchTargets(page, TOUCH_SWITCHES, { minHeight: 24 })
    },
  )

  test(
    'configuración → clínica → precios especiales: buscador y precio por fila',
    { tag: '@extendida' },
    async ({ page }) => {
      const { clinic } = await createClinicWithDoctor(page)
      await createProduct(page)

      await page.goto(`/configuracion/clinicas/${clinic.id}`)
      await page.getByRole('tab', { name: 'Precios especiales' }).click()
      await expect(page.getByLabel('Buscar producto')).toBeVisible()
      await expectTouchTargets(page, TOUCH_CONTROLS)
    },
  )
})
