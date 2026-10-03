import { useEffect, useRef } from 'react'
import { Button } from './ui/button'

/**
 * UX3-02: estado de error reutilizable para una consulta de TanStack Query que falló por red o
 * por el servidor — nunca para "no existe" (eso lo decide `isNotFoundError` antes de elegir
 * entre este componente y un `EmptyState`). Pensado para vivir dentro del layout de la pantalla
 * (ficha, ficha corta, «Mis trabajos», contadores del inicio), junto al contenido que no cargó;
 * el error no capturado de toda una ruta lo cubre `RouterErrorFallback`, no este componente.
 *
 * Accesibilidad (ronda de fixes 1, hallazgo Important): `role="alert"` en el mensaje, para que
 * un lector de pantalla lo anuncie sin que la pantalla tenga que estar enfocada ahí, y foco
 * inicial en «Reintentar» al montar — con guantes o teclado, la acción útil queda a un toque o
 * un Enter, sin buscarla.
 */
export function LoadError({
  description = 'Revisa tu conexión e intenta de nuevo.',
  onRetry,
}: {
  description?: string
  onRetry: () => void
}) {
  const retryRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    retryRef.current?.focus()
  }, [])

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-destructive/40 bg-destructive/5 px-6 py-12 text-center">
      <div role="alert">
        <p className="font-medium">No se pudo cargar la información</p>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      <Button ref={retryRef} onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  )
}
