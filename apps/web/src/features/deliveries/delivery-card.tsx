import {
  availableActions,
  canActOnDelivery,
  canPerform,
  CASE_ACTION_LABEL,
  DELIVERY_CLOSING_ACTION,
  DELIVERY_MANAGE_ROLES,
  DELIVERY_ROLES,
  hasRole,
  isClosedByCancellation,
  isOverdueDelivery,
  type UserRole,
} from '@dentalware/shared'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AlertChip } from '@/features/cases/alert-chip'
import { DeliverDialog } from '@/features/cases/deliver-dialog'
import { StatusChip } from '@/features/cases/status-chip'
import { useCaseAction } from '@/features/cases/use-cases'
import { cn } from '@/lib/utils'
import type { DeliveryItem } from './api'
import { DELIVERY_TYPE_COLOR } from './delivery-colors'
import { DeliveryStatusChip } from './delivery-status-chip'
import { DeliveryTypeChip } from './delivery-type-chip'
import { FailDialog } from './fail-dialog'

/**
 * Una recogida o entrega de la lista del día (ENT-5): tipo, código (enlace a la ficha corta),
 * paciente, «Urgente» y «Atrasada», y la acción que la cierra con los **mismos** diálogos de la
 * ficha. Una pendiente ofrece su acción (un solo primario) y «No se pudo»; una cerrada queda
 * atenuada con su estado y sin acciones. La que cerró la cancelación del trabajo (ruling de la
 * Tarea 6: `fallida` con el prefijo de cancelación, `isClosedByCancellation`) se ve «Cancelado»,
 * nunca como fallida reprogramable; las cerradas antes de cancelar conservan su estado real.
 */
export function DeliveryCard({
  delivery: d,
  role,
  userId,
  today,
}: {
  delivery: DeliveryItem
  role: UserRole
  /** Quien usa la app: el mensajero solo actúa sobre sus propias entregas. */
  userId: string
  today: string
}) {
  const [dialog, setDialog] = useState<'entregar' | 'fallida' | null>(null)
  const action = useCaseAction(d.case.id)
  const cancelled = isClosedByCancellation(d)
  // Cancelar cierra la pendiente en la misma transacción; el estado del trabajo es solo una
  // red por si una pendiente de un trabajo cancelado llegara igual: nunca es accionable.
  const pending = d.status === 'pendiente' && d.case.status !== 'cancelado'
  const closing = DELIVERY_CLOSING_ACTION[d.type]
  // Misma regla que la API y la ficha (`canActOnDelivery`, M-3): una sola fuente para «el
  // mensajero solo actúa sobre lo suyo»; admin y recepción, sobre cualquiera.
  const own = canActOnDelivery({ role, userId }, closing, { type: d.type, courierId: d.courier.id })
  const canClose =
    pending && own && availableActions(d.case.status).includes(closing) && canPerform(role, closing)
  // «No se pudo»: quien puede cerrar la entrega también puede reprogramarla (la API exige lo
  // mismo en `POST /api/entregas/:id/fallida`).
  const canFail = pending && own && hasRole(DELIVERY_ROLES, role)
  const overdue = pending && isOverdueDelivery(d, today)
  // Quien administra entregas ve las de todos: el nombre del mensajero orienta a recepción.
  const showCourier = hasRole(DELIVERY_MANAGE_ROLES, role)

  function close() {
    if (closing === 'marcar_entregado') setDialog('entregar')
    else action.mutate({ accion: closing, motivo: null })
  }

  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-lg border-l-4 bg-card p-3 ring-1 ring-foreground/10 md:flex-row md:items-center md:justify-between',
        // Atenuada sin `opacity`: bajaría el texto por debajo de AA. Fondo apagado y sin sombra.
        !pending && 'bg-muted/60 ring-foreground/5',
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
          {d.case.priority === 'urgente' && <AlertChip tone="destructive">Urgente</AlertChip>}
          {overdue && <AlertChip tone="amber">Atrasada</AlertChip>}
          {cancelled ? (
            <StatusChip status="cancelado" />
          ) : (
            d.status !== 'pendiente' && <DeliveryStatusChip status={d.status} />
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          {d.case.patientRef && <p className="text-sm">{d.case.patientRef}</p>}
          {showCourier && (
            <p className="text-sm text-muted-foreground">{`Mensajero: ${d.courier.name}`}</p>
          )}
          {d.status === 'fallida' && !cancelled && d.failedReason && (
            <p className="text-sm text-muted-foreground">{`Motivo: ${d.failedReason}`}</p>
          )}
        </div>
      </div>
      {(canClose || canFail) && (
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {canClose && (
            <Button className="w-full sm:w-auto" disabled={action.isPending} onClick={close}>
              {CASE_ACTION_LABEL[closing]}
            </Button>
          )}
          {canFail && (
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              disabled={action.isPending}
              onClick={() => setDialog('fallida')}
            >
              No se pudo
            </Button>
          )}
        </div>
      )}
      {dialog === 'entregar' && (
        <DeliverDialog
          case={d.case}
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
