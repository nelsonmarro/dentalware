import { join } from 'node:path'
import type { Locator, Page } from '@playwright/test'
import { abrirDialogo, captura, cerrarDialogo } from './helpers'
import { expect, test } from './fixtures'

/** Capturas de la sección «Mensajero» del manual, con la sesión de Marco Mensajero: su ruta del
 * martes 20 (la recogida de «M. P.», la de «T. W.» ya recogida, el envío de «D. F.» y la entrega
 * de «G. H.» que no se pudo hacer y se reprogramó para hoy). Ninguna cambia datos: «Recogido»
 * no se toca (la recogida en camino la deja así el seed) y los diálogos de «Marcar entregado» y
 * «No se pudo» se abren, se capturan y se cierran con «Volver» (la foto de la constancia solo se
 * sube al confirmar, UX4-06). */
test.use({ rol: 'mensajero' })

/** La misma foto de prueba que usan los E2E de entregas (`apps/web/e2e/fixtures/foto.png`). */
const FOTO = join(__dirname, '..', '..', 'web', 'e2e', 'fixtures', 'foto.png')

/** Margen alrededor de un diálogo: el recorte deja ver el fondo oscurecido en vez de las
 * esquinas redondeadas sobre la página de detrás. */
const DIALOGO = { margen: 16 } as const

/** La parada de una clínica en «Entregas»: su `region`, con el nombre de la clínica. */
const parada = (page: Page, clinica: string) => page.getByRole('region', { name: clinica })

/** La tarjeta de un trabajo dentro de una parada (un `li` por recogida o entrega). */
const tarjeta = (zona: Locator, paciente: string) =>
  zona.getByRole('listitem').filter({ hasText: paciente })

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

async function abrirEntregas(page: Page) {
  await page.goto('/entregas')
  await expect(page.getByRole('heading', { name: 'Entregas', level: 1 })).toBeVisible()
  await expect(parada(page, 'Clínica Sonrisa Norte')).toBeVisible()
}

test('entregas del día', async ({ page }, testInfo) => {
  await abrirEntregas(page)
  // En el teléfono, la pantalla tal cual se abre; en escritorio, el día entero (`main`): las
  // tres paradas con la entrega reprogramada, la fallida, la recogida, el envío y lo en camino.
  await captura(
    page,
    'mensajero/entregas-del-dia',
    testInfo.project.name === 'telefono'
      ? { pagina: true, esperar: parada(page, 'Centro Dental Los Álamos') }
      : page.getByRole('main'),
    { testInfo },
  )

  // La parada de Clínica Sonrisa Norte: la dirección (mapa), el teléfono, la recogida de «M. P.»
  // con «Recogido» y «No se pudo», y el envío de «D. F.».
  const norte = parada(page, 'Clínica Sonrisa Norte')
  const recogido = tarjeta(norte, 'M. P.').getByRole('button', { name: 'Recogido' })
  await expect(recogido).toBeVisible()
  await captura(page, 'mensajero/tarjeta-recogida', await centrado(norte), {
    testInfo,
    solo: 'telefono',
    margen: 8,
  })
  // Solo el botón, sin tocarlo.
  await captura(page, 'mensajero/recogido-boton', await centrado(recogido), {
    testInfo,
    solo: 'telefono',
  })

  // Ya recogida y aún sin llegar al laboratorio: «En camino al laboratorio».
  const enCamino = tarjeta(parada(page, 'Consultorio Dra. Paredes'), 'T. W.')
  await expect(enCamino.getByText('Recogido por Marco Mensajero a las 10:30')).toBeVisible()
  await captura(page, 'mensajero/en-camino', await centrado(enCamino), {
    testInfo,
    solo: 'telefono',
    margen: 8,
  })
})

test('marcar entregado', async ({ page }, testInfo) => {
  await abrirEntregas(page)
  // La ficha corta del envío de «D. F.»: el código de la tarjeta la abre.
  const envio = tarjeta(parada(page, 'Clínica Sonrisa Norte'), 'D. F.')
  const codigo = (await envio.getByRole('link').textContent()) ?? ''
  await envio.getByRole('link').click()
  await expect(page.getByRole('heading', { level: 1, name: codigo })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Marcar entregado' })).toBeVisible()
  await page.mouse.move(0, 0)
  // El contenido de la ficha corta, sin el vacío que queda debajo hasta la barra de abajo.
  await captura(
    page,
    'mensajero/ficha-corta',
    page.getByRole('main').locator(':scope > *').first(),
    {
      testInfo,
      solo: 'telefono',
      margen: 16,
    },
  )

  // El diálogo con la foto ya elegida (miniatura local): nada se sube hasta confirmar.
  const dialogo = await abrirDialogo(page, 'Marcar entregado')
  await dialogo.getByLabel('Foto de constancia').setInputFiles(FOTO)
  await expect(dialogo.getByRole('img', { name: 'Foto de constancia' })).toBeVisible()
  await expect(dialogo.getByRole('button', { name: 'Marcar entregado' })).toBeEnabled()
  await sinFoco(page)
  await captura(page, 'mensajero/marcar-entregado-dialogo', dialogo, { testInfo, ...DIALOGO })
  await cerrarDialogo(page)
})

test('no se pudo', async ({ page }, testInfo) => {
  await abrirEntregas(page)
  // «No se pudo» en el envío de «D. F.», con un motivo frecuente elegido (sin reprogramar).
  const envio = tarjeta(parada(page, 'Clínica Sonrisa Norte'), 'D. F.')
  await envio.getByRole('button', { name: 'No se pudo' }).click()
  const dialogo = page.getByRole('dialog', { name: 'No se pudo entregar' })
  await expect(dialogo).toBeVisible()
  await dialogo.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
  )
  await dialogo.getByRole('button', { name: 'Nadie para recibir' }).click()
  await expect(dialogo.getByRole('textbox', { name: 'Motivo' })).toHaveValue('Nadie para recibir')
  await sinFoco(page)
  await captura(page, 'mensajero/no-se-pudo-dialogo', dialogo, { testInfo, ...DIALOGO })
  await cerrarDialogo(page)

  // La entrega de «G. H.» que no se pudo hacer: fallida, con el motivo y la nueva fecha.
  const fallida = tarjeta(parada(page, 'Centro Dental Los Álamos'), 'G. H.').filter({
    hasText: 'Motivo:',
  })
  await captura(page, 'mensajero/entrega-fallida', await centrado(fallida), {
    testInfo,
    solo: 'telefono',
    margen: 8,
  })
})

test('sin señal', async ({ page, context }, testInfo) => {
  await abrirEntregas(page)
  await context.setOffline(true)
  try {
    // La pantalla entera: el aviso sale arriba, sobre la ruta del día, que sigue a la vista.
    const aviso = page
      .getByRole('status')
      .filter({ hasText: 'Sin conexión: lo que marques se enviará al volver la señal' })
    await captura(
      page,
      'mensajero/sin-senal',
      { pagina: true, esperar: aviso },
      { testInfo, solo: 'telefono' },
    )
  } finally {
    await context.setOffline(false)
  }
})
