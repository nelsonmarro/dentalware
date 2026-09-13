import { MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useGrid } from '../context'
import type { GridColumn } from '../types'

/** Menú de columna: solo aparece si alguna feature registró items (`slots.columnMenu`). */
export function ColumnMenu({ column, label }: { column: GridColumn<never>; label: string }) {
  const grid = useGrid<never>()
  const items = grid.features.flatMap((f) =>
    f.slots?.columnMenu ? [{ id: f.id, Item: f.slots.columnMenu }] : [],
  )
  if (items.length === 0) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Opciones de la columna ${label}`}>
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map(({ id, Item }) => (
          <Item key={id} column={column} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
