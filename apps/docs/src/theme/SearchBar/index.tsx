import SearchBar from '@theme-original/SearchBar'
import { useEffect, useRef, type ComponentProps } from 'react'
import { etiquetarBuscador } from '../buscador-accesible'

/** `SearchBar` del plugin con el campo nombrado en español (UX8-01). `display: contents` para no
 * cambiar la fila del navbar. */
export default function SearchBarAccesible(props: ComponentProps<typeof SearchBar>) {
  const raiz = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = raiz.current
    if (!el) return
    etiquetarBuscador(el)
    const observador = new MutationObserver(() => etiquetarBuscador(el))
    observador.observe(el, { childList: true, subtree: true })
    return () => observador.disconnect()
  }, [])
  return (
    <div ref={raiz} style={{ display: 'contents' }}>
      <SearchBar {...props} />
    </div>
  )
}
