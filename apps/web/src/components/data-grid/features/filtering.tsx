import {
  columnFacetingFeature,
  columnFilteringFeature,
  createFacetedMinMaxValues,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  globalFilteringFeature,
} from '@tanstack/react-table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useGrid } from '../context'
import { normalize } from '../lib/normalize'
import type { GridFeature } from '../types'
import { ColumnFilter } from './filtering-column-filter'

/** Filtro de texto insensible a acentos y mayúsculas (celda y valor buscado normalizados). */
const accentInsensitive = (
  row: { getValue: (id: string) => unknown },
  columnId: string,
  value: unknown,
) => normalize(row.getValue(columnId)).includes(normalize(value))

/**
 * Filtro único registrado para todas las columnas (`defaultColumn.filterFn`): rango numérico
 * `[min, max]` cuando el valor es un array, igualdad normalizada para `meta.filter === 'select'`
 * y, en cualquier otro caso (texto o sin meta), coincidencia de subcadena sin acentos.
 */
const gridFilter = (
  row: { getValue: (id: string) => unknown; table: { getColumn: (id: string) => unknown } },
  columnId: string,
  value: unknown,
) => {
  if (Array.isArray(value)) {
    const n = Number(row.getValue(columnId))
    const [min, max] = value as [number | undefined, number | undefined]
    return (min === undefined || n >= min) && (max === undefined || n <= max)
  }
  if (value === undefined || value === '') return true
  const column = row.table.getColumn(columnId) as
    { columnDef: { meta?: { filter?: string } } } | undefined
  const kind = column?.columnDef.meta?.filter
  if (kind === 'select') return normalize(row.getValue(columnId)) === normalize(value)
  return accentInsensitive(row, columnId, value)
}

type SearchOpts = { id: string; label: string; placeholder?: string }

function Toolbar({ search, columns }: { search?: SearchOpts; columns: boolean }) {
  const grid = useGrid<never>()
  const { table } = grid
  const query = String(table.state.globalFilter ?? '')
  const filterable = columns
    ? table.getAllLeafColumns().filter((c) => c.columnDef.meta?.filter)
    : []
  return (
    <>
      {search && (
        <div className="flex flex-col gap-1.5 sm:max-w-xs">
          <Label htmlFor={search.id}>{search.label}</Label>
          <Input
            id={search.id}
            type="search"
            placeholder={search.placeholder}
            className="h-11"
            value={query}
            onChange={(e) => table.setGlobalFilter(e.target.value)}
          />
        </div>
      )}
      {filterable.map((column) => (
        <ColumnFilter key={column.id} column={column} />
      ))}
    </>
  )
}

/**
 * Búsqueda global (con etiqueta visible, UX1-09) y/o filtros por columna según `meta.filter`.
 * Un único `gridFilter` cubre texto sin acentos, igualdad normalizada (`select`) y rango
 * numérico `[min, max]` (`range`); `globalFilterFn` reutiliza la variante de texto (`accentInsensitive`).
 */
export function filtering(opts: { search?: SearchOpts; columns?: boolean } = {}): GridFeature {
  const columns = opts.columns ?? false
  return {
    id: 'filtering',
    tanstack: {
      columnFilteringFeature,
      globalFilteringFeature,
      columnFacetingFeature,
      filteredRowModel: createFilteredRowModel(),
      facetedRowModel: createFacetedRowModel(),
      facetedUniqueValues: createFacetedUniqueValues(),
      facetedMinMaxValues: createFacetedMinMaxValues(),
      filterFns: { gridFilter },
    },
    options: () => ({
      globalFilterFn: accentInsensitive,
      // Se pasa la función directa (no el string 'gridFilter'): el tipo `GridFeatures` que
      // tipa `options()` es fijo (`types.ts:gridFeaturesForTyping`) y no conoce los `filterFns`
      // que cada feature registra en runtime, así que el nombre no es un `FilterFnOption` válido
      // a nivel de tipos aunque sí lo sea en ejecución (registrado más abajo en `filterFns`).
      defaultColumn: { filterFn: gridFilter },
    }),
    initialState: { globalFilter: '' },
    slots: { toolbar: () => <Toolbar search={opts.search} columns={columns} /> },
  }
}
