import {
  CASE_STATUS_LABEL,
  CASE_STATUSES,
  DELIVERY_FAILED_LABEL,
  DELIVERY_TYPES,
  type CaseEventType,
  type CaseStatus,
  type DeliveryType,
} from '@dentalware/shared'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeftRight,
  Ban,
  CalendarClock,
  Check,
  FilePlus2,
  MessageSquare,
  Package,
  PackageCheck,
  PackageOpen,
  Pause,
  Paperclip,
  Pencil,
  Play,
  RefreshCcw,
  Send,
  TriangleAlert,
  Truck,
  UserRound,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { Stage } from '@/features/stages/api'
import type { CaseDetail, CaseEvent } from './api'
import { attachmentUrl } from './attachments-api'
import { formatDate } from './date-format'

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
  pickup_scheduled: 'Recogida programada',
  picked_up: 'Recogido',
  received: 'Recibido en el laboratorio',
  delivery_failed: 'Entrega o recogida fallida',
  cancelled: 'Cancelado',
  remake_created: 'Repetición creada',
  edited: 'Datos editados',
  price_changed: 'Precio modificado',
}

/** Rótulo de un evento: `delivery_failed` nombra lo que falló con el tipo que guarda en
 * `fromValue` (UX4-16); los anteriores, sin tipo, siguen con el texto genérico. */
function eventLabel(e: CaseEvent): string {
  if (
    e.type === 'delivery_failed' &&
    (DELIVERY_TYPES as readonly string[]).includes(e.fromValue ?? '')
  ) {
    return DELIVERY_FAILED_LABEL[e.fromValue as DeliveryType]
  }
  return EVENT_LABEL[e.type]
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
  pickup_scheduled: CalendarClock,
  picked_up: PackageOpen,
  received: PackageCheck,
  delivery_failed: TriangleAlert,
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

/**
 * Motivo/destino de cada evento, con rótulo humano en vez de la clave cruda (I-1, ola de
 * fixes del PR 1, lote B). `aceptar` y `finalizar` escriben ambos `status_changed`: sin el
 * subtítulo del estado destino se ven en el historial como dos "Estado cambiado" idénticos.
 * `stageName` resuelve ids contra las fases que la ficha ya tiene cargadas (`useStages(true)`);
 * los nombres de técnico de `assigned` llegan con el propio evento (`fromName`/`toName`,
 * UX3-13).
 */
function EventDetail({
  event: e,
  caseId,
  stageName,
  technicianName,
}: {
  event: CaseEvent
  caseId: string
  stageName: (id: string | null) => string | null
  technicianName: (id: string | null, name: string | null) => string
}) {
  switch (e.type) {
    case 'status_changed': {
      const label = e.toValue ? (CASE_STATUS_LABEL[e.toValue as CaseStatus] ?? e.toValue) : null
      if (!label) return null
      return <p className="text-sm text-muted-foreground">Nuevo estado: {label}</p>
    }
    case 'hold':
    case 'cancelled':
      return e.reason ? <p className="text-sm text-muted-foreground">Motivo: {e.reason}</p> : null
    case 'stage_changed': {
      const from = stageName(e.fromValue)
      const to = stageName(e.toValue)
      return (
        <>
          {(from ?? to) && (
            <p className="text-sm text-muted-foreground">
              {from ?? '—'} → {to ?? '—'}
            </p>
          )}
          {e.reason && <p className="text-sm text-muted-foreground">Motivo: {e.reason}</p>}
        </>
      )
    }
    case 'assigned':
      return (
        <p className="text-sm text-muted-foreground">
          {technicianName(e.fromValue, e.fromName)} → {technicianName(e.toValue, e.toName)}
        </p>
      )
    // Iteración 4: estos eventos guardan fecha, mensajero, motivo o constancia en vez de un
    // estado (ver `cases/service.ts`); se dicen con palabras, nunca con el valor crudo.
    case 'pickup_scheduled':
    case 'shipped':
      return e.reason && e.toValue ? (
        <p className="text-sm text-muted-foreground">
          {`Con ${e.reason} para el ${formatDate(e.toValue)}`}
        </p>
      ) : null
    // #118: quién recogió en la clínica (copia del nombre en el momento). Los viejos, que
    // escribía «Recibido» sin nombre, se quedan en «Recogido» a secas.
    case 'picked_up':
      return e.reason ? <p className="text-sm text-muted-foreground">{`Por ${e.reason}`}</p> : null
    case 'delivered':
      // Desde la Iteración 4 `toValue` es el id de la constancia; antes era el estado
      // (`entregado`) y no había foto: solo se nombra la foto cuando la hay.
      // UX4-16: la foto se abre aparte, con el mismo endpoint que «Abrir original» en «Adjuntos».
      return e.toValue && !(CASE_STATUSES as readonly string[]).includes(e.toValue) ? (
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          Con foto de constancia
          <a
            href={attachmentUrl(e.toValue)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center text-primary underline underline-offset-2"
          >
            Ver constancia
          </a>
        </p>
      ) : null
    case 'delivery_failed':
      return e.reason && e.toValue ? (
        <p className="text-sm text-muted-foreground">
          {`Motivo: ${e.reason} — nueva fecha ${formatDate(e.toValue)}`}
        </p>
      ) : null
    case 'remake_created':
      return (
        <>
          {e.relatedCaseId && e.relatedCaseId !== caseId && (
            <Link
              to="/trabajos/$caseId"
              params={{ caseId: e.relatedCaseId }}
              className="w-fit text-sm text-primary underline underline-offset-2"
            >
              Ver repetición {e.toValue}
            </Link>
          )}
          {e.reason && <p className="text-sm text-muted-foreground">Motivo: {e.reason}</p>}
        </>
      )
    default:
      return null
  }
}

/** Historial del trabajo, de lo más reciente a lo más antiguo (UX3-26): un ícono y texto en
 * español por tipo de evento, autor y fecha relativa; los comentarios muestran su texto en un
 * bloque aparte y el resto de eventos su motivo o destino cuando lo tienen (I-1). `stages`
 * (todas, activas o no, igual que `StageControl`) resuelve nombres de fase; los de técnico
 * vienen en el evento para todos los roles, también para un técnico que ya no está activo
 * (UX3-13: antes solo admin y recepción los resolvían, contra la lista de activos). */
export function CaseHistory({
  events,
  case: c,
  stages,
}: {
  events: CaseEvent[]
  case: CaseDetail
  stages: Stage[]
}) {
  const stageName = (id: string | null): string | null => {
    if (!id) return null
    return stages.find((s) => s.id === id)?.name ?? 'Fase desconocida'
  }

  // `name` es el que trae `/eventos`; el técnico actual (`c.technician`) queda como respaldo
  // y «Técnico» solo si la API no pudo resolverlo (usuario borrado).
  const technicianName = (id: string | null, name: string | null): string => {
    if (!id) return 'Sin asignar'
    if (name) return name
    if (c.technician?.id === id) return c.technician.name
    return 'Técnico'
  }

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin actividad todavía.</p>
  }
  return (
    <ol className="flex flex-col gap-4">
      {/* UX3-26: lo más reciente primero. `/eventos` llega de más antiguo a más reciente
          (`orderBy createdAt asc` en el repo, que `CaseHeader` también usa para el último
          "hold"); se invierte solo aquí, al pintar. */}
      {[...events].reverse().map((e) => {
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
                <span className="font-medium">{eventLabel(e)}</span>
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
              <EventDetail
                event={e}
                caseId={c.id}
                stageName={stageName}
                technicianName={technicianName}
              />
            </div>
          </li>
        )
      })}
    </ol>
  )
}
