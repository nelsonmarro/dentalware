import { createContext, useContext, type ReactNode } from 'react'
import type { RowData } from '@tanstack/react-table'
import type { GridInstance } from './types'

export const GridContext = createContext<GridInstance<never> | null>(null)

/** Instancia del grid más cercano; falla claro si una parte se usa fuera de `DataGrid.Root`. */
export function useGrid<T extends RowData>(): GridInstance<T> {
  const grid = useContext(GridContext)
  if (!grid) throw new Error('Las partes de DataGrid deben usarse dentro de <DataGrid.Root>')
  return grid as unknown as GridInstance<T>
}

export type RootProps = {
  emptyMessage: string | ((query: string) => string)
  emptyAction?: ReactNode
  renderCard?: (row: never) => ReactNode
}

export const RootPropsContext = createContext<RootProps | null>(null)

/** Props de DataGrid.Root que consumen las partes (mensaje vacío, acción, tarjeta a medida). */
export function useRootProps(): RootProps {
  const props = useContext(RootPropsContext)
  if (!props) throw new Error('Las partes de DataGrid deben usarse dentro de <DataGrid.Root>')
  return props
}
