import { expect, test, type Page } from '@playwright/test'
import {
  createClinicWithDoctor,
  createCourier,
  createProduct,
  expectTouchTargets,
  FOTO_PATH,
  login,
  loginAsAdmin,
  shipAndDeliver,
  testPassword,
  todayIso,
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
    /** «Programar recogida» al crear (ENT-1): el trabajo nace `por_recoger`. */
    recogida?: { mensajeroId: string; fecha: string }
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
      ...(opts.recogida ? { recogida: opts.recogida } : {}),
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
    // UX5-09 (#122): en móvil, el orden es un solo `select` «Ordenar» (columna y sentido juntos),
    // también en esta tabla, que ordena en el servidor. Se mide aparte para que no pase en vacío.
    await expect(page.getByRole('combobox', { name: 'Ordenar' })).toBeVisible()
    await expectTouchTargets(page, 'select[id$="-ordenar"]')
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
      try {
        const anonPage = await anon.newPage()
        await anonPage.goto('/login?redirect=%2Ft%2F26-00001')
        await expect(anonPage.getByText('Inicia sesión para abrir el trabajo')).toBeVisible()
        await expectTouchTargets(anonPage, TOUCH_CONTROLS)
      } finally {
        await anon.close()
      }
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
      for (const accion of ['aceptar', 'finalizar']) {
        await runCaseAction(page, created.id, accion)
      }
      // Enviar y entregar exigen mensajero y constancia (Iteración 4, Tarea 4).
      const courier = await createCourier(page)
      await shipAndDeliver(page, created.id, courier.id)

      await page.goto(`/trabajos/${created.id}`)
      await page.getByRole('button', { name: 'Repetir' }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expectTouchTargets(dialog, TOUCH_CONTROLS)
    },
  )

  // UX4-02 y UX4-25: los enlaces entre el original y su repetición (aviso «Repetido» y bloque
  // «Repeticiones» en el original; «Repetición de …» en la ficha de la repetición).
  test(
    'ficha de un original y de su repetición: enlaces entre ambos',
    { tag: '@extendida' },
    async ({ page }) => {
      const { clinic, doctor } = await createClinicWithDoctor(page)
      const product = await createProduct(page)
      const created = await createCompleteCase(page, {
        clinicId: clinic.id,
        doctorId: doctor.id,
        productId: product.id,
      })
      for (const accion of ['aceptar', 'finalizar']) {
        await runCaseAction(page, created.id, accion)
      }
      const courier = await createCourier(page)
      await shipAndDeliver(page, created.id, courier.id)
      const remake = await page.request.post(`/api/trabajos/${created.id}/repetir`, {
        data: { motivo: 'Fractura (E2E)', responsabilidad: 'laboratorio', cobroPct: 0 },
      })
      expect(remake.ok()).toBe(true)
      const { case: child } = (await remake.json()) as { case: { id: string; code: string } }

      await page.goto(`/trabajos/${created.id}`)
      await expect(page.getByRole('link', { name: `Repetido: ${child.code}` })).toBeVisible()
      await expectTouchTargets(page, 'a[href]:has-text("Repetido:")')
      await expect(page.getByRole('heading', { name: 'Repeticiones' })).toBeVisible()
      await expectTouchTargets(page, TOUCH_CONTROLS)
      await expectTouchTargets(page, 'a[href]:has-text("' + child.code + '")')

      await page.goto(`/trabajos/${child.id}`)
      const enlace = page.getByRole('link', { name: `Repetición de ${created.code}` })
      await expect(enlace).toBeVisible()
      await expectTouchTargets(page, 'a[href]:has-text("Repetición de")')
    },
  )

  // Iteración 4 (ENT-1): la sección plegable del formulario, abierta.
  test(
    'nuevo trabajo: sección «Programar recogida» abierta',
    { tag: '@extendida' },
    async ({ page }) => {
      await page.goto('/trabajos/nuevo')
      await expect(page.getByRole('heading', { name: 'Nuevo trabajo' })).toBeVisible()
      await page.getByRole('button', { name: 'Programar recogida' }).click()
      await expect(page.getByRole('combobox', { name: 'Mensajero' })).toBeVisible()
      await expectTouchTargets(page, TOUCH_CONTROLS)
    },
  )

  // Iteración 4 (ENT-2/ENT-4): los diálogos de enviar y entregar.
  test(
    'ficha de un trabajo terminado: diálogo «Marcar enviado»',
    { tag: '@extendida' },
    async ({ page }) => {
      const { clinic, doctor } = await createClinicWithDoctor(page)
      const product = await createProduct(page)
      const created = await createCompleteCase(page, {
        clinicId: clinic.id,
        doctorId: doctor.id,
        productId: product.id,
      })
      for (const accion of ['aceptar', 'finalizar']) {
        await runCaseAction(page, created.id, accion)
      }

      await page.goto(`/trabajos/${created.id}`)
      await page.getByRole('button', { name: 'Marcar enviado' }).click()
      const dialog = page.getByRole('dialog', { name: 'Marcar enviado' })
      await expect(dialog.getByRole('combobox', { name: 'Mensajero' })).toBeVisible()
      await expectTouchTargets(dialog, TOUCH_CONTROLS)
    },
  )

  test(
    'ficha de un trabajo enviado: diálogo «Marcar entregado»',
    { tag: '@extendida' },
    async ({ page }) => {
      const { clinic, doctor } = await createClinicWithDoctor(page)
      const product = await createProduct(page)
      const created = await createCompleteCase(page, {
        clinicId: clinic.id,
        doctorId: doctor.id,
        productId: product.id,
      })
      for (const accion of ['aceptar', 'finalizar']) {
        await runCaseAction(page, created.id, accion)
      }
      const courier = await createCourier(page)
      const shipped = await page.request.post(`/api/trabajos/${created.id}/acciones`, {
        data: { accion: 'marcar_enviado', envio: { mensajeroId: courier.id, fecha: todayIso() } },
      })
      expect(shipped.ok()).toBe(true)

      await page.goto(`/trabajos/${created.id}`)
      await page.getByRole('button', { name: 'Marcar entregado' }).click()
      const dialog = page.getByRole('dialog', { name: 'Marcar entregado' })
      await expect(dialog.getByRole('button', { name: 'Tomar foto de constancia' })).toBeVisible()
      await expectTouchTargets(dialog, TOUCH_CONTROLS)
    },
  )

  // #105: la ficha corta del mensajero (su acción de entrega en grande), con su propia sesión.
  test(
    'ficha corta del mensajero: acción de entrega',
    { tag: '@extendida' },
    async ({ page, browser }) => {
      const { clinic, doctor } = await createClinicWithDoctor(page)
      const product = await createProduct(page)
      const created = await createCompleteCase(page, {
        clinicId: clinic.id,
        doctorId: doctor.id,
        productId: product.id,
      })
      for (const accion of ['aceptar', 'finalizar']) {
        await runCaseAction(page, created.id, accion)
      }
      const courier = await createCourier(page)

      const courierContext = await browser.newContext()
      try {
        const courierPage = await courierContext.newPage()
        await login(courierPage, { email: courier.email, password: courier.password })
        await courierPage.goto(`/t/${created.code}`)
        await expect(courierPage.getByRole('button', { name: 'Marcar enviado' })).toBeVisible()
        await expectTouchTargets(courierPage, TOUCH_CONTROLS)
      } finally {
        await courierContext.close()
      }
    },
  )

  // ENT-5: «Entregas», con el enlace al mapa, el `tel:` y las acciones de una entrega pendiente.
  test('entregas: grupo de clínica y acciones', { tag: '@extendida' }, async ({ page }) => {
    const { clinic, doctor } = await createClinicWithDoctor(page, {
      address: 'Av. Amazonas N34-120 y Atahualpa, Quito',
      phone: '099 123 4567',
    })
    const product = await createProduct(page)
    const created = await createCompleteCase(page, {
      clinicId: clinic.id,
      doctorId: doctor.id,
      productId: product.id,
    })
    for (const accion of ['aceptar', 'finalizar']) {
      await runCaseAction(page, created.id, accion)
    }
    const courier = await createCourier(page)
    const shipped = await page.request.post(`/api/trabajos/${created.id}/acciones`, {
      data: { accion: 'marcar_enviado', envio: { mensajeroId: courier.id, fecha: todayIso() } },
    })
    expect(shipped.ok()).toBe(true)

    await page.goto(`/entregas?mensajeroId=${courier.id}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Entregas' })).toBeVisible()
    const group = page.getByRole('region', { name: clinic.name })
    await expect(group.getByRole('button', { name: 'Marcar entregado' })).toBeVisible()
    await expect(group.getByRole('link', { name: /099 123 4567/ })).toBeVisible()
    await expectTouchTargets(page, TOUCH_CONTROLS)

    // ENT-5: el diálogo «No se pudo» (motivo y nueva fecha).
    await group.getByRole('button', { name: 'No se pudo' }).click()
    const dialog = page.getByRole('dialog', { name: 'No se pudo entregar' })
    await expect(dialog.getByLabel('Nueva fecha')).toBeVisible()
    // UX4-12: los chips de motivo frecuente también miden 44 px.
    await expect(
      dialog.getByRole('group', { name: 'Motivos frecuentes' }).getByRole('button'),
    ).toHaveCount(4)
    await expectTouchTargets(dialog, TOUCH_CONTROLS)
  })

  // Ola UI/UX It4: «Entregas» del mensajero (sin filtro de mensajero, con el día), con su
  // recogida y su entrega, el diálogo «No se pudo recoger» con los motivos frecuentes y
  // «Marcar entregado» con la foto ya elegida («Cambiar foto»).
  test(
    'entregas del mensajero: su recogida, su entrega y los diálogos',
    { tag: '@extendida' },
    async ({ page, browser }) => {
      const { clinic, doctor } = await createClinicWithDoctor(page, {
        address: 'Av. Amazonas N34-120 y Atahualpa',
        phone: '099 123 4567',
      })
      const product = await createProduct(page)
      const courier = await createCourier(page)
      const enviado = await createCompleteCase(page, {
        clinicId: clinic.id,
        doctorId: doctor.id,
        productId: product.id,
      })
      for (const accion of ['aceptar', 'finalizar']) {
        await runCaseAction(page, enviado.id, accion)
      }
      const shipped = await page.request.post(`/api/trabajos/${enviado.id}/acciones`, {
        data: { accion: 'marcar_enviado', envio: { mensajeroId: courier.id, fecha: todayIso() } },
      })
      expect(shipped.ok()).toBe(true)
      const porRecoger = await createCase(page, {
        clinicId: clinic.id,
        doctorId: doctor.id,
        productId: product.id,
        recogida: { mensajeroId: courier.id, fecha: todayIso() },
      })

      const courierContext = await browser.newContext()
      try {
        const courierPage = await courierContext.newPage()
        await login(courierPage, { email: courier.email, password: courier.password })
        await courierPage.goto('/entregas')
        await expect(courierPage.getByRole('heading', { level: 1, name: 'Entregas' })).toBeVisible()
        const group = courierPage.getByRole('region', { name: clinic.name })
        await expect(group.getByRole('link', { name: porRecoger.code })).toBeVisible()
        await expect(group.getByRole('button', { name: 'Marcar entregado' })).toBeVisible()
        await expect(group.getByRole('button', { name: 'No se pudo' })).toHaveCount(2)
        // #118: «Recogido» en su recogida entra en el barrido.
        await expect(group.getByRole('button', { name: 'Recogido' })).toBeVisible()
        expect(
          await courierPage.evaluate(
            () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
          ),
        ).toBe(true)
        await expectTouchTargets(courierPage, TOUCH_CONTROLS)

        const recogida = group.getByRole('listitem').filter({ hasText: porRecoger.code })
        await recogida.getByRole('button', { name: 'No se pudo' }).click()
        const fail = courierPage.getByRole('dialog', { name: 'No se pudo recoger' })
        await expect(
          fail.getByRole('group', { name: 'Motivos frecuentes' }).getByRole('button'),
        ).toHaveCount(4)
        await expectTouchTargets(fail, TOUCH_CONTROLS)
        await fail.getByRole('button', { name: 'Volver' }).click()
        await expect(fail).toBeHidden()

        // #118: ya recogida, la tarjeta en camino (sin botones) tampoco rompe el barrido.
        await recogida.getByRole('button', { name: 'Recogido' }).click()
        await expect(recogida.getByText('En camino al laboratorio')).toBeVisible()
        expect(
          await courierPage.evaluate(
            () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
          ),
        ).toBe(true)
        await expectTouchTargets(courierPage, TOUCH_CONTROLS)

        await group.getByRole('button', { name: 'Marcar entregado' }).click()
        const deliver = courierPage.getByRole('dialog', { name: 'Marcar entregado' })
        await deliver.getByLabel('Foto de constancia').setInputFiles(FOTO_PATH)
        await expect(deliver.getByRole('button', { name: 'Cambiar foto' })).toBeVisible()
        await expectTouchTargets(deliver, TOUCH_CONTROLS)
      } finally {
        await courierContext.close()
      }
    },
  )

  // UX4-07: la ficha corta de un trabajo enviado le dice al mensajero adónde ir (mapa y teléfono
  // de la clínica) y le da su acción.
  test(
    'ficha corta del mensajero: trabajo enviado con el contacto de la clínica',
    { tag: '@extendida' },
    async ({ page, browser }) => {
      const { clinic, doctor } = await createClinicWithDoctor(page, {
        address: 'Av. Amazonas N34-120 y Atahualpa',
        phone: '099 123 4567',
      })
      const product = await createProduct(page)
      const courier = await createCourier(page)
      const created = await createCompleteCase(page, {
        clinicId: clinic.id,
        doctorId: doctor.id,
        productId: product.id,
      })
      for (const accion of ['aceptar', 'finalizar']) {
        await runCaseAction(page, created.id, accion)
      }
      const shipped = await page.request.post(`/api/trabajos/${created.id}/acciones`, {
        data: { accion: 'marcar_enviado', envio: { mensajeroId: courier.id, fecha: todayIso() } },
      })
      expect(shipped.ok()).toBe(true)

      const courierContext = await browser.newContext()
      try {
        const courierPage = await courierContext.newPage()
        await login(courierPage, { email: courier.email, password: courier.password })
        await courierPage.goto(`/t/${created.code}`)
        await expect(courierPage.getByRole('button', { name: 'Marcar entregado' })).toBeVisible()
        await expect(courierPage.getByRole('link', { name: /Av\. Amazonas N34-120/ })).toBeVisible()
        await expect(courierPage.getByRole('link', { name: /099 123 4567/ })).toBeVisible()
        await expectTouchTargets(courierPage, TOUCH_CONTROLS)
      } finally {
        await courierContext.close()
      }
    },
  )

  // INI-3 (#105): el inicio del mensajero, con su ruta de hoy agrupada por clínica.
  test(
    'inicio del mensajero: entregas de hoy',
    { tag: '@extendida' },
    async ({ page, browser }) => {
      const { clinic, doctor } = await createClinicWithDoctor(page)
      const product = await createProduct(page)
      const created = await createCompleteCase(page, {
        clinicId: clinic.id,
        doctorId: doctor.id,
        productId: product.id,
      })
      for (const accion of ['aceptar', 'finalizar']) {
        await runCaseAction(page, created.id, accion)
      }
      const courier = await createCourier(page)
      const shipped = await page.request.post(`/api/trabajos/${created.id}/acciones`, {
        data: { accion: 'marcar_enviado', envio: { mensajeroId: courier.id, fecha: todayIso() } },
      })
      expect(shipped.ok()).toBe(true)

      const courierContext = await browser.newContext()
      try {
        const courierPage = await courierContext.newPage()
        await login(courierPage, { email: courier.email, password: courier.password })
        const group = courierPage.getByRole('region', { name: clinic.name })
        await expect(group.getByRole('button', { name: 'Marcar entregado' })).toBeVisible()
        expect(
          await courierPage.evaluate(
            () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
          ),
        ).toBe(true)
        await expectTouchTargets(courierPage, TOUCH_CONTROLS)
      } finally {
        await courierContext.close()
      }
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

  // CTA-1 (#82): «Cuentas» y la cuenta de una clínica, pantallas nuevas de la Iteración 5. Un
  // «Saldo inicial» por API pone la clínica en la lista; se busca por su nombre (la BD de E2E
  // tiene más clínicas con saldo y la lista pagina de 25 en 25).
  test(
    'cuentas: buscador, interruptor y tarjeta de la clínica',
    { tag: '@extendida' },
    async ({ page }) => {
      const { clinic } = await createClinicWithDoctor(page)
      const res = await page.request.post('/api/cuentas/ajustes', {
        data: { clinicaId: clinic.id, monto: '150.00', motivo: 'Saldo inicial', fecha: todayIso() },
      })
      expect(res.ok()).toBe(true)

      await page.goto('/cuentas')
      await expect(page.getByRole('heading', { level: 1, name: 'Cuentas' })).toBeVisible()
      await page.getByLabel('Buscar clínica').fill(clinic.name)
      const card = page.getByRole('link', { name: new RegExp(clinic.name) })
      await expect(card).toContainText('$ 150.00')
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true)
      await expectTouchTargets(page, TOUCH_CONTROLS)
      await expectTouchTargets(page, TOUCH_SWITCHES, { minHeight: 24 })

      await card.click()
      await expect(page.getByRole('heading', { level: 1, name: clinic.name })).toBeVisible()
      await expectTouchTargets(page, TOUCH_CONTROLS)
    },
  )

  // UX5-05/09/18 (#122): una clínica de nombre largo, con un ajuste de motivo largo y un pago con
  // saldo a favor, no desplaza en horizontal ni la página ni ninguna tabla a 360, 412 (Pixel 7) y
  // 1280. En móvil, el orden es un solo «Ordenar» y «Anular pago» va aparte, bajo una raya.
  test(
    'cuentas: clínica de nombre largo sin scroll horizontal y un solo «Ordenar»',
    { tag: '@extendida' },
    async ({ page }) => {
      const name = `Centro Odontológico Integral E2E ${uniqueSuffix()} Valle de los Chillos`
      const created = await page.request.post('/api/config/clinicas', { data: { name } })
      expect(created.ok()).toBe(true)
      const { clinic } = (await created.json()) as { clinic: { id: string } }
      // Un trabajo entregado queda «Por cobrar»: así el pago a favor ofrece «Aplicar saldo a
      // favor» junto a «Anular pago».
      const doctorRes = await page.request.post('/api/config/doctores', {
        data: { clinicId: clinic.id, name: `Dr. E2E ${uniqueSuffix()}` },
      })
      expect(doctorRes.ok()).toBe(true)
      const { doctor } = (await doctorRes.json()) as { doctor: { id: string } }
      const product = await createProduct(page)
      const job = await createCompleteCase(page, {
        clinicId: clinic.id,
        doctorId: doctor.id,
        productId: product.id,
      })
      for (const accion of ['aceptar', 'finalizar']) {
        await runCaseAction(page, job.id, accion)
      }
      await shipAndDeliver(page, job.id, (await createCourier(page)).id)
      const adjusted = await page.request.post('/api/cuentas/ajustes', {
        data: {
          clinicaId: clinic.id,
          monto: '150.00',
          motivo:
            'Saldo inicial acordado con la doctora por la demora en la entrega de la prótesis y el retraso del mensajero en la recogida',
          fecha: todayIso(),
        },
      })
      expect(adjusted.ok()).toBe(true)
      const paid = await page.request.post('/api/cuentas/pagos', {
        data: {
          clinicaId: clinic.id,
          monto: '5.00',
          metodo: 'efectivo',
          fecha: todayIso(),
          asignaciones: [],
        },
      })
      expect(paid.ok()).toBe(true)

      const noPageScroll = () =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        )
      const noTableScroll = () =>
        page.evaluate(() =>
          [...document.querySelectorAll('[data-slot=table-container]')].every(
            (el) => el.scrollWidth <= el.clientWidth,
          ),
        )

      await page.goto('/cuentas')
      await expect(page.getByRole('heading', { level: 1, name: 'Cuentas' })).toBeVisible()
      const search = page.getByRole('search')
      await expect(search.getByRole('combobox', { name: 'Ordenar' })).toBeVisible()
      await expect(search.locator('select')).toHaveCount(1)
      await page.getByLabel('Buscar clínica').fill(name)
      await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible()
      expect(await noPageScroll()).toBe(true)
      await expectTouchTargets(page, TOUCH_CONTROLS)
      await page.setViewportSize({ width: 360, height: 740 })
      expect(await noPageScroll()).toBe(true)

      await page.goto(`/cuentas/${clinic.id}`)
      await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
      await page.getByRole('tab', { name: /^Movimientos/ }).click()
      const anular = page.getByRole('button', { name: /^Anular pago de/ })
      await expect(anular).toBeVisible()
      expect(await noPageScroll()).toBe(true)
      await expectTouchTargets(page, TOUCH_CONTROLS)
      // «Anular pago» va aparte: bajo «Aplicar saldo a favor», que va a lo ancho de la tarjeta.
      const apply = page.getByRole('button', { name: /^Aplicar saldo a favor de/ })
      const [applyBox, anularBox] = [await apply.boundingBox(), await anular.boundingBox()]
      expect(anularBox!.y).toBeGreaterThan(applyBox!.y + applyBox!.height)

      await page.setViewportSize({ width: 1280, height: 800 })
      await expect(page.getByRole('table')).toBeVisible()
      expect(await noTableScroll()).toBe(true)
      expect(await noPageScroll()).toBe(true)
      await page.goto('/cuentas')
      await page.getByLabel('Buscar clínica').fill(name)
      await expect(page.getByRole('link', { name })).toBeVisible()
      expect(await noTableScroll()).toBe(true)
      expect(await noPageScroll()).toBe(true)
    },
  )

  // CTA-2/CTA-3 (#83, #84): la cuenta de una clínica con sus pestañas, la línea de cobro de la
  // ficha y los cuatro diálogos de cobro. Un trabajo entregado queda «Por cobrar» y un pago por
  // API que le asigna una parte deja saldo a favor, para que «Aplicado a», «Aplicar saldo a
  // favor» y «Anular pago» salgan.
  test(
    'cuenta de una clínica: pestañas, línea de cobro y diálogos de pago, saldo a favor, anulación y ajuste',
    { tag: '@extendida' },
    async ({ page }) => {
      const { clinic, doctor } = await createClinicWithDoctor(page)
      const product = await createProduct(page)
      const created = await createCompleteCase(page, {
        clinicId: clinic.id,
        doctorId: doctor.id,
        productId: product.id,
      })
      for (const accion of ['aceptar', 'finalizar']) {
        await runCaseAction(page, created.id, accion)
      }
      const courier = await createCourier(page)
      await shipAndDeliver(page, created.id, courier.id)
      // $ 2.00: $ 1.00 al trabajo, para que la fila diga «Aplicado a» con su enlace (UX5-03), y
      // $ 1.00 a favor.
      const paid = await page.request.post('/api/cuentas/pagos', {
        data: {
          clinicaId: clinic.id,
          monto: '2.00',
          metodo: 'efectivo',
          fecha: todayIso(),
          asignaciones: [{ trabajoId: created.id, monto: '1.00' }],
        },
      })
      expect(paid.ok()).toBe(true)

      await page.goto(`/trabajos/${created.id}`)
      const accountLink = page.getByRole('link', { name: 'Ver cuenta de la clínica' })
      await expect(accountLink).toBeVisible()
      await expectTouchTargets(page, 'a[href]:has-text("Ver cuenta de la clínica")')

      await accountLink.click()
      await expect(page.getByRole('heading', { level: 1, name: clinic.name })).toBeVisible()
      await expect(page.getByRole('link', { name: created.code })).toBeVisible()
      // UX5-02 (#122): el desglose del saldo al pie de «Por cobrar», con el $ 1.00 a favor.
      const breakdown = page.locator('dl[aria-label="Desglose del saldo"]')
      await expect(breakdown).toContainText('Saldo a favor')
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true)
      await expectTouchTargets(page, TOUCH_CONTROLS)
      // UX5-01/UX5-17 (#122): «Aplicar saldo a favor» en la cabecera (hay algo por cobrar y un
      // pago con saldo), entre los botones de la cuenta, que se miden aparte.
      const accountActions = page.getByRole('group', { name: 'Acciones de la cuenta' })
      await expect(
        accountActions.getByRole('button', { name: 'Aplicar saldo a favor', exact: true }),
      ).toBeVisible()
      await expectTouchTargets(accountActions, 'button')

      await page.getByRole('tab', { name: /^Movimientos/ }).click()
      await expect(page.getByText('Le quedan $ 1.00 a favor')).toBeVisible()
      await expect(page.getByText(/^Aplicado a /)).toHaveText(`Aplicado a ${created.code} ($ 1.00)`)
      await expectTouchTargets(page, TOUCH_CONTROLS)
      // El enlace de «Aplicado a» no es identificador de la tarjeta: se mide (44 px con el dedo).
      await expectTouchTargets(page, `a[href="/trabajos/${created.id}"]:not([data-target-size])`)

      // Qué más se mide en cada diálogo (#122): la fecha con su fecha escrita debajo (UX5-08,
      // «Sábado, 10 de octubre de 2026») y el pie fijo del reparto, con lo aplicado en vivo
      // (UX5-06), dentro de la ventana.
      const longDate = /^\p{Lu}\p{Ll}+, \d{1,2} de \p{Ll}+ de \d{4}$/u
      const dialogs: { button: RegExp; title: string; dateId?: string; split?: boolean }[] = [
        { button: /^Registrar pago$/, title: 'Registrar pago', dateId: 'pago-fecha', split: true },
        { button: /^Aplicar saldo a favor$/, title: 'Aplicar saldo a favor', split: true },
        { button: /^Aplicar saldo a favor de/, title: 'Aplicar saldo a favor', split: true },
        { button: /^Anular pago de/, title: 'Anular pago' },
        { button: /^Registrar ajuste$/, title: 'Registrar ajuste', dateId: 'ajuste-fecha' },
      ]
      for (const { button, title, dateId, split } of dialogs) {
        await page.getByRole('button', { name: button }).click()
        const dialog = page.getByRole('dialog', { name: title })
        await expect(dialog).toBeVisible()
        await expectTouchTargets(dialog, TOUCH_CONTROLS)
        if (dateId) {
          await expect(dialog.locator(`#${dateId}-escrita`)).toHaveText(longDate)
          await expectTouchTargets(dialog, `input#${dateId}`)
        }
        if (split) {
          const footer = dialog.locator('[data-slot=form-dialog-footer]')
          await expect(footer.getByRole('status')).toContainText(/^Aplicado \$/)
          await expect(footer).toBeInViewport({ ratio: 1 })
          await expectTouchTargets(footer, 'button')
        }
        // Nada se sale por la derecha del diálogo (el reparto con un paciente largo lo
        // ensanchaba y recortaba los botones del pie).
        expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
        await dialog.getByRole('button', { name: 'Volver' }).click()
        await expect(dialog).toBeHidden()
      }
    },
  )

  // CTA-2/CTA-3 (#83, #84): los desplegables de los diálogos de cobro, que el barrido de arriba
  // no abre: el método de «Registrar pago» (`Select`) y el trabajo de «Registrar ajuste»
  // (`Combobox` con buscador). Las opciones son lo que se toca con guantes.
  test(
    'cuenta de una clínica: desplegables de método de pago y de trabajo del ajuste',
    { tag: '@extendida' },
    async ({ page }) => {
      const { clinic, doctor } = await createClinicWithDoctor(page)
      const product = await createProduct(page)
      const created = await createCompleteCase(page, {
        clinicId: clinic.id,
        doctorId: doctor.id,
        productId: product.id,
      })
      for (const accion of ['aceptar', 'finalizar']) {
        await runCaseAction(page, created.id, accion)
      }
      const courier = await createCourier(page)
      await shipAndDeliver(page, created.id, courier.id)

      await page.goto(`/cuentas/${clinic.id}`)
      await expect(page.getByRole('heading', { level: 1, name: clinic.name })).toBeVisible()

      await page.getByRole('button', { name: 'Registrar pago' }).click()
      const pago = page.getByRole('dialog', { name: 'Registrar pago' })
      await pago.getByRole('combobox', { name: 'Método' }).click()
      const metodos = page.getByRole('listbox')
      await expect(metodos.getByRole('option', { name: 'Transferencia' })).toBeVisible()
      await expectTouchTargets(metodos, '[role=option]')
      await page.keyboard.press('Escape')
      await expect(metodos).toBeHidden()
      await pago.getByRole('button', { name: 'Volver' }).click()
      await expect(pago).toBeHidden()

      await page.getByRole('button', { name: 'Registrar ajuste' }).click()
      const ajuste = page.getByRole('dialog', { name: 'Registrar ajuste' })
      await ajuste.getByRole('combobox', { name: 'Trabajo' }).click()
      const trabajos = page.getByRole('dialog', { name: 'Elegir trabajo' })
      await expect(trabajos.getByRole('option', { name: new RegExp(created.code) })).toBeVisible()
      await expectTouchTargets(trabajos, '[role=option]')
      await expectTouchTargets(trabajos, 'input')
    },
  )

  // CTA-5 (#86): el estado de cuenta imprimible, con sus controles de periodo e «Imprimir».
  test('estado de cuenta: periodo, imprimir y tablas', { tag: '@extendida' }, async ({ page }) => {
    const { clinic } = await createClinicWithDoctor(page)
    const res = await page.request.post('/api/cuentas/ajustes', {
      data: { clinicaId: clinic.id, monto: '150.00', motivo: 'Saldo inicial', fecha: todayIso() },
    })
    expect(res.ok()).toBe(true)

    await page.goto(`/cuentas/${clinic.id}/estado`)
    await expect(page.getByRole('heading', { level: 1, name: 'Estado de cuenta' })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Movimientos' })).toContainText('Saldo inicial')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true)
    await expectTouchTargets(page, TOUCH_CONTROLS)
  })

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
      // UX4-22: la tarjeta «Entregas de hoy» de admin y recepción entra en el barrido.
      await expect(page.getByRole('link', { name: /^Entregas de hoy \d/ })).toBeVisible()
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
      const password = testPassword()
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
      try {
        const tecnicoPage = await tecnicoContext.newPage()
        await login(tecnicoPage, { email, password })

        await expect(tecnicoPage.getByRole('heading', { name: 'Mis trabajos' })).toBeVisible()
        // La fila tiene que estar antes de medir: con la lista vacía el barrido no mediría
        // ninguna fila de "Mis trabajos" y el criterio quedaría sin probar.
        await expect(
          tecnicoPage.getByRole('link', { name: new RegExp(trabajo.code) }),
        ).toBeVisible()
        expect(
          await tecnicoPage.evaluate(
            () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
          ),
        ).toBe(true)
        await expectTouchTargets(tecnicoPage, TOUCH_CONTROLS)
      } finally {
        await tecnicoContext.close()
      }
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
