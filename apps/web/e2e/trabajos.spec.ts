import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { createClinicWithDoctor, createProduct, login, loginAsAdmin } from './helpers'

const FOTO_PATH = path.join(import.meta.dirname, 'fixtures', 'foto.png')

/** Crea un trabajo mínimo por API (sesión admin ya iniciada en `page`). Sin `dueDate` ni
 * `prescription` a propósito: varios tests de esta suite comparten la misma BD sin reset
 * entre ellos, y el test "ordena por entrega" depende de ser el único trabajo con fecha
 * deseada explícita en la vista "nuevos" (ver su comentario). Quien necesite un trabajo listo
 * para "Aceptar" usa `createCompleteCase`. */
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
 * Crea un trabajo completo por API: piezas, fecha deseada y prescripción, listo para
 * "Aceptar" sin que `missingForAccept` (shared) reclame nada — a diferencia de `createCase`,
 * deliberadamente incompleto. El trabajo termina en un estado distinto de `nuevo` antes de
 * que termine el test que lo usa (se acepta y se avanza), así que no interfiere con "ordena
 * por entrega" (filtra `vista=nuevos`) sin importar el orden de ejecución entre tests.
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

test.describe('Trabajos', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test(
    'crea un trabajo con odontograma y lo ve en la lista',
    { tag: '@esencial' },
    async ({ page }, testInfo) => {
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

      // UX2-03: para un producto "por pieza" (ver `createProduct` en helpers.ts) la
      // cantidad se deriva de las piezas marcadas y el campo queda de solo lectura —
      // regresión del fix de la Task 3 (09e11b5), sin `expect` propio hasta ahora
      // (ruling de la revisión de Task 3, `.superpowers/sdd/2026-09-07-ola-fixes-ui-ux/progress.md`).
      const cantidad = page.getByLabel('Cantidad')
      await expect(cantidad).toHaveValue('2')
      await expect(cantidad).toHaveAttribute('readonly', '')

      await page.getByRole('button', { name: 'Guardar', exact: true }).click()

      await expect(page).toHaveURL(/\/trabajos\/[^/]+$/)
      const code = await page.getByText(/^\d{2}-\d{5}$/).textContent()
      expect(code).toMatch(/^\d{2}-\d{5}$/)

      await page.goto('/trabajos?vista=nuevos')
      await page.getByLabel('Buscar por código, paciente o caja').fill(code!)
      await expect(page.getByRole('link', { name: code! })).toBeVisible()

      if (testInfo.project.name === 'escritorio') {
        // UX2-05: a 1280 px la tabla de trabajos no debe exigir scroll horizontal
        // interno para ver "Estado" y "Total".
        const tabla = page.locator('[data-slot="table-container"]')
        expect(await tabla.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
        await expect(page.getByRole('columnheader', { name: 'Estado' })).toBeInViewport()
        await expect(page.getByRole('columnheader', { name: 'Total' })).toBeInViewport()
      }
    },
  )

  test('comenta y sube una foto', { tag: '@clave' }, async ({ page }) => {
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

  test(
    'ordena por entrega desde la cabecera y el orden queda en la URL',
    { tag: '@clave' },
    async ({ page }, testInfo) => {
      test.skip(
        testInfo.project.name !== 'escritorio',
        'la cabecera de la tabla solo existe en escritorio',
      )
      const { clinic, doctor } = await createClinicWithDoctor(page)
      const product = await createProduct(page)
      // `dueDate` explícita: sin ella (como el resto de trabajos que crea este archivo, sin
      // fecha de entrega) TanStack elige la primera dirección de orden muestreando las 10
      // primeras filas sin ordenar (`column_getAutoSortDir`, `@tanstack/table-core`) — si
      // ninguna trae un valor no nulo, cae a "desc" por defecto en vez de "asc". Con una fecha
      // real en la fila que este test crea, el primer clic es determinísticamente ascendente.
      const created = await createCase(page, {
        clinicId: clinic.id,
        doctorId: doctor.id,
        productId: product.id,
        dueDate: '2030-01-15',
      })
      await page.goto('/trabajos?vista=nuevos')
      const header = page.getByRole('columnheader', { name: /Entrega/ })
      await page.getByRole('button', { name: 'Ordenar por Entrega' }).click()
      await expect(page).toHaveURL(/orden=entrega(?!-desc)/)
      await expect(header).toHaveAttribute('aria-sort', 'ascending')
      await page.getByRole('button', { name: 'Ordenar por Entrega' }).click()
      await expect(page).toHaveURL(/orden=entrega-desc/)
      await expect(header).toHaveAttribute('aria-sort', 'descending')
      // El aria-sort y la URL solo prueban la cabecera; con `nulls last` en ambas direcciones
      // (`repo.ts:orderFor`) nuestro trabajo, el único con `dueDate` explícita entre los que
      // crea este archivo, queda primero de la lista real tras el segundo clic — confirma que
      // la web mandó `orden` a la API y que la tabla renderizó la fila que corresponde, no solo
      // que la cabecera cambió de aspecto.
      const primerCodigo = page.locator('tbody').getByRole('link').first()
      await expect(primerCodigo).toHaveText(created.code)
    },
  )

  test('un técnico ve el trabajo sin precios', { tag: '@esencial' }, async ({ page, browser }) => {
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

  test('importa dos trabajos desde CSV', { tag: '@clave' }, async ({ page }) => {
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

  test(
    'acepta un trabajo, avanza la fase y lo finaliza',
    { tag: '@esencial' },
    async ({ page }) => {
      const { clinic, doctor } = await createClinicWithDoctor(page)
      const product = await createProduct(page)
      // `createCompleteCase`, no `createCase`: sin fecha deseada ni prescripción "Aceptar"
      // sale deshabilitada (`missingForAccept`, shared) y el test fallaría por la razón
      // equivocada (ver comentario del helper).
      const trabajo = await createCompleteCase(page, {
        clinicId: clinic.id,
        doctorId: doctor.id,
        productId: product.id,
      })
      await page.goto(`/trabajos/${trabajo.id}`)

      await page.getByRole('button', { name: 'Aceptar' }).click()
      await expect(page.getByText('En proceso')).toBeVisible()

      // Primera fase activa sembrada por `seed-data.ts` (`STAGES`): "Recepción"; un clic de
      // "Avanzar fase" la mueve a la siguiente, "Modelo". `.first()`: el nombre aparece dos
      // veces (el campo "Fase" de `CaseHeader` y el propio `StageControl`).
      await page.getByRole('button', { name: 'Avanzar fase' }).click()
      await expect(page.getByText('Modelo').first()).toBeVisible()

      // El diálogo de confirmación de "Finalizar" (Tarea 8) deja dos botones con el mismo
      // nombre en pantalla: el de la barra de acciones y el de confirmar dentro del diálogo.
      // El primer clic es al único que hay antes de abrirlo; el segundo se acota al
      // `alertdialog` (ver ruling de la Tarea 9). `exact: true` porque el chip de estado
      // "Terminado" convive con el texto de `StageControl` para los demás estados
      // ("El trabajo ya está terminado."), que también contiene la palabra.
      await page.getByRole('button', { name: 'Finalizar' }).click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Finalizar' }).click()
      await expect(page.getByText('Terminado', { exact: true })).toBeVisible()
    },
  )

  test(
    'asigna el técnico responsable y repite un trabajo entregado',
    { tag: '@clave' },
    async ({ page }) => {
      const { clinic, doctor } = await createClinicWithDoctor(page)
      const product = await createProduct(page)
      const trabajo = await createCompleteCase(page, {
        clinicId: clinic.id,
        doctorId: doctor.id,
        productId: product.id,
      })

      const email = `tecnico-e2e-${Date.now()}@t.local`
      const createdUser = await page.request.post('/api/users', {
        data: { name: 'Técnico Repetición E2E', email, password: 'Tecnico1234', role: 'tecnico' },
      })
      expect(createdUser.ok()).toBe(true)
      const { user: tecnico } = (await createdUser.json()) as { user: { id: string; name: string } }

      await page.goto(`/trabajos/${trabajo.id}`)
      await page.getByLabel('Técnico responsable').selectOption(tecnico.id)
      await expect(page.getByLabel('Técnico responsable')).toHaveValue(tecnico.id)

      // Hasta "entregado" para poder repetirlo (`REMAKEABLE_STATUSES`, shared).
      await page.getByRole('button', { name: 'Aceptar' }).click()
      await page.getByRole('button', { name: 'Finalizar' }).click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Finalizar' }).click()
      await expect(page.getByText('Terminado', { exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Marcar enviado' }).click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Marcar enviado' }).click()
      await expect(page.getByText('Enviado', { exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Marcar entregado' }).click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Marcar entregado' }).click()
      await expect(page.getByText('Entregado', { exact: true })).toBeVisible()

      await page.getByRole('button', { name: 'Repetir' }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByLabel('Motivo').fill('Fractura en cerámica al probar (E2E)')
      await dialog.getByRole('button', { name: 'Crear repetición' }).click()

      // Navega a la ficha del hijo (código distinto del padre, estado "Nuevo"): la Tarea 9
      // lleva al usuario ahí después de crear la repetición en vez de dejarlo en la del padre.
      await expect(page).toHaveURL(/\/trabajos\/[^/]+$/)
      await expect(page.getByText(trabajo.code)).not.toBeVisible()
      await expect(page.getByText('Nuevo', { exact: true })).toBeVisible()
    },
  )
})
