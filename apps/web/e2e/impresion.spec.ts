import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import {
  createClinicWithDoctor,
  createProduct,
  login,
  loginAsAdmin,
  trackConsoleErrors,
  uniqueSuffix,
} from './helpers'

/**
 * FIC-1 (#71): el objetivo de impresión (ruling de la ronda de fixes 1 de la Tarea 14) es que
 * una orden de **hasta 4 líneas** quepa en **una** página en A4 y en A5; con más líneas puede
 * pasar a una segunda página, pero sin cortar ningún bloque. `chrome-devtools-mcp` no emula
 * `media: print` ni el tamaño de papel (ver brief de la Tarea 14), así que la verificación real
 * es Playwright: `emulateMedia({ media: 'print' })` + `page.pdf()`, que genera la salida real de
 * impresión de Chromium — no una captura de la vista en pantalla. `page.pdf()` solo existe en
 * Chromium (`escritorio`/`android`, ambos Chromium bajo el emulador de dispositivo); el proyecto
 * `iphone` (WebKit) no lo soporta.
 *
 * UX3-21: admin y recepción imprimen dos copias (laboratorio sin precios, clínica con precios),
 * cada una en su hoja; UX3-20: la escala de A4 es propia (raíz de 22 px al imprimir en hojas
 * anchas, 16 px en A5, `index.css`), no el A5 estirado.
 */

/** Ancho de página a 96 dpi: A4 (210 mm) y A5 (148 mm). Con `media: print` emulado, la media
 * query de ancho de `index.css` se evalúa contra el viewport. */
const PAGE_WIDTH_PX = { A4: 794, A5: 559 } as const

/** Trabajo de 4 líneas (el límite del ruling) con una pieza en cada esquina del odontograma:
 * 18/28 (superior) y 48/38 (inferior) son las piezas de los extremos de cada arcada — si el
 * odontograma envolviera a dos filas por arcada, dejarían de compartir fila con su par. */
async function createFourLineCase(page: Page, priority: 'normal' | 'urgente') {
  const { clinic, doctor } = await createClinicWithDoctor(page)
  const product = await createProduct(page)
  const caseRes = await page.request.post('/api/trabajos', {
    data: {
      clinicId: clinic.id,
      doctorId: doctor.id,
      patientRef: `Paciente E2E ${uniqueSuffix()}`,
      receivedAt: new Date().toISOString().slice(0, 10),
      dueDate: '2026-12-31',
      priority,
      shade: 'A2',
      reference: 'Guía adjunta',
      observations: 'Ajustar oclusión: revisar contacto proximal y altura cuspídea.',
      prescription: 'Corona completa, contactos ajustados',
      items: [
        { productId: product.id, quantity: 1, teeth: [18], unitPrice: null, discountPct: 0 },
        { productId: product.id, quantity: 1, teeth: [28], unitPrice: null, discountPct: 0 },
        { productId: product.id, quantity: 1, teeth: [48], unitPrice: null, discountPct: 0 },
        { productId: product.id, quantity: 1, teeth: [38], unitPrice: null, discountPct: 0 },
      ],
    },
  })
  expect(caseRes.ok()).toBe(true)
  return ((await caseRes.json()) as { case: { id: string; code: string } }).case
}

/** Genera el PDF real de impresión de Chromium y cuenta sus páginas por objeto `/Type /Page`
 * (sin contar `/Type /Pages`, el nodo padre: el límite de palabra tras "Page" no matchea antes
 * de una "s"). `printBackground: false` es lo que imprime recepción con Ctrl+P: Chrome trae
 * «Gráficos de fondo» desactivado por defecto (I-1). */
async function pdfPages(page: Page, testInfo: TestInfo, format: 'A4' | 'A5', name: string) {
  fs.mkdirSync(testInfo.outputDir, { recursive: true })
  const pdfPath = path.join(testInfo.outputDir, `${name}-${format}.pdf`)
  await page.pdf({ format, path: pdfPath, printBackground: false })
  // Un PDF vacío o truncado pesa muchísimo menos que una hoja con encabezado, odontograma,
  // líneas y firmas.
  expect(
    fs.statSync(pdfPath).size,
    `PDF ${name} ${format} sospechosamente pequeño`,
  ).toBeGreaterThan(5_000)
  await testInfo.attach(`${name}-${format}`, { path: pdfPath, contentType: 'application/pdf' })
  const pdfText = fs.readFileSync(pdfPath).toString('latin1')
  return (pdfText.match(/\/Type\s*\/Page\b/g) ?? []).length
}

async function fontSizePx(page: Page, testId: string) {
  return page
    .getByTestId(testId)
    .first()
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
}

test.describe('Orden de trabajo imprimible', () => {
  let consoleErrors: string[] = []
  test.beforeEach(async ({ page }) => {
    consoleErrors = trackConsoleErrors(page)
    await loginAsAdmin(page)
  })

  // #34: ningún flujo de la iteración deja errores de consola ni excepciones sin capturar.
  test.afterEach(() => {
    expect(consoleErrors).toEqual([])
  })

  test(
    'cada copia de una orden urgente de 4 líneas cabe en una página en A4 y en A5',
    { tag: '@clave' },
    async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === 'iphone', 'page.pdf() no existe en WebKit')

      const created = await createFourLineCase(page, 'urgente')
      await page.goto(`/trabajos/${created.id}/imprimir`)
      await expect(page.getByRole('heading', { name: 'Arte Dental' }).first()).toBeVisible()
      await expect(
        page.getByRole('heading', { name: `Orden de trabajo ${created.code}` }).first(),
      ).toBeVisible()
      await expect(page.getByRole('img', { name: /Código QR del trabajo/ }).first()).toBeVisible()
      // UX3-07 y UX3-21: por omisión, admin imprime las dos copias, ambas marcadas urgentes.
      await expect(page.getByRole('tab', { name: 'Ambas', selected: true })).toBeVisible()
      await expect(page.getByTestId('rotulo-copia')).toHaveText([
        'Copia laboratorio',
        'Copia clínica',
      ])
      await expect(page.getByText('URGENTE')).toHaveCount(2)

      // En pantalla el app-shell sigue presente (la ruta usa el layout `_app`): la barra
      // lateral en escritorio (`lg:flex`), la barra inferior en móvil (`lg:hidden`).
      const shellOnScreen =
        testInfo.project.name === 'escritorio'
          ? page.getByTestId('sidebar')
          : page.getByTestId('bottom-nav')
      await expect(shellOnScreen).toBeVisible()

      // K-2: con el ancho útil de A5 (148 mm − 2×12 mm de margen ≈ 470 px CSS a 96 dpi,
      // `@page { margin: 12mm }` en `index.css`), cada arcada del odontograma debe quedar en
      // una sola fila sin envolver — 18 y 28 (superior) comparten `y`, igual que 48 y 38
      // (inferior). Se mide sobre el DOM emulado con `media: print`: `page.pdf()` no expone
      // layout.
      await page.setViewportSize({ width: 480, height: 900 })
      await page.emulateMedia({ media: 'print' })

      // `print:hidden` (Tailwind, `app-shell.tsx`) oculta la navegación y el selector de copia
      // al imprimir: la orden es lo único que queda en la página impresa.
      await expect(page.getByTestId('sidebar')).toBeHidden()
      await expect(page.getByTestId('bottom-nav')).toBeHidden()
      await expect(page.getByRole('tab', { name: 'Ambas' })).toBeHidden()

      for (const [a, b] of [
        ['pieza-18', 'pieza-28'],
        ['pieza-48', 'pieza-38'],
      ] as const) {
        const boxA = await page.getByTestId(a).first().boundingBox()
        const boxB = await page.getByTestId(b).first().boundingBox()
        expect(boxA, `${a} sin boundingBox`).not.toBeNull()
        expect(boxB, `${b} sin boundingBox`).not.toBeNull()
        expect(boxA!.y, `arcada en dos filas: ${a} y ${b} no comparten fila`).toBeCloseTo(
          boxB!.y,
          0,
        )
      }

      // «Ambas»: una hoja por copia, cada copia sin pasarse a una segunda hoja.
      for (const format of ['A4', 'A5'] as const) {
        expect(await pdfPages(page, testInfo, format, 'ambas'), `ambas copias en ${format}`).toBe(2)
      }

      for (const [tab, name] of [
        ['Laboratorio', 'copia-laboratorio'],
        ['Clínica', 'copia-clinica'],
      ] as const) {
        await page.emulateMedia({ media: 'screen' })
        await page.getByRole('tab', { name: tab }).click()
        await expect(page.getByTestId('rotulo-copia')).toHaveCount(1)
        await page.emulateMedia({ media: 'print' })
        for (const format of ['A4', 'A5'] as const) {
          expect(await pdfPages(page, testInfo, format, name), `${name} en ${format}`).toBe(1)
        }
      }
    },
  )

  // UX3-20: la orden ya no usa en A4 los tamaños de A5 (7–10 px): en una hoja ancha todo
  // escala, y los números del odontograma nunca bajan de 9 px, ni en A5.
  test(
    'la orden impresa tiene escala propia en A4 y el odontograma legible en A5',
    { tag: '@clave' },
    async ({ page }) => {
      const created = await createFourLineCase(page, 'normal')
      await page.goto(`/trabajos/${created.id}/imprimir`)
      await page.getByRole('tab', { name: 'Laboratorio' }).click()
      await expect(page.getByTestId('rotulo-copia')).toHaveCount(1)
      await page.emulateMedia({ media: 'print' })

      const measure = async (width: number) => {
        await page.setViewportSize({ width, height: 1100 })
        const qr = await page.getByRole('img', { name: /Código QR del trabajo/ }).boundingBox()
        expect(qr, 'QR sin boundingBox').not.toBeNull()
        return {
          tooth: await fontSizePx(page, 'pieza-11'),
          body: await fontSizePx(page, 'rotulo-copia'),
          qr: qr!.width,
        }
      }
      const a5 = await measure(PAGE_WIDTH_PX.A5)
      const a4 = await measure(PAGE_WIDTH_PX.A4)

      expect(a5.tooth, 'números del odontograma en A5').toBeGreaterThanOrEqual(9)
      expect(a4.tooth, 'números del odontograma en A4').toBeGreaterThanOrEqual(12)
      expect(a4.body / a5.body, 'el texto de A4 no escala respecto al de A5').toBeGreaterThan(1.25)
      // QR ≥ 24 mm en A5 (≈ 90 px) y más grande en A4.
      expect(a5.qr, 'QR en A5').toBeGreaterThanOrEqual(90)
      expect(a4.qr, 'QR en A4').toBeGreaterThan(a5.qr)
    },
  )

  // UX3-21: el técnico no ve una «Copia clínica», ni vacía: solo la copia laboratorio.
  test(
    'un técnico solo imprime la copia laboratorio, sin precios',
    { tag: '@clave' },
    async ({ page, browser }) => {
      const created = await createFourLineCase(page, 'normal')
      const email = `tecnico-e2e-${uniqueSuffix()}@t.local`
      const password = 'Tecnico1234'
      const user = await page.request.post('/api/users', {
        data: { name: 'Técnico E2E', email, password, role: 'tecnico' },
      })
      expect(user.ok()).toBe(true)

      const tecnicoContext = await browser.newContext()
      const tecnicoPage = await tecnicoContext.newPage()
      const tecnicoErrors = trackConsoleErrors(tecnicoPage)
      await login(tecnicoPage, { email, password })
      await tecnicoPage.goto(`/trabajos/${created.id}/imprimir`)

      await expect(tecnicoPage.getByTestId('rotulo-copia')).toHaveText(['Copia laboratorio'])
      await expect(tecnicoPage.getByRole('tab')).toHaveCount(0)
      await expect(tecnicoPage.getByText('Copia clínica')).toHaveCount(0)
      // Dentro de la orden: `getByText` en toda la página también cuenta texto oculto que no
      // es de la orden (scripts en línea del documento).
      const orden = tecnicoPage.getByRole('article')
      await expect(orden).toHaveCount(1)
      await expect(orden.getByText(/\$/)).toHaveCount(0)
      await expect(orden.getByText(/Total/)).toHaveCount(0)
      expect(tecnicoErrors).toEqual([])
      await tecnicoContext.close()
    },
  )
})
