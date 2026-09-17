import type { CSSProperties, ComponentType } from 'react'
import {
  columnFacetingFeature,
  columnFilteringFeature,
  columnGroupingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  metaHelper,
  rowAggregationFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  type Column,
  type ColumnDef,
  type Header,
  type ReactTable,
  type Row,
  type RowData,
  type TableOptions,
} from '@tanstack/react-table'

export type GridFeatureId =
  | 'pagination'
  | 'sorting'
  | 'filtering'
  | 'advancedFilter'
  | 'grouping'
  | 'resizing'
  | 'pinning'
  | 'urlState'

export type GridMode = 'client' | 'server'

/** Metadatos propios de columna: sirven a la tabla, a las tarjetas móviles y a las features. */
export type GridColumnMeta = {
  /** Control de filtro por columna (feature `filtering`). */
  filter?: 'text' | 'select' | 'range'
  /** Papel de la columna en la tarjeta móvil. Sin valor = `detail`. */
  mobile?: 'title' | 'subtitle' | 'badge' | 'detail' | 'actions' | 'hidden'
  align?: 'left' | 'right'
  /** Ancho inicial en px (feature `resizing` lo usa como `size`). */
  width?: number
  cellClassName?: string
  /** Estilo inline por fila (pestaña de color del ticket). `row` es `original` sin tipar: castear en la tabla. */
  cellStyle?: (row: unknown) => CSSProperties | undefined
  /** Agregado en filas de grupo (feature `grouping`). */
  aggregate?: 'sum' | 'count'
  /** La columna se ofrece en «Agrupar por». */
  groupable?: boolean
  /** Etiqueta para menús y filtros cuando `header` no es texto. */
  label?: string
}

/**
 * Conjunto COMPLETO de features de TanStack: solo se usa como tipo. En runtime, `useDataGrid`
 * registra únicamente las features listadas por la tabla; las partes preguntan `grid.has(id)`
 * antes de usar una API de esa feature.
 */
export const gridFeaturesForTyping = () =>
  tableFeatures({
    columnMeta: metaHelper<GridColumnMeta>(),
    columnVisibilityFeature,
    columnFilteringFeature,
    globalFilteringFeature,
    columnFacetingFeature,
    rowPaginationFeature,
    rowSortingFeature,
    columnGroupingFeature,
    rowExpandingFeature,
    rowAggregationFeature,
    columnSizingFeature,
    columnResizingFeature,
    columnPinningFeature,
  })
export type GridFeatures = ReturnType<typeof gridFeaturesForTyping>

// `ReactTable` (no `Table` de table-core): la instancia que devuelve `useTable()` añade
// `FlexRender`, `state` y `Subscribe` sobre el tipo base; sin esto las partes no tipan
// `table.FlexRender` ni `table.state`.
export type GridTable<T extends RowData> = ReactTable<GridFeatures, T>
export type GridColumn<T extends RowData> = Column<GridFeatures, T, unknown>
export type GridHeader<T extends RowData> = Header<GridFeatures, T, unknown>
export type GridRow<T extends RowData> = Row<GridFeatures, T>
export type GridColumns<T extends RowData> = ColumnDef<GridFeatures, T, unknown>[]

/** Lo que una feature recibe para calcular sus opciones. */
export type GridInit = {
  key: string
  mode: GridMode
  rowCount?: number
  /**
   * Resuelve el valor "crudo" de una fila para un id de columna, replicando cómo TanStack deriva
   * el accessor en `defineColumns` (`col.accessor(fn, { id })` → `accessorFn`; `col.accessor(key,
   * {})` → `accessorKey`, id implícito = `key`; `col.display(...)` → sin accessor, `undefined`
   * siempre). Lo construye `useDataGrid` desde las definiciones de columna (no desde `table`,
   * porque `transformData` corre antes de `useTable()`) — ninguna feature necesita reimplementar
   * esta resolución para leer un valor por id de columna (ver `features/advanced-filter.tsx`).
   */
  getRowValue: (row: unknown, columnId: string) => unknown
}

/**
 * Fuente de estado externo a React que una feature declara para que `useDataGrid` sepa cuándo
 * debe recalcular `transformData` (ver `GridFeature.dataSignal`). Es el contrato mínimo de
 * `useSyncExternalStore`: `subscribe` registra un callback y devuelve cómo darse de baja;
 * `getSnapshot` devuelve el valor actual y debe ser una referencia **estable** mientras no cambie
 * (si no, React entra en un bucle de recálculo). `useDataGrid` no interpreta el valor devuelto
 * (`unknown`): solo compara si cambió de una lectura a otra.
 */
export type GridDataSignal = {
  subscribe: (callback: () => void) => () => void
  getSnapshot: () => unknown
}

export type GridSlots = {
  toolbar?: ComponentType
  /** Se pinta dentro de cada `th` después de la etiqueta (botón de orden, asa de redimensionado). */
  headerCell?: ComponentType<{ header: GridHeader<never> }>
  /**
   * Item del menú de columna (fijar, agrupar) y, opcionalmente, en qué columnas aplica
   * (`canApply`, por defecto todas). `parts/column-menu.tsx` no renderiza el botón del menú en
   * una columna donde ningún item aplica — evita un menú vacío en, por ejemplo, una columna sin
   * `meta.groupable`.
   */
  columnMenu?: {
    item: ComponentType<{ column: GridColumn<never> }>
    canApply?: (column: GridColumn<never>) => boolean
  }
  footer?: ComponentType
}

export type GridFeature = {
  id: GridFeatureId
  /** Features, row models y fns de TanStack que este módulo necesita (se fusionan en `tableFeatures`). */
  tanstack: Record<string, unknown>
  /** Opciones de `TableOptions` (manualSorting, state + on*Change, columnResizeMode…). */
  options?: (init: GridInit) => Partial<TableOptions<GridFeatures, never>>
  /** Estado inicial que siembra (se fusiona en `initialState`). */
  initialState?: Record<string, unknown>
  /**
   * Transforma las filas antes de construir la tabla (`useDataGrid` lo aplica con `useMemo`,
   * encadenado entre features, antes de `useTable`). Recibe `init` por la misma razón que
   * `options(init)`: una feature con estado fuera de React (por ejemplo el filtro avanzado,
   * guardado por `key` en `features/advanced-filter-store.ts`) necesita `init.key` para leer su
   * propia entrada y no chocar con otro grid en la misma página. `GridFeature` no es genérico
   * sobre el tipo de fila (igual que `GridColumn<never>` en los slots): la feature castea dentro
   * de su implementación, nunca aquí.
   */
  transformData?: (rows: never[], init: GridInit) => never[]
  /**
   * Declara la fuente reactiva que hace que `transformData` se recalcule cuando cambia un estado
   * fuera de React (por ejemplo el filtro avanzado). `useDataGrid` combina la `dataSignal` de
   * todas las features registradas en una sola suscripción de `useSyncExternalStore`
   * (`combineDataSignals`) y usa su snapshot como dependencia del `useMemo` de `transformData`:
   * una feature sin estado externo (o cuyo `transformData` es puro sobre `rows`) no necesita
   * declararla.
   */
  dataSignal?: (init: GridInit) => GridDataSignal
  slots?: GridSlots
}

export type GridInstance<T extends RowData> = {
  table: GridTable<T>
  key: string
  mode: GridMode
  features: GridFeature[]
  has: (id: GridFeatureId) => boolean
}
