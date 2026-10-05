import {
  availableActions,
  canActOnDelivery,
  canFailDelivery,
  canPerform,
  cancelledDeliveryNote,
  CASE_ACTION_LABEL,
  DELIVERY_CLOSING_ACTION,
  deliveryNextStep,
  deliveryOutcome,
  isActionableDelivery,
  isDeliveryInTransit,
  isOverdueDelivery,
  offersPickUp,
  type UserRole,
} from '@dentalware/shared'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AlertChip } from '@/features/cases/alert-chip'
import { formatDate } from '@/features/cases/date-format'
import { DeliverDialog } from '@/features/cases/deliver-dialog'
import { QueuedNotice } from '@/features/cases/queued-notice'
import { useCaseBusy } from '@/features/cases/use-case-busy'
import { useCaseAction } from '@/features/cases/use-cases'
import { cn } from '@/lib/utils'
import type { DeliveryItem } from './api'
import { DELIVERY_TYPE_COLOR } from './delivery-colors'
import { DeliveryStatusChip } from './delivery-status-chip'
import { DeliveryTypeChip } from './delivery-type-chip'
import { FailDialog } from './fail-dialog'
import { InTransitChip } from './in-transit-chip'
import { PickUpButton } from './pick-up-button'
import { pickedUpText } from './picked-up-text'

/**
 * Una recogida o entrega de la lista del día (ENT-5): tipo, código (enlace a la ficha corta),
 * paciente, «Urgente» y «Atrasada», y la acción que la cierra con los **mismos** diálogos de la
 * ficha. Una pendiente ofrece su acción (un solo primario) y «No se pudo»; una cerrada queda
 * atenuada con su resultado (`deliveryOutcome`), sin acciones ni «Urgente». La que cerró la
 * cancelación del trabajo (ruling de la Tarea 6) se ve «Anulada» con el motivo de la
 * cancelación (UX4-17), nunca como fallida reprogramable; las cerradas antes de cancelar
 * conservan su estado real y dicen que el trabajo se canceló. La fallida dice su nueva fecha
 * (UX4-18). En una recogida, el mensajero marca «Recogido» en la clínica; después la tarjeta
 * dice «En camino al laboratorio», quién y a qué hora, y recepción la cierra con «Recibido»
 * al llegar (#118).
 */
export function DeliveryCard({
  delivery: d,
  role,
  userId,
  today,
  showCourier,
}: {
  delivery: DeliveryItem
  role: UserRole
  /** Quien usa la app: el mensajero solo actúa sobre sus propias entregas. */
  userId: string
  today: string
  /** «Mensajero: …» en la tarjeta: lo decide la lista (`DeliveriesDay`). */
  showCourier: boolean
}) {
  const [dialog, setDialog] = useState<'entregar' | 'fallida' | null>(null)
  const action = useCaseAction(d.case.id)
  // M-4: cualquier acción de este trabajo en curso o en pausa (también la de un diálogo ya
  // cerrado con «Volver») bloquea las dos acciones de la tarjeta.
  const { busy, queued } = useCaseBusy(d.case.id)
  const outcome = deliveryOutcome(d)
  // Cancelar cierra la pendiente en la misma transacción; el estado del trabajo es solo una
  // red por si una pendiente de un trabajo cancelado llegara igual: nunca es accionable.
  const pending = isActionableDelivery(d)
  // #118: recogida hecha y trabajo aún por recoger. No está cerrada del todo: espera «Recibido».
  const inTransit = isDeliveryInTransit(d)
  // UX4-17: lo cerrado de un trabajo cancelado lo dice; la anulada, con el motivo.
  const cancelNote =
    d.case.status === 'cancelado' && !pending ? cancelledDeliveryNote(d.failedReason) : null
  const closing = DELIVERY_CLOSING_ACTION[d.type]
  // Misma regla que la API y la ficha (`canActOnDelivery`, M-3): una sola fuente para «el
  // mensajero solo actúa sobre lo suyo»; admin y recepción, sobre cualquiera.
  const assignment = { type: d.type, courierId: d.courier.id }
  const own = canActOnDelivery({ role, userId }, closing, assignment)
  const canClose =
    (pending || inTransit) &&
    own &&
    availableActions(d.case.status).includes(closing) &&
    canPerform(role, closing)
  // #118, decisión 4: en la UI «Recogido» es del mensajero, en la suya (`offersPickUp`).
  const canPickUp = pending && offersPickUp({ role, userId }, assignment)
  // «No se pudo»: misma regla que la API (`canFailDelivery`, `POST /api/entregas/:id/fallida`).
  // No depende de quién cierra la entrega (UX4-10): el mensajero no marca «Recibido», pero sí
  // «No se pudo» en su recogida.
  const canFail = pending && canFailDelivery({ role, userId }, assignment)
  // UX4-10: quien no la cierra sabe qué sigue; en la recogida en camino, el mensajero lee que
  // «Recibido» lo marca recepción al llegar.
  const nextStep = inTransit && !canClose ? deliveryNextStep(role, d.type) : null
  const actionable = canClose || canPickUp || canFail
  const overdue = pending && isOverdueDelivery(d, today)

  // UX4-05: cada diálogo vive mientras su acción siga disponible. Si la entrega deja de estar
  // pendiente (otra persona canceló el trabajo o la cerró; lo trae el refresco tras un 409 o
  // cualquier otro), se cierra en vez de quedar abierto sobre el estado nuevo.
  if ((dialog === 'entregar' && !canClose) || (dialog === 'fallida' && !canFail)) setDialog(null)

  function close() {
    if (closing === 'marcar_entregado') setDialog('entregar')
    else action.mutate({ accion: closing, motivo: null })
  }

  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-lg border-l-4 bg-card p-3 ring-1 ring-foreground/10 md:flex-row md:items-center md:justify-between',
        // Atenuada sin `opacity`: bajaría el texto por debajo de AA. Fondo apagado y sin sombra.
        !pending && !inTransit && 'bg-muted/60 ring-foreground/5',
      )}
      style={{ borderLeftColor: DELIVERY_TYPE_COLOR[d.type] }}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <DeliveryTypeChip type={d.type} />
          <Link
            to="/t/$code"
            params={{ code: d.case.code }}
            className="inline-flex min-h-11 items-center font-mono text-base font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {d.case.code}
          </Link>
          {pending && d.case.priority === 'urgente' && (
            <AlertChip tone="destructive">Urgente</AlertChip>
          )}
          {overdue && <AlertChip tone="amber">Atrasada</AlertChip>}
          {inTransit ? <InTransitChip /> : outcome && <DeliveryStatusChip outcome={outcome} />}
        </div>
        <div className="flex flex-col gap-0.5">
          {d.case.patientRef && <p className="text-sm">{d.case.patientRef}</p>}
          {showCourier && (
            <p className="text-sm text-muted-foreground">{`Mensajero: ${d.courier.name}`}</p>
          )}
          {outcome === 'fallida' && d.failedReason && (
            <p className="text-sm text-muted-foreground">{`Motivo: ${d.failedReason}`}</p>
          )}
          {/* M-1 (revisión T9): si el trabajo se canceló después, la reprogramada quedó
              anulada y la fecha prometería una visita que ya no existe. */}
          {outcome === 'fallida' && d.rescheduledFor && !cancelNote && (
            <p className="text-sm text-muted-foreground">
              {`Nueva fecha: ${formatDate(d.rescheduledFor)}`}
            </p>
          )}
          {cancelNote && <p className="text-sm text-muted-foreground">{cancelNote}</p>}
          {inTransit && d.doneAt && (
            <p className="text-sm">{pickedUpText(d.courier.name, d.doneAt, today)}</p>
          )}
          {nextStep && <p className="text-sm text-muted-foreground">{nextStep}</p>}
          {queued && actionable && <QueuedNotice />}
        </div>
      </div>
      {actionable && (
        // UX4-20: ancho mínimo común, para que las acciones se alineen de tarjeta en tarjeta.
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {canClose && (
            <Button className="w-full sm:w-auto sm:min-w-40" disabled={busy} onClick={close}>
              {CASE_ACTION_LABEL[closing]}
            </Button>
          )}
          {canPickUp && (
            <PickUpButton
              deliveryId={d.id}
              caseId={d.case.id}
              className="w-full sm:w-auto sm:min-w-40"
            />
          )}
          {canFail && (
            <Button
              variant="outline"
              className="w-full sm:w-auto sm:min-w-40"
              disabled={busy}
              onClick={() => setDialog('fallida')}
            >
              No se pudo
            </Button>
          )}
        </div>
      )}
      {dialog === 'entregar' && (
        <DeliverDialog
          case={{ ...d.case, clinic: d.clinic }}
          role={role}
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null)
          }}
        />
      )}
      {dialog === 'fallida' && (
        <FailDialog
          delivery={d}
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null)
          }}
        />
      )}
    </li>
  )
}
