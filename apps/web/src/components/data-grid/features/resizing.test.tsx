import { fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { renderWithRouter } from '@/test/router'
import { DataGrid } from '../data-grid'
import { defineColumns } from '../define-columns'
import { useDataGrid } from '../use-data-grid'
import { resizing } from './resizing'

type Row = { id: string; name: string }
const columns = defineColumns<Row>((col) => [
  col.accessor('name', { header: 'Nombre', meta: { width: 200 } }),
])
const rows: Row[] = [{ id: '1', name: 'Ana' }]

function Grid({ features }: { features: ReturnType<typeof resizing>[] }) {
  const grid = useDataGrid({
    key: 'resize-test',
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

describe('feature resizing', () => {
  afterEach(() => localStorage.clear())

  it('aplica el ancho inicial de meta.width y lo cambia con el teclado', async () => {
    setMatchMedia(true)
    renderWithRouter(<Grid features={[resizing()]} />)
    const th = await screen.findByRole('columnheader', { name: /Nombre/ })
    expect(th).toHaveStyle({ width: '200px' })
    const handle = screen.getByRole('separator', { name: 'Redimensionar Nombre' })
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(th).toHaveStyle({ width: '216px' })
    expect(localStorage.getItem('datagrid:resize-test:sizing:v1')).toContain('"name":216')
  })

  it('restaura el ancho guardado al montar', async () => {
    localStorage.setItem('datagrid:resize-test:sizing:v1', '{"name":300}')
    setMatchMedia(true)
    renderWithRouter(<Grid features={[resizing()]} />)
    expect(await screen.findByRole('columnheader', { name: /Nombre/ })).toHaveStyle({
      width: '300px',
    })
  })

  it('sin la feature no hay asas', async () => {
    setMatchMedia(true)
    renderWithRouter(<Grid features={[]} />)
    await screen.findByRole('table')
    expect(screen.queryByRole('separator')).not.toBeInTheDocument()
  })
})
