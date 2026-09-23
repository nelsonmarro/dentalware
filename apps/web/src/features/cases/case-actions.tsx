import type { CaseAction, UserRole } from '@dentalware/shared'
import { ACTIONS_REQUIRING_REASON, availableActions, canPerform } from '@dentalware/shared'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import type { CaseDetail } from './api'
import { CaseActionDialog } from './case-action-dialog'
import { useCaseAction } from './use-cases'

/** Rótulo del botón por acción; imperativo, no el nombre del estado destino. */
const ACTION_LABELS: Record<CaseAction, string> = {
  aceptar: 'Aceptar',
  pausar: 'Pausar',
  reanudar: 'Reanudar',
  enviar_prueba: 'Enviar a prueba',
  recibir_prueba: 'Recibir de prueba',
  finalizar: 'Finalizar',
  marcar_enviado: 'Marcar enviado',
  marcar_entregado: 'Marcar entregado',
  cancelar: 'Cancelar trabajo',
}

/** Acciones que piden confirmación (`ConfirmDialog`) antes de enviarse: el criterio es la
 * reversibilidad, no la frecuencia. Las tres llevan a un estado del que no hay transición
 * de vuelta (`case-status.ts`) y estampan una fecha que no se reconstruye después; las
 * demás se quedan a un clic porque "pausar"/"cancelar" siguen disponibles después. */
const CONFIRM_ACTIONS = ['finalizar', 'marcar_enviado', 'marcar_entregado'] as const
type ConfirmAction = (typeof CONFIRM_ACTIONS)[number]

function isConfirmAction(a: CaseAction): a is ConfirmAction {
  return (CONFIRM_ACTIONS as readonly CaseAction[]).includes(a)
}

/** Consecuencia concreta de cada acción de `CONFIRM_ACTIONS`, no un genérico "¿estás
 * seguro?": qué fecha queda registrada y por qué no se puede deshacer. */
const CONFIRM_DESCRIPTIONS: Record<ConfirmAction, string> = {
  finalizar:
    'El trabajo pasará a "Terminado" con la fecha de hoy. No hay ninguna acción para devolverlo a "En proceso".',
  marcar_enviado:
    'Se registrará el envío con la fecha de hoy. No hay ninguna acción para devolverlo a "Terminado".',
  marcar_entregado:
    'Se registrará la entrega con la fecha de hoy y el trabajo quedará cerrado: no queda ninguna acción para deshacerlo.',
}

/** Barra de acciones de estado de la ficha del trabajo: los botones disponibles se
 * derivan de `CASE_TRANSITIONS` (estado actual × rol), nunca a mano. "Aceptar" se
 * deshabilita mientras `missing` no esté vacío (el aviso de qué falta lo pinta
 * `CaseHeader`, no este componente, para no duplicarlo); las acciones de
 * `ACTIONS_REQUIRING_REASON` (pausar, cancelar) abren un diálogo con motivo
 * obligatorio, las de `CONFIRM_ACTIONS` piden confirmación, y el resto se envía
 * directo al hacer clic. */
export function CaseActions({
  case: c,
  missing,
  role,
}: {
  case: CaseDetail
  missing: string[]
  role: UserRole
}) {
  const [dialogAction, setDialogAction] = useState<CaseAction | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const action = useCaseAction(c.id)

  const actions = availableActions(c.status).filter((a) => canPerform(role, a))

  if (actions.length === 0) return null

  function run(a: CaseAction) {
    if (ACTIONS_REQUIRING_REASON.includes(a)) {
      setDialogAction(a)
      return
    }
    if (isConfirmAction(a)) {
      setConfirmAction(a)
      return
    }
    action.mutate({ accion: a, motivo: null })
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {actions.map((a) => {
        const disabled = a === 'aceptar' && missing.length > 0
        return (
          <Button
            key={a}
            variant={a === 'cancelar' ? 'destructive' : 'default'}
            className="w-full sm:w-auto"
            disabled={disabled || action.isPending}
            onClick={() => run(a)}
          >
            {ACTION_LABELS[a]}
          </Button>
        )
      })}
      {dialogAction && (
        <CaseActionDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialogAction(null)
          }}
          action={dialogAction}
          title={ACTION_LABELS[dialogAction]}
          pending={action.isPending}
          onConfirm={(input) => {
            action.mutate(input, { onSuccess: () => setDialogAction(null) })
          }}
        />
      )}
      {confirmAction && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirmAction(null)
          }}
          title={ACTION_LABELS[confirmAction]}
          description={CONFIRM_DESCRIPTIONS[confirmAction]}
          confirmLabel={ACTION_LABELS[confirmAction]}
          pending={action.isPending}
          onConfirm={() => {
            action.mutate(
              { accion: confirmAction, motivo: null },
              { onSuccess: () => setConfirmAction(null) },
            )
          }}
        />
      )}
    </div>
  )
}
