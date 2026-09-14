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

/** Fila de grupo (feature `grouping`): botón expandir/contraer y celdas agregadas. */
function GroupRow({ row }: { row: GridRow<never> }) {
  const { table } = useGrid<never>()
  const value = String(row.groupingValue)
  return (
    <TableRow className="bg-muted/40 font-medium" aria-label={`${value} (${row.subRows.length})`}>
      {row.getVisibleCells().map((cell) => (
        <TableCell
          key={cell.id}
          className={cell.column.columnDef.meta?.align === 'right' ? 'text-right' : ''}
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
        style={hasResizing ? { width: table.getTotalSize() } : undefined}
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
                    className={cn(meta?.cellClassName, meta?.align === 'right' && 'text-right')}
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
              <GroupRow key={row.id} row={row} />
            ) : (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(meta?.cellClassName, meta?.align === 'right' && 'text-right')}
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
