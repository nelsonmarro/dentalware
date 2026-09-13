import type { GridColumn } from '../types'

/** Etiqueta de columna para menús, orden y filtros: `meta.label` → header de texto → `column.id`. */
export function columnLabel(column: GridColumn<never>): string {
  return (
    column.columnDef.meta?.label ??
    (typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id)
  )
}
