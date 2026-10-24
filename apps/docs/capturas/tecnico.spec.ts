import type { Locator, Page, TestInfo } from '@playwright/test'
import { abrirDialogo, abrirTrabajo, captura, cerrarDialogo } from './helpers'
import { expect, test } from './fixtures'

/** Capturas de la sección «Técnico» del manual, con la sesión de Diego Técnico, que tiene
 * asignados los trabajos de demostración: «L. T.» (atrasado y en la última fase), «A. S.» (vence
 * hoy), «C. V.» (vence mañana, en Diseño), «R. M.» (en espera) y «E. G.» (en prueba). Ninguna
 * cambia datos: «Avanzar fase» no se toca y los diálogos de «Retroceder fase» y «Finalizar» se
 * abren, se capturan y se cierran con «Volver». De las fichas en espera y en prueba solo se
 * captura el panel: la cabecera dice «En espera desde …» con la fecha real del evento, que no
 * sigue al reloj fijo. */
test.use({ rol: 'tecnico' })

const esTelefono = (testInfo: TestInfo) => testInfo.project.name === 'telefono'

/** Margen alrededor de un diálogo: el recorte deja ver el fondo oscurecido en vez de las
 * esquinas redondeadas sobre la página de detrás. */
const DIALOGO = { margen: 16 } as const

/** El panel bajo la cabecera de la ficha: «Producción» mientras el trabajo se hace. */
const produccion = (page: Page) => page.getByRole('region', { name: 'Producción' })

/** Centra el elemento en la ventana antes de capturarlo: en el teléfono, la barra de abajo es
 * fija y taparía lo que quede al pie (`captura` solo desplaza si el elemento no se ve). */
const centrado = async (objetivo: Locator) => {
  await objetivo.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  return objetivo
}

/** Quita el foco del campo recién usado: su anillo de foco no es parte de lo que se explica.
 * Dentro de un diálogo, el foco pasa al propio diálogo. */
const sinFoco = (page: Page) =>
  page.evaluate(() => {
    const dialogo = document.querySelector<HTMLElement>('[role=dialog], [role=alertdialog]')
    if (dialogo) dialogo.focus()
    else (document.activeElement as HTMLElement | null)?.blur()
  })

test('mis trabajos', async ({ page }, testInfo) => {
  await page.goto('/')
  const mis = page
    .getByRole('main')
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Mis trabajos' }) })
  await expect(mis.getByRole('link').filter({ hasText: 'E. G.' })).toBeVisible()
  // Solo «Mis trabajos», con aire alrededor: con los contadores del laboratorio debajo, el
  // inicio no cabe en la ventana.
  await captura(page, 'tecnico/inicio-mis-trabajos', await centrado(mis), {
    testInfo,
    margen: 16,
  })

  await page.goto('/trabajos?vista=en_curso')
  await expect(page.getByRole('heading', { name: 'Trabajos', level: 1 })).toBeVisible()
  const lista = page
    .getByRole('main')
    .getByRole('row')
    .or(page.getByRole('main').getByRole('listitem'))
    .filter({ hasText: 'C. V.' })
  await expect(lista).toBeVisible()
  // En el teléfono, la barra de vistas abre desplazada hasta la elegida: se vuelve al principio.
  await page.getByRole('tablist').evaluate((el) => {
    for (let n: Element | null = el; n; n = n.parentElement) n.scrollLeft = 0
  })
  await captura(
    page,
    'tecnico/trabajos-lista-sin-precios',
    esTelefono(testInfo) ? { pagina: true, esperar: lista } : page.getByRole('table'),
    { testInfo },
  )
})

test('avanzar fase', async ({ page }, testInfo) => {
  await abrirTrabajo(page, 'C. V.')
  const panel = produccion(page)
  await expect(panel.getByText('Diseño', { exact: true })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Avanzar fase' })).toBeEnabled()
  await captura(page, 'tecnico/ficha-produccion', await centrado(panel), { testInfo })

  // «Retroceder fase» pide el motivo; se escribe uno, sin confirmarlo.
  const atras = await abrirDialogo(page, 'Retroceder fase')
  await atras.getByLabel('Motivo').fill('El color no coincide con la guía')
  await sinFoco(page)
  await captura(page, 'tecnico/avanzar-fase-motivo', atras, { testInfo, ...DIALOGO })
  await cerrarDialogo(page)

  // Adjuntos: «Añadir foto» abre la cámara del teléfono; no se sube nada.
  await page.getByRole('tab', { name: /^Adjuntos/ }).click()
  const adjuntos = page.getByRole('tabpanel', { name: /^Adjuntos/ })
  await expect(adjuntos.getByRole('button', { name: 'Añadir foto' })).toBeVisible()
  await captura(page, 'tecnico/ficha-adjuntos-anadir-foto', await centrado(adjuntos), {
    testInfo,
    solo: 'telefono',
    margen: 8,
  })
})

test('pruebas y espera', async ({ page }, testInfo) => {
  await abrirTrabajo(page, 'R. M.')
  const espera = produccion(page)
  await expect(espera.getByText(/^El trabajo está en espera/)).toBeVisible()
  await captura(page, 'tecnico/en-espera-panel', await centrado(espera), { testInfo })

  await abrirTrabajo(page, 'E. G.')
  const prueba = produccion(page)
  await expect(prueba.getByText(/^El trabajo está en una prueba en boca/)).toBeVisible()
  await captura(page, 'tecnico/en-prueba-panel', await centrado(prueba), { testInfo })
})

test('finalizar', async ({ page }, testInfo) => {
  // «L. T.» está en la última fase: «Finalizar» es el botón principal del panel.
  await abrirTrabajo(page, 'L. T.')
  const panel = produccion(page)
  await expect(
    panel.getByText('Es la última fase: termina el trabajo con «Finalizar».'),
  ).toBeVisible()
  await captura(page, 'tecnico/finalizar-ultima-fase', await centrado(panel), { testInfo })

  // «Finalizar» confirma con un `alertdialog` (ConfirmDialog), que también cierra con «Volver».
  await panel.getByRole('button', { name: 'Finalizar' }).click()
  const finalizar = page.getByRole('alertdialog')
  await expect(finalizar).toBeVisible()
  await finalizar.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
  )
  await captura(page, 'tecnico/finalizar-confirmacion', finalizar, { testInfo, ...DIALOGO })
  await finalizar.getByRole('button', { name: 'Volver' }).click()
  await expect(finalizar).toHaveCount(0)

  // La orden: el técnico solo tiene la copia del laboratorio, sin precios ni elección de copia.
  const codigo = (await page.getByRole('heading', { level: 1 }).textContent()) ?? ''
  expect(codigo).toMatch(/^\d{2}-\d{5}$/)
  await page.getByRole('link', { name: 'Imprimir' }).click()
  await expect(page.getByText('Copia laboratorio')).toBeVisible()
  // El puntero se queda sobre «Imprimir» de esta pantalla (el enlace estaba en el mismo sitio):
  // sin moverlo, sale en su color de `hover`.
  await page.mouse.move(0, 0)
  await captura(
    page,
    'tecnico/imprimir-laboratorio',
    {
      pagina: true,
      esperar: page.getByRole('heading', { name: `Orden de trabajo ${codigo}` }).first(),
    },
    { testInfo, solo: 'escritorio' },
  )
})
