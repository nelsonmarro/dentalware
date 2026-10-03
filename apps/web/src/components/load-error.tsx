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
 * un lector de pantalla lo anuncie sin que la pantalla tenga que estar enfocada ahí.
 *
 * `autoFocus` (ronda de fixes 2, hallazgo I-1): por defecto **no** se activa. Cuando
 * `LoadError` sustituye *todo* el contenido de la pantalla (ficha, `/t/:code`, el error
 * principal de un detalle, un formulario bloqueado) sí tiene sentido mover el foco a
 * «Reintentar» al montar — con guantes o teclado, la acción útil queda a un toque o un Enter.
 * Pero cuando vive *embebido* junto a otros controles ya visibles (una pestaña, un interruptor
 * «Mostrar inactivas», dos `LoadError` en la misma pantalla), robarle el foco a lo que la
 * persona ya estaba usando es peor que no enfocar nada — `role="alert"` ya avisa sin moverlo.
 */
export function LoadError({
  description = 'Revisa tu conexión e intenta de nuevo.',
  onRetry,
  autoFocus = false,
}: {
  description?: string
  onRetry: () => void
  autoFocus?: boolean
}) {
  const retryRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (autoFocus) retryRef.current?.focus()
  }, [autoFocus])

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
