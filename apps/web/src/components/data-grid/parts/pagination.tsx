import { useGrid } from '../context'

export function GridPagination() {
  const grid = useGrid<never>()
  if (!grid.has('pagination')) return null
  return null // Task 5 implementa los controles
}
