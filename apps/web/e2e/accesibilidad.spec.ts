import { expect, test, type Page } from '@playwright/test'
import {
  createClinicWithDoctor,
  createProduct,
  expectTouchTargets,
  login,
  loginAsAdmin,
  TOUCH_CONTROLS,
  TOUCH_SWITCHES,
  uniqueSuffix,
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
      patientRef: `Paciente E2E ${uniqueSuffix()}`,
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

  // UX3-14: el filtro de clínica pasó a `Combobox`. En móvil los filtros van plegados en
  // «Filtros», así que el barrido de la lista no los veía: se despliegan y se mide también el
  // desplegable (buscador y opciones), que es lo que se toca con guantes.
  test(
    'trabajos: filtros desplegados y buscador de clínica',
    { tag: '@extendida' },
    async ({ page }) => {
      const { clinic } = await createClinicWithDoctor(page)
      await page.goto('/trabajos')
      await expect(page.getByRole('heading', { name: 'Trabajos' })).toBeVisible()
      await page.getByText('Filtros', { exact: true }).click()
      const clinicFilter = page.getByRole('combobox', { name: 'Clínica' })
      await expect(clinicFilter).toBeVisible()
      await expectTouchTargets(page, TOUCH_CONTROLS)

      await clinicFilter.click()
      await page.getByPlaceholder('Buscar clínica').fill(clinic.name)
      await expect(page.getByRole('option', { name: clinic.name })).toBeVisible()
      // El desplegable entra con `zoom-in-95`: medido a mitad de la animación, una opción de
      // 44 px mide ~42,6. Se espera a que termine antes de medir.
      const popover = page.getByRole('dialog', { name: 'Elegir clínica' })
      await popover.evaluate((el) =>
        Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
      )
      await expectTouchTargets(popover, '[role=option]')
    },
  )

  // UX3-19: el login al que lleva el QR dice qué trabajo se abrirá. Se mide sin sesión (contexto
  // aparte: el `beforeEach` ya abrió la de admin, que rebotaría el login a «Inicio»).
  test(
    'login desde el QR: aviso del trabajo y controles',
    { tag: '@extendida' },
    async ({ browser }) => {
      const anon = await browser.newContext()
      const anonPage = await anon.newPage()
      await anonPage.goto('/login?redirect=%2Ft%2F26-00001')
      await expect(anonPage.getByText('Inicia sesión para abrir el trabajo')).toBeVisible()
      await expectTouchTargets(anonPage, TOUCH_CONTROLS)
      await anon.close()
    },
  )

  test('nuevo trabajo: selects y diálogo de piezas', { tag: '@extendida' }, async ({ page }) => {
    const { clinic, doctor } = await createClinicWithDoctor(page)
    const product = await createProduct(page)

    await page.goto('/trabajos/nuevo')
    // Esperar a la página antes de medir: `goto` resuelve al cargar el documento, no al pintar
    // la pantalla, y en móvil la barra lateral está oculta. Sin esta espera el barrido medía
    // cero controles y pasaba en vacío (lo destapó `expectTouchTargets` al exigir medir algo).
    await expect(page.getByRole('heading', { name: 'Nuevo trabajo' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Clínica' })).toBeVisible()
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
    // Esperar a la página antes de medir: `goto` resuelve al cargar el documento, no al pintar
    // la pantalla, y en móvil la barra lateral está oculta. Sin esta espera el barrido medía
    // cero controles y pasaba en vacío (lo destapó `expectTouchTargets` al exigir medir algo).
    await expect(page.getByRole('heading', { name: created.code, level: 1 })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Detalle' })).toBeVisible()
    // UX3-05: el panel «Producción» (técnico y acciones) va sobre las pestañas y entra en la medida.
    await expect(page.getByRole('region', { name: 'Producción' })).toBeVisible()
    await expectTouchTargets(page, TOUCH_CONTROLS)
  })

  // M-6 (ola de fixes del PR 1, lote B): un trabajo `nuevo` (el único caso que cubría el test
  // de arriba) no monta la fase del panel «Producción» (`StageControl`) ni el `<select>` de técnico
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
      // Esperar a la página antes de medir: `goto` resuelve al cargar el documento, no al pintar
      // la pantalla, y en móvil la barra lateral está oculta. Sin esta espera el barrido medía
      // cero controles y pasaba en vacío (lo destapó `expectTouchTargets` al exigir medir algo).
      await expect(page.getByRole('button', { name: 'Retroceder fase' })).toBeVisible()
      await expectTouchTargets(page, TOUCH_CONTROLS)

      await page.getByRole('button', { name: 'Retroceder fase' }).click()
      const backDialog = page.getByRole('dialog')
      await expect(backDialog).toBeVisible()
      await expectTouchTargets(backDialog, TOUCH_CONTROLS)
    },
  )

  // Tarea 18 (#34): los dos diálogos de la barra de acciones que ningún barrido medía todavía
  // (el resto de la ficha ya lo mide "ficha de un trabajo: pestañas" arriba) — el de motivo
  // obligatorio ("Pausar"/"Cancelar", mismo componente `CaseActionDialog`, se mide con uno) y
  // el `ConfirmDialog` de "Finalizar" (ruling de la Tarea 8: las tres acciones que estampan una
  // fecha irreversible lo usan; "Finalizar" es la única disponible sin pasar antes por
  // "Marcar enviado"/"Marcar entregado", que exigirían un trabajo ya terminado).
  test(
    'ficha de un trabajo en proceso: diálogo de motivo ("Pausar") y confirmación de "Finalizar"',
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

      await page.goto(`/trabajos/${created.id}`)
      await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible()

      await page.getByRole('button', { name: 'Pausar' }).click()
      const motivoDialog = page.getByRole('dialog')
      await expect(motivoDialog).toBeVisible()
      await expectTouchTargets(motivoDialog, TOUCH_CONTROLS)
      await motivoDialog.getByRole('button', { name: 'Volver' }).click()
      await expect(motivoDialog).not.toBeVisible()

      await page.getByRole('button', { name: 'Finalizar' }).click()
      const confirmDialog = page.getByRole('alertdialog')
      await expect(confirmDialog).toBeVisible()
      await expectTouchTargets(confirmDialog, TOUCH_CONTROLS)
    },
  )

  // Tarea 15 (FIC-2 #72 / FIC-3 #73): ficha corta del QR, pantalla nueva de esta iteración —
  // toda pantalla nueva entra en este barrido (docs/conventions.md §7). Espera al `h1` con el
  // código (propio de esta pantalla) antes de medir, mismo criterio que el resto del archivo.
  test(
    'ficha corta del QR (/t/:code): botones grandes del puesto',
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

      await page.goto(`/t/${created.code}`)
      await expect(page.getByRole('heading', { level: 1, name: created.code })).toBeVisible()
      await expectTouchTargets(page, TOUCH_CONTROLS)
    },
  )

  // UX3-27: «No encontrado» ganó la salida «Ir a trabajos»; con guantes también debe medir 44 px.
  test(
    'ficha corta del QR (/t/:code): código que no existe',
    { tag: '@extendida' },
    async ({ page }) => {
      await page.goto('/t/26-99999')
      await expect(page.getByRole('link', { name: 'Ir a trabajos' })).toBeVisible()
      await expectTouchTargets(page, TOUCH_CONTROLS)
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

  // I-1 (ronda de fixes 1, T12): el criterio de INI-1 ("sin scroll horizontal a 390 px") no
  // tenía test y el inicio no estaba en este barrido. `scrollWidth <= clientWidth` se mide
  // sobre `document.documentElement` (no sobre un contenedor interno como en
  // `trabajos.spec.ts:98,126`/`configuracion.spec.ts:84`): las tarjetas del panel de inicio son
  // un grid de página, no una tabla con su propio scroll interno.
  test(
    'inicio: tarjetas de resumen y "Mis trabajos"',
    { tag: '@extendida' },
    async ({ page, browser }) => {
      await page.goto('/')
      await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true)
      await expectTouchTargets(page, TOUCH_CONTROLS)

      // "Mis trabajos" solo existe para técnico (INI-2): un trabajo aceptado y asignado, igual
      // que el E2E de CIC-5 en trabajos.spec.ts, para que el barrido cubra también sus filas.
      const { clinic, doctor } = await createClinicWithDoctor(page)
      const product = await createProduct(page)
      const trabajo = await createCompleteCase(page, {
        clinicId: clinic.id,
        doctorId: doctor.id,
        productId: product.id,
      })
      await runCaseAction(page, trabajo.id, 'aceptar')

      const suffix = uniqueSuffix()
      const email = `tecnico-a11y-${suffix}@t.local`
      const password = 'Tecnico1234'
      const createdUser = await page.request.post('/api/users', {
        data: { name: `Técnico A11y ${suffix}`, email, password, role: 'tecnico' },
      })
      expect(createdUser.ok()).toBe(true)
      const { user: tecnico } = (await createdUser.json()) as { user: { id: string } }
      const assignRes = await page.request.put(`/api/trabajos/${trabajo.id}/tecnico`, {
        data: { tecnicoId: tecnico.id },
      })
      expect(assignRes.ok()).toBe(true)

      const tecnicoContext = await browser.newContext()
      const tecnicoPage = await tecnicoContext.newPage()
      await login(tecnicoPage, { email, password })

      await expect(tecnicoPage.getByRole('heading', { name: 'Mis trabajos' })).toBeVisible()
      // La fila tiene que estar antes de medir: con la lista vacía el barrido no mediría
      // ninguna fila de "Mis trabajos" y el criterio quedaría sin probar.
      await expect(tecnicoPage.getByRole('link', { name: new RegExp(trabajo.code) })).toBeVisible()
      expect(
        await tecnicoPage.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true)
      await expectTouchTargets(tecnicoPage, TOUCH_CONTROLS)

      await tecnicoContext.close()
    },
  )

  // M-5 (ronda de fixes 1, Tarea 14, #71): la orden imprimible es pantalla nueva y no estaba en
  // el barrido. Solo mide los controles en pantalla ("Volver al trabajo", "Imprimir" y, para
  // admin, las pestañas «Copia a imprimir», UX3-21): el resto de la orden es contenido para
  // papel, sin objetivos táctiles que probar.
  test(
    'orden de trabajo imprimible: "Volver al trabajo", "Imprimir" y las pestañas de copia',
    { tag: '@extendida' },
    async ({ page }) => {
      const { clinic, doctor } = await createClinicWithDoctor(page)
      const product = await createProduct(page)
      const trabajo = await createCase(page, {
        clinicId: clinic.id,
        doctorId: doctor.id,
        productId: product.id,
      })

      await page.goto(`/trabajos/${trabajo.id}/imprimir`)
      // Esperar a la página antes de medir: `goto` resuelve al cargar el documento, no al pintar
      // la pantalla. Sin esta espera el barrido medía cero controles y pasaba en vacío.
      await expect(page.getByRole('button', { name: 'Imprimir' })).toBeVisible()
      await expectTouchTargets(page, TOUCH_CONTROLS)
    },
  )
})
