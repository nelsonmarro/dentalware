import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { defineColumns } from './define-columns'
import { useGrid, useRootProps } from './context'

type Row = { id: string; name: string; city: string | null }

describe('defineColumns', () => {
  it('devuelve las columnas con su meta tipado y un id por columna', () => {
    const columns = defineColumns<Row>((col) => [
      col.accessor('name', { header: 'Nombre', meta: { mobile: 'title', filter: 'text' } }),
      col.accessor('city', { header: 'Ciudad', meta: { mobile: 'subtitle' } }),
      col.display({ id: 'actions', header: '', meta: { mobile: 'actions', align: 'right' } }),
    ])
    expect(columns).toHaveLength(3)
    expect(columns[0]?.meta?.mobile).toBe('title')
    expect(columns[2]?.id).toBe('actions')
  })
})

describe('useGrid', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('lanza error descriptivo fuera del provider', () => {
    expect(() => renderHook(() => useGrid())).toThrow(
      'Las partes de DataGrid deben usarse dentro de <DataGrid.Root>',
    )
  })
})

describe('useRootProps', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('lanza error descriptivo fuera del provider', () => {
    expect(() => renderHook(() => useRootProps())).toThrow(
      'Las partes de DataGrid deben usarse dentro de <DataGrid.Root>',
    )
  })
})
