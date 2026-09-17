import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { renderWithRouter } from '@/test/router'
import { DataGrid } from '../data-grid'
import { defineColumns } from '../define-columns'
import { useDataGrid } from '../use-data-grid'
import { grouping } from './grouping'

type Row = { id: string; name: string; category: string; brand: string; price: number }
const columns = defineColumns<Row>((col) => [
  col.accessor('name', { header: 'Producto' }),
  col.accessor('category', { header: 'Categoría', meta: { groupable: true } }),
  col.accessor('brand', { header: 'Marca', meta: { groupable: true } }),
  col.accessor('price', { header: 'Precio', meta: { aggregate: 'sum', align: 'right' } }),
])
const rows: Row[] = [
  { id: '1', name: 'Zirconio', category: 'Fija', brand: 'Ivoclar', price: 45 },
  { id: '2', name: 'Metal porcelana', category: 'Fija', brand: 'Vita', price: 30 },
  { id: '3', name: 'Acrílico', category: 'Removible', brand: 'Ivoclar', price: 20 },
]

function Grid({ features }: { features: ReturnType<typeof grouping>[] }) {
  const grid = useDataGrid({ key: 'test', columns, data: rows, features, getRowId: (r) => r.id })
  return (
    <DataGrid.Root grid={grid} emptyMessage="Vacío">
      <DataGrid.Toolbar />
      <DataGrid.Content />
    </DataGrid.Root>
  )
}

describe('feature grouping', () => {
  it('agrupa por categoría con conteo, agregado y filas expandibles', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderWithRouter(<Grid features={[grouping()]} />)
    await user.selectOptions(await screen.findByLabelText('Agrupar por'), 'category')
    const fija = screen.getByRole('row', { name: /Fija \(2\)/ })
    expect(within(fija).getByText('75.00')).toBeInTheDocument()
    const toggle = within(fija).getByRole('button', { name: /Contraer Fija/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await user.click(toggle)
    expect(screen.queryByText('Zirconio')).not.toBeInTheDocument()
  })

  it('arranca agrupado si se indica initial', async () => {
    setMatchMedia(true)
    renderWithRouter(<Grid features={[grouping({ initial: 'category' })]} />)
    expect(await screen.findByRole('row', { name: /Removible \(1\)/ })).toBeInTheDocument()
  })

  it('el menú de columna reemplaza la agrupación anterior en vez de acumularla', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderWithRouter(<Grid features={[grouping()]} />)
    await user.click(
      await screen.findByRole('button', { name: 'Opciones de la columna Categoría' }),
    )
    await user.click(await screen.findByRole('menuitem', { name: /Agrupar por Categoría/ }))
    expect(await screen.findByRole('row', { name: /Fija \(2\)/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Opciones de la columna Marca' }))
    await user.click(await screen.findByRole('menuitem', { name: /Agrupar por Marca/ }))
    // Si `toggleGrouping()` acumulara en vez de reemplazar, «Fija» seguiría existiendo como
    // grupo externo con «Ivoclar»/«Vita» anidados dentro.
    expect(await screen.findByRole('row', { name: /Ivoclar \(2\)/ })).toBeInTheDocument()
    // Un `queryByRole` con `/Fija/` sin más también matchearía filas normales de la categoría
    // "Fija" (su valor sigue en la celda de esa columna): se busca específicamente el patrón de
    // encabezado de grupo «Fija (n)».
    expect(screen.queryByRole('row', { name: /Fija \(\d+\)/ })).not.toBeInTheDocument()
  })

  it('el menú de columna solo aparece en columnas agrupables', async () => {
    setMatchMedia(true)
    renderWithRouter(<Grid features={[grouping()]} />)
    await screen.findByRole('table')
    expect(
      screen.queryByRole('button', { name: 'Opciones de la columna Producto' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Opciones de la columna Categoría' }),
    ).toBeInTheDocument()
  })

  it('la fila de grupo no pinta celdas de columnas ocultas', async () => {
    setMatchMedia(true)
    function HiddenColumnGrid() {
      const grid = useDataGrid({
        key: 'test-hidden',
        columns,
        data: rows,
        // `id: 'urlState'` es un valor cualquiera de `GridFeatureId` sin comportamiento propio
        // registrado: solo sirve para sembrar `columnVisibility` en el `initialState` fusionado,
        // como ya hace `use-data-grid.test.tsx` con features ad-hoc.
        features: [
          grouping({ initial: 'category' }),
          { id: 'urlState', tanstack: {}, initialState: { columnVisibility: { brand: false } } },
        ],
        getRowId: (r) => r.id,
      })
      return (
        <DataGrid.Root grid={grid} emptyMessage="Vacío">
          <DataGrid.Content />
        </DataGrid.Root>
      )
    }
    renderWithRouter(<HiddenColumnGrid />)
    const fija = await screen.findByRole('row', { name: /Fija \(2\)/ })
    // 3 columnas visibles (Producto, Categoría, Precio): "Marca" está oculta. `getAllCells()`
    // ignora la visibilidad y pintaría 4.
    expect(within(fija).getAllByRole('cell')).toHaveLength(3)
  })

  it('en móvil no duplica las tarjetas hijas del grupo', async () => {
    setMatchMedia(false)
    renderWithRouter(<Grid features={[grouping({ initial: 'category' })]} />)
    const items = await screen.findAllByRole('listitem')
    // `table.getRowModel().rows` ya llega aplanado (fila de grupo + hijas intercaladas): 2
    // encabezados de grupo (Fija, Removible) + 3 tarjetas, una por producto.
    expect(items).toHaveLength(5)
    expect(screen.getAllByText('Zirconio')).toHaveLength(1)
    expect(screen.getAllByText('Metal porcelana')).toHaveLength(1)
    expect(screen.getAllByText('Acrílico')).toHaveLength(1)
  })

  it('sin la feature no hay «Agrupar por»', async () => {
    setMatchMedia(true)
    renderWithRouter(<Grid features={[]} />)
    await screen.findByRole('table')
    expect(screen.queryByLabelText('Agrupar por')).not.toBeInTheDocument()
  })
})
