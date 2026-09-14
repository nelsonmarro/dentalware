import { describe, expect, it } from 'vitest'
import { columnLabel } from './column-label'
import type { GridColumn } from '../types'

function fakeColumn(meta: { label?: string } | undefined, header: unknown, id: string) {
  return { id, columnDef: { meta, header } } as unknown as GridColumn<never>
}

describe('columnLabel', () => {
  it('usa meta.label cuando está presente', () => {
    expect(columnLabel(fakeColumn({ label: 'Categoría' }, 'category', 'category'))).toBe(
      'Categoría',
    )
  })

  it('usa el header cuando es texto y no hay meta.label', () => {
    expect(columnLabel(fakeColumn(undefined, 'Nombre', 'name'))).toBe('Nombre')
  })

  it('usa el id de la columna cuando el header no es texto', () => {
    expect(columnLabel(fakeColumn(undefined, () => null, 'acciones'))).toBe('acciones')
  })
})
