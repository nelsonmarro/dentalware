import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { defineColumns } from './define-columns'
import { useGrid } from './context'

type Row = { id: string; name: string; city: string }

describe('defineColumns', () => {
  it('devuelve las columnas con su meta tipado', () => {
    const columns = defineColumns<Row>((col) => [
      col.accessor('name', { header: 'Nombre', meta: { mobile: 'title', filter: 'text' } }),
      col.accessor('city', { header: 'Ciudad', meta: { mobile: 'subtitle' } }),
    ])
    expect(columns).toHaveLength(2)
    expect(columns[0]?.meta?.mobile).toBe('title')
    expect(columns[1]?.meta?.mobile).toBe('subtitle')
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
