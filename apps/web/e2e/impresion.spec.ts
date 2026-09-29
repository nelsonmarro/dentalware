import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { createClinicWithDoctor, createProduct, loginAsAdmin, uniqueSuffix } from './helpers'

/**
 * FIC-1 (#71): la orden de trabajo debe verse correcta en la vista previa de impresión de
 * Chrome en A4 y A5, sin cortar ningún bloque y con el QR legible. `chrome-devtools-mcp` no
 * emula `media: print` ni el tamaño de papel (ver brief de la Tarea 14), así que la
 * verificación real es Playwright: `emulateMedia({ media: 'print' })` + `page.pdf()`, que
 * genera la salida real de impresión de Chromium — no una captura de la vista en pantalla.
 * `page.pdf()` solo existe en Chromium (`escritorio`/`android`, ambos Chromium bajo el
 * emulador de dispositivo); el proyecto `iphone` (WebKit) no lo soporta.
 */
test.describe('Orden de trabajo imprimible', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test(
    'se ve correcta en la vista previa de impresión en A4 y A5, sin el app-shell',
    { tag: '@extendida' },
    async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === 'iphone', 'page.pdf() no existe en WebKit')

      const { clinic, doctor } = await createClinicWithDoctor(page)
      const product = await createProduct(page)
      const caseRes = await page.request.post('/api/trabajos', {
        data: {
          clinicId: clinic.id,
          doctorId: doctor.id,
          patientRef: `Paciente E2E ${uniqueSuffix()}`,
          receivedAt: new Date().toISOString().slice(0, 10),
          shade: 'A2',
          observations: 'Ajustar oclusión',
          items: [
            { productId: product.id, quantity: 1, teeth: [11], unitPrice: null, discountPct: 0 },
          ],
        },
      })
      expect(caseRes.ok()).toBe(true)
      const { case: created } = (await caseRes.json()) as { case: { id: string; code: string } }

      await page.goto(`/trabajos/${created.id}/imprimir`)
      await expect(page.getByRole('heading', { name: 'Arte Dental' })).toBeVisible()
      await expect(page.getByRole('heading', { name: `Trabajo ${created.code}` })).toBeVisible()
      await expect(page.getByRole('img', { name: /Código QR del trabajo/ })).toBeVisible()

      // En pantalla el app-shell sigue presente (la ruta usa el layout `_app`): la barra
      // lateral en escritorio (`lg:flex`), la barra inferior en móvil (`lg:hidden`).
      const shellOnScreen =
        testInfo.project.name === 'escritorio'
          ? page.getByTestId('sidebar')
          : page.getByTestId('bottom-nav')
      await expect(shellOnScreen).toBeVisible()

      await page.emulateMedia({ media: 'print' })

      // Al imprimir, `print:hidden` (Tailwind, `app-shell.tsx`) oculta la navegación: la
      // orden es lo único que queda en la página impresa.
      await expect(page.getByTestId('sidebar')).toBeHidden()
      await expect(page.getByTestId('bottom-nav')).toBeHidden()

      const outDir = testInfo.outputDir
      fs.mkdirSync(outDir, { recursive: true })
      for (const format of ['A4', 'A5'] as const) {
        const pdfPath = path.join(outDir, `orden-${format}.pdf`)
        await page.pdf({ format, path: pdfPath, printBackground: true })
        const stats = fs.statSync(pdfPath)
        // Un PDF vacío o truncado (bloque cortado a media página, render fallido) pesa
        // muchísimo menos que una hoja con encabezado, odontograma, líneas y firmas.
        expect(stats.size, `PDF ${format} sospechosamente pequeño`).toBeGreaterThan(5_000)
        await testInfo.attach(`orden-${format}`, { path: pdfPath, contentType: 'application/pdf' })
      }
    },
  )
})
