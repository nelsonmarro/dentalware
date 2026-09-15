import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { renderWithRouter } from '@/test/router'
import { DataGrid } from './data-grid'
import { defineColumns } from './define-columns'
import { advancedFilter } from './features/advanced-filter'
import { filtering } from './features/filtering'
import { sorting } from './features/sorting'
import type { GridFeature } from './types'
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

function Grid({
  data,
  action,
  renderCard,
  features,
}: {
  data: Row[]
  action?: React.ReactNode
  renderCard?: (row: Row) => React.ReactNode
  features?: GridFeature[]
}) {
  const grid = useDataGrid({ key: 'test', columns, data, features, getRowId: (r) => r.id })
  return (
    <DataGrid.Root
      grid={grid}
      emptyMessage="No hay clínicas"
      emptyAction={action}
      renderCard={renderCard}
    >
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

  it('en móvil usa renderCard con la fila tipada, sin tarjeta automática', async () => {
    setMatchMedia(false)
    renderWithRouter(
      <Grid
        data={rows}
        renderCard={(row) => <span data-testid="card">{row.name.toUpperCase()}</span>}
      />,
    )
    expect(await screen.findByText('CLÍNICA UNO')).toBeInTheDocument()
    expect(screen.getByText('CLÍNICA DOS')).toBeInTheDocument()
    expect(screen.getAllByTestId('card')).toHaveLength(2)
    expect(screen.queryByText('Quito')).not.toBeInTheDocument()
  })

  it('sin features no hay barra, ni botones de orden, ni paginación', async () => {
    setMatchMedia(true)
    renderWithRouter(<Grid data={rows} />)
    await screen.findByRole('table')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument()
    expect(screen.queryByRole('search')).not.toBeInTheDocument()
  })

  it('en móvil une varias columnas subtitle con " · " y omite las de valor vacío', async () => {
    setMatchMedia(false)
    type ContactRow = { id: string; name: string; city: string | null; phone: string }
    const contactColumns = defineColumns<ContactRow>((col) => [
      col.accessor('name', { header: 'Nombre', meta: { mobile: 'title' } }),
      col.accessor('city', {
        header: 'Ciudad',
        cell: (c) => c.getValue() ?? '—',
        meta: { mobile: 'subtitle' },
      }),
      col.accessor('phone', { header: 'Teléfono', meta: { mobile: 'subtitle' } }),
    ])
    const contactRows: ContactRow[] = [
      { id: '1', name: 'Clínica Uno', city: 'Quito', phone: '+593991234567' },
      { id: '2', name: 'Clínica Dos', city: null, phone: '+593991234567' },
    ]
    function ContactGrid({ data }: { data: ContactRow[] }) {
      const grid = useDataGrid({
        key: 'test-contact',
        columns: contactColumns,
        data,
        getRowId: (r) => r.id,
      })
      return (
        <DataGrid.Root grid={grid} emptyMessage="No hay filas">
          <DataGrid.Content />
        </DataGrid.Root>
      )
    }
    const { container } = renderWithRouter(<ContactGrid data={contactRows} />)
    await screen.findByText('Clínica Uno')
    const subtitles = container.querySelectorAll('li p')
    expect(subtitles).toHaveLength(2)
    expect(subtitles[0]?.textContent).toBe('Quito · +593991234567')
    expect(subtitles[1]?.textContent).toBe('+593991234567')
  })

  it('en móvil, con 3 o más features con slot de toolbar, pliega la barra bajo «Filtros y orden»; abrirla y buscar sube el contador', async () => {
    setMatchMedia(false)
    const user = userEvent.setup()
    renderWithRouter(
      <Grid
        data={rows}
        features={[
          filtering({ search: { id: 'buscar', label: 'Buscar' } }),
          sorting(),
          advancedFilter(),
        ]}
      />,
    )
    const summary = await screen.findByText('Filtros y orden')
    const details = summary.closest('details')
    expect(details).not.toHaveAttribute('open')
    await user.click(summary)
    await user.type(screen.getByLabelText('Buscar'), 'clínica uno')
    expect(await screen.findByText('Filtros y orden (1)')).toBeInTheDocument()
  })

  it('en móvil, con solo 2 features con slot de toolbar, no pliega: los controles se ven directos', async () => {
    setMatchMedia(false)
    renderWithRouter(
      <Grid
        data={rows}
        features={[filtering({ search: { id: 'buscar', label: 'Buscar' } }), sorting()]}
      />,
    )
    expect(await screen.findByLabelText('Buscar')).toBeInTheDocument()
    expect(screen.queryByText('Filtros y orden')).not.toBeInTheDocument()
  })

  it('en escritorio no hay <details>: los controles de la barra se ven directos', async () => {
    setMatchMedia(true)
    renderWithRouter(
      <Grid
        data={rows}
        features={[
          filtering({ search: { id: 'buscar', label: 'Buscar' } }),
          sorting(),
          advancedFilter(),
        ]}
      />,
    )
    await screen.findByRole('table')
    expect(screen.queryByText('Filtros y orden')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Buscar')).toBeInTheDocument()
  })
})
