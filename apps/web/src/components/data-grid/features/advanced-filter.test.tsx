import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { renderWithRouter } from '@/test/router'
import { DataGrid } from '../data-grid'
import { defineColumns } from '../define-columns'
import { useDataGrid } from '../use-data-grid'
import { advancedFilter } from './advanced-filter'

type Row = { id: string; name: string; days: number }
const columns = defineColumns<Row>((col) => [
  col.accessor('name', { header: 'Producto', meta: { filter: 'text' } }),
  col.accessor('days', { header: 'Días', meta: { filter: 'range' } }),
])
const rows: Row[] = [
  { id: '1', name: 'Zirconio', days: 5 },
  { id: '2', name: 'Acrílico', days: 12 },
]

function Grid({ features }: { features: ReturnType<typeof advancedFilter>[] }) {
  const grid = useDataGrid({ key: 'test', columns, data: rows, features, getRowId: (r) => r.id })
  return (
    <DataGrid.Root grid={grid} emptyMessage="Vacío">
      <DataGrid.Toolbar />
      <DataGrid.Content />
    </DataGrid.Root>
  )
}

describe('feature advancedFilter', () => {
  it('aplica una condición desde el diálogo y la muestra como chip', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderWithRouter(<Grid features={[advancedFilter()]} />)
    await user.click(await screen.findByRole('button', { name: 'Filtro avanzado' }))
    const dialog = await screen.findByRole('dialog', { name: 'Filtro avanzado' })
    await user.click(screen.getByRole('button', { name: 'Añadir condición' }))
    await user.selectOptions(screen.getByLabelText('Columna 1'), 'days')
    await user.selectOptions(screen.getByLabelText('Operador 1'), 'mayor')
    await user.type(screen.getByLabelText('Valor 1'), '10')
    await user.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(dialog).not.toBeInTheDocument()
    expect(screen.queryByText('Zirconio')).not.toBeInTheDocument()
    expect(screen.getByText('Acrílico')).toBeInTheDocument()
    expect(screen.getByText('Días mayor que 10')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Quitar condición Días mayor que 10' }))
    expect(screen.getByText('Zirconio')).toBeInTheDocument()
  })

  it('sin la feature no hay botón', async () => {
    setMatchMedia(true)
    renderWithRouter(<Grid features={[]} />)
    await screen.findByRole('table')
    expect(screen.queryByRole('button', { name: 'Filtro avanzado' })).not.toBeInTheDocument()
  })
})
