import {
  ASSIGN_TECHNICIAN_ROLES,
  type CaseEventType,
  type CaseStatus,
  type UserRole,
} from '@dentalware/shared'
import { Link } from '@tanstack/react-router'
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
import type { Stage } from '@/features/stages/api'
import type { CaseDetail, CaseEvent } from './api'
import { STATUS_LABEL } from './status-chip'
import { useTechnicians } from './use-cases'

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
  remake_created: 'Repetición creada',
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

/**
 * Motivo/destino de cada evento, con rótulo humano en vez de la clave cruda (I-1, ola de
 * fixes del PR 1, lote B). `aceptar` y `finalizar` escriben ambos `status_changed`: sin el
 * subtítulo del estado destino se ven en el historial como dos "Estado cambiado" idénticos.
 * `stageName`/`technicianName` resuelven ids contra lo que la ficha ya tiene cargado
 * (`useStages(true)` y `useTechnicians`, ver `CaseHistory`); no disparan ninguna consulta
 * nueva.
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
  technicianName: (id: string | null) => string
}) {
  switch (e.type) {
    case 'status_changed': {
      const label = e.toValue ? (STATUS_LABEL[e.toValue as CaseStatus] ?? e.toValue) : null
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
          {technicianName(e.fromValue)} → {technicianName(e.toValue)}
        </p>
      )
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

/** Historial cronológico del trabajo: un ícono y texto en español por tipo de evento,
 * autor y fecha relativa; los comentarios muestran su texto en un bloque aparte y el resto
 * de eventos su motivo o destino cuando lo tienen (I-1). `stages` (todas, activas o no,
 * igual que `StageControl`) y `role` resuelven nombres de fase y de técnico sin disparar
 * una consulta nueva: `useTechnicians` solo se llama para los roles que ya pueden verlos
 * (`ASSIGN_TECHNICIAN_ROLES`); técnico y mensajero solo resuelven el técnico actualmente
 * asignado (`case.technician`), no uno anterior que ya no está activo — ver el reporte de
 * esta tarea. */
export function CaseHistory({
  events,
  case: c,
  stages,
  role,
}: {
  events: CaseEvent[]
  case: CaseDetail
  stages: Stage[]
  role: UserRole
}) {
  const canSeeTechnicians = (ASSIGN_TECHNICIAN_ROLES as readonly UserRole[]).includes(role)
  const technicians = useTechnicians(canSeeTechnicians)

  const stageName = (id: string | null): string | null => {
    if (!id) return null
    return stages.find((s) => s.id === id)?.name ?? 'Fase desconocida'
  }

  // El técnico actualmente asignado (`c.technician`) resuelve siempre, esté activo o no
  // (mismo criterio que `TechnicianSelect`/`CaseHeader`); uno anterior solo si sigue activo
  // y el rol puede consultar la lista (`technicians.data`). Un técnico anterior ya inactivo
  // no es resoluble en cliente sin una consulta nueva: fallback legible mínimo (M-4/I-1, ver
  // reporte).
  const technicianName = (id: string | null): string => {
    if (!id) return 'Sin asignar'
    if (c.technician?.id === id) return c.technician.name
    return technicians.data?.find((t) => t.id === id)?.name ?? 'Técnico'
  }

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
