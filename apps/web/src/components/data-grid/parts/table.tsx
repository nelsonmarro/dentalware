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
import { HeaderCell } from './header-cell'
import { pinningStyles } from './pinning-styles'

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
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              data-grouped={grid.has('grouping') && row.getIsGrouped() ? '' : undefined}
            >
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
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
