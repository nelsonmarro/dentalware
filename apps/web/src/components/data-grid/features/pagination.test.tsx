import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { renderWithRouter } from '@/test/router'
import { DataGrid } from '../data-grid'
import { defineColumns } from '../define-columns'
import { useDataGrid } from '../use-data-grid'
import { pagination } from './pagination'

type Row = { id: string; name: string }
const columns = defineColumns<Row>((col) => [col.accessor('name', { header: 'Nombre' })])
const rows: Row[] = Array.from({ length: 7 }, (_, i) => ({ id: String(i), name: `Fila ${i}` }))

function Grid({
  features,
  mode,
  rowCount,
}: {
  features: ReturnType<typeof pagination>[]
  mode?: 'client' | 'server'
  rowCount?: number
}) {
  const grid = useDataGrid({
    key: 'test',
    columns,
    data: rows,
    features,
    mode,
    rowCount,
    getRowId: (r) => r.id,
  })
  return (
    <DataGrid.Root grid={grid} emptyMessage="Vacío">
      <DataGrid.Content />
      <DataGrid.Pagination />
    </DataGrid.Root>
  )
}

describe('feature pagination', () => {
  it('en cliente muestra 3 por página y avanza', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderWithRouter(<Grid features={[pagination({ pageSize: 3 })]} />)
    await screen.findByRole('navigation', { name: 'Paginación' })
    expect(screen.getAllByRole('row')).toHaveLength(4)
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument()
    expect(screen.getByText('Fila 3')).toBeInTheDocument()
  })

  it('en servidor no corta las filas y calcula las páginas con rowCount', async () => {
    setMatchMedia(true)
    renderWithRouter(<Grid features={[pagination({ pageSize: 3 })]} mode="server" rowCount={30} />)
    await screen.findByRole('navigation', { name: 'Paginación' })
    expect(screen.getAllByRole('row')).toHaveLength(8) // las 7 filas que llegaron + cabecera
    expect(screen.getByText('Página 1 de 10')).toBeInTheDocument()
  })

  it('sin la feature no hay paginación', async () => {
    setMatchMedia(true)
    renderWithRouter(<Grid features={[]} />)
    await screen.findByRole('table')
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument()
  })
})
