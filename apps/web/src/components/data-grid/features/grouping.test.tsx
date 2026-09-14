import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { renderWithRouter } from '@/test/router'
import { DataGrid } from '../data-grid'
import { defineColumns } from '../define-columns'
import { useDataGrid } from '../use-data-grid'
import { grouping } from './grouping'

type Row = { id: string; name: string; category: string; price: number }
const columns = defineColumns<Row>((col) => [
  col.accessor('name', { header: 'Producto' }),
  col.accessor('category', { header: 'Categoría', meta: { groupable: true } }),
  col.accessor('price', { header: 'Precio', meta: { aggregate: 'sum', align: 'right' } }),
])
const rows: Row[] = [
  { id: '1', name: 'Zirconio', category: 'Fija', price: 45 },
  { id: '2', name: 'Metal porcelana', category: 'Fija', price: 30 },
  { id: '3', name: 'Acrílico', category: 'Removible', price: 20 },
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

  it('sin la feature no hay «Agrupar por»', async () => {
    setMatchMedia(true)
    renderWithRouter(<Grid features={[]} />)
    await screen.findByRole('table')
    expect(screen.queryByLabelText('Agrupar por')).not.toBeInTheDocument()
  })
})
