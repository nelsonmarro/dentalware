import { Link, useRouter } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { Button } from './ui/button'

/**
 * `defaultErrorComponent` del router (UX3-02): sin él, cualquier error no capturado durante
 * `beforeLoad`/`loader` (el caso real: sin red, `getSession()` rechaza la promesa) caía en la
 * pantalla por defecto de TanStack Router, en inglés — "Something went wrong! / Failed to
 * fetch" — y sin salida. Este componente la reemplaza en toda la app: mensaje en español,
 * «Reintentar» (recarga la ruta actual con `router.invalidate()`, no solo limpia el límite de
 * error: ver la nota de la skill de routing) y un enlace de salida a Inicio.
 *
 * Accesibilidad (ronda de fixes 1, hallazgo Important): `role="alert"` en el mensaje y foco
 * inicial en «Reintentar» al montar, mismo criterio que `LoadError`.
 */
export function RouterErrorFallback() {
  const router = useRouter()
  const retryRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    retryRef.current?.focus()
  }, [])

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <div role="alert">
        <p className="text-lg font-medium">No hay conexión con el servidor</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Revisa tu conexión a internet e intenta de nuevo.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button ref={retryRef} onClick={() => void router.invalidate()}>
          Reintentar
        </Button>
        <Button variant="outline" asChild>
          <Link to="/">Ir a Inicio</Link>
        </Button>
      </div>
    </div>
  )
}
