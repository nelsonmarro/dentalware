import type { CaseAction, UserRole } from '@dentalware/shared'
import { ACTIONS_REQUIRING_REASON, availableActions, canPerform } from '@dentalware/shared'
import { useState } from 'react'
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

/** Barra de acciones de estado de la ficha del trabajo: los botones disponibles se
 * derivan de `CASE_TRANSITIONS` (estado actual × rol), nunca a mano. "Aceptar" se
 * deshabilita mientras `missing` no esté vacío; las acciones de
 * `ACTIONS_REQUIRING_REASON` (pausar, cancelar) abren un diálogo con motivo
 * obligatorio antes de enviarse; el resto se envía directo al hacer clic. */
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
  const action = useCaseAction(c.id)

  const actions = availableActions(c.status).filter((a) => canPerform(role, a))

  if (actions.length === 0) return null

  function run(a: CaseAction) {
    if (ACTIONS_REQUIRING_REASON.includes(a)) {
      setDialogAction(a)
      return
    }
    action.mutate({ accion: a, motivo: null })
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {actions.map((a) => {
        const disabled = a === 'aceptar' && missing.length > 0
        return (
          <div key={a} className="flex w-full flex-col gap-1 sm:w-auto">
            <Button
              variant={a === 'cancelar' ? 'destructive' : 'default'}
              className="w-full sm:w-auto"
              disabled={disabled || action.isPending}
              onClick={() => run(a)}
            >
              {ACTION_LABELS[a]}
            </Button>
            {disabled && (
              <p className="text-xs text-muted-foreground">Falta: {missing.join(', ')}</p>
            )}
          </div>
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
    </div>
  )
}
