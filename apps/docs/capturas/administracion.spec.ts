import type { Locator, Page, TestInfo } from '@playwright/test'
import { captura } from './helpers'
import { expect, test } from './fixtures'

/** Capturas de la sección «Administración» del manual (configuración), con la sesión del admin de
 * `apps/api/.env.test`. Ninguna cambia datos: los formularios se abren, se capturan y se cierran
 * con «Cancelar» (el botón de cerrar de los formularios de configuración), y «Bloquear» se abre y
 * se cierra con «Volver». «Nuevo usuario» se captura vacío: nunca se escribe una contraseña. */
test.use({ rol: 'admin' })

const esTelefono = (testInfo: TestInfo) => testInfo.project.name === 'telefono'

/** Margen alrededor de un diálogo: el recorte deja ver el fondo oscurecido en vez de las
 * esquinas redondeadas sobre la página de detrás. */
const DIALOGO = { margen: 16 } as const

/** Quita el foco del campo que el diálogo enfocó al abrirse: su anillo de foco no es parte de lo
 * que se explica. Dentro de un diálogo, el foco pasa al propio diálogo. */
const sinFoco = (page: Page) =>
  page.evaluate(() => {
    const dialogo = document.querySelector<HTMLElement>('[role=dialog], [role=alertdialog]')
    if (dialogo) dialogo.focus()
    else (document.activeElement as HTMLElement | null)?.blur()
  })

/** Espera a que el diálogo termine de entrar (a mitad del `zoom-in-95` sale recortado). */
async function listo(dialogo: Locator) {
  await expect(dialogo).toBeVisible()
  await dialogo.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
  )
  return dialogo
}

/** Abre el formulario del botón (por su nombre exacto) y lo deja listo para capturar. */
async function abrirFormulario(page: Page, boton: string) {
  await page.getByRole('main').getByRole('button', { name: boton, exact: true }).click()
  const dialogo = await listo(page.getByRole('dialog'))
  await sinFoco(page)
  return dialogo
}

/** Cierra un formulario de configuración con «Cancelar»: nunca se guarda nada desde un spec. */
async function cancelar(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

/** Abre una pantalla de configuración y espera a su título y a un dato propio. */
async function abrir(page: Page, ruta: string, titulo: string, dato: string | RegExp) {
  await page.goto(ruta)
  await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible()
  await expect(page.getByRole('main').getByText(dato, { exact: true }).first()).toBeVisible()
}

/** La pantalla tal como se abre: en el teléfono, con la barra de abajo. */
const pantalla = (page: Page, esperar: Locator) => ({ pagina: true as const, esperar })

test('laboratorio', async ({ page }, testInfo) => {
  await abrir(
    page,
    '/configuracion/laboratorio',
    'Laboratorio',
    'Datos que aparecen en las fichas impresas y en los avisos a las clínicas.',
  )
  const formulario = page.getByRole('main').locator('form')
  await expect(formulario.getByLabel('Nombre del laboratorio')).toHaveValue('Laboratorio Demo')
  await captura(page, 'administracion/laboratorio-formulario', formulario, {
    testInfo,
    solo: 'escritorio',
  })
})

test('clínicas y doctores', async ({ page }, testInfo) => {
  await abrir(page, '/configuracion/clinicas', 'Clínicas', 'Consultorio Dra. Paredes')
  await captura(
    page,
    'administracion/clinicas-lista',
    pantalla(page, page.getByRole('main').getByText('Clínica Sonrisa Norte').first()),
    { testInfo },
  )

  const nueva = await abrirFormulario(page, 'Nueva clínica')
  await expect(nueva.getByRole('heading', { name: 'Nueva clínica' })).toBeVisible()
  await captura(page, 'administracion/clinica-formulario', nueva, { testInfo, ...DIALOGO })
  await cancelar(page)

  await page.getByRole('main').getByRole('link', { name: 'Clínica Sonrisa Norte' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Clínica Sonrisa Norte' })).toBeVisible()
  const doctores = page.getByRole('tabpanel', { name: 'Doctores' })
  await expect(doctores.getByText('Dra. Valeria Andrade').first()).toBeVisible()
  await page.mouse.move(0, 0)
  await captura(page, 'administracion/clinica-ficha', pantalla(page, doctores), { testInfo })

  const doctor = await abrirFormulario(page, 'Nuevo doctor')
  await expect(doctor.getByRole('heading', { name: 'Nuevo doctor' })).toBeVisible()
  await captura(page, 'administracion/doctor-formulario', doctor, { testInfo, ...DIALOGO })
  await cancelar(page)

  await page.getByRole('tab', { name: 'Precios especiales' }).click()
  const precios = page.getByRole('tabpanel', { name: 'Precios especiales' })
  await expect(precios.getByLabel('Precio especial de Zirconio')).toHaveValue('95.00')
  await captura(
    page,
    'administracion/precio-por-clinica',
    esTelefono(testInfo) ? pantalla(page, precios) : precios,
    { testInfo },
  )
})

test('productos y precios', async ({ page }, testInfo) => {
  await abrir(page, '/configuracion/productos', 'Productos y precios', 'Metal porcelana')
  await captura(
    page,
    'administracion/productos-lista',
    pantalla(page, page.getByRole('main').getByText('Acrílico', { exact: true }).first()),
    { testInfo },
  )

  // El formulario con datos: el de Metal porcelana, que se cobra por pieza y requiere prueba.
  await page.getByRole('button', { name: 'Editar Metal porcelana' }).click()
  const producto = await listo(page.getByRole('dialog'))
  await expect(producto.getByLabel('Nombre')).toHaveValue('Metal porcelana')
  await sinFoco(page)
  await captura(page, 'administracion/producto-formulario', producto, { testInfo, ...DIALOGO })
  await cancelar(page)

  await page.getByRole('tab', { name: 'Categorías' }).click()
  const categorias = page.getByRole('tabpanel', { name: 'Categorías' })
  await expect(categorias.getByText('Prótesis removible')).toBeVisible()
  await captura(page, 'administracion/categorias-lista', categorias, {
    testInfo,
    solo: 'escritorio',
  })
})

test('fases', async ({ page }, testInfo) => {
  // En el teléfono, cada tarjeta lleva el número delante: «7. Control de calidad».
  await abrir(page, '/configuracion/fases', 'Fases de producción', /Control de calidad$/)
  await captura(
    page,
    'administracion/fases-lista',
    pantalla(
      page,
      page
        .getByRole('main')
        .getByText(/Diseño$/)
        .first(),
    ),
    { testInfo },
  )

  await page.getByRole('button', { name: 'Editar Diseño' }).click()
  const fase = await listo(page.getByRole('dialog'))
  await expect(fase.getByLabel('Nombre')).toHaveValue('Diseño')
  await sinFoco(page)
  await captura(page, 'administracion/fase-formulario', fase, { testInfo, ...DIALOGO })
  await cancelar(page)
})

test('usuarios', async ({ page }, testInfo) => {
  await abrir(page, '/configuracion/usuarios', 'Usuarios', 'Marco Mensajero')
  await captura(
    page,
    'administracion/usuarios-lista',
    pantalla(page, page.getByRole('main').getByText('Carla Recepción').first()),
    { testInfo },
  )

  // Vacío: la contraseña nunca se escribe.
  const usuario = await abrirFormulario(page, 'Nuevo usuario')
  await expect(usuario.getByLabel('Contraseña')).toHaveValue('')
  await captura(page, 'administracion/usuario-formulario', usuario, { testInfo, ...DIALOGO })
  await cancelar(page)

  // «Bloquear» confirma con un `alertdialog`, que se cierra con «Volver».
  await page
    .getByRole('main')
    .getByRole('row')
    .or(page.getByRole('main').getByRole('listitem'))
    .filter({ hasText: 'Lucía Mensajera' })
    .getByRole('button', { name: 'Bloquear', exact: true })
    .click()
  const bloquear = await listo(page.getByRole('alertdialog'))
  await captura(page, 'administracion/usuario-bloquear', bloquear, { testInfo, ...DIALOGO })
  await bloquear.getByRole('button', { name: 'Volver' }).click()
  await expect(bloquear).toHaveCount(0)
})
