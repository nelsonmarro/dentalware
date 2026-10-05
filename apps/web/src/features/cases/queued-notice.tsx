import { cn } from '@/lib/utils'

/** Texto junto a las acciones deshabilitadas de un trabajo con una acción en pausa (M-4): dice
 * por qué no se puede volver a tocar, no solo con el estado deshabilitado. */
export function QueuedNotice({ className }: { className?: string }) {
  return (
    <p role="status" className={cn('text-sm text-muted-foreground', className)}>
      Se enviará al volver la señal.
    </p>
  )
}
