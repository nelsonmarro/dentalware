import { CASE_ORDERS } from '@dentalware/shared'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { renderWithRouter } from '@/test/router'
import type { CaseListRow } from './api'
import { CasesTable } from './cases-table'

const rows: CaseListRow[] = [
  {
    id: 'caso-1',
    code: '26-00123',
    boxNumber: '12',
    patientRef: 'Juan Pérez',
    status: 'en_proceso',
    priority: 'urgente',
    receivedAt: '2026-09-01',
    dueDate: '2020-01-01',
    promisedDate: null,
    total: '147.00',
    clinic: { id: 'clinica-1', name: 'Clínica Uno' },
    doctor: { id: 'doctor-1', name: 'Dr. Gómez' },
    stage: null,
    technician: null,
    itemsSummary: 'Corona ×2',
  },
  {
    id: 'caso-2',
    code: '26-00124',
    boxNumber: null,
    patientRef: 'María López',
    status: 'nuevo',
    priority: 'normal',
    receivedAt: '2026-09-05',
    dueDate: '2026-12-31',
    promisedDate: null,
    total: '80.00',
    clinic: { id: 'clinica-1', name: 'Clínica Uno' },
    doctor: { id: 'doctor-2', name: 'Dra. Ruiz' },
    stage: null,
    technician: null,
    itemsSummary: 'Placa',
  },
]

describe('CasesTable', () => {
  it('en escritorio muestra el código como enlace, el chip, el atraso y el total', async () => {
    setMatchMedia(true)
    renderWithRouter(
      <CasesTable rows={rows} total={2} hidePrices={false} search={{}} onSearchChange={vi.fn()} />,
    )

    const link = await screen.findByRole('link', { name: /26-00123/ })
    expect(link).toHaveAttribute('href', '/trabajos/caso-1')
    expect(screen.getByText('En proceso')).toBeInTheDocument()
    expect(screen.getByText('$ 147.00')).toBeInTheDocument()
  })

  it('el enlace del código es un identificador de fila, exento del objetivo táctil de 44 px', async () => {
    // El código de trabajo (font-mono, sin padding propio) es el identificador de la
    // fila/tarjeta, no una acción — misma excepción "inline" (WCAG 2.5.8) que el nombre
    // de clínica en `clinics-table.tsx`. Sin `data-target-size="inline"`, el barrido de
    // `expectTouchTargets` en `accesibilidad.spec.ts` lo mide en ~23 px de alto (texto
    // `font-mono font-medium` sin `h-11`) y falla de forma determinista en cuanto la
    // lista de trabajos tiene al menos una fila.
    setMatchMedia(true)
    renderWithRouter(
      <CasesTable rows={rows} total={2} hidePrices={false} search={{}} onSearchChange={vi.fn()} />,
    )

    const link = await screen.findByRole('link', { name: /26-00123/ })
    expect(link).toHaveAttribute('data-target-size', 'inline')
  })

  it('el atraso y la urgencia se muestran como icono accesible, no como chip de texto', async () => {
    setMatchMedia(true)
    renderWithRouter(
      <CasesTable rows={rows} total={2} hidePrices={false} search={{}} onSearchChange={vi.fn()} />,
    )

    await screen.findByRole('link', { name: /26-00123/ })
    // UX2-05: liberar ancho a 1280 cambiando los chips "Urgente"/"Atrasado" por un
    // icono con título y nombre accesible — el texto sigue disponible para lectores
    // de pantalla, solo deja de ocupar una celda completa de texto.
    expect(screen.queryByText('Atrasado')).not.toBeInTheDocument()
    expect(screen.queryByText('Urgente')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Urgente' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Atrasado' })).toBeInTheDocument()
  })

  it('compacta clínica y doctor en una sola línea con el texto completo accesible', async () => {
    setMatchMedia(true)
    renderWithRouter(
      <CasesTable rows={rows} total={2} hidePrices={false} search={{}} onSearchChange={vi.fn()} />,
    )

    await screen.findByRole('link', { name: /26-00123/ })
    const cell = screen.getByText('Clínica Uno · Dr. Gómez')
    expect(cell).toHaveAttribute('title', 'Clínica Uno · Dr. Gómez')
  })

  it('oculta la columna Total cuando hidePrices es verdadero', async () => {
    setMatchMedia(true)
    renderWithRouter(
      <CasesTable rows={rows} total={2} hidePrices search={{}} onSearchChange={vi.fn()} />,
    )

    await screen.findByRole('link', { name: /26-00123/ })
    expect(screen.queryByText('Total')).not.toBeInTheDocument()
    expect(screen.queryByText('$ 147.00')).not.toBeInTheDocument()
  })

  it('en móvil muestra tarjetas con el mismo código', async () => {
    setMatchMedia(false)
    renderWithRouter(
      <CasesTable rows={rows} total={2} hidePrices={false} search={{}} onSearchChange={vi.fn()} />,
    )

    const link = await screen.findByRole('link', { name: /26-00123/ })
    expect(link).toBeInTheDocument()
    expect(screen.getByText('$ 147.00')).toBeInTheDocument()
  })

  it('ordenar por Entrega navega con orden=entrega y sin pagina', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    const onSearchChange = vi.fn()
    renderWithRouter(
      <CasesTable
        rows={rows}
        total={2}
        hidePrices={false}
        search={{ pagina: 2 }}
        onSearchChange={onSearchChange}
      />,
    )
    await user.click(await screen.findByRole('button', { name: 'Ordenar por Entrega' }))
    expect(onSearchChange).toHaveBeenLastCalledWith({ orden: 'entrega', pagina: undefined })
  })

  it('la columna Código queda fija a la izquierda', async () => {
    setMatchMedia(true)
    renderWithRouter(
      <CasesTable rows={rows} total={2} hidePrices={false} search={{}} onSearchChange={vi.fn()} />,
    )
    expect(await screen.findByRole('columnheader', { name: /Código/ })).toHaveStyle({
      position: 'sticky',
    })
  })

  it('en una celda del cuerpo, pinningStyles y meta.cellStyle conviven (M-2 de la revisión final)', async () => {
    // `parts/table.tsx` sobrescribe (`{ ...pinningStyles(...), ...meta?.cellStyle?.(row.original) }`)
    // en vez de fusionar: hoy es inocuo porque las claves son disjuntas (position/insetInline*/
    // zIndex/background/boxShadow del sticky vs borderLeftColor de la pestaña de color), pero solo
    // el columnheader (sin cellStyle) estaba cubierto. Esta celda del cuerpo sí recibe ambas cosas
    // a la vez: el trabajo 1 es urgente y en_proceso (STATUS_COLOR.en_proceso = #0F766E).
    setMatchMedia(true)
    renderWithRouter(
      <CasesTable rows={rows} total={2} hidePrices={false} search={{}} onSearchChange={vi.fn()} />,
    )
    const link = await screen.findByRole('link', { name: /26-00123/ })
    const cell = link.closest('td')
    expect(cell).not.toBeNull()
    expect(cell).toHaveStyle({ position: 'sticky', borderLeftColor: '#0F766E' })
  })

  it('Siguiente navega a la página 2 cuando hay más filas en el servidor', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    const onSearchChange = vi.fn()
    renderWithRouter(
      <CasesTable
        rows={rows}
        total={60}
        hidePrices={false}
        search={{}}
        onSearchChange={onSearchChange}
      />,
    )
    await user.click(await screen.findByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(onSearchChange).toHaveBeenLastCalledWith({ pagina: 2 }))
  })

  it('cada columna ordenable produce un `orden` válido en CASE_ORDERS (guarda M-4)', async () => {
    // `parseCasesSearch` (case-views.ts) valida `search` con `.catch({})` sobre el objeto
    // ENTERO: un id de columna que no sea una de las bases de CASE_ORDERS no solo rompería el
    // orden, sino que la URL resultante ('?orden=<id-inválido>') haría que la ruta descarte
    // vista, filtros y página también. Este test hace clic en cada botón "Ordenar por <columna>"
    // de la cabecera y comprueba que el `orden` que produce sea siempre un miembro de
    // CASE_ORDERS (packages/shared/src/schemas/cases.ts) — la única fuente de verdad de la API.
    setMatchMedia(true)
    const user = userEvent.setup()
    const onSearchChange = vi.fn()
    renderWithRouter(
      <CasesTable
        rows={rows}
        total={2}
        hidePrices={false}
        search={{}}
        onSearchChange={onSearchChange}
      />,
    )
    const sortButtons = await screen.findAllByRole('button', { name: /^Ordenar por/ })
    expect(sortButtons.length).toBeGreaterThan(0)
    for (const button of sortButtons) {
      onSearchChange.mockClear()
      await user.click(button)
      const patch = onSearchChange.mock.calls.at(-1)?.[0] as { orden?: string } | undefined
      expect(patch?.orden).toBeDefined()
      expect(CASE_ORDERS).toContain(patch?.orden)
    }
  })

  it('la suma de anchos de columna no supera el presupuesto de la tabla a 1280 px (UX1-03)', async () => {
    // Mismo presupuesto y mismo razonamiento que `products-table.test.tsx`: a 1280 px el
    // contenedor real de la tabla mide 960 px (descuenta menú lateral y márgenes de página).
    // `resizing` fija cada columna a `meta.width` con `table-layout: fixed` (`parts/table.tsx`):
    // si la suma declarada supera el presupuesto, vuelve el scroll horizontal (UX1-03). Trabajos
    // declara 920 px con precios visibles (Tarea 18); este test lo rompe en CI si crece.
    setMatchMedia(true)
    renderWithRouter(
      <CasesTable rows={rows} total={2} hidePrices={false} search={{}} onSearchChange={vi.fn()} />,
    )
    const table = await screen.findByRole('table')
    const total = Array.from(table.querySelectorAll('thead th')).reduce((sum, th) => {
      const width = Number.parseFloat((th as HTMLElement).style.width)
      return sum + (Number.isNaN(width) ? 0 : width)
    }, 0)
    expect(total).toBeLessThanOrEqual(960)
  })

  it('en móvil no muestra el total a un técnico/mensajero (hidePrices) — enmascarado en tarjetas (M-6)', async () => {
    // El test de hidePrices existente ("oculta la columna Total…") solo corre en escritorio; la
    // tarjeta móvil es justo la superficie que ve un técnico o un mensajero (docs/conventions.md
    // §4: nunca reciben precios). Este test cubre la tarjeta.
    setMatchMedia(false)
    renderWithRouter(
      <CasesTable rows={rows} total={2} hidePrices search={{}} onSearchChange={vi.fn()} />,
    )

    await screen.findByRole('link', { name: /26-00123/ })
    expect(screen.queryByText('$ 147.00')).not.toBeInTheDocument()
    expect(screen.queryByText('$ 80.00')).not.toBeInTheDocument()
  })

  it('en móvil muestra el total cuando hidePrices es falso', async () => {
    setMatchMedia(false)
    renderWithRouter(
      <CasesTable rows={rows} total={2} hidePrices={false} search={{}} onSearchChange={vi.fn()} />,
    )

    await screen.findByRole('link', { name: /26-00123/ })
    expect(screen.getByText('$ 147.00')).toBeInTheDocument()
  })

  it('en escritorio la toolbar no deja un contenedor vacío fuera de `lg:hidden` (M-1)', async () => {
    // Regresión estructural del arreglo M-1: el único slot de toolbar de esta tabla
    // (`sorting`'s "Ordenar por"/"Dirección") es solo-móvil, así que `<DataGrid.Toolbar />` se
    // envuelve en `lg:hidden` en `cases-table.tsx` (no en el núcleo, ver el comentario junto al
    // JSX) para que en escritorio no quede un `<div>` vacío consumiendo el `gap-3` del
    // `DataGrid.Root`. Verificado también visualmente en Chrome DevTools a 1280×800.
    setMatchMedia(true)
    const { container } = renderWithRouter(
      <CasesTable rows={rows} total={2} hidePrices={false} search={{}} onSearchChange={vi.fn()} />,
    )
    await screen.findByRole('table')
    const sortLabel = screen.getByText('Ordenar por')
    // El contenedor `lg:hidden` debe ser un ancestro directo de la toolbar de orden, no una clase
    // suelta en cualquier otro `div` de la tabla.
    const lgHiddenAncestor = sortLabel.closest('.lg\\:hidden')
    expect(lgHiddenAncestor).toBeTruthy()
    // Exactamente dos: el wrapper del fix (alrededor de `<DataGrid.Toolbar />`, en
    // `cases-table.tsx`) y el propio contenedor de `MobileSortControls` (`sorting.tsx`), que ya
    // se ocultaba a sí mismo antes de este fix. Ningún otro `div` de la tabla lleva `lg:hidden`.
    const lgHiddenDivs = Array.from(container.querySelectorAll('div')).filter((div) =>
      div.className.split(' ').includes('lg:hidden'),
    )
    expect(lgHiddenDivs).toHaveLength(2)
  })
})
