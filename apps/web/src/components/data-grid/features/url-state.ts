import { globalFilteringFeature, type SortingState, type Updater } from '@tanstack/react-table'
import type { GridFeature } from '../types'

export type UrlSearch = { pagina?: number; orden?: string; q?: string }

/** `'campo' | 'campo-desc'` (o vacío) → estado de orden de TanStack (una sola columna). */
export function ordenToSorting(orden: string | undefined): SortingState {
  if (!orden) return []
  const desc = orden.endsWith('-desc')
  return [{ id: desc ? orden.slice(0, -5) : orden, desc }]
}

/** Estado de orden de TanStack → `'campo' | 'campo-desc'` (solo la primera columna ordenada). */
export function sortingToOrden(sorting: SortingState): string | undefined {
  const first = sorting[0]
  if (!first) return undefined
  return first.desc ? `${first.id}-desc` : first.id
}

const resolve = <T>(updater: Updater<T>, prev: T): T =>
  typeof updater === 'function' ? (updater as (old: T) => T)(prev) : updater

/**
 * Estado controlado desde la URL de la ruta (`pagina`, `orden`, `q`): la ruta valida `search` con
 * los schemas de shared y pasa un `navigate` que actualiza esa URL; el grid nunca valida ni
 * conoce el schema. Cambiar orden o búsqueda vuelve a la primera página (`pagina: undefined`), a
 * juego con el resto del listado de trabajos (la ruta trata `pagina` ausente como 1).
 *
 * Registra `globalFilteringFeature` para que `table.setGlobalFilter`/`state.globalFilter` existan
 * aunque `filtering()` no esté en la lista de features (Tarea 18 consume `urlState` en modo
 * servidor, donde el buscador de la toolbar lo aporta `filtering()`, pero `urlState` no puede
 * depender de que esa otra feature esté registrada: cada módulo es independiente, ver
 * `docs/architecture.md` §3.5). Registrarlo aquí también cuando `filtering()` ya lo registra no es
 * un conflicto: ambos importan el mismo objeto de `@tanstack/react-table`.
 */
export function urlState(opts: {
  search: UrlSearch
  navigate: (patch: Record<string, unknown>) => void
  pageSize: number
}): GridFeature {
  const pagination = {
    pageIndex: Math.max((opts.search.pagina ?? 1) - 1, 0),
    pageSize: opts.pageSize,
  }
  const sorting = ordenToSorting(opts.search.orden)
  const globalFilter = opts.search.q ?? ''
  return {
    id: 'urlState',
    tanstack: { globalFilteringFeature },
    options: () => ({
      state: { pagination, sorting, globalFilter },
      onPaginationChange: (updater: Updater<typeof pagination>) => {
        const next = resolve(updater, pagination)
        opts.navigate({ pagina: next.pageIndex + 1 })
      },
      onSortingChange: (updater: Updater<SortingState>) => {
        opts.navigate({ orden: sortingToOrden(resolve(updater, sorting)), pagina: undefined })
      },
      onGlobalFilterChange: (updater: Updater<string>) => {
        opts.navigate({ q: resolve(updater, globalFilter) || undefined, pagina: undefined })
      },
    }),
  }
}
