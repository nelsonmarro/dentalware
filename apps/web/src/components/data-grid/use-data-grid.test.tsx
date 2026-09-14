import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { defineColumns } from './define-columns'
import { filtering } from './features/filtering'
import { resizing } from './features/resizing'
import { useDataGrid } from './use-data-grid'

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
