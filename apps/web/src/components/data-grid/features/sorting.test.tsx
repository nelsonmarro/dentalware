import { screen } from '@testing-library/react'
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
  col.accessor('name', { header: 'Nombre' }),
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
})
