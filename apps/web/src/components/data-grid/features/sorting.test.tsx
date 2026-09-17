import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { renderWithRouter } from '@/test/router'
import { DataGrid } from '../data-grid'
import { defineColumns } from '../define-columns'
import { useDataGrid } from '../use-data-grid'
import { sorting } from './sorting'

type Row = { id: string; name: string; days: number }
const columns = defineColumns<Row>((col) => [
  col.accessor('name', { header: 'Nombre', meta: { mobile: 'title' } }),
  col.accessor('days', { header: 'Días' }),
])
const rows: Row[] = [
  { id: '1', name: 'Zirconio', days: 5 },
  { id: '2', name: 'Acrílico', days: 12 },
]
const FEATURES = [sorting()]

function Grid({ features }: { features: typeof FEATURES | [] }) {
  const grid = useDataGrid({ key: 'test', columns, data: rows, features, getRowId: (r) => r.id })
  return (
    <DataGrid.Root grid={grid} emptyMessage="Vacío">
      <DataGrid.Toolbar />
      <DataGrid.Content />
    </DataGrid.Root>
  )
}
const cellsOf = (col: number) =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((r) => r.querySelectorAll('td')[col]?.textContent)

describe('feature sorting', () => {
  it('ordena al pulsar la cabecera y anuncia aria-sort', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderWithRouter(<Grid features={FEATURES} />)
    const button = await screen.findByRole('button', { name: 'Ordenar por Nombre' })
    await user.click(button)
    expect(cellsOf(0)).toEqual(['Acrílico', 'Zirconio'])
    expect(screen.getByRole('columnheader', { name: /Nombre/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    )
    await user.click(button)
    expect(cellsOf(0)).toEqual(['Zirconio', 'Acrílico'])
    expect(screen.getByRole('columnheader', { name: /Nombre/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    )
  })

  it('sin la feature no hay botones de orden', async () => {
    setMatchMedia(true)
    renderWithRouter(<Grid features={[]} />)
    await screen.findByRole('table')
    expect(screen.queryByRole('button', { name: /Ordenar por/ })).not.toBeInTheDocument()
  })

  it('en móvil ordena las tarjetas desde los selectores «Ordenar por» y «Dirección» de la toolbar', async () => {
    setMatchMedia(false)
    const user = userEvent.setup()
    renderWithRouter(<Grid features={FEATURES} />)
    await screen.findByRole('list')
    const cards = () => screen.getAllByRole('listitem')
    expect(within(cards()[0]!).getByText('Zirconio')).toBeInTheDocument()
    expect(within(cards()[1]!).getByText('Acrílico')).toBeInTheDocument()
    await user.selectOptions(await screen.findByLabelText('Ordenar por'), 'name')
    await user.selectOptions(screen.getByLabelText('Dirección'), 'asc')
    expect(within(cards()[0]!).getByText('Acrílico')).toBeInTheDocument()
    expect(within(cards()[1]!).getByText('Zirconio')).toBeInTheDocument()
  })

  it('el selector de orden móvil está en el DOM en escritorio, oculto solo por CSS (`lg:hidden`)', async () => {
    setMatchMedia(true)
    renderWithRouter(<Grid features={FEATURES} />)
    const select = await screen.findByLabelText('Ordenar por')
    const wrapper = select.closest('div')?.parentElement
    expect(wrapper).toHaveClass('lg:hidden')
  })

  it('los ids de los selectores incluyen la key del grid (dos grids en la misma página no chocan)', async () => {
    setMatchMedia(true)
    renderWithRouter(<Grid features={FEATURES} />)
    const columnaSelect = await screen.findByLabelText('Ordenar por')
    const direccionSelect = screen.getByLabelText('Dirección')
    expect(columnaSelect).toHaveAttribute('id', 'test-ordenar-por')
    expect(direccionSelect).toHaveAttribute('id', 'test-direccion-orden')
  })
})
