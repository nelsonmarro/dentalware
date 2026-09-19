import { ChevronRight } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useGrid } from '../context'
import type { GridRow } from '../types'
import { HeaderCell } from './header-cell'
import { pinningStyles } from './pinning-styles'

/**
 * Fila de grupo (feature `grouping`): botón expandir/contraer y celdas agregadas. Aplica
 * `pinningStyles` a sus celdas igual que `GridTable` (mismo helper, mismas columnas) porque sale
 * gratis, aunque ninguna tabla combina hoy `grouping` + `pinning` (ver `docs/data-grid.md`).
 */
function GroupRow({
  row,
  hasResizing,
  hasPinning,
}: {
  row: GridRow<never>
  hasResizing: boolean
  hasPinning: boolean
}) {
  const { table } = useGrid<never>()
  const value = String(row.groupingValue)
  return (
    <TableRow className="bg-muted/40 font-medium" aria-label={`${value} (${row.subRows.length})`}>
      {row.getVisibleCells().map((cell) => (
        <TableCell
          key={cell.id}
          className={cn(
            // La celda con la etiqueta del grupo («Categoría (n)») queda fuera a propósito: con
            // `table-layout: fixed` (arriba) recortaría el conteo si la columna agrupada es
            // angosta. Se deja desbordar hacia la celda vacía de la columna siguiente (ninguna
            // otra columna de esta fila pinta contenido ahí salvo que también esté agregada, y
            // esa sí mantiene `overflow-hidden`).
            hasResizing && !cell.getIsGrouped() && 'overflow-hidden',
            cell.column.columnDef.meta?.align === 'right' && 'text-right',
          )}
          style={pinningStyles(cell.column, hasPinning)}
        >
          {cell.getIsGrouped() ? (
            <button
              type="button"
              className="inline-flex h-11 items-center gap-2"
              aria-expanded={row.getIsExpanded()}
              aria-label={`${row.getIsExpanded() ? 'Contraer' : 'Expandir'} ${value}`}
              onClick={row.getToggleExpandedHandler()}
            >
              <ChevronRight
                aria-hidden
                className={`size-4 transition-transform ${row.getIsExpanded() ? 'rotate-90' : ''}`}
              />
              {value} ({row.subRows.length})
            </button>
          ) : cell.getIsAggregated() ? (
            <table.FlexRender cell={cell} />
          ) : null}
        </TableCell>
      ))}
    </TableRow>
  )
}

export function GridTable() {
  const grid = useGrid<never>()
  const { table } = grid
  const hasPinning = grid.has('pinning')
  const hasResizing = grid.has('resizing')
  return (
    <div className="min-w-0 overflow-x-auto rounded-xl border border-border bg-card">
      <Table
        className="[&_tr>*:last-child]:pr-5"
        // `table-layout: fixed`: sin ella, un `<th style="width">` es solo una MÍNIMA garantía en
        // el layout automático (por defecto) — el navegador la respeta como piso, pero la supera
        // en cuanto el CONTENIDO de cualquier celda de esa columna (cabecera o cuerpo) la exige,
        // y entonces el resto de columnas fijas también crecen para mantener sus proporciones. Un
        // valor largo en una sola fila (un código o nombre de producto sin tope, por ejemplo)
        // bastaba para que la tabla entera excediera el contenedor pese a que la suma de anchos
        // declarados cupiera. Con `fixed`, el ancho de cada columna es exactamente el declarado
        // (`meta.width`/lo redimensionado): el contenido que no quepa se recorta con
        // `overflow-hidden` en la celda, nunca fuerza la tabla a crecer.
        style={hasResizing ? { width: table.getTotalSize(), tableLayout: 'fixed' } : undefined}
      >
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => {
                const meta = header.column.columnDef.meta
                const isSorted = grid.has('sorting') ? header.column.getIsSorted() : false
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={
                      isSorted === 'asc'
                        ? 'ascending'
                        : isSorted === 'desc'
                          ? 'descending'
                          : undefined
                    }
                    className={cn(
                      // `relative`: ancla el asa de `resizing` (posicionada de forma absoluta,
                      // ver `features/resizing.tsx`) al borde derecho de ESTA cabecera y no de un
                      // ancestro posicionado más arriba. `overflow-hidden`: con `table-layout:
                      // fixed` (arriba), una etiqueta que no quepa se recorta en vez de estirar la
                      // columna.
                      hasResizing && 'relative overflow-hidden',
                      meta?.cellClassName,
                      meta?.align === 'right' && 'text-right',
                    )}
                    style={{
                      ...pinningStyles(header.column, hasPinning),
                      ...(hasResizing ? { width: header.getSize() } : {}),
                    }}
                  >
                    <HeaderCell header={header} />
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) =>
            grid.has('grouping') && row.getIsGrouped() ? (
              <GroupRow key={row.id} row={row} hasResizing={hasResizing} hasPinning={hasPinning} />
            ) : (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        // Igual que en la cabecera: con `table-layout: fixed` un valor sin
                        // `truncate` propio (un código o un nombre largo) se recorta en la celda
                        // en vez de forzar la columna — y con ella, la tabla entera — más ancha.
                        hasResizing && 'overflow-hidden',
                        meta?.cellClassName,
                        meta?.align === 'right' && 'text-right',
                      )}
                      style={{
                        ...pinningStyles(cell.column, hasPinning),
                        ...meta?.cellStyle?.(row.original),
                      }}
                    >
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  )
                })}
              </TableRow>
            ),
          )}
        </TableBody>
      </Table>
    </div>
  )
}
