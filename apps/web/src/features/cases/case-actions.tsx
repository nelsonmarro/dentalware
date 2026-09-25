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

/** Qué confirma cada acción antes de enviarse, o `null` si se envía al primer clic. El
 * criterio es la **reversibilidad, no la frecuencia**: las tres que llevan texto van a un
 * estado del que `CASE_TRANSITIONS` no ofrece vuelta y estampan una fecha que no se
 * reconstruye; las demás se quedan a un clic porque "pausar"/"cancelar" siguen disponibles.
 *
 * Es un `Record<CaseAction, …>` exhaustivo a propósito, no una lista de las que confirman:
 * así una acción nueva en `shared` **no compila** hasta que alguien decide si es reversible.
 * Con una lista se quedaría en un clic por omisión, que es justo el fallo que esto corrige.
 * El texto dice la consecuencia concreta —qué fecha queda registrada y a dónde no se
 * vuelve—, nunca un "¿estás seguro?". */
const CONFIRM_DESCRIPTIONS: Record<CaseAction, string | null> = {
  aceptar: null,
  pausar: null,
  reanudar: null,
  enviar_prueba: null,
  recibir_prueba: null,
  finalizar:
    'El trabajo pasará a "Terminado" con la fecha de hoy. No hay ninguna acción para devolverlo a "En proceso".',
  marcar_enviado:
    'Se registrará el envío con la fecha de hoy. No hay ninguna acción para devolverlo a "Terminado".',
  marcar_entregado:
    'Se registrará la entrega con la fecha de hoy y el trabajo quedará cerrado: no queda ninguna acción para deshacerlo.',
  cancelar: null,
}

/** Barra de acciones de estado de la ficha del trabajo: los botones disponibles se
 * derivan de `CASE_TRANSITIONS` (estado actual × rol), nunca a mano. "Aceptar" se
 * deshabilita mientras `missing` no esté vacío (el aviso de qué falta lo pinta
 * `CaseHeader`, no este componente, para no duplicarlo); las acciones de
 * `ACTIONS_REQUIRING_REASON` (pausar, cancelar) abren un diálogo con motivo
 * obligatorio, las que tienen texto en `CONFIRM_DESCRIPTIONS` piden confirmación, y el
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
  const [confirm, setConfirm] = useState<{ action: CaseAction; description: string } | null>(null)
  const action = useCaseAction(c.id)

  const actions = availableActions(c.status).filter((a) => canPerform(role, a))

  if (actions.length === 0) return null

  function run(a: CaseAction) {
    if (ACTIONS_REQUIRING_REASON.includes(a)) {
      setDialogAction(a)
      return
    }
    const description = CONFIRM_DESCRIPTIONS[a]
    if (description) {
      setConfirm({ action: a, description })
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
      {confirm && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirm(null)
          }}
          title={ACTION_LABELS[confirm.action]}
          description={confirm.description}
          confirmLabel={ACTION_LABELS[confirm.action]}
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
