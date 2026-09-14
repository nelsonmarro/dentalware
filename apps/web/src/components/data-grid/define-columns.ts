import { createColumnHelper, type ColumnHelper, type RowData } from '@tanstack/react-table'
import type { GridColumns, GridFeatures } from './types'

type Helper<T extends RowData> = ColumnHelper<GridFeatures, T>
type ColumnsArg<T extends RowData> = Parameters<Helper<T>['columns']>[0]

/**
 * Define las columnas de una tabla una sola vez: sirven para la tabla de escritorio y para las
 * tarjetas móviles (`meta.mobile`). El helper viene tipado con `GridFeatures` y `GridColumnMeta`.
 */
export function defineColumns<T extends RowData>(
  build: (col: Helper<T>) => ColumnsArg<T>,
): GridColumns<T> {
  const helper = createColumnHelper<GridFeatures, T>()
  return helper.columns(build(helper)) as GridColumns<T>
}
