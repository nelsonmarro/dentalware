import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { renderWithRouter } from '@/test/router'
import { DataGrid } from '../data-grid'
import { defineColumns } from '../define-columns'
import { useDataGrid } from '../use-data-grid'
import { filtering } from './filtering'

type Row = { id: string; name: string; category: string; days: number }
const columns = defineColumns<Row>((col) => [
  col.accessor('name', { header: 'Nombre', meta: { filter: 'text' } }),
  col.accessor('category', { header: 'Categoría', meta: { filter: 'select' } }),
  col.accessor('days', { header: 'Días', meta: { filter: 'range' } }),
])
const rows: Row[] = [
  { id: '1', name: 'Prótesis híbrida', category: 'Removible', days: 12 },
  { id: '2', name: 'Zirconio', category: 'Fija', days: 5 },
]
const withSearch = [filtering({ search: { id: 'buscar', label: 'Buscar producto' } })]
const withColumns = [filtering({ columns: true })]

function Grid({ features }: { features: ReturnType<typeof filtering>[] }) {
  const grid = useDataGrid({ key: 'test', columns, data: rows, features, getRowId: (r) => r.id })
  return (
    <DataGrid.Root
      grid={grid}
      emptyMessage={(q) => (q ? `Ningún producto coincide con "${q}"` : 'No hay productos')}
    >
      <DataGrid.Toolbar />
      <DataGrid.Content />
    </DataGrid.Root>
  )
}

describe('feature filtering', () => {
  it('el buscador tiene etiqueta visible y filtra sin acentos', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderWithRouter(<Grid features={withSearch} />)
    await user.type(await screen.findByLabelText('Buscar producto'), 'hibrida')
    expect(screen.getByText('Prótesis híbrida')).toBeInTheDocument()
    expect(screen.queryByText('Zirconio')).not.toBeInTheDocument()
  })

  it('muestra el vacío con el texto buscado', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderWithRouter(<Grid features={withSearch} />)
    await user.type(await screen.findByLabelText('Buscar producto'), 'no existe')
    expect(await screen.findByText('Ningún producto coincide con "no existe"')).toBeInTheDocument()
  })

  it('filtra por columna select con los valores únicos y por rango', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderWithRouter(<Grid features={withColumns} />)
    await user.selectOptions(await screen.findByLabelText('Filtrar Categoría'), 'Fija')
    expect(screen.queryByText('Prótesis híbrida')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Filtrar Categoría'), '')
    await user.type(screen.getByLabelText('Días mínimo'), '10')
    expect(screen.queryByText('Zirconio')).not.toBeInTheDocument()
    expect(screen.getByText('Prótesis híbrida')).toBeInTheDocument()
  })

  it('sin la feature no hay buscador ni filtros', async () => {
    setMatchMedia(true)
    renderWithRouter(<Grid features={[]} />)
    await screen.findByRole('table')
    expect(screen.queryByRole('search')).not.toBeInTheDocument()
  })
})
