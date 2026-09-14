import { screen } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { renderWithRouter } from '@/test/router'
import { DataGrid } from '../data-grid'
import { defineColumns } from '../define-columns'
import { useDataGrid, type UseDataGridOptions } from '../use-data-grid'
import { advancedFilter } from './advanced-filter'
import { clearAdvancedFilter, setAdvancedFilter } from './advanced-filter-store'

type Row = { id: string; name: string; days: number }
const columns = defineColumns<Row>((col) => [
  col.accessor('name', { header: 'Producto', meta: { filter: 'text' } }),
  col.accessor('days', { header: 'Días', meta: { filter: 'range' } }),
])
const rows: Row[] = [
  { id: '1', name: 'Zirconio', days: 5 },
  { id: '2', name: 'Acrílico', days: 12 },
]

function Grid({
  features,
  ...rest
}: { features: ReturnType<typeof advancedFilter>[] } & Partial<
  Pick<UseDataGridOptions<Row>, 'mode' | 'rowCount'>
>) {
  const grid = useDataGrid({
    key: 'test',
    columns,
    data: rows,
    features,
    getRowId: (r) => r.id,
    ...rest,
  })
  return (
    <DataGrid.Root grid={grid} emptyMessage="Vacío">
      <DataGrid.Toolbar />
      <DataGrid.Content />
    </DataGrid.Root>
  )
}

/** Abre el diálogo, añade «Días mayor que 10» y aplica: pasos comunes a varios tests. */
async function applyDaysGreaterThan10(user: UserEvent) {
  await user.click(await screen.findByRole('button', { name: 'Filtro avanzado' }))
  const dialog = await screen.findByRole('dialog', { name: 'Filtro avanzado' })
  await user.click(screen.getByRole('button', { name: 'Añadir condición' }))
  await user.selectOptions(screen.getByLabelText('Columna 1'), 'days')
  await user.selectOptions(screen.getByLabelText('Operador 1'), 'mayor')
  await user.type(screen.getByLabelText('Valor 1'), '10')
  await user.click(screen.getByRole('button', { name: 'Aplicar' }))
  return dialog
}

describe('feature advancedFilter', () => {
  afterEach(() => clearAdvancedFilter('test'))

  it('aplica una condición desde el diálogo y la muestra como chip', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderWithRouter(<Grid features={[advancedFilter()]} />)
    const dialog = await applyDaysGreaterThan10(user)
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

  it('limpia el filtro al desmontar: remontar con la misma key no arrastra condiciones', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    const { unmount } = renderWithRouter(<Grid features={[advancedFilter()]} />)
    await applyDaysGreaterThan10(user)
    expect(screen.queryByText('Zirconio')).not.toBeInTheDocument()

    unmount()
    renderWithRouter(<Grid features={[advancedFilter()]} />)

    expect(await screen.findByText('Zirconio')).toBeInTheDocument()
    expect(screen.getByText('Acrílico')).toBeInTheDocument()
    expect(screen.queryByText('Días mayor que 10')).not.toBeInTheDocument()
  })

  it('en modo servidor no hace nada: sin botón y sin filtrar aunque el store tenga una condición', async () => {
    setMatchMedia(true)
    // El store ya trae una condición antes de montar: si `advancedFilter()` no respetara
    // `mode: 'server'`, la tabla llegaría filtrada y/o mostraría el botón.
    setAdvancedFilter('test', {
      logic: 'and',
      conditions: [{ column: 'days', op: 'mayor', value: '10' }],
    })
    renderWithRouter(<Grid features={[advancedFilter()]} mode="server" rowCount={rows.length} />)
    expect(await screen.findByText('Zirconio')).toBeInTheDocument()
    expect(screen.getByText('Acrílico')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Filtro avanzado' })).not.toBeInTheDocument()
  })
})
