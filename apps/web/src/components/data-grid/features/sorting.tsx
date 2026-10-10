import { createSortedRowModel, rowSortingFeature, sortFns } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useGrid } from '../context'
import { columnLabel } from '../lib/column-label'
import type { GridColumn, GridFeature, GridHeader } from '../types'

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

type SortDir = 'asc' | 'desc'
const SORT_DIRS: readonly SortDir[] = ['asc', 'desc']
const DEFAULT_DIR_TEXT: Record<SortDir, string> = { asc: 'ascendente', desc: 'descendente' }

/** Texto de la opción de una columna en un sentido: `meta.sortLabels` si lo declara («Clínica
 * A–Z», «Saldo: de mayor a menor»), o «<Columna>: ascendente/descendente». */
function sortOptionText(column: GridColumn<never>, dir: SortDir): string {
  return (
    column.columnDef.meta?.sortLabels?.[dir] ?? `${columnLabel(column)}: ${DEFAULT_DIR_TEXT[dir]}`
  )
}

/** Valor de la opción: id de la columna y sentido (`clinica:asc`). */
const optionValue = (columnId: string, dir: SortDir) => `${columnId}:${dir}`

/**
 * Control de orden para la toolbar en móvil (spec §4: «orden y filtros disponibles desde la
 * toolbar con controles de 44 px» en `< lg`). El botón de la cabecera (`SortButton`) solo existe
 * en la tabla de escritorio (`parts/header-cell.tsx`), así que en tarjetas no hay otra forma de
 * ordenar. Un solo `select` «Ordenar» con columna y sentido ya combinados («Saldo: de mayor a
 * menor»), para no apilar dos controles antes de la primera tarjeta (UX5-09). Se monta siempre —
 * oculto con `lg:hidden`, no condicionado por `useMediaQuery` — para que quede en el DOM,
 * accionable con teclado y sencillo de probar sin simular el viewport real.
 */
function MobileSortControl() {
  const grid = useGrid<never>()
  const { table, key } = grid
  const sortable = table.getAllLeafColumns().filter((c) => c.getCanSort())
  const current = table.state.sorting[0]
  const value = current ? optionValue(current.id, current.desc ? 'desc' : 'asc') : ''
  // Id con la `key` del grid: dos grids con `sorting` en la misma página no chocan de id.
  const id = `${key}-ordenar`

  const apply = (next: string) => {
    const at = next.lastIndexOf(':')
    table.setSorting(at > 0 ? [{ id: next.slice(0, at), desc: next.slice(at + 1) === 'desc' }] : [])
  }

  return (
    <div className="flex flex-col gap-1.5 lg:hidden">
      <Label htmlFor={id}>Ordenar</Label>
      <select
        id={id}
        className={SELECT_CLASS}
        value={value}
        onChange={(e) => apply(e.target.value)}
      >
        <option value="">Sin orden</option>
        {sortable.flatMap((column) =>
          SORT_DIRS.map((dir) => (
            <option key={optionValue(column.id, dir)} value={optionValue(column.id, dir)}>
              {sortOptionText(column, dir)}
            </option>
          )),
        )}
      </select>
    </div>
  )
}

/** Orden por columna (cliente o servidor). `multi` habilita varias columnas con Shift. */
export function sorting(opts: { multi?: boolean } = {}): GridFeature {
  return {
    id: 'sorting',
    tanstack: { rowSortingFeature, sortedRowModel: createSortedRowModel(), sortFns },
    options: () => ({ enableMultiSort: opts.multi ?? false }),
    slots: { headerCell: SortButton, toolbar: MobileSortControl },
  }
}
