import {
  columnVisibilityFeature,
  metaHelper,
  tableFeatures,
  useTable,
  type RowData,
} from '@tanstack/react-table'
import { useMemo } from 'react'
import type {
  GridColumnMeta,
  GridColumns,
  GridFeature,
  GridFeatureId,
  GridFeatures,
  GridInstance,
  GridMode,
} from './types'

export type UseDataGridOptions<T extends RowData> = {
  /** Clave estable por tabla: nombra la persistencia local (`datagrid:<key>`). */
  key: string
  columns: GridColumns<T>
  data: T[]
  features?: GridFeature[]
  mode?: GridMode
  /** Total de filas en modo servidor (para calcular páginas). */
  rowCount?: number
  getRowId: (row: T) => string
}

/**
 * Compone `tableFeatures()` y `useTable()` a partir de la lista de módulos: cada módulo aporta
 * sus features de TanStack, sus opciones y su estado inicial. Nada fuera de la lista existe en
 * runtime, aunque el tipo `GridFeatures` sea el conjunto completo.
 */
export function useDataGrid<T extends RowData>(opts: UseDataGridOptions<T>): GridInstance<T> {
  // La lista de features se declara una vez por tabla (constante de módulo o useMemo del
  // llamador): memorizarla aquí evita recomputar `tableFeatures()` cuando solo cambia `data`.
  const list = useMemo(() => opts.features ?? [], [opts.features])
  const mode = opts.mode ?? 'client'
  const init = { key: opts.key, mode, rowCount: opts.rowCount }

  const features = useMemo(
    () =>
      tableFeatures({
        columnMeta: metaHelper<GridColumnMeta>(),
        // Feature de core (sin row model propio): mantiene `row.getVisibleCells()` atado a la
        // misma fuente de visibilidad/orden que `table.getHeaderGroups()` usa para la cabecera
        // (ver `parts/table.tsx`), aunque ninguna feature registrada la use todavía.
        columnVisibilityFeature,
        ...Object.assign({}, ...list.map((f) => f.tanstack)),
      }) as unknown as GridFeatures,
    [list],
  )

  const merged = list.reduce<Record<string, unknown>>(
    (acc, f) => ({ ...acc, ...(f.options?.(init) ?? {}) }),
    {},
  )
  const initialState = list.reduce<Record<string, unknown>>(
    (acc, f) => ({ ...acc, ...(f.initialState ?? {}) }),
    {},
  )
  const serverOptions =
    mode === 'server'
      ? {
          manualPagination: true,
          manualSorting: true,
          manualFiltering: true,
          rowCount: opts.rowCount,
        }
      : {}

  const table = useTable<GridFeatures, T>(
    {
      features,
      columns: opts.columns,
      data: opts.data,
      getRowId: (row) => opts.getRowId(row),
      initialState: initialState as never,
      ...serverOptions,
      ...merged,
    },
    (state) => state,
  )

  const ids = new Set<GridFeatureId>(list.map((f) => f.id))
  return { table, key: opts.key, mode, features: list, has: (id) => ids.has(id) }
}
