import { Button } from '@/components/ui/button'
import { useGrid } from '../context'

export function GridPagination() {
  const grid = useGrid<never>()
  if (!grid.has('pagination')) return null
  const { table } = grid
  const { pageIndex, pageSize } = table.store.get().pagination
  const pageCount = Math.max(table.getPageCount(), 1)
  const total =
    grid.mode === 'server'
      ? (table.options.rowCount ?? 0)
      : table.getPrePaginatedRowModel().rows.length
  const from = total === 0 ? 0 : pageIndex * pageSize + 1
  const to = Math.min((pageIndex + 1) * pageSize, total)
  return (
    <nav aria-label="Paginación" className="flex items-center justify-between gap-3">
      <Button
        type="button"
        variant="outline"
        className="h-11"
        disabled={!table.getCanPreviousPage()}
        onClick={() => table.previousPage()}
      >
        Anterior
      </Button>
      <p className="text-sm text-muted-foreground">
        <span>
          Página {pageIndex + 1} de {pageCount}
        </span>
        <span aria-live="polite" className="sr-only">
          Mostrando {from} a {to} de {total}
        </span>
      </p>
      <Button
        type="button"
        variant="outline"
        className="h-11"
        disabled={!table.getCanNextPage()}
        onClick={() => table.nextPage()}
      >
        Siguiente
      </Button>
    </nav>
  )
}
