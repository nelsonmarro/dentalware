import { createSortedRowModel, rowSortingFeature, sortFns } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { GridFeature, GridHeader } from '../types'

function SortButton({ header }: { header: GridHeader<never> }) {
  const column = header.column
  if (!column.getCanSort()) return null
  const sorted = column.getIsSorted()
  const label =
    column.columnDef.meta?.label ??
    (typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id)
  const Icon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`Ordenar por ${label}`}
      onClick={column.getToggleSortingHandler()}
    >
      <Icon aria-hidden className="size-4" />
    </Button>
  )
}

/** Orden por columna (cliente o servidor). `multi` habilita varias columnas con Shift. */
export function sorting(opts: { multi?: boolean } = {}): GridFeature {
  return {
    id: 'sorting',
    tanstack: { rowSortingFeature, sortedRowModel: createSortedRowModel(), sortFns },
    options: () => ({ enableMultiSort: opts.multi ?? false }),
    slots: { headerCell: SortButton },
  }
}
