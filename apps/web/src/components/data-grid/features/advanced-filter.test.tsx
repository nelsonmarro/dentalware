import { screen, within } from '@testing-library/react'
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
  // Columna de acciones sin accessor pero con `meta.filter` a propósito (caso patológico): prueba
  // que el selector la excluye por no tener un valor resoluble, no solo por `meta.filter` ausente.
  col.display({ id: 'acciones', header: 'Acciones', meta: { filter: 'text' } }),
])
const rows: Row[] = [
  { id: '1', name: 'Zirconio', days: 5 },
  { id: '2', name: 'Acrílico', days: 12 },
]

// Fila con categoría anidada (accessor derivado, id de columna distinto del campo crudo): el caso
// real de productos que `matches()` no resolvía antes de recibir `getRowValue`.
type CategoryRow = { id: string; name: string; category: { id: string; name: string } }
const categoryColumns = defineColumns<CategoryRow>((col) => [
  col.accessor('name', { header: 'Producto', meta: { filter: 'text' } }),
  col.accessor((r) => r.category.name, {
    id: 'categoria',
    header: 'Categoría',
    meta: { filter: 'text' },
  }),
])
const categoryRows: CategoryRow[] = [
  { id: '1', name: 'Zirconio', category: { id: 'c1', name: 'Fija' } },
  { id: '2', name: 'Acrílico', category: { id: 'c2', name: 'Removible' } },
]

// Una columna por tipo de `meta.filter`, para probar qué operadores ofrece el diálogo en cada caso
// (I-2 de la revisión final del PR 2: `select` solo debía ofrecer «es»/«no es», no los de texto).
type OperatorsRow = { id: string; name: string; category: string; days: number }
const operatorsColumns = defineColumns<OperatorsRow>((col) => [
  col.accessor('name', { header: 'Nombre', meta: { filter: 'text' } }),
  col.accessor('category', { header: 'Categoría', meta: { filter: 'select' } }),
  col.accessor('days', { header: 'Días', meta: { filter: 'range' } }),
])
const operatorsRows: OperatorsRow[] = [
  { id: '1', name: 'Zirconio', category: 'Fija', days: 5 },
  { id: '2', name: 'Acrílico', category: 'Removible', days: 12 },
]

function OperatorsGrid({ features }: { features: ReturnType<typeof advancedFilter>[] }) {
  const grid = useDataGrid({
    key: 'test-operadores',
    columns: operatorsColumns,
    data: operatorsRows,
    features,
    getRowId: (r) => r.id,
  })
  return (
    <DataGrid.Root grid={grid} emptyMessage="Vacío">
      <DataGrid.Toolbar />
      <DataGrid.Content />
    </DataGrid.Root>
  )
}

function CategoryGrid({ features }: { features: ReturnType<typeof advancedFilter>[] }) {
  const grid = useDataGrid({
    key: 'test-categoria',
    columns: categoryColumns,
    data: categoryRows,
    features,
    getRowId: (r) => r.id,
  })
  return (
    <DataGrid.Root grid={grid} emptyMessage="Vacío">
      <DataGrid.Toolbar />
      <DataGrid.Content />
    </DataGrid.Root>
  )
}

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

  it('el selector de columna omite una sin valor resoluble aunque tenga meta.filter', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderWithRouter(<Grid features={[advancedFilter()]} />)
    await user.click(await screen.findByRole('button', { name: 'Filtro avanzado' }))
    await user.click(screen.getByRole('button', { name: 'Añadir condición' }))
    const options = within(screen.getByLabelText('Columna 1')).getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual(['Producto', 'Días'])
  })

  it('filtra por una columna de accessor derivado (id de columna distinto del campo crudo)', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderWithRouter(<CategoryGrid features={[advancedFilter()]} />)
    await user.click(await screen.findByRole('button', { name: 'Filtro avanzado' }))
    await user.click(screen.getByRole('button', { name: 'Añadir condición' }))
    await user.selectOptions(screen.getByLabelText('Columna 1'), 'categoria')
    await user.selectOptions(screen.getByLabelText('Operador 1'), 'es')
    await user.type(screen.getByLabelText('Valor 1'), 'Fija')
    await user.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(screen.getByText('Zirconio')).toBeInTheDocument()
    expect(screen.queryByText('Acrílico')).not.toBeInTheDocument()
    clearAdvancedFilter('test-categoria')
  })

  it('ofrece los operadores según meta.filter: select solo es/no es, text los cuatro, range los numéricos', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderWithRouter(<OperatorsGrid features={[advancedFilter()]} />)
    await user.click(await screen.findByRole('button', { name: 'Filtro avanzado' }))
    await user.click(screen.getByRole('button', { name: 'Añadir condición' }))
    // La fila de condición usa `key={condition.column}-${i}` (`advanced-filter-dialog.tsx`): al
    // cambiar de columna, React remonta la fila y con ella el <select> de operador — hay que
    // volver a consultarlo en cada paso, nunca reusar la referencia capturada antes del cambio.
    const operatorLabels = () =>
      within(screen.getByLabelText('Operador 1'))
        .getAllByRole('option')
        .map((o) => o.textContent)

    await user.selectOptions(screen.getByLabelText('Columna 1'), 'category')
    expect(operatorLabels()).toEqual(['es', 'no es'])

    await user.selectOptions(screen.getByLabelText('Columna 1'), 'name')
    expect(operatorLabels()).toEqual(['contiene', 'es', 'no es', 'empieza con'])

    await user.selectOptions(screen.getByLabelText('Columna 1'), 'days')
    expect(operatorLabels()).toEqual(['es', 'no es', 'mayor que', 'menor que', 'entre'])

    clearAdvancedFilter('test-operadores')
  })
})
