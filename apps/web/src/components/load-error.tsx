import { Button } from './ui/button'

/**
 * UX3-02: estado de error reutilizable para una consulta de TanStack Query que falló por red o
 * por el servidor — nunca para "no existe" (eso lo decide `isNotFoundError` antes de elegir
 * entre este componente y un `EmptyState`). Pensado para vivir dentro del layout de la pantalla
 * (ficha, ficha corta, «Mis trabajos», contadores del inicio), junto al contenido que no cargó;
 * el error no capturado de toda una ruta lo cubre `RouterErrorFallback`, no este componente.
 */
export function LoadError({
  description = 'Revisa tu conexión e intenta de nuevo.',
  onRetry,
}: {
  description?: string
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-destructive/40 bg-destructive/5 px-6 py-12 text-center">
      <p className="font-medium">No se pudo cargar la información</p>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      <Button onClick={onRetry}>Reintentar</Button>
    </div>
  )
}
