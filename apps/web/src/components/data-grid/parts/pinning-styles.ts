import type { CSSProperties } from 'react'
import type { GridColumn } from '../types'

/**
 * Estilos sticky de una columna fijada (patrón del ejemplo oficial `column-pinning-sticky` de
 * TanStack). Sombra en el borde de la última columna fijada a la izquierda / primera fijada a la
 * derecha, calculada con `table.getStartVisibleLeafColumns()`/`getEndVisibleLeafColumns()` (no
 * `column.getIsLastColumn()`/`getIsFirstColumn()`: esas viven en `columnOrderingFeature`, que la
 * feature `pinning` no registra — ver el reporte de la Tarea 16). Sin la feature `pinning`
 * (`hasPinning` en `false`) devuelve `{}`.
 */
export function pinningStyles(column: GridColumn<never>, hasPinning: boolean): CSSProperties {
  if (!hasPinning) return {}
  const pinned = column.getIsPinned()
  if (!pinned) return {}
  const lastLeft =
    pinned === 'start' && column.table.getStartVisibleLeafColumns().at(-1)?.id === column.id
  const firstRight =
    pinned === 'end' && column.table.getEndVisibleLeafColumns()[0]?.id === column.id
  return {
    position: 'sticky',
    insetInlineStart: pinned === 'start' ? `${column.getStart('start')}px` : undefined,
    insetInlineEnd: pinned === 'end' ? `${column.getAfter('end')}px` : undefined,
    zIndex: 1,
    background: 'var(--card)',
    boxShadow: lastLeft
      ? 'inset -1px 0 0 var(--border)'
      : firstRight
        ? 'inset 1px 0 0 var(--border)'
        : undefined,
  }
}
