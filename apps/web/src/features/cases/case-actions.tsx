import type { CaseAction, UserRole } from '@dentalware/shared'
import {
  ACTIONS_REQUIRING_REASON,
  availableActions,
  canPerform,
  CASE_ACTION_LABEL,
} from '@dentalware/shared'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import type { CaseDetail } from './api'
import { CaseActionDialog } from './case-action-dialog'
import { useCaseAction } from './use-cases'

type ActionDialogCopy = { confirmLabel: string; description: string }

/** Diálogo de cada acción, o `null` si se envía al primer clic (UX3-12: el botón principal
 * nombra la acción y la descripción dice qué le pasa al trabajo, nunca un «¿estás seguro?»).
 *
 * Las de `ACTIONS_REQUIRING_REASON` (shared) abren el diálogo con motivo y usan este texto;
 * del resto, las que tienen texto piden confirmación. El criterio para confirmar es la
 * **reversibilidad, no la frecuencia**: finalizar, marcar enviado y marcar entregado van a un
 * estado del que `CASE_TRANSITIONS` no ofrece vuelta y estampan una fecha que no se
 * reconstruye; las demás se quedan a un clic.
 *
 * `Record<CaseAction, …>` exhaustivo a propósito, no una lista de las que confirman: una
 * acción nueva en `shared` **no compila** hasta que alguien decide si abre diálogo. */
const ACTION_DIALOG: Record<CaseAction, ActionDialogCopy | null> = {
  aceptar: null,
  pausar: {
    confirmLabel: 'Pausar trabajo',
    description: 'El trabajo sale de producción y queda "En espera" hasta que lo reanudes.',
  },
  reanudar: null,
  enviar_prueba: null,
  recibir_prueba: null,
  finalizar: {
    confirmLabel: 'Finalizar',
    description:
      'El trabajo pasará a "Terminado" con la fecha de hoy. No hay ninguna acción para devolverlo a "En proceso".',
  },
  marcar_enviado: {
    confirmLabel: 'Marcar enviado',
    description:
      'Se registrará el envío con la fecha de hoy. No hay ninguna acción para devolverlo a "Terminado".',
  },
  marcar_entregado: {
    confirmLabel: 'Marcar entregado',
    description:
      'Se registrará la entrega con la fecha de hoy y el trabajo quedará cerrado: no queda ninguna acción para deshacerlo.',
  },
  cancelar: {
    confirmLabel: 'Cancelar trabajo',
    description: 'El trabajo queda "Cancelado" y no hay ninguna acción para retomarlo.',
  },
}

/** Texto del diálogo con motivo: si una acción con motivo nueva llegara sin texto propio,
 * al menos el botón dice su nombre (nunca un «Confirmar» genérico). */
function reasonDialogCopy(a: CaseAction): ActionDialogCopy {
  return ACTION_DIALOG[a] ?? { confirmLabel: CASE_ACTION_LABEL[a], description: '' }
}

/** Barra de acciones de estado de la ficha del trabajo: los botones disponibles se
 * derivan de `CASE_TRANSITIONS` (estado actual × rol), nunca a mano. "Aceptar" se
 * deshabilita mientras `missing` no esté vacío (el aviso de qué falta lo pinta
 * `CaseHeader`, no este componente, para no duplicarlo); las acciones de
 * `ACTIONS_REQUIRING_REASON` (pausar, cancelar) abren un diálogo con motivo
 * obligatorio, las que tienen texto en `ACTION_DIALOG` piden confirmación, y el
 * resto se envía directo al hacer clic. */
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
  const [confirm, setConfirm] = useState<({ action: CaseAction } & ActionDialogCopy) | null>(null)
  const action = useCaseAction(c.id)

  const actions = availableActions(c.status).filter((a) => canPerform(role, a))

  if (actions.length === 0) return null

  function run(a: CaseAction) {
    if (ACTIONS_REQUIRING_REASON.includes(a)) {
      setDialogAction(a)
      return
    }
    const copy = ACTION_DIALOG[a]
    if (copy) {
      setConfirm({ action: a, ...copy })
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
            {CASE_ACTION_LABEL[a]}
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
          {...reasonDialogCopy(dialogAction)}
          pending={action.isPending}
          onConfirm={(input) => {
            action.mutate(input, { onSuccess: () => setDialogAction(null) })
          }}
        />
      )}
      {confirm && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirm(null)
          }}
          title={confirm.confirmLabel}
          description={confirm.description}
          confirmLabel={confirm.confirmLabel}
          pending={action.isPending}
          onConfirm={() => {
            action.mutate(
              { accion: confirm.action, motivo: null },
              { onSuccess: () => setConfirm(null) },
            )
          }}
        />
      )}
    </div>
  )
}
