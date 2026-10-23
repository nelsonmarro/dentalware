import type { Locator, Page, TestInfo } from '@playwright/test'
import { abrirDialogo, abrirTrabajo, captura, cerrarDialogo, pickSelectOption } from './helpers'
import { expect, test } from './fixtures'

/** Capturas de la sección «Recepción» del manual, una prueba por guía. Ninguna guarda nada: los
 * diálogos se abren, se capturan y se cierran con «Volver» (o «Cancelar» en el de las piezas,
 * que no es una acción); los formularios se rellenan sin enviarse. */

/** La cabecera de la ficha: la tarjeta que lleva el código como `h1`. */
const cabeceraFicha = (page: Page) =>
  page.locator('[data-slot=card]').filter({ has: page.getByRole('heading', { level: 1 }) })

/** La cuenta de una clínica de demostración, desde la lista «Cuentas». */
async function abrirCuenta(page: Page, clinica: string) {
  await page.goto('/cuentas')
  await page.getByRole('link', { name: clinica }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: clinica })).toBeVisible()
}

const esTelefono = (testInfo: TestInfo) => testInfo.project.name === 'telefono'

/** Quita el foco del campo recién usado: su anillo de foco no es parte de lo que se explica.
 * Dentro de un diálogo, el foco pasa al propio diálogo (su trampa de foco devolvería un `blur`
 * al último campo). */
const sinFoco = (page: Page) =>
  page.evaluate(() => {
    const dialogo = document.querySelector<HTMLElement>('[role=dialog], [role=alertdialog]')
    if (dialogo) dialogo.focus()
    else (document.activeElement as HTMLElement | null)?.blur()
  })

/** Centra el elemento en la ventana antes de capturarlo: en el teléfono, la barra de abajo es
 * fija y taparía lo que quede al pie (`captura` solo desplaza si el elemento no se ve). */
const centrado = async (objetivo: Locator) => {
  await objetivo.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  return objetivo
}

/** Margen alrededor de un diálogo: el recorte deja ver el fondo oscurecido en vez de las
 * esquinas redondeadas sobre la página de detrás. */
const DIALOGO = { margen: 16 } as const

test('crear un trabajo', async ({ page }, testInfo) => {
  await page.goto('/trabajos')
  await expect(page.getByRole('heading', { name: 'Trabajos', level: 1 })).toBeVisible()
  await captura(
    page,
    'recepcion/trabajos-lista',
    { pagina: true, esperar: page.getByRole('tab', { name: 'Todos' }) },
    { testInfo },
  )

  await page.getByRole('link', { name: 'Nuevo trabajo' }).click()
  await expect(page.getByRole('heading', { name: 'Nuevo trabajo', level: 1 })).toBeVisible()
  // La primera pantalla del formulario (qué falta para aceptar, clínica y paciente): el
  // formulario entero no cabe en una imagen legible.
  await captura(
    page,
    'recepcion/nuevo-trabajo-formulario',
    { pagina: true, esperar: page.getByRole('combobox', { name: 'Clínica' }) },
    { testInfo },
  )

  // Las piezas se marcan en una línea con un producto por pieza (zirconio).
  await page.getByRole('button', { name: 'Agregar línea' }).click()
  await page.getByRole('combobox', { name: 'Producto' }).click()
  await page.getByRole('option', { name: /^ZR/ }).click()
  await page.getByRole('button', { name: 'Piezas (0)' }).click()
  const piezas = page.getByRole('dialog')
  await piezas.getByRole('button', { name: /^11 ·/ }).click()
  await piezas.getByRole('button', { name: /^21 ·/ }).click()
  await expect(piezas.getByText('2 piezas')).toBeVisible()
  await piezas.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
  )
  // Es más ancho que los demás diálogos: en el teléfono solo deja 8 px a cada lado.
  await captura(page, 'recepcion/nuevo-trabajo-odontograma', piezas, { testInfo, margen: 8 })
  await piezas.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.getByRole('button', { name: 'Programar recogida' }).click()
  const recogida = page
    .locator('[data-slot=card]')
    .filter({ has: page.getByRole('button', { name: 'Programar recogida' }) })
  await pickSelectOption(
    page,
    recogida.getByRole('combobox', { name: 'Mensajero' }),
    'Marco Mensajero',
  )
  await sinFoco(page)
  await captura(page, 'recepcion/nuevo-trabajo-recogida', await centrado(recogida), { testInfo })
})

test('la ficha del trabajo', async ({ page }, testInfo) => {
  await abrirTrabajo(page, 'A. S.')
  await captura(page, 'recepcion/ficha-cabecera', await centrado(cabeceraFicha(page)), { testInfo })
  await captura(
    page,
    'recepcion/ficha-acciones',
    await centrado(page.getByRole('region', { name: 'Producción' })),
    {
      testInfo,
    },
  )
  // Los eventos del seed llevan la hora real de la máquina (`clock_timestamp()`), no la del reloj
  // fijo: el navegador se pone dos horas después del último, para que el historial diga «hace 2
  // horas» siempre, y no «dentro de 3 días» ni algo distinto en cada corrida.
  const caseId = page.url().split('/').pop()
  const ultimo = await page.evaluate(async (id) => {
    const res = await fetch(`/api/trabajos/${id}/eventos`, { credentials: 'include' })
    const { events } = (await res.json()) as { events: { createdAt: string }[] }
    return Math.max(...events.map((e) => new Date(e.createdAt).getTime()))
  }, caseId)
  await page.clock.setFixedTime(new Date(ultimo + 2 * 60 * 60 * 1000))
  await page.reload()
  await page.getByRole('tab', { name: /^Historial/ }).click()
  await captura(
    page,
    'recepcion/ficha-historial',
    await centrado(page.getByRole('tabpanel', { name: /^Historial/ })),
    { testInfo },
  )

  // La foto de la constancia de entrega: solo los trabajos entregados la tienen.
  await abrirTrabajo(page, 'S. L.')
  await page.getByRole('tab', { name: /^Adjuntos/ }).click()
  const adjuntos = page.getByRole('tabpanel', { name: /^Adjuntos/ })
  await expect(adjuntos.getByRole('img').first()).toBeVisible()
  await captura(page, 'recepcion/ficha-adjuntos', await centrado(adjuntos), { testInfo })
})

test('estados y acciones', async ({ page }, testInfo) => {
  await page.goto('/trabajos?vista=todos')
  if (esTelefono(testInfo)) {
    // En el teléfono, la lista son tarjetas: la pantalla con las primeras, cada una con su chip.
    const tarjetas = page.getByRole('main').getByRole('list')
    await tarjetas.evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await captura(
      page,
      'recepcion/estados-chips',
      { pagina: true, esperar: tarjetas },
      { testInfo },
    )
  } else {
    await captura(page, 'recepcion/estados-chips', page.getByRole('table'), { testInfo })
  }

  await abrirTrabajo(page, 'A. S.')
  const pausar = await abrirDialogo(page, 'Pausar')
  await captura(page, 'recepcion/accion-pausar', pausar, { testInfo, ...DIALOGO })
  await cerrarDialogo(page)

  // «Finalizar» confirma con un `alertdialog` (ConfirmDialog), que también cierra con «Volver».
  await page.getByRole('button', { name: 'Finalizar' }).click()
  const finalizar = page.getByRole('alertdialog')
  await expect(finalizar).toBeVisible()
  await finalizar.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
  )
  await captura(page, 'recepcion/accion-finalizar', finalizar, { testInfo, ...DIALOGO })
  await finalizar.getByRole('button', { name: 'Volver' }).click()
  await expect(finalizar).toHaveCount(0)
})

test('recogidas y entregas', async ({ page }, testInfo) => {
  await page.goto('/entregas')
  await captura(
    page,
    'recepcion/entregas-dia',
    { pagina: true, esperar: page.getByRole('heading', { name: 'Clínica Sonrisa Norte' }) },
    { testInfo },
  )

  // Un trabajo «Terminado»: «Marcar enviado» con el mensajero elegido (sin enviarlo).
  await abrirTrabajo(page, 'P. Q.')
  const envio = await abrirDialogo(page, 'Marcar enviado')
  await pickSelectOption(
    page,
    envio.getByRole('combobox', { name: 'Mensajero' }),
    'Marco Mensajero',
  )
  await sinFoco(page)
  await captura(page, 'recepcion/accion-marcar-enviado', envio, { testInfo, ...DIALOGO })
  await cerrarDialogo(page)

  // Recogido por el mensajero y aún «Por recoger»: en camino al laboratorio, con «Recibido».
  await abrirTrabajo(page, 'T. W.')
  await captura(
    page,
    'recepcion/ficha-recibido',
    await centrado(page.getByRole('region', { name: 'Recogida' })),
    {
      testInfo,
    },
  )
})

test('cuentas y pagos', async ({ page }, testInfo) => {
  await page.goto('/cuentas')
  await expect(page.getByRole('heading', { name: 'Cuentas', level: 1 })).toBeVisible()
  // En el teléfono, las tarjetas no caben enteras: la pantalla tal cual se ve.
  await captura(
    page,
    'recepcion/cuentas-lista',
    esTelefono(testInfo)
      ? { pagina: true, esperar: page.getByRole('link', { name: 'Clínica Sonrisa Norte' }) }
      : page.getByRole('main').locator(':scope > div'),
    { testInfo, margen: 16 },
  )

  await abrirCuenta(page, 'Clínica Sonrisa Norte')
  await captura(
    page,
    'recepcion/cuenta-cabecera',
    await centrado(page.getByRole('region', { name: 'Saldo' })),
    {
      testInfo,
    },
  )

  // En escritorio, con una ventana algo más alta el diálogo cabe entero, sin desplazar su cuerpo
  // (se cortaría el rótulo de los primeros campos). Va después de las capturas de la cuenta.
  if (!esTelefono(testInfo)) await page.setViewportSize({ width: 1280, height: 1000 })
  const pago = await abrirDialogo(page, 'Registrar pago')
  // Un pago de $ 100.00 por transferencia: cubre «S. L.» y deja a «K. O.» debiendo.
  await pickSelectOption(page, pago.getByRole('combobox', { name: 'Método' }), 'Transferencia')
  await pago.getByLabel('Monto', { exact: true }).fill('100.00')
  await expect(pago.getByText('Queda cobrado')).toBeVisible()
  await sinFoco(page)
  // El cuerpo del diálogo se desplaza: se baja hasta el reparto, con las dos filas a la vista.
  await pago.getByText(/^Quedará debiendo/).scrollIntoViewIfNeeded()
  await captura(page, 'recepcion/registrar-pago', pago, { testInfo, ...DIALOGO })
  await cerrarDialogo(page)

  const aplicar = await abrirDialogo(page, /^Aplicar saldo a favor$/)
  await sinFoco(page)
  await captura(page, 'recepcion/aplicar-saldo', aplicar, { testInfo, ...DIALOGO })
  await cerrarDialogo(page)
})

test('avisar por whatsapp', async ({ page }, testInfo) => {
  await abrirTrabajo(page, 'A. S.')
  // El bloque del código, la clínica y el enlace, que dice a quién se avisa.
  const bloque = page.getByRole('heading', { level: 1 }).locator('xpath=../..')
  await expect(bloque.getByRole('link', { name: /^Avisar por WhatsApp a / })).toBeVisible()
  await captura(page, 'recepcion/whatsapp-boton', bloque, { testInfo })

  await abrirTrabajo(page, 'J. R.')
  const sinNumero = page.getByRole('heading', { level: 1 }).locator('xpath=../..')
  await expect(sinNumero.getByText('Sin WhatsApp registrado.')).toBeVisible()
  await captura(page, 'recepcion/whatsapp-sin-numero', sinNumero, { testInfo })
})

test('imprimir', async ({ page }, testInfo) => {
  await abrirTrabajo(page, 'A. S.')
  await page.getByRole('link', { name: 'Imprimir' }).click()
  await captura(
    page,
    'recepcion/imprimir-orden',
    {
      pagina: true,
      esperar: page.getByRole('heading', { name: 'Orden de trabajo 26-00004' }).first(),
    },
    { testInfo },
  )

  await abrirCuenta(page, 'Clínica Sonrisa Norte')
  await page.getByRole('link', { name: 'Estado de cuenta' }).click()
  await captura(
    page,
    'recepcion/estado-de-cuenta',
    { pagina: true, esperar: page.getByRole('heading', { level: 1, name: 'Estado de cuenta' }) },
    { testInfo },
  )
})
