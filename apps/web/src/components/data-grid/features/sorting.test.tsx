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

  it('en móvil un solo control «Ordenar» combina columna y dirección (UX5-09)', async () => {
    setMatchMedia(false)
    const user = userEvent.setup()
    renderWithRouter(<Grid features={FEATURES} />)
    await screen.findByRole('list')
    const cards = () => screen.getAllByRole('listitem')
    expect(within(cards()[0]!).getByText('Zirconio')).toBeInTheDocument()
    // Un único `select`: sin «Ordenar por» y «Dirección» por separado.
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
    expect(screen.queryByLabelText('Dirección')).not.toBeInTheDocument()
    const select = screen.getByRole('combobox', { name: 'Ordenar' })
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual([
      'Sin orden',
      'Nombre: ascendente',
      'Nombre: descendente',
      'Días: ascendente',
      'Días: descendente',
    ])
    await user.selectOptions(select, 'Nombre: ascendente')
    expect(within(cards()[0]!).getByText('Acrílico')).toBeInTheDocument()
    expect(within(cards()[1]!).getByText('Zirconio')).toBeInTheDocument()
    await user.selectOptions(select, 'Días: descendente')
    expect(within(cards()[0]!).getByText('Acrílico')).toBeInTheDocument()
    await user.selectOptions(select, 'Días: ascendente')
    expect(within(cards()[0]!).getByText('Zirconio')).toBeInTheDocument()
    await user.selectOptions(select, 'Sin orden')
    expect(select).toHaveValue('')
  })

  it('cada columna puede nombrar sus dos órdenes con `meta.sortLabels`', async () => {
    setMatchMedia(false)
    const labelled = defineColumns<Row>((col) => [
      col.accessor('name', {
        header: 'Nombre',
        meta: { mobile: 'title', sortLabels: { asc: 'Nombre A–Z', desc: 'Nombre Z–A' } },
      }),
      col.accessor('days', {
        header: 'Días',
        meta: { sortLabels: { asc: 'Menos días primero', desc: 'Más días primero' } },
      }),
    ])
    function Labelled() {
      const grid = useDataGrid({
        key: 'test',
        columns: labelled,
        data: rows,
        features: FEATURES,
        getRowId: (r) => r.id,
      })
      return (
        <DataGrid.Root grid={grid} emptyMessage="Vacío">
          <DataGrid.Toolbar />
          <DataGrid.Content />
        </DataGrid.Root>
      )
    }
    renderWithRouter(<Labelled />)
    const select = await screen.findByRole('combobox', { name: 'Ordenar' })
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Sin orden', 'Nombre A–Z', 'Nombre Z–A', 'Menos días primero', 'Más días primero'])
  })

  it('el control de orden móvil está en el DOM en escritorio, oculto solo por CSS (`lg:hidden`)', async () => {
    setMatchMedia(true)
    renderWithRouter(<Grid features={FEATURES} />)
    const select = await screen.findByLabelText('Ordenar')
    expect(select.parentElement).toHaveClass('lg:hidden')
  })

  it('el id del control incluye la key del grid (dos grids en la misma página no chocan)', async () => {
    setMatchMedia(true)
    renderWithRouter(<Grid features={FEATURES} />)
    expect(await screen.findByLabelText('Ordenar')).toHaveAttribute('id', 'test-ordenar')
  })
})
