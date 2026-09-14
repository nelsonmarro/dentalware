import {
  aggregationFns,
  columnGroupingFeature,
  createExpandedRowModel,
  createGroupedRowModel,
  rowAggregationFeature,
  rowExpandingFeature,
} from '@tanstack/react-table'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { useGrid } from '../context'
import { columnLabel } from '../lib/column-label'
import type { GridColumn, GridFeature } from '../types'

function GroupBySelect() {
  const grid = useGrid<never>()
  const { table, key } = grid
  const groupable = table.getAllLeafColumns().filter((c) => c.columnDef.meta?.groupable)
  const current = table.state.grouping[0] ?? ''
  // Id con la `key` del grid: dos grids con `grouping` en la misma página no chocan de id.
  const selectId = `${key}-agrupar-por`
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={selectId}>Agrupar por</Label>
      <select
        id={selectId}
        className="h-11 rounded-md border border-input bg-background px-3 text-sm"
        value={current}
        onChange={(e) => table.setGrouping(e.target.value ? [e.target.value] : [])}
      >
        <option value="">Sin agrupar</option>
        {groupable.map((c) => (
          <option key={c.id} value={c.id}>
            {columnLabel(c)}
          </option>
        ))}
      </select>
    </div>
  )
}

function GroupMenuItem({ column }: { column: GridColumn<never> }) {
  const grouped = column.getIsGrouped()
  // No `column.toggleGrouping()`: acumula en el array de `grouping` (pensado para agrupación
  // multi-columna), pero el resto de la feature asume una sola columna (`grouping[0]` en
  // `GroupBySelect`, `row.groupingValue` en `parts/table.tsx`/`parts/cards.tsx`). Se reemplaza
  // el array entero: agrupar por otra columna sustituye la anterior en vez de anidarla.
  return (
    <DropdownMenuItem onSelect={() => column.table.setGrouping(grouped ? [] : [column.id])}>
      {grouped ? 'Quitar agrupación' : `Agrupar por ${columnLabel(column)}`}
    </DropdownMenuItem>
  )
}

/** Agrupación por una columna `groupable`, filas de grupo expandibles y agregados por `meta.aggregate`. */
export function grouping(opts: { initial?: string } = {}): GridFeature {
  return {
    id: 'grouping',
    tanstack: {
      columnGroupingFeature,
      rowExpandingFeature,
      rowAggregationFeature,
      groupedRowModel: createGroupedRowModel(),
      expandedRowModel: createExpandedRowModel(),
      aggregationFns,
    },
    initialState: { grouping: opts.initial ? [opts.initial] : [], expanded: true },
    slots: {
      toolbar: GroupBySelect,
      columnMenu: { item: GroupMenuItem, canApply: (c) => !!c.columnDef.meta?.groupable },
    },
  }
}
