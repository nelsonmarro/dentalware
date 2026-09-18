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

  it('fija una columna sin fijar a la izquierda desde el menú', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderWithRouter(<Grid features={[pinning()]} />)
    const th = await screen.findByRole('columnheader', { name: /Código/ })
    expect(th).not.toHaveStyle({ position: 'sticky' })

    await user.click(screen.getByRole('button', { name: 'Opciones de la columna Código' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Fijar a la izquierda' }))

    expect(th).toHaveStyle({ position: 'sticky', insetInlineStart: '0px' })
    const stored = JSON.parse(localStorage.getItem('datagrid:pin-test:pinning:v1') ?? '{}') as {
      start: string[]
      end: string[]
    }
    expect(stored.start).toEqual(['code'])
    expect(stored.end).toEqual([])
  })

  it('fija una columna sin fijar a la derecha desde el menú', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderWithRouter(<Grid features={[pinning()]} />)
    const th = await screen.findByRole('columnheader', { name: /Código/ })
    expect(th).not.toHaveStyle({ position: 'sticky' })

    await user.click(screen.getByRole('button', { name: 'Opciones de la columna Código' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Fijar a la derecha' }))

    expect(th).toHaveStyle({ position: 'sticky', insetInlineEnd: '0px' })
    const stored = JSON.parse(localStorage.getItem('datagrid:pin-test:pinning:v1') ?? '{}') as {
      start: string[]
      end: string[]
    }
    expect(stored.end).toEqual(['code'])
    expect(stored.start).toEqual([])
  })

  it('restaura el fijado guardado en localStorage al montar, aunque no coincida con `left`/`right`', async () => {
    // M-9 de la revisión final del PR 3: los tests anteriores cubren fijar/mover/soltar y
    // comprueban `localStorage` después de cada acción, pero ninguno monta el grid con la clave
    // ya escrita para comprobar el viaje de vuelta — la rama `readStored` del `initialState`
    // solo se ejercitaba con su valor por defecto. Se escribe la clave con `name` fijado a la
    // derecha (justo lo contrario de `left: ['code']`) para que solo pase si `initialState` lee
    // de verdad lo guardado en vez de caer al fallback de las opciones.
    localStorage.setItem(
      'datagrid:pin-test:pinning:v1',
      JSON.stringify({ start: [], end: ['name'] }),
    )
    setMatchMedia(true)
    renderWithRouter(<Grid features={[pinning({ left: ['code'] })]} />)
    const codigo = await screen.findByRole('columnheader', { name: /Código/ })
    const nombre = await screen.findByRole('columnheader', { name: /Nombre/ })
    expect(codigo).not.toHaveStyle({ position: 'sticky' })
    expect(nombre).toHaveStyle({ position: 'sticky', insetInlineEnd: '0px' })
  })

  it('mueve una columna ya fijada a la izquierda hacia la derecha sin duplicarla', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderWithRouter(<Grid features={[pinning({ left: ['code'] })]} />)
    const th = await screen.findByRole('columnheader', { name: /Código/ })
    expect(th).toHaveStyle({ position: 'sticky', insetInlineStart: '0px' })

    await user.click(screen.getByRole('button', { name: 'Opciones de la columna Código' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Fijar a la derecha' }))

    expect(th).toHaveStyle({ position: 'sticky', insetInlineEnd: '0px' })
    const stored = JSON.parse(localStorage.getItem('datagrid:pin-test:pinning:v1') ?? '{}') as {
      start: string[]
      end: string[]
    }
    expect(stored.start).toEqual([])
    expect(stored.end).toEqual(['code'])
  })
})
