import SearchPage from '@theme-original/SearchPage'
import { useEffect, type ComponentProps } from 'react'
import { etiquetarBuscador } from '../buscador-accesible'

/** `SearchPage` del plugin con el campo nombrado en español (UX8-01) y su contenedor de
 * resultados como `main` (UX8-13). El `Layout` del plugin pinta el navbar y el contenedor fuera de
 * cualquier elemento que pongamos alrededor, así que se corrige sobre todo el documento. */
export default function SearchPageAccesible(props: ComponentProps<typeof SearchPage>) {
  useEffect(() => {
    etiquetarBuscador(document)
    const observador = new MutationObserver(() => etiquetarBuscador(document))
    observador.observe(document.body, { childList: true, subtree: true })
    return () => observador.disconnect()
  }, [])
  return <SearchPage {...props} />
}
