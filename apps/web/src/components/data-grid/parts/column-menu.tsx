import { MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useGrid } from '../context'
import type { GridColumn } from '../types'

/**
 * Menú de columna: solo aparece si alguna feature registró un item (`slots.columnMenu`) que
 * `canApply` acepta para esta columna (sin `canApply`, aplica a todas). Evita el botón con un
 * menú vacío en una columna donde ningún item aplica (por ejemplo, una sin `meta.groupable`).
 */
export function ColumnMenu({ column, label }: { column: GridColumn<never>; label: string }) {
  const grid = useGrid<never>()
  const items = grid.features.flatMap((f) => {
    const slot = f.slots?.columnMenu
    if (!slot || !(slot.canApply?.(column) ?? true)) return []
    return [{ id: f.id, Item: slot.item }]
  })
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
