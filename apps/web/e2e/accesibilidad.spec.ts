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
  opts: { clinicId: string; doctorId: string; productId: string },
) {
  const res = await page.request.post('/api/trabajos', {
    data: {
      clinicId: opts.clinicId,
      doctorId: opts.doctorId,
      patientRef: `Paciente E2E ${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      receivedAt: new Date().toISOString().slice(0, 10),
      items: [
        { productId: opts.productId, quantity: 1, teeth: [], unitPrice: null, discountPct: 0 },
      ],
    },
  })
  expect(res.ok()).toBe(true)
  const { case: created } = (await res.json()) as { case: { id: string; code: string } }
  return created
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
