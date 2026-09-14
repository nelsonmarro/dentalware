import { useSyncExternalStore } from 'react'
import { bumpTransformData } from '../transform-data-version'
import type { AdvancedFilter } from './advanced-filter-logic'

/**
 * Estado del filtro avanzado por `key` de grid: lo comparten el slot (botón, chips, diálogo) y
 * `transformData` (leído dentro de `useDataGrid`, ver `advanced-filter.tsx`) sin pasar por el
 * estado de la tabla de TanStack — evita chocar con `globalFilter`/`columnFilters` de la feature
 * `filtering` y mantiene la lógica AND/OR sobre columnas arbitrarias fuera de esa feature.
 */

type Entry = { filter: AdvancedFilter; listeners: Set<() => void> }

const EMPTY_FILTER: AdvancedFilter = { logic: 'and', conditions: [] }
const store = new Map<string, Entry>()

function entryFor(key: string): Entry {
  let entry = store.get(key)
  if (!entry) {
    entry = { filter: EMPTY_FILTER, listeners: new Set() }
    store.set(key, entry)
  }
  return entry
}

/** Filtro activo de `key`, lectura directa sin suscripción: usada por `transformData`. */
export function getAdvancedFilter(key: string): AdvancedFilter {
  return entryFor(key).filter
}

/**
 * Guarda el filtro, notifica a la UI suscrita (chips y diálogo) y avisa a `useDataGrid` (vía
 * `bumpTransformData`) para que vuelva a aplicar `transformData` sobre los datos.
 */
export function setAdvancedFilter(key: string, filter: AdvancedFilter): void {
  const entry = entryFor(key)
  entry.filter = filter
  entry.listeners.forEach((listener) => listener())
  bumpTransformData(key)
}

/** Elimina la entrada de `key`: evita filtrar por accidente entre montajes de la misma tabla. */
export function clearAdvancedFilter(key: string): void {
  store.delete(key)
}

/** Filtro activo, reactivo: usado por la toolbar (botón, chips) para pintar las condiciones. */
export function useAdvancedFilter(key: string): AdvancedFilter {
  return useSyncExternalStore(
    (listener) => {
      const entry = entryFor(key)
      entry.listeners.add(listener)
      return () => entry.listeners.delete(listener)
    },
    () => entryFor(key).filter,
  )
}
