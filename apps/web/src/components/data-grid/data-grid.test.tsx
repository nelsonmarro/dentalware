import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { renderWithRouter } from '@/test/router'
import { DataGrid } from './data-grid'
import { defineColumns } from './define-columns'
import { useDataGrid } from './use-data-grid'

type Row = { id: string; name: string; city: string; active: boolean }
const columns = defineColumns<Row>((col) => [
  col.accessor('name', { header: 'Nombre', meta: { mobile: 'title' } }),
  col.accessor('city', { header: 'Ciudad', meta: { mobile: 'subtitle' } }),
  col.accessor('active', {
    header: 'Estado',
    cell: (c) => (c.getValue() ? 'Activa' : 'Inactiva'),
    meta: { mobile: 'badge' },
  }),
])
const rows: Row[] = [
  { id: '1', name: 'Clínica Uno', city: 'Quito', active: true },
  { id: '2', name: 'Clínica Dos', city: 'Ambato', active: false },
]

function Grid({ data, action }: { data: Row[]; action?: React.ReactNode }) {
  const grid = useDataGrid({ key: 'test', columns, data, getRowId: (r) => r.id })
  return (
    <DataGrid.Root grid={grid} emptyMessage="No hay clínicas" emptyAction={action}>
      <DataGrid.Toolbar />
      <DataGrid.Content />
      <DataGrid.Pagination />
    </DataGrid.Root>
  )
}

describe('DataGrid', () => {
  it('en escritorio renderiza una tabla y ninguna tarjeta', async () => {
    setMatchMedia(true)
    renderWithRouter(<Grid data={rows} />)
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Nombre' })).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(3)
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('en móvil renderiza tarjetas con título, subtítulo y badge, y ninguna tabla', async () => {
    setMatchMedia(false)
    renderWithRouter(<Grid data={rows} />)
    expect(await screen.findByRole('list')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('Clínica Uno')).toBeInTheDocument()
    expect(screen.getByText('Quito')).toBeInTheDocument()
    expect(screen.getByText('Activa')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('muestra el estado vacío con su acción', async () => {
    setMatchMedia(true)
    renderWithRouter(<Grid data={[]} action={<button>Nueva clínica</button>} />)
    expect(await screen.findByText('No hay clínicas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nueva clínica' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('sin features no hay barra, ni botones de orden, ni paginación', async () => {
    setMatchMedia(true)
    renderWithRouter(<Grid data={rows} />)
    await screen.findByRole('table')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument()
    expect(screen.queryByRole('search')).not.toBeInTheDocument()
  })
})
