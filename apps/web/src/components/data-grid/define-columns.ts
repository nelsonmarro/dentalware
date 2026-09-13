import {
  createColumnHelper,
  type ColumnDef,
  type ColumnHelper,
  type RowData,
} from '@tanstack/react-table'
import type { GridFeatures } from './types'

/**
 * Define las columnas de una tabla una sola vez: sirven para la tabla de escritorio y para las
 * tarjetas móviles (`meta.mobile`). El helper viene tipado con `GridFeatures` y `GridColumnMeta`.
 *
 * Nota: `helper.columns()` existe en TanStack Table 9.2.4 pero tiene limitaciones de tipado
 * con columnas display; se retorna directo `build(helper)` para mejor inferencia.
 */
export function defineColumns<T extends RowData>(
  build: (col: ColumnHelper<GridFeatures, T>) => unknown[],
): ColumnDef<GridFeatures, T, unknown>[] {
  const helper = createColumnHelper<GridFeatures, T>()
  return build(helper) as ColumnDef<GridFeatures, T, unknown>[]
}
