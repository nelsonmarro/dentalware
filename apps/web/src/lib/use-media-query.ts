import { useSyncExternalStore } from 'react'

/**
 * Suscribe el componente a un media query y devuelve si coincide en este momento.
 * Se usa `useSyncExternalStore` para evitar el parpadeo de un primer render en
 * false seguido de un efecto que lo corrige (y para que funcione bien en SSR).
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
