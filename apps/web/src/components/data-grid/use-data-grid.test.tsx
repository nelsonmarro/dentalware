import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { defineColumns } from './define-columns'
import { useDataGrid } from './use-data-grid'

type Row = { id: string; name: string }
const columns = defineColumns<Row>((col) => [col.accessor('name', { header: 'Nombre' })])
const data: Row[] = [
  { id: '1', name: 'Ana' },
  { id: '2', name: 'Beto' },
]

describe('useDataGrid', () => {
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
})
