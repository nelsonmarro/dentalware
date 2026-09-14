import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { defineColumns } from './define-columns'
import { filtering } from './features/filtering'
import { grouping } from './features/grouping'
import { resizing } from './features/resizing'
import { formatAggregate, useDataGrid } from './use-data-grid'

type Row = { id: string; name: string }
const columns = defineColumns<Row>((col) => [col.accessor('name', { header: 'Nombre' })])
const data: Row[] = [
  { id: '1', name: 'Ana' },
  { id: '2', name: 'Beto' },
]

describe('useDataGrid', () => {
  afterEach(() => localStorage.clear())

  it('sin features expone las filas tal cual y has() es falso para todo', () => {
    const { result } = renderHook(() =>
      useDataGrid({ key: 'test', columns, data, getRowId: (r) => r.id }),
    )
    expect(result.current.table.getRowModel().rows.map((r) => r.id)).toEqual(['1', '2'])
    expect(result.current.has('sorting')).toBe(false)
    expect(result.current.mode).toBe('client')
  })

  it('fusiona las features y opciones de cada módulo registrado', () => {
    const { result } = renderHook(() =>
      useDataGrid({
        key: 'test',
        columns,
        data,
        getRowId: (r) => r.id,
        features: [{ id: 'sorting', tanstack: {}, options: () => ({ enableSorting: false }) }],
      }),
    )
    expect(result.current.has('sorting')).toBe(true)
    expect(result.current.table.options.enableSorting).toBe(false)
  })

  it('meta.width se aplica como size', () => {
    const withWidth = defineColumns<Row>((col) => [
      col.accessor('name', { header: 'Nombre', meta: { width: 200 } }),
    ])
    const { result } = renderHook(() =>
      useDataGrid({ key: 'test', columns: withWidth, data, getRowId: (r) => r.id }),
    )
    expect(result.current.table.getColumn('name')?.columnDef.size).toBe(200)
  })

  it('meta.aggregate se aplica como aggregationFn y aggregatedCell formateado; meta.groupable habilita enableGrouping', () => {
    type RowWithPrice = Row & { price: number }
    const withMeta = defineColumns<RowWithPrice>((col) => [
      col.accessor('name', { header: 'Nombre', meta: { groupable: true } }),
      col.accessor('price', { header: 'Precio', meta: { aggregate: 'sum' } }),
    ])
    const { result } = renderHook(() =>
      useDataGrid({
        key: 'test',
        columns: withMeta,
        data: [{ id: '1', name: 'Ana', price: 10 }],
        getRowId: (r) => r.id,
      }),
    )
    const name = result.current.table.getColumn('name')
    const price = result.current.table.getColumn('price')
    // Sin `meta.groupable` una columna sería agrupable por defecto (TanStack): se limita a las
    // columnas marcadas explícitamente.
    expect(name?.columnDef.enableGrouping).toBe(true)
    expect(price?.columnDef.enableGrouping).toBe(false)
    // Se registra una definición propia (`moneySum`, no el string 'sum' ni el `aggregationFn_sum`
    // nativo de TanStack: ver los comentarios en `use-data-grid.ts`), así que se comprueba
    // comportamiento (`aggregate`), no identidad.
    const aggregationFn = price?.columnDef.aggregationFn as
      { aggregate: (ctx: { getValue: (row: unknown) => number }) => number } | undefined
    expect(typeof aggregationFn?.aggregate).toBe('function')
    const aggregatedCell = price?.columnDef.aggregatedCell as
      ((ctx: { getValue: () => unknown }) => unknown) | undefined
    expect(aggregatedCell).toBeTypeOf('function')
    expect(aggregatedCell?.({ getValue: () => 12.345 })).toBe('12.35')
  })

  it('meta.aggregate `sum` suma cadenas decimales de dinero, no solo números', () => {
    // El dinero viaja como cadena decimal ("45.00", conventions §4): `aggregationFn_sum` de
    // TanStack ignora todo lo que no sea `typeof value === 'number'`, así que sumar precios
    // agrupados daría "0.00" si no se convierte cada valor con `Number()` antes de sumar.
    type RowMoney = { id: string; category: string; price: string }
    const withMoney = defineColumns<RowMoney>((col) => [
      col.accessor('category', { header: 'Categoría', meta: { groupable: true } }),
      col.accessor('price', { header: 'Precio', meta: { aggregate: 'sum' } }),
    ])
    const { result } = renderHook(() =>
      useDataGrid({
        key: 'test',
        columns: withMoney,
        data: [
          { id: '1', category: 'Fija', price: '45.00' },
          { id: '2', category: 'Fija', price: '30.00' },
        ],
        features: [grouping({ initial: 'category' })],
        getRowId: (r) => r.id,
      }),
    )
    const groupRow = result.current.table.getRowModel().rows.find((r) => r.getIsGrouped())
    if (!groupRow) throw new Error('no se encontró la fila de grupo')
    const priceCell = groupRow.getAllCells().find((c) => c.column.id === 'price')
    if (!priceCell) throw new Error('no se encontró la celda de precio')
    const aggregatedCell = priceCell.column.columnDef.aggregatedCell as
      ((ctx: { getValue: () => unknown }) => unknown) | undefined
    expect(aggregatedCell?.({ getValue: () => priceCell.getValue() })).toBe('75.00')
  })

  it('formatAggregate: `sum` con dos decimales, `count` como entero', () => {
    expect(formatAggregate('sum', 75)).toBe('75.00')
    expect(formatAggregate('sum', 12.345)).toBe('12.35')
    expect(formatAggregate('count', 3.9)).toBe('3')
  })

  it('transformData de una feature se aplica a los datos', () => {
    const { result } = renderHook(() =>
      useDataGrid({
        key: 'test',
        columns,
        data,
        getRowId: (r) => r.id,
        features: [
          {
            id: 'advancedFilter',
            tanstack: {},
            transformData: (rows) =>
              (rows as typeof data).filter((r) => r.name === 'Ana') as never[],
          },
        ],
      }),
    )
    expect(result.current.table.getRowModel().rows.map((r) => r.id)).toEqual(['1'])
  })

  it('el initialState que devuelve options() se fusiona con el de otras features', () => {
    localStorage.setItem('datagrid:test-fusion:sizing:v1', '{"name":300}')
    const { result } = renderHook(() =>
      useDataGrid({
        key: 'test-fusion',
        columns,
        data,
        getRowId: (r) => r.id,
        features: [filtering(), resizing()],
      }),
    )
    // `filtering()` siembra `initialState: { globalFilter: '' }` (estático) y `resizing()` siembra
    // `columnSizing` calculado en `options()` a partir de lo guardado: ninguno debe pisar al otro.
    expect(result.current.table.state.globalFilter).toBe('')
    expect(result.current.table.state.columnSizing).toEqual({ name: 300 })
  })
})
