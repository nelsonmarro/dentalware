import { useSyncExternalStore } from 'react'

/**
 * Señal genérica, por `key` de grid, para que `useDataGrid` sepa cuándo debe volver a aplicar
 * `transformData` de las features registradas: `transformData` filtra/transforma filas antes de
 * `useTable`, pero su resultado puede depender de un estado que vive fuera de React (por ejemplo
 * el filtro avanzado, guardado en `features/advanced-filter-store.ts`). Este módulo no conoce esa
 * feature ni ningún otro detalle de negocio — solo cuenta versiones y notifica: es el núcleo
 * (`use-data-grid.ts`) el único lado que se suscribe, y cualquier feature con `transformData`
 * reactivo llama `bumpTransformData(key)` cuando cambia su estado externo.
 */

type Entry = { version: number; listeners: Set<() => void> }

const store = new Map<string, Entry>()

function entryFor(key: string): Entry {
  let entry = store.get(key)
  if (!entry) {
    entry = { version: 0, listeners: new Set() }
    store.set(key, entry)
  }
  return entry
}

/** Incrementa la versión de `key` y notifica: usar tras cambiar el estado externo que lee `transformData`. */
export function bumpTransformData(key: string): void {
  const entry = entryFor(key)
  entry.version += 1
  entry.listeners.forEach((listener) => listener())
}

/** Se suscribe a la versión de `key`: usado solo por `useDataGrid` para recalcular `transformData`. */
export function useTransformDataVersion(key: string): number {
  return useSyncExternalStore(
    (listener) => {
      const entry = entryFor(key)
      entry.listeners.add(listener)
      return () => entry.listeners.delete(listener)
    },
    () => entryFor(key).version,
  )
}
