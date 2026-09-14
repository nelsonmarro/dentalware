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
export type GridInit = { key: string; mode: GridMode; rowCount?: number }

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
  slots?: GridSlots
}

export type GridInstance<T extends RowData> = {
  table: GridTable<T>
  key: string
  mode: GridMode
  features: GridFeature[]
  has: (id: GridFeatureId) => boolean
}
