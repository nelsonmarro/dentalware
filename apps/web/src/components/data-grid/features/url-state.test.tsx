import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { defineColumns } from '../define-columns'
import { useDataGrid } from '../use-data-grid'
import { pagination } from './pagination'
import { sorting } from './sorting'
import { ordenToSorting, sortingToOrden, urlState } from './url-state'

describe('urlState: mapeo puro', () => {
  it('orden ↔ sorting', () => {
    expect(ordenToSorting('entrega-desc')).toEqual([{ id: 'entrega', desc: true }])
    expect(ordenToSorting('codigo')).toEqual([{ id: 'codigo', desc: false }])
    expect(ordenToSorting(undefined)).toEqual([])
    expect(sortingToOrden([{ id: 'clinica', desc: true }])).toBe('clinica-desc')
    expect(sortingToOrden([])).toBeUndefined()
  })
})

type Row = { id: string; codigo: string }
const columns = defineColumns<Row>((col) => [col.accessor('codigo', { header: 'Código' })])

describe('urlState: enlaza el estado del grid con la URL', () => {
  it('lee pagina/orden/q de search y navega al cambiar, reseteando pagina', () => {
    const navigate = vi.fn()
    const features = [
      sorting(),
      pagination({ pageSize: 25 }),
      urlState({ search: { pagina: 3, orden: 'codigo-desc', q: 'ana' }, navigate, pageSize: 25 }),
    ]
    const { result } = renderHook(() =>
      useDataGrid({
        key: 't',
        columns,
        data: [],
        features,
        mode: 'server',
        rowCount: 100,
        getRowId: (r) => r.id,
      }),
    )
    const state = result.current.table.state
    expect(state.pagination).toEqual({ pageIndex: 2, pageSize: 25 })
    expect(state.sorting).toEqual([{ id: 'codigo', desc: true }])
    expect(state.globalFilter).toBe('ana')

    result.current.table.nextPage()
    expect(navigate).toHaveBeenLastCalledWith({ pagina: 4 })
    result.current.table.setSorting([{ id: 'codigo', desc: false }])
    expect(navigate).toHaveBeenLastCalledWith({ orden: 'codigo', pagina: undefined })
    result.current.table.setGlobalFilter('beto')
    expect(navigate).toHaveBeenLastCalledWith({ q: 'beto', pagina: undefined })
  })
})
