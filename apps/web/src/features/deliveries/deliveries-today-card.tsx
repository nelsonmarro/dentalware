import { isActionableDelivery, isOverdueDelivery, toIsoDate } from '@dentalware/shared'
import { Link } from '@tanstack/react-router'
import { DELIVERY_TYPE_COLOR } from './delivery-colors'
import { useDeliveries } from './use-deliveries'

/**
 * «Entregas de hoy» en el inicio de recepción y admin (UX4-22): lo pendiente del día (con las
 * atrasadas, que el día de hoy también trae) como una tarjeta más de los contadores, que lleva a
 * «Entregas». Reutiliza la misma consulta que esa pantalla, sin un resumen nuevo en la API. Un
 * fallo al cargar no se pinta como cero.
 */
export function DeliveriesTodayCard() {
  const today = toIsoDate(new Date())
  const q = useDeliveries(today)
  const pending = q.data?.filter(isActionableDelivery)
  const overdue = pending?.filter((d) => isOverdueDelivery(d, today)).length ?? 0
  const note = overdue > 0 ? `${overdue} ${overdue === 1 ? 'atrasada' : 'atrasadas'}` : undefined
  return (
    <Link
      to="/entregas"
      aria-label={
        q.isError
          ? 'Entregas de hoy, no se pudo cargar'
          : pending === undefined
            ? 'Entregas de hoy, cargando'
            : [`Entregas de hoy ${pending.length}`, note].filter(Boolean).join(', ')
      }
      className="flex min-h-[88px] flex-col justify-between gap-2 rounded-xl border-l-4 bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      style={{ borderLeftColor: DELIVERY_TYPE_COLOR.entrega }}
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-sm text-muted-foreground">Entregas de hoy</span>
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </span>
      {q.isError ? (
        <span className="text-sm text-muted-foreground">No se pudo cargar</span>
      ) : (
        <span className="font-mono text-2xl font-semibold tabular-nums">
          {pending?.length ?? '—'}
        </span>
      )}
    </Link>
  )
}
