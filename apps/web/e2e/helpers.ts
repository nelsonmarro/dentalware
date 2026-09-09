import { expect, type Locator, type Page } from '@playwright/test'

export const ADMIN = {
  email: process.env.ADMIN_EMAIL ?? 'admin@lab.local',
  password: process.env.ADMIN_PASSWORD ?? 'Admin12345!',
}

/**
 * Inicia sesión y espera a que la transición a `/` termine (encabezado «Inicio»
 * visible), no solo a que cambie la URL: TanStack Router actualiza la URL antes de
 * cargar la ruta, y un `page.goto` lanzado mientras esa carga sigue pendiente falla
 * en WebKit (proyecto iphone) con «Navigation … is interrupted by another
 * navigation to /».
 */
export async function login(page: Page, credentials: { email: string; password: string }) {
  await page.goto('/login')
  await page.getByLabel('Correo').fill(credentials.email)
  await page.getByLabel('Contraseña').fill(credentials.password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible()
}

export async function loginAsAdmin(page: Page) {
  await login(page, ADMIN)
}

/** Crea una clínica y un doctor únicos por API (sesión admin ya iniciada en `page`). */
export async function createClinicWithDoctor(page: Page) {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`

  const clinicRes = await page.request.post('/api/config/clinicas', {
    data: { name: `Clínica E2E ${suffix}` },
  })
  expect(clinicRes.ok()).toBe(true)
  const { clinic } = (await clinicRes.json()) as { clinic: { id: string; name: string } }

  const doctorRes = await page.request.post('/api/config/doctores', {
    data: { clinicId: clinic.id, name: `Dr. E2E ${suffix}` },
  })
  expect(doctorRes.ok()).toBe(true)
  const { doctor } = (await doctorRes.json()) as { doctor: { id: string; name: string } }

  return { clinic, doctor }
}

/** Crea un producto único "por pieza" por API, en la primera categoría existente. */
export async function createProduct(page: Page) {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`

  const categoriesRes = await page.request.get('/api/config/productos/categorias')
  expect(categoriesRes.ok()).toBe(true)
  const { categories } = (await categoriesRes.json()) as { categories: { id: string }[] }

  const productRes = await page.request.post('/api/config/productos', {
    data: {
      code: `E2E${suffix}`.slice(0, 20),
      name: `Producto E2E ${suffix}`,
      categoryId: categories[0]!.id,
      pricingUnit: 'por_pieza',
      basePrice: '25.00',
      turnaroundDays: 5,
      requiresTryIn: false,
    },
  })
  expect(productRes.ok()).toBe(true)
  const { product } = (await productRes.json()) as {
    product: { id: string; code: string; name: string }
  }
  return product
}

// Tolerancia de subpíxel: el DPR no entero del Pixel 7 emulado (2.625, ver
// `devices['Pixel 7'].deviceScaleFactor` de Playwright) redondea cada borde de la caja
// a un múltiplo de 1/2.625 ≈ 0.381 px de dispositivo al pintar. `getBoundingClientRect()`
// devuelve `bottom - top` ya con ese redondeo aplicado por separado a cada borde, así
// que un control con altura exacta de 44 px (p. ej. "Arcada superior"/"Arcada
// inferior"/"Limpiar" en `odontogram.tsx`, que sí usa la escala fija `h-9
// pointer-coarse:h-11` de `button.tsx`, no relleno dependiente de línea/fuente) puede
// medir menos: sus ancestros directos hasta el diálogo (`FormDialog` > `flex flex-col
// gap-4` > `Odontogram` > `flex flex-wrap gap-2` del pie) también redondean su propia
// posición de forma independiente, y el error de cada uno se acumula. Confirmado en la
// Task 6 (43.07 px medidos bajo 8 workers en paralelo, 44 px en corridas aisladas) y
// no reproducido de forma determinista en la Task 7 pese a >150 repeticiones dirigidas
// (`pnpm e2e --project=android -g "piezas" --repeat-each=25`, suites completas
// repetidas) — es redondeo genuino de DPR, no un control sin alto fijo. El epsilon
// cubre con margen el déficit medido (0.93 px), no un peor caso teórico de la cadena
// de ancestros (que rondaría los 4-5 × 0.381 ≈ 1.5-1.9 px con 4-5 ancestros): un
// control real por debajo de 43 px (44 − 1) sigue fallando la aserción, y uno sin
// escala fija de 44 px falla por 8+ px, muy por encima de este margen. Si el déficit
// medido volviera a superar 1 px, investigar la causa (¿más ancestros en la cadena?
// ¿otro DPR?) en vez de subir el epsilon de nuevo sin analizar.
const SUBPIXEL_EPSILON = 1

/**
 * Comprueba que cada elemento visible que coincida con `selector` (o `locator`, para
 * acotar la búsqueda a un contenedor como un diálogo) mida al menos `minHeight` × `minWidth`
 * — el objetivo táctil mínimo de la dirección de diseño (44 × 44 px por defecto). Ignora los
 * paneles de TanStack Query/Router Devtools (solo aparecen en `vite dev`, nunca en
 * producción): no son UI de la app bajo prueba.
 */
export async function expectTouchTargets(
  target: Page | Locator,
  selector: string,
  opts: { minHeight?: number; minWidth?: number } = {},
) {
  const { minHeight = 44, minWidth = 44 } = opts
  const items = target.locator(selector)
  const count = await items.count()
  for (let i = 0; i < count; i++) {
    const el = items.nth(i)
    if (!(await el.isVisible())) continue
    const label = (await el.getAttribute('aria-label')) ?? (await el.textContent()) ?? `#${i}`
    if (/devtools/i.test(label)) continue
    const box = await el.boundingBox()
    expect(box, `"${selector}" (${label.trim()}) sin boundingBox`).not.toBeNull()
    expect(box!.height, `"${selector}" (${label.trim()}) alto`).toBeGreaterThanOrEqual(
      minHeight - SUBPIXEL_EPSILON,
    )
    expect(box!.width, `"${selector}" (${label.trim()}) ancho`).toBeGreaterThanOrEqual(
      minWidth - SUBPIXEL_EPSILON,
    )
  }
}

/**
 * Selector de controles interactivos sujetos al objetivo táctil de 44 px. Excluye:
 * - `[role=switch]` (el `Switch` de Radix renderiza un `<button>`): se comprueba aparte con
 *   `TOUCH_SWITCHES`, que exige un mínimo distinto.
 * - `[data-target-size=inline]`: enlaces identificadores de fila/tarjeta (p. ej. el nombre
 *   de una clínica en la tabla), exentos por la excepción "inline" de WCAG 2.5.8.
 * - las celdas del odontograma, cada una dentro de un `role="group"` por cuadrante
 *   (`[data-testid=odontogram] [role=group] button`): UX2-07, aceptado y diferido por el
 *   controlador del plan (celdas de 37-41 px en 360/390) — no forma parte de esta tarea. El
 *   pie del diálogo "Piezas" (Guardar/Cancelar/Arcada superior/inferior/Limpiar, UX2-08) NO
 *   está dentro de ese `role="group"`, así que sigue sujeto al mínimo de 44 px.
 */
export const TOUCH_CONTROLS =
  'button:not([role=switch]):not([data-testid=odontogram] [role=group] button), a[href]:not([data-target-size=inline]), [role=tab], [role=combobox], input:not([type=hidden]):not([type=checkbox]):not([type=radio])'
/** Los switches miden menos por diseño (patrón interruptor): alto ≥ 24, ancho ≥ 44. */
export const TOUCH_SWITCHES = '[role=switch]'
