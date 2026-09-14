import { createSortedRowModel, rowSortingFeature, sortFns } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useGrid } from '../context'
import { columnLabel } from '../lib/column-label'
import type { GridFeature, GridHeader } from '../types'

function SortButton({ header }: { header: GridHeader<never> }) {
  const column = header.column
  if (!column.getCanSort()) return null
  const sorted = column.getIsSorted()
  const label = columnLabel(column)
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

const SELECT_CLASS =
  'h-11 rounded-lg border border-input bg-transparent px-3 text-base focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:text-sm dark:bg-input/30'

/**
 * Control de orden para la toolbar en móvil (spec §4: «orden y filtros disponibles desde la
 * toolbar con controles de 44 px» en `< lg`). El botón de la cabecera (`SortButton`) solo existe
 * en la tabla de escritorio (`parts/header-cell.tsx`), así que en tarjetas no hay otra forma de
 * ordenar. Se monta siempre — oculto con `lg:hidden`, no condicionado por `useMediaQuery` — para
 * que quede en el DOM, accionable con teclado y sencillo de probar sin simular el viewport real.
 */
function MobileSortControls() {
  const grid = useGrid<never>()
  const { table, key } = grid
  const sortable = table.getAllLeafColumns().filter((c) => c.getCanSort())
  const current = table.state.sorting[0]
  const columnId = current?.id ?? ''
  const desc = current?.desc ?? false
  // Ids con la `key` del grid: dos grids con `sorting` en la misma página no chocan de id.
  const columnaId = `${key}-ordenar-por`
  const direccionId = `${key}-direccion-orden`

  const apply = (nextColumnId: string, nextDesc: boolean) => {
    table.setSorting(nextColumnId ? [{ id: nextColumnId, desc: nextDesc }] : [])
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end lg:hidden">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={columnaId}>Ordenar por</Label>
        <select
          id={columnaId}
          className={SELECT_CLASS}
          value={columnId}
          onChange={(e) => apply(e.target.value, desc)}
        >
          <option value="">Sin orden</option>
          {sortable.map((column) => (
            <option key={column.id} value={column.id}>
              {columnLabel(column)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={direccionId}>Dirección</Label>
        <select
          id={direccionId}
          className={SELECT_CLASS}
          value={desc ? 'desc' : 'asc'}
          disabled={!columnId}
          onChange={(e) => apply(columnId, e.target.value === 'desc')}
        >
          <option value="asc">Ascendente</option>
          <option value="desc">Descendente</option>
        </select>
      </div>
    </div>
  )
}

/** Orden por columna (cliente o servidor). `multi` habilita varias columnas con Shift. */
export function sorting(opts: { multi?: boolean } = {}): GridFeature {
  return {
    id: 'sorting',
    tanstack: { rowSortingFeature, sortedRowModel: createSortedRowModel(), sortFns },
    options: () => ({ enableMultiSort: opts.multi ?? false }),
    slots: { headerCell: SortButton, toolbar: MobileSortControls },
  }
}
