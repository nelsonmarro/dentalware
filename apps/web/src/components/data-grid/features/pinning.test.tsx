import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { renderWithRouter } from '@/test/router'
import { DataGrid } from '../data-grid'
import { defineColumns } from '../define-columns'
import { useDataGrid } from '../use-data-grid'
import { pinning } from './pinning'

type Row = { id: string; code: string; name: string }
const columns = defineColumns<Row>((col) => [
  col.accessor('code', { header: 'Código' }),
  col.accessor('name', { header: 'Nombre' }),
])
const rows: Row[] = [{ id: '1', code: '26-00001', name: 'Ana' }]

function Grid({ features }: { features: ReturnType<typeof pinning>[] }) {
  const grid = useDataGrid({
    key: 'pin-test',
    columns,
    data: rows,
    features,
    getRowId: (r) => r.id,
  })
  return (
    <DataGrid.Root grid={grid} emptyMessage="Vacío">
      <DataGrid.Content />
    </DataGrid.Root>
  )
}

describe('feature pinning', () => {
  afterEach(() => localStorage.clear())

  it('fija la columna inicial con position sticky y permite soltarla desde el menú', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderWithRouter(<Grid features={[pinning({ left: ['code'] })]} />)
    const th = await screen.findByRole('columnheader', { name: /Código/ })
    expect(th).toHaveStyle({ position: 'sticky' })
    await user.click(screen.getByRole('button', { name: 'Opciones de la columna Código' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Soltar' }))
    expect(th).not.toHaveStyle({ position: 'sticky' })
    expect(localStorage.getItem('datagrid:pin-test:pinning:v1')).toContain('"start":[]')
  })

  it('sin la feature no hay menú de columna ni sticky', async () => {
    setMatchMedia(true)
    renderWithRouter(<Grid features={[]} />)
    await screen.findByRole('table')
    expect(screen.queryByRole('button', { name: /Opciones de la columna/ })).not.toBeInTheDocument()
  })
})
