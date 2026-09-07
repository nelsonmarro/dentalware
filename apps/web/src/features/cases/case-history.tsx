import type { CaseEventType } from '@dentalware/shared'
import {
  ArrowLeftRight,
  Ban,
  Check,
  FilePlus2,
  MessageSquare,
  Package,
  Pause,
  Paperclip,
  Pencil,
  Play,
  RefreshCcw,
  Send,
  Truck,
  UserRound,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { CaseEvent } from './api'

export const EVENT_LABEL: Record<CaseEventType, string> = {
  created: 'Trabajo creado',
  status_changed: 'Estado cambiado',
  stage_changed: 'Fase cambiada',
  assigned: 'Técnico asignado',
  hold: 'En espera',
  resumed: 'Reanudado',
  tryin_sent: 'Prueba enviada',
  tryin_returned: 'Prueba recibida',
  comment: 'Comentario',
  attachment_added: 'Adjunto agregado',
  attachment_removed: 'Adjunto eliminado',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  remake_created: 'Reproceso creado',
  edited: 'Datos editados',
  price_changed: 'Precio modificado',
}

const EVENT_ICON: Record<CaseEventType, LucideIcon> = {
  created: FilePlus2,
  status_changed: ArrowLeftRight,
  stage_changed: ArrowLeftRight,
  assigned: UserRound,
  hold: Pause,
  resumed: Play,
  tryin_sent: Send,
  tryin_returned: Package,
  comment: MessageSquare,
  attachment_added: Paperclip,
  attachment_removed: X,
  shipped: Truck,
  delivered: Check,
  cancelled: Ban,
  remake_created: RefreshCcw,
  edited: Pencil,
  price_changed: Wallet,
}

/** `hace 5 min`, `hace 2 h`, `hace 3 d`… con `Intl.RelativeTimeFormat('es')`. */
function relativeTime(iso: string): string {
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
  const diffMs = new Date(iso).getTime() - Date.now()
  const diffMin = Math.round(diffMs / 60_000)
  if (Math.abs(diffMin) < 1) return 'justo ahora'
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute')
  const diffHour = Math.round(diffMin / 60)
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, 'hour')
  const diffDay = Math.round(diffHour / 24)
  return rtf.format(diffDay, 'day')
}

/** Etiqueta de la pestaña "Historial": el total combinado de eventos y comentarios
 * (ya vienen juntos desde `/eventos`, ver `useEvents`); sin número cuando el trabajo
 * todavía no tiene ninguna actividad, en vez de mostrar "Historial (0)" (UX2-10). */
export function historyTabLabel(total: number): string {
  return total === 0 ? 'Historial' : `Historial (${total})`
}

/** Historial cronológico del trabajo: un ícono y texto en español por tipo de evento,
 * autor y fecha relativa; los comentarios muestran su texto en un bloque aparte. */
export function CaseHistory({ events }: { events: CaseEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin actividad todavía.</p>
  }
  return (
    <ol className="flex flex-col gap-4">
      {events.map((e) => {
        const Icon = EVENT_ICON[e.type]
        return (
          <li key={e.id} className="flex gap-3">
            <span
              aria-hidden
              className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
            >
              <Icon className="size-4" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-medium">{EVENT_LABEL[e.type]}</span>
                <span className="text-muted-foreground">{e.actor?.name ?? 'Sistema'}</span>
                <span
                  className="text-xs text-muted-foreground"
                  title={new Date(e.createdAt).toLocaleString('es-EC')}
                >
                  {relativeTime(e.createdAt)}
                </span>
              </div>
              {e.type === 'comment' && e.toValue && (
                <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                  {e.toValue}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
