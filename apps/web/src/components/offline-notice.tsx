import { onlineManager, useIsMutating } from '@tanstack/react-query'
import { WifiOff } from 'lucide-react'
import { useSyncExternalStore } from 'react'

const subscribe = (onChange: () => void) => onlineManager.subscribe(onChange)
const isOnline = () => onlineManager.isOnline()

function pendingLabel(count: number) {
  return count === 1 ? '1 acción por enviar' : `${count} acciones por enviar`
}

/**
 * Aviso global sin conexión (UX4-11). Sin red, TanStack Query deja las mutaciones en pausa
 * (`networkMode: 'online'`, el de por omisión) y las envía solas al volver la señal: no se pierde
 * lo marcado, pero sin este aviso el botón se quedaba deshabilitado sin decir nada. Lee el mismo
 * `onlineManager` que decide la pausa, así que el aviso y la pausa nunca se contradicen, y cuenta
 * las mutaciones en pausa (`state.isPaused`).
 *
 * La región `role="status"` está siempre montada (vacía con red) para que el lector de pantalla
 * anuncie el cambio al aparecer el texto. Va en el flujo, arriba y `sticky`: no tapa la barra
 * inferior móvil ni ningún control que no se pueda alcanzar desplazando.
 */
export function OfflineNotice() {
  const online = useSyncExternalStore(subscribe, isOnline, isOnline)
  const paused = useIsMutating({ predicate: (mutation) => mutation.state.isPaused })

  return (
    <div role="status" className="sticky top-0 z-30 bg-card print:hidden">
      {!online && (
        <div className="flex items-start gap-2 border-b border-wax-amber bg-wax-amber/10 px-4 py-2.5 text-sm text-wax-amber-ink lg:px-8">
          <WifiOff aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p className="flex flex-wrap gap-x-2">
            <span className="font-medium">
              Sin conexión: lo que marques se enviará al volver la señal
            </span>
            {/* El espacio separa las dos frases para el lector de pantalla; el `gap` las separa a la vista. */}
            {paused > 0 && ' '}
            {paused > 0 && <span>{pendingLabel(paused)}</span>}
          </p>
        </div>
      )}
    </div>
  )
}
