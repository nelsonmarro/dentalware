import {
  aggregationFn_count,
  columnVisibilityFeature,
  constructAggregationFn,
  metaHelper,
  tableFeatures,
  useTable,
  type RowData,
} from '@tanstack/react-table'
import { useMemo } from 'react'
import { useTransformDataVersion } from './transform-data-version'
import type {
  GridColumnMeta,
  GridColumns,
  GridFeature,
  GridFeatureId,
  GridFeatures,
  GridInstance,
  GridMode,
} from './types'

/** Formato de la celda agregada de una fila de grupo: `sum` con dos decimales, `count` entero. */
export function formatAggregate(kind: NonNullable<GridColumnMeta['aggregate']>, value: unknown) {
  return kind === 'count' ? String(Math.trunc(Number(value))) : Number(value).toFixed(2)
}

// `aggregationFn_sum` de TanStack solo suma valores con `typeof value === 'number'`
// (rowAggregationFeature): el dinero de este proyecto viaja como cadena decimal ("45.00",
// conventions §4), así que agrupar una columna de precio con el `sum` de TanStack sumaría 0 en
// cada fila y daría "0.00". Esta variante convierte cada valor con `Number()` e ignora los que
// resulten `NaN` (celdas vacías o no numéricas), sin dejar de sumar números ya nativos.
const moneySum = constructAggregationFn({
  aggregate: ({ rows, getValue }) =>
    rows.reduce((total, row) => {
      const n = Number(getValue(row))
      return total + (Number.isNaN(n) ? 0 : n)
    }, 0),
  merge: ({ subRowResults }) => subRowResults.reduce((total, value) => total + value, 0),
})

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

  // `meta.width`/`meta.aggregate`/`meta.groupable` (declarados en las columnas) son detalles de
  // cómo el grid interpreta el meta, no de cómo se define la columna: se traducen aquí, no en
  // `defineColumns`. `meta.width` es el tamaño inicial que `resizing` acaba usando como
  // `column.getSize()`. `meta.aggregate` se traduce a `aggregationFn` (la feature `grouping` lo
  // registra) y a un `aggregatedCell` que formatea el resultado (`sum` con dos decimales, `count`
  // como entero). `enableGrouping` se fija explícitamente a `!!meta.groupable` en toda columna:
  // sin esto, TanStack permite agrupar cualquier columna por defecto.
  const columns = useMemo(
    () =>
      opts.columns.map((c) => {
        const meta = c.meta
        const aggregate = meta?.aggregate
        return {
          ...c,
          ...(meta?.width ? { size: meta.width } : {}),
          enableGrouping: !!meta?.groupable,
          // Se pasa la definición directa (no el string 'sum'/'count'): igual que
          // `defaultColumn.filterFn` en `filtering.tsx`, `GridFeatures` es un tipo fijo que no
          // conoce el registro `aggregationFns` que `grouping()` aporta en runtime, así que el
          // nombre no es un `AggregationFnOption` válido a nivel de tipos aunque sí en ejecución.
          ...(aggregate
            ? {
                aggregationFn: aggregate === 'sum' ? moneySum : aggregationFn_count,
                aggregatedCell: (ctx: { getValue: () => unknown }) =>
                  formatAggregate(aggregate, ctx.getValue()),
              }
            : {}),
        }
      }),
    [opts.columns],
  )

  // Cada feature puede sembrar estado inicial de dos formas: el campo estático `initialState`
  // (no depende de `init`) o devolviéndolo dentro de `options(init)` (depende de `key`/`mode`,
  // como la persistencia de `resizing`). Ambas fuentes se fusionan en un único `initialState`;
  // el resto de `options()` se fusiona aparte, para que ese `initialState` nunca lo pise.
  const merged = list.reduce<{
    options: Record<string, unknown>
    initialState: Record<string, unknown>
  }>(
    (acc, f) => {
      const { initialState: fromOptions, ...rest } = f.options?.(init) ?? {}
      return {
        options: { ...acc.options, ...rest },
        initialState: { ...acc.initialState, ...(f.initialState ?? {}), ...(fromOptions ?? {}) },
      }
    },
    { options: {}, initialState: {} },
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

  // `transformData` (por ejemplo, el filtro avanzado) vive fuera del estado de React: se suscribe
  // aquí a una señal genérica por `key` (`transform-data-version.ts`, sin conocer qué feature la
  // dispara) para que un cambio externo recalcule las filas antes de `useTable`, encadenando cada
  // feature registrada en orden.
  const transformVersion = useTransformDataVersion(opts.key)
  const data = useMemo(
    () =>
      list.reduce<T[]>((rows, f) => {
        if (!f.transformData) return rows
        const featureInit = { key: opts.key, mode, rowCount: opts.rowCount }
        return f.transformData(rows as unknown as never[], featureInit) as unknown as T[]
      }, opts.data),
    // `transformVersion` no se lee dentro del cálculo (por diseño: `transformData` relee el
    // estado externo con su propio getter, ver `advanced-filter-store.ts`), pero debe forzar el
    // recálculo cuando cambia; sin la excepción, el linter lo marca como dependencia "innecesaria".
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, opts.data, opts.key, mode, opts.rowCount, transformVersion],
  )

  const table = useTable<GridFeatures, T>(
    {
      features,
      columns,
      data,
      getRowId: (row) => opts.getRowId(row),
      initialState: merged.initialState as never,
      ...serverOptions,
      ...merged.options,
    },
    (state) => state,
  )

  const ids = new Set<GridFeatureId>(list.map((f) => f.id))
  return { table, key: opts.key, mode, features: list, has: (id) => ids.has(id) }
}
