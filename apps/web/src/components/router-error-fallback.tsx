import { Link, useRouter } from '@tanstack/react-router'
import { Button } from './ui/button'

/**
 * `defaultErrorComponent` del router (UX3-02): sin él, cualquier error no capturado durante
 * `beforeLoad`/`loader` (el caso real: sin red, `getSession()` rechaza la promesa) caía en la
 * pantalla por defecto de TanStack Router, en inglés — "Something went wrong! / Failed to
 * fetch" — y sin salida. Este componente la reemplaza en toda la app: mensaje en español,
 * «Reintentar» (recarga la ruta actual con `router.invalidate()`, no solo limpia el límite de
 * error: ver la nota de la skill de routing) y un enlace de salida a Inicio.
 */
export function RouterErrorFallback() {
  const router = useRouter()
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-lg font-medium">No hay conexión con el servidor</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Revisa tu conexión a internet e intenta de nuevo.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => void router.invalidate()}>Reintentar</Button>
        <Button variant="outline" asChild>
          <Link to="/">Ir a Inicio</Link>
        </Button>
      </div>
    </div>
  )
}
