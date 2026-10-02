import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import {
  createClinicWithDoctor,
  createProduct,
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
 */
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
    'una orden de 4 líneas cabe en una página en A4 y en A5, con el odontograma en dos filas',
    { tag: '@clave' },
    async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === 'iphone', 'page.pdf() no existe en WebKit')

      const { clinic, doctor } = await createClinicWithDoctor(page)
      const product = await createProduct(page)
      // Cuatro líneas (el límite del ruling) con una pieza en cada esquina del odontograma:
      // 18/28 (superior) y 48/38 (inferior) son las piezas de los extremos de cada arcada — si
      // el odontograma envolviera a dos filas por arcada, dejarían de compartir fila con su par.
      const caseRes = await page.request.post('/api/trabajos', {
        data: {
          clinicId: clinic.id,
          doctorId: doctor.id,
          patientRef: `Paciente E2E ${uniqueSuffix()}`,
          receivedAt: new Date().toISOString().slice(0, 10),
          dueDate: '2026-12-31',
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
      const { case: created } = (await caseRes.json()) as { case: { id: string; code: string } }

      await page.goto(`/trabajos/${created.id}/imprimir`)
      await expect(page.getByRole('heading', { name: 'Arte Dental' })).toBeVisible()
      await expect(
        page.getByRole('heading', { name: `Orden de trabajo ${created.code}` }),
      ).toBeVisible()
      await expect(page.getByRole('img', { name: /Código QR del trabajo/ })).toBeVisible()

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
      // (inferior). Se mide antes de generar el PDF: `page.pdf()` no expone layout, así que la
      // comprobación de filas se hace sobre el DOM emulado en pantalla con `media: print`.
      await page.setViewportSize({ width: 480, height: 900 })
      await page.emulateMedia({ media: 'print' })

      // `print:hidden` (Tailwind, `app-shell.tsx`) oculta la navegación al imprimir: la orden
      // es lo único que queda en la página impresa.
      await expect(page.getByTestId('sidebar')).toBeHidden()
      await expect(page.getByTestId('bottom-nav')).toBeHidden()

      const box18 = await page.getByTestId('pieza-18').boundingBox()
      const box28 = await page.getByTestId('pieza-28').boundingBox()
      const box48 = await page.getByTestId('pieza-48').boundingBox()
      const box38 = await page.getByTestId('pieza-38').boundingBox()
      expect(box18, 'pieza 18 sin boundingBox').not.toBeNull()
      expect(box28, 'pieza 28 sin boundingBox').not.toBeNull()
      expect(box48, 'pieza 48 sin boundingBox').not.toBeNull()
      expect(box38, 'pieza 38 sin boundingBox').not.toBeNull()
      expect(
        box18!.y,
        `arcada superior en dos filas: 18 (y=${box18!.y}) y 28 (y=${box28!.y}) no comparten fila`,
      ).toBeCloseTo(box28!.y, 0)
      expect(
        box48!.y,
        `arcada inferior en dos filas: 48 (y=${box48!.y}) y 38 (y=${box38!.y}) no comparten fila`,
      ).toBeCloseTo(box38!.y, 0)

      const outDir = testInfo.outputDir
      fs.mkdirSync(outDir, { recursive: true })
      for (const format of ['A4', 'A5'] as const) {
        const pdfPath = path.join(outDir, `orden-${format}.pdf`)
        // `printBackground: false` es lo que imprime recepción con Ctrl+P: Chrome trae
        // «Gráficos de fondo» desactivado por defecto (I-1). Con `printBackground: true` la
        // marca de pieza (antes solo `bg-foreground text-background`) quedaba invisible sin que
        // este test lo notara — la ronda anterior probó con fondo activo y no lo vio.
        await page.pdf({ format, path: pdfPath, printBackground: false })
        const stats = fs.statSync(pdfPath)
        // Un PDF vacío o truncado (bloque cortado a media página, render fallido) pesa
        // muchísimo menos que una hoja con encabezado, odontograma, líneas y firmas.
        expect(stats.size, `PDF ${format} sospechosamente pequeño`).toBeGreaterThan(5_000)

        // K-4: cuenta de páginas por objeto `/Type /Page` del PDF (sin contar `/Type /Pages`,
        // el nodo padre del árbol de páginas — el límite de palabra tras "Page" no matchea
        // antes de una "s", así que no hace falta una alternativa negativa explícita).
        const pdfText = fs.readFileSync(pdfPath).toString('latin1')
        const pageCount = (pdfText.match(/\/Type\s*\/Page\b/g) ?? []).length
        expect(pageCount, `PDF ${format}: ${pageCount} páginas (se esperaba 1)`).toBe(1)

        await testInfo.attach(`orden-${format}`, { path: pdfPath, contentType: 'application/pdf' })
      }
    },
  )
})
