import {
  aggregationFn_count,
  columnVisibilityFeature,
  constructAggregationFn,
  metaHelper,
  tableFeatures,
  useTable,
  type RowData,
} from '@tanstack/react-table'
import { useMemo, useSyncExternalStore } from 'react'
import type {
  GridColumnMeta,
  GridColumns,
  GridDataSignal,
  GridFeature,
  GridFeatureId,
  GridFeatures,
  GridInit,
  GridInstance,
  GridMode,
} from './types'

/** Formato de la celda agregada de una fila de grupo: `sum` con dos decimales, `count` entero. */
export function formatAggregate(kind: NonNullable<GridColumnMeta['aggregate']>, value: unknown) {
  return kind === 'count' ? String(Math.trunc(Number(value))) : Number(value).toFixed(2)
}

/**
 * Combina la `dataSignal` de todas las features registradas en una sola suscripción de
 * `useSyncExternalStore`: `subscribe` se suma a cada una y `getSnapshot` compara por posición con
 * `Object.is`, devolviendo la MISMA referencia anterior si nada cambió (React exige que
 * `getSnapshot` sea estable mientras no haya novedad, o entra en un bucle de recálculo).
 */
function combineDataSignals(signals: GridDataSignal[]): GridDataSignal {
  let cached: unknown[] = signals.map((s) => s.getSnapshot())
  return {
    subscribe: (callback) => {
      const unsubscribes = signals.map((s) => s.subscribe(callback))
      return () => unsubscribes.forEach((unsubscribe) => unsubscribe())
    },
    getSnapshot: () => {
      const next = signals.map((s) => s.getSnapshot())
      const changed = next.some((value, i) => !Object.is(value, cached[i]))
      if (changed) cached = next
      return cached
    },
  }
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

/**
 * Arma `init.getRowValue`: replica cómo `defineColumns`/`createColumnHelper` deriva el accessor
 * de cada columna (`col.accessor(fn, { id })` → `c.accessorFn`; `col.accessor(key, {})` →
 * `c.accessorKey`, id implícito = `key`; `col.display(...)` → ninguno de los dos, sin resolver).
 * Se construye desde las definiciones CRUDAS (`opts.columns`), no desde `table.getColumn()`:
 * `transformData` (que es quien más lo necesita, ver `features/advanced-filter.tsx`) corre en un
 * `useMemo` propio antes de `useTable()`, así que el `table` real todavía no existe en ese punto.
 */
function buildRowValueResolver<T extends RowData>(
  columns: GridColumns<T>,
): (row: unknown, columnId: string) => unknown {
  const resolvers = new Map<string, (row: unknown) => unknown>()
  for (const c of columns) {
    const accessorKey =
      'accessorKey' in c && typeof c.accessorKey === 'string' ? c.accessorKey : undefined
    const accessorFn =
      'accessorFn' in c && typeof c.accessorFn === 'function' ? c.accessorFn : undefined
    const id = c.id ?? accessorKey
    if (!id) continue
    if (accessorFn) {
      resolvers.set(id, (row) => accessorFn(row as T, 0))
    } else if (accessorKey) {
      resolvers.set(id, (row) => (row as Record<string, unknown>)[accessorKey])
    }
  }
  return (row, columnId) => resolvers.get(columnId)?.(row)
}

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
  const getRowValue = useMemo(() => buildRowValueResolver<T>(opts.columns), [opts.columns])
  const init: GridInit = { key: opts.key, mode, rowCount: opts.rowCount, getRowValue }

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
  // registra) y, por defecto, a un `aggregatedCell` que formatea el resultado (`sum` con dos
  // decimales, `count` como entero) — una columna puede pasar su propio `aggregatedCell` (campo
  // de TanStack, no de `meta`) para sobrescribir ese formato (por ejemplo mostrar `$ 75.00` en vez
  // de `75.00`); se respeta en vez de pisarlo. `enableGrouping` se fija explícitamente a
  // `!!meta.groupable` en toda columna: sin esto, TanStack permite agrupar cualquier columna por
  // defecto.
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
                aggregatedCell:
                  c.aggregatedCell ??
                  ((ctx: { getValue: () => unknown }) =>
                    formatAggregate(aggregate, ctx.getValue())),
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
      const { initialState: fromOptions, defaultColumn, ...rest } = f.options?.(init) ?? {}
      return {
        // `defaultColumn` es el único campo que más de una feature escribe a la vez (`filtering`:
        // `filterFn`, `resizing`: `minSize`, la combinación real de productos, Tarea 13): una
        // fusión superficial del resto de `options()` haría que la feature registrada después
        // pisara por completo el `defaultColumn` de la anterior en vez de sumar sus campos, y
        // `filtering` perdería su `filterFn` sin ningún error visible. Se fusiona aparte, campo a
        // campo, igual que `initialState`.
        options: {
          ...acc.options,
          ...rest,
          ...(acc.options.defaultColumn || defaultColumn
            ? {
                defaultColumn: {
                  ...(acc.options.defaultColumn as Record<string, unknown> | undefined),
                  ...defaultColumn,
                },
              }
            : {}),
        },
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

  // `transformData` (por ejemplo, el filtro avanzado) puede depender de estado fuera de React: la
  // `dataSignal` que declare cada feature (ver `types.ts`) se combina en una sola suscripción de
  // `useSyncExternalStore`, cuyo snapshot fuerza recalcular `data` cuando cambia, sin que el
  // núcleo conozca qué feature ni qué guarda esa señal.
  const signals = useMemo(
    () =>
      list.flatMap((f) =>
        f.dataSignal
          ? [f.dataSignal({ key: opts.key, mode, rowCount: opts.rowCount, getRowValue })]
          : [],
      ),
    [list, opts.key, mode, opts.rowCount, getRowValue],
  )
  const combinedSignal = useMemo(() => combineDataSignals(signals), [signals])
  const dataSignalSnapshot = useSyncExternalStore(
    combinedSignal.subscribe,
    combinedSignal.getSnapshot,
  )

  const data = useMemo(() => {
    // `dataSignalSnapshot` no se lee dentro del cálculo (cada feature relee su propio estado
    // externo con su getter, p. ej. `getAdvancedFilter`): se referencia aquí solo para que
    // `react-hooks/exhaustive-deps` la reconozca como dependencia real y fuerce el recálculo
    // cuando una `dataSignal` cambia.
    void dataSignalSnapshot
    return list.reduce<T[]>((rows, f) => {
      if (!f.transformData) return rows
      const featureInit = { key: opts.key, mode, rowCount: opts.rowCount, getRowValue }
      return f.transformData(rows as unknown as never[], featureInit) as unknown as T[]
    }, opts.data)
  }, [list, opts.data, opts.key, mode, opts.rowCount, getRowValue, dataSignalSnapshot])

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
