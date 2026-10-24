import type { Locator, Page, TestInfo } from '@playwright/test'
import { captura } from './helpers'
import { expect, test } from './fixtures'

/** Capturas de la sección «Administración» del manual, con la sesión del admin de
 * `apps/api/.env.test`. Ninguna cambia datos: los formularios de configuración se abren, se
 * capturan y se cierran con «Cancelar» (su botón de cerrar), y los diálogos de las cuentas y
 * «Bloquear», con «Volver»; los que se rellenan nunca se envían. «Nuevo usuario» se captura vacío:
 * nunca se escribe una contraseña. La importación solo valida (sin `confirmar`, la API no crea
 * nada) y nunca pulsa «Importar N trabajos». */
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

/** Abre el diálogo de la cuenta por su botón y lo busca por su título: el desplegable de
 * «Trabajo» (un `Combobox`) también es un `dialog`, montado aunque esté cerrado. */
async function abrirDeCuenta(page: Page, boton: string | RegExp, titulo: string) {
  await page.getByRole('button', { name: boton }).click()
  const dialogo = await listo(page.getByRole('dialog', { name: titulo }))
  await sinFoco(page)
  return dialogo
}

/** Lleva el cuerpo desplazable del diálogo a su principio o a su final. En el teléfono no cabe
 * entero: al escribir en el último campo se queda abajo y esconde el primero («Tipo»). */
const desplazar = (dialogo: Locator, hacia: 'principio' | 'final') =>
  dialogo.evaluate((el, final) => {
    for (const hijo of el.querySelectorAll<HTMLElement>('*')) {
      if (!['auto', 'scroll'].includes(getComputedStyle(hijo).overflowY)) continue
      hijo.scrollTop = final ? hijo.scrollHeight : 0
    }
  }, hacia === 'final')

/** Cierra con «Volver»: nunca se confirma nada desde un spec. */
async function volver(dialogo: Locator) {
  await dialogo.getByRole('button', { name: 'Volver' }).click()
  await expect(dialogo).toHaveCount(0)
}

/** La cuenta de una clínica de demostración, desde la lista «Cuentas». */
async function abrirCuenta(page: Page, clinica: string) {
  await page.goto('/cuentas')
  await page.getByRole('link', { name: clinica }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: clinica })).toBeVisible()
}

test('ajustes y anular pagos', async ({ page }, testInfo) => {
  // Una ventana algo más alta: el diálogo (90 % del alto) cabe entero, con su aviso al pie.
  await page.setViewportSize(
    esTelefono(testInfo) ? { width: 412, height: 915 } : { width: 1280, height: 1000 },
  )
  await abrirCuenta(page, 'Clínica Sonrisa Norte')

  // Un descuento de $ 40.00 a «S. L.», que debe $ 35.00 y ya tiene $ 60.00 pagados: $ 5.00
  // vuelven al saldo a favor, y el diálogo lo dice antes de confirmar.
  const ajuste = await abrirDeCuenta(page, 'Registrar ajuste', 'Registrar ajuste')
  await ajuste.getByRole('button', { name: 'Descuento o nota de crédito' }).click()
  await ajuste.getByLabel('Monto', { exact: true }).fill('40.00')
  await ajuste.getByRole('combobox', { name: 'Trabajo' }).click()
  await page.getByRole('option', { name: /S\. L\./ }).click()
  await ajuste.getByLabel('Motivo').fill('Descuento acordado por el retraso de la entrega')
  await expect(
    ajuste.getByText('de lo ya pagado por este trabajo vuelven al saldo a favor.'),
  ).toBeVisible()
  await sinFoco(page)
  await desplazar(ajuste, 'principio')
  await captura(page, 'administracion/registrar-ajuste', ajuste, { testInfo, ...DIALOGO })
  await volver(ajuste)

  // «Saldo inicial» rellena el tipo, el trabajo y el motivo; el monto lo escribe el admin.
  const inicial = await abrirDeCuenta(page, 'Registrar ajuste', 'Registrar ajuste')
  await inicial.getByRole('button', { name: 'Saldo inicial' }).click()
  await inicial.getByLabel('Monto', { exact: true }).fill('120.00')
  await expect(inicial.getByRole('button', { name: 'Recargo' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(inicial.getByLabel('Motivo')).toHaveValue('Saldo inicial')
  await sinFoco(page)
  // En el teléfono, hasta el final: el «Recargo» elegido, «Sin trabajo» y el motivo.
  await desplazar(inicial, esTelefono(testInfo) ? 'final' : 'principio')
  await captura(page, 'administracion/saldo-inicial', inicial, { testInfo, ...DIALOGO })
  await volver(inicial)

  await page.getByRole('tab', { name: 'Movimientos' }).click()
  const anular = await abrirDeCuenta(page, /^Anular pago de /, 'Anular pago')
  await expect(anular.getByText(/^Se quita lo aplicado a /)).toBeVisible()
  await anular.getByLabel('Motivo').fill('Se registró con el monto equivocado')
  await sinFoco(page)
  await captura(page, 'administracion/anular-pago', anular, { testInfo, ...DIALOGO })
  await volver(anular)
})

/** Un CSV de trabajos con la cabecera de la plantilla (`IMPORT_COLUMNS` de shared). */
const csv = (...filas: string[]) =>
  Buffer.from(
    [
      'clinica,doctor,paciente,producto,piezas,cantidad,color,fecha_deseada,caja,observaciones',
      ...filas,
    ].join('\n'),
  )

test('importar trabajos', async ({ page }, testInfo) => {
  await page.goto('/trabajos')
  await expect(page.getByRole('heading', { level: 1, name: 'Trabajos' })).toBeVisible()
  await page.getByRole('main').getByRole('button', { name: 'Importar', exact: true }).click()
  const dialogo = await listo(page.getByRole('dialog'))
  await expect(dialogo.getByRole('link', { name: 'Descargar plantilla' })).toBeVisible()
  await sinFoco(page)
  // El diálogo ancho ocupa en el teléfono casi todo el ancho: allí, 8 px de margen.
  await captura(page, 'administracion/importar-dialogo', dialogo, {
    testInfo,
    margen: esTelefono(testInfo) ? 8 : DIALOGO.margen,
  })
  if (esTelefono(testInfo)) {
    await cancelar(page)
    return
  }

  // Validar no crea nada: un archivo con errores muestra la tabla de fila, columna y mensaje.
  const archivo = dialogo.getByLabel('Archivo CSV')
  await archivo.setInputFiles({
    name: 'trabajos.csv',
    mimeType: 'text/csv',
    buffer: csv(
      'Clínica Sonrisa Norte,Dra. Valeria Andrade,R. P.,ZR,"11,21",1,A2,30/10/2026,C-014,',
      'Centro Dental Los Álamos,Dr. Tomás Herrera,F. C.,MP,36,1,A3,30/10/2026,,',
      'Clínica Ejemplo Sur,Dr. Rafael Mena,H. N.,ZR,14,1,,,,',
      'Centro Dental Los Álamos,Dr. Rafael Mena,O. E.,ZR,19,1,,31/02/2026,,',
    ),
  })
  await dialogo.getByRole('button', { name: 'Validar' }).click()
  await expect(dialogo.getByRole('table')).toBeVisible()
  // El puntero se queda sobre el botón del pie, que saldría en su color de `hover`.
  await page.mouse.move(0, 0)
  await sinFoco(page)
  await captura(page, 'administracion/importar-errores', dialogo, {
    testInfo,
    solo: 'escritorio',
    ...DIALOGO,
  })

  // Corregido, «Validar» dice cuántos trabajos saldrán y ofrece importarlos (no se pulsa).
  await archivo.setInputFiles({
    name: 'trabajos.csv',
    mimeType: 'text/csv',
    buffer: csv(
      'Clínica Sonrisa Norte,Dra. Valeria Andrade,R. P.,ZR,"11,21",1,A2,30/10/2026,C-014,',
      'Clínica Sonrisa Norte,Dra. Valeria Andrade,R. P.,MP,36,1,A3,30/10/2026,C-014,',
      'Centro Dental Los Álamos,Dr. Rafael Mena,O. E.,ZR,15,1,,30/10/2026,,',
    ),
  })
  await dialogo.getByRole('button', { name: 'Validar' }).click()
  await expect(dialogo.getByRole('button', { name: 'Importar 2 trabajos' })).toBeVisible()
  await page.mouse.move(0, 0)
  await sinFoco(page)
  await captura(page, 'administracion/importar-listo', dialogo, {
    testInfo,
    solo: 'escritorio',
    ...DIALOGO,
  })
  await cancelar(page)
})
