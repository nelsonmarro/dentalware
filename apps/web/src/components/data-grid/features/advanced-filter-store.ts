import { useSyncExternalStore } from 'react'
import type { GridDataSignal } from '../types'
import type { AdvancedFilter } from './advanced-filter-logic'

/**
 * Estado del filtro avanzado por `key` de grid: lo comparten el slot (botón, chips, diálogo) y
 * `transformData` (leído dentro de `useDataGrid` vía `dataSignal`, ver `advanced-filter.tsx` y
 * `types.ts`) sin pasar por el estado de la tabla de TanStack — evita chocar con
 * `globalFilter`/`columnFilters` de la feature `filtering` y mantiene la lógica AND/OR sobre
 * columnas arbitrarias fuera de esa feature.
 */

type Entry = { filter: AdvancedFilter; listeners: Set<() => void> }

const EMPTY_FILTER: AdvancedFilter = { logic: 'and', conditions: [] }
const store = new Map<string, Entry>()
const signals = new Map<string, GridDataSignal>()

function entryFor(key: string): Entry {
  let entry = store.get(key)
  if (!entry) {
    entry = { filter: EMPTY_FILTER, listeners: new Set() }
    store.set(key, entry)
  }
  return entry
}

/**
 * Filtro activo de `key`, lectura pura: no crea entrada en el store (una entrada nace al
 * suscribirse — `advancedFilterSignal`/`useAdvancedFilter` — o al escribir — `setAdvancedFilter`).
 * Referencia estable mientras el filtro no cambie: es lo que permite usarla como `getSnapshot` de
 * `useSyncExternalStore` sin que React la confunda con un valor inestable.
 */
export function getAdvancedFilter(key: string): AdvancedFilter {
  return store.get(key)?.filter ?? EMPTY_FILTER
}

/** Guarda el filtro y notifica a quien esté suscrito (chips, diálogo y `useDataGrid`). */
export function setAdvancedFilter(key: string, filter: AdvancedFilter): void {
  const entry = entryFor(key)
  entry.filter = filter
  entry.listeners.forEach((listener) => listener())
}

/**
 * Borra la entrada de `key` y notifica: evita filtrar por accidente entre montajes de la misma
 * tabla (el slot la llama al desmontarse, ver `advanced-filter.tsx`).
 */
export function clearAdvancedFilter(key: string): void {
  const entry = store.get(key)
  if (!entry) return
  store.delete(key)
  entry.listeners.forEach((listener) => listener())
}

/**
 * `dataSignal` de `advancedFilter()` (contrato en `types.ts`, registrado en `advanced-filter.tsx`):
 * memoizado por `key` para que `subscribe`/`getSnapshot` sean la MISMA función entre renders — sin
 * esto, `useDataGrid` (`combineDataSignals`) se resuscribiría en cada render al recibir una
 * `dataSignal` distinta cada vez.
 */
export function advancedFilterSignal(key: string): GridDataSignal {
  let signal = signals.get(key)
  if (!signal) {
    signal = {
      subscribe: (listener) => {
        const entry = entryFor(key)
        entry.listeners.add(listener)
        return () => entry.listeners.delete(listener)
      },
      getSnapshot: () => getAdvancedFilter(key),
    }
    signals.set(key, signal)
  }
  return signal
}

/** Filtro activo, reactivo: usado por la toolbar (botón, chips) para pintar las condiciones. */
export function useAdvancedFilter(key: string): AdvancedFilter {
  const signal = advancedFilterSignal(key)
  return useSyncExternalStore(signal.subscribe, signal.getSnapshot) as AdvancedFilter
}
