import { createPaginatedRowModel, rowPaginationFeature } from '@tanstack/react-table'
import type { GridFeature } from '../types'

export const DEFAULT_PAGE_SIZE = 25

/** Paginación: cliente (row model paginado) o servidor (`manualPagination` + `rowCount`, ver useDataGrid). */
export function pagination(opts: { pageSize?: number } = {}): GridFeature {
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE
  return {
    id: 'pagination',
    tanstack: { rowPaginationFeature, paginatedRowModel: createPaginatedRowModel() },
    initialState: { pagination: { pageIndex: 0, pageSize } },
    options: (init) => ({ autoResetPageIndex: init.mode === 'client' }),
  }
}
