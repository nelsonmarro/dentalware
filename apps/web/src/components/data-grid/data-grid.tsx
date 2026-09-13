import type { RowData } from '@tanstack/react-table'
import type { ReactNode } from 'react'
import { useMediaQuery } from '@/lib/use-media-query'
import { GridContext, RootPropsContext, useGrid, useRootProps, type RootProps } from './context'
import { GridCards } from './parts/cards'
import { GridEmpty } from './parts/empty'
import { GridPagination } from './parts/pagination'
import { GridTable } from './parts/table'
import { GridToolbar } from './parts/toolbar'
import type { GridInstance } from './types'

// Tailwind `lg` empieza en 1024px; debe coincidir con las clases `lg:*` de las partes.
const DESKTOP_QUERY = '(min-width: 1024px)'

type RootProviderProps<T extends RowData> = Omit<RootProps, 'renderCard'> & {
  grid: GridInstance<T>
  children: ReactNode
  /** Tarjeta móvil a medida: tipada con la fila real de esta tabla, no con `never`. */
  renderCard?: (row: T) => ReactNode
}

function Root<T extends RowData>({
  grid,
  emptyMessage,
  emptyAction,
  renderCard,
  children,
}: RootProviderProps<T>) {
  return (
    <GridContext.Provider value={grid as unknown as GridInstance<never>}>
      <RootPropsContext.Provider
        value={{ emptyMessage, emptyAction, renderCard: renderCard as RootProps['renderCard'] }}
      >
        <div className="flex min-w-0 flex-col gap-3">{children}</div>
      </RootPropsContext.Provider>
    </GridContext.Provider>
  )
}

/** Tabla en escritorio, tarjetas en móvil (una sola variante montada), vacío cuando no hay filas. */
function Content() {
  const grid = useGrid<never>()
  const props = useRootProps()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  if (grid.table.getRowModel().rows.length === 0) {
    const query = grid.has('filtering') ? String(grid.table.state.globalFilter ?? '') : ''
    const trimmed = query.trim()
    const message =
      typeof props.emptyMessage === 'function' ? props.emptyMessage(trimmed) : props.emptyMessage
    return <GridEmpty message={message} action={trimmed ? undefined : props.emptyAction} />
  }
  return isDesktop ? <GridTable /> : <GridCards />
}

export const DataGrid = { Root, Content, Toolbar: GridToolbar, Pagination: GridPagination }
