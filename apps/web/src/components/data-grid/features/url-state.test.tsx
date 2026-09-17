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

  // Tarea 18 (trabajos): `urlState` sola (sin `filtering()`) registra `globalFilteringFeature`
  // para que `state.globalFilter` exista, pero NO registra `filteredRowModel` — esa fábrica
  // solo la aporta `filtering()`. Sin ella no hay row model que filtre por `globalFilter`, así
  // que pasarle un `q` a `urlState` en una tabla sin `filtering()` deja el valor en el estado sin
  // ocultar ninguna fila. Prueba de regresión para la decisión de `cases-table.tsx` de NO
  // reenviar `search.q` (el buscador de trabajos vive en `CasesFilters`, fuera del grid): si esto
  // dejara de cumplirse, una página del servidor perdería filas que sí existen.
  it('sin filtering(), un q en la URL no oculta filas (modo servidor)', () => {
    const navigate = vi.fn()
    const rows: Row[] = [
      { id: '1', codigo: 'AA-00001' },
      { id: '2', codigo: 'BB-00002' },
    ]
    const features = [
      pagination({ pageSize: 25 }),
      urlState({ search: { q: 'zzz-no-existe' }, navigate, pageSize: 25 }),
    ]
    const { result } = renderHook(() =>
      useDataGrid({
        key: 't2',
        columns,
        data: rows,
        features,
        mode: 'server',
        rowCount: rows.length,
        getRowId: (r) => r.id,
      }),
    )
    expect(result.current.table.state.globalFilter).toBe('zzz-no-existe')
    expect(result.current.table.getRowModel().rows).toHaveLength(2)
  })
})
