import {
  availableActions,
  canPerform,
  CASE_ACTION_LABEL,
  DELIVERY_MANAGE_ROLES,
  DELIVERY_ROLES,
  hasRole,
  isOverdueDelivery,
  type CaseAction,
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

/** Acción de estado del trabajo que cierra cada tipo de entrega: la recogida se cierra con
 * «Recibido» y la entrega con «Marcar entregado» (y su constancia). `Record` exhaustivo. */
const CLOSING_ACTION: Record<DeliveryItem['type'], CaseAction> = {
  recogida: 'recibir',
  entrega: 'marcar_entregado',
}

/**
 * Una recogida o entrega de la lista del día (ENT-5): tipo, código (enlace a la ficha corta),
 * paciente, «Urgente» y «Atrasada», y la acción que la cierra con los **mismos** diálogos de la
 * ficha. Una pendiente ofrece su acción (un solo primario) y «No se pudo»; una cerrada queda
 * atenuada con su estado y sin acciones. La de un trabajo cancelado (ruling de la Tarea 6: queda
 * `fallida` con «Trabajo cancelado: …») se ve «Cancelado», nunca como fallida reprogramable.
 */
export function DeliveryCard({
  delivery: d,
  role,
  today,
}: {
  delivery: DeliveryItem
  role: UserRole
  today: string
}) {
  const [dialog, setDialog] = useState<'entregar' | 'fallida' | null>(null)
  const action = useCaseAction(d.case.id)
  const cancelled = d.case.status === 'cancelado'
  const pending = d.status === 'pendiente' && !cancelled
  const closing = CLOSING_ACTION[d.type]
  const canClose =
    pending && availableActions(d.case.status).includes(closing) && canPerform(role, closing)
  const canFail = pending && hasRole(DELIVERY_ROLES, role)
  const overdue = !cancelled && isOverdueDelivery(d, today)
  // Quien administra entregas ve las de todos: el nombre del mensajero orienta a recepción.
  const showCourier = hasRole(DELIVERY_MANAGE_ROLES, role)

  function close() {
    if (closing === 'marcar_entregado') setDialog('entregar')
    else action.mutate({ accion: closing, motivo: null })
  }

  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-lg border-l-4 bg-card p-3 ring-1 ring-foreground/10',
        !pending && 'bg-muted/40 opacity-75',
      )}
      style={{ borderLeftColor: DELIVERY_TYPE_COLOR[d.type] }}
    >
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
      {(canClose || canFail) && (
        <div className="flex flex-col gap-2 sm:flex-row">
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
