import type {
  ActionRequiringDeliveryForm,
  ActionRequiringReason,
  CaseAction,
  UserRole,
} from '@dentalware/shared'
import {
  availableActions,
  canPerform,
  canRemake,
  CASE_ACTION_LABEL,
  REMAKE_ROLES,
  requiresDeliveryForm,
  requiresReason,
  hasRole,
} from '@dentalware/shared'
import { useState, type ComponentType } from 'react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { actionVariant, type ActionButtonVariant } from './action-emphasis'
import type { CaseDetail } from './api'
import { CaseActionDialog } from './case-action-dialog'
import { DeliverDialog } from './deliver-dialog'
import { RemakeDialog } from './remake-dialog'
import { ShipDialog, type DeliverySelf } from './ship-dialog'
import { useCaseAction } from './use-cases'

/** Orden en la barra: el primario primero (arriba en la pila móvil), luego los secundarios y
 * «Repetir», y lo destructivo al final y aparte (UX3-04). */
const VARIANT_ORDER: Record<ActionButtonVariant, number> = {
  default: 0,
  outline: 1,
  destructive: 2,
}

type ActionDialogCopy = { confirmLabel: string; description: string }

/** Diálogo con motivo de cada acción de `ActionRequiringReason` (shared): el botón principal
 * nombra la acción y la descripción dice qué le pasa al trabajo (UX3-12). `Record` sobre el
 * tipo estrecho (M-4): una acción que empiece a pedir motivo en shared no compila hasta tener
 * su texto aquí — nunca un diálogo con descripción vacía o un «Confirmar» genérico. */
const REASON_DIALOG: Record<ActionRequiringReason, ActionDialogCopy> = {
  pausar: {
    confirmLabel: 'Pausar trabajo',
    description: 'El trabajo sale de producción y queda "En espera" hasta que lo reanudes.',
  },
  cancelar: {
    confirmLabel: 'Cancelar trabajo',
    description: 'El trabajo queda "Cancelado" y no hay ninguna acción para retomarlo.',
  },
}

/** Confirmación de cada acción sin motivo ni datos de entrega, o `null` si se envía al primer
 * clic. El criterio es la **reversibilidad, no la frecuencia**: finalizar va a un estado del
 * que `CASE_TRANSITIONS` no ofrece vuelta y estampa una fecha que no se reconstruye; las demás
 * se quedan a un clic. El texto dice la consecuencia concreta, nunca un «¿estás seguro?».
 *
 * `Record` exhaustivo a propósito, no una lista de las que confirman: una acción nueva en
 * `shared` **no compila** hasta que alguien decide si es reversible. */
const CONFIRM_DIALOG: Record<
  Exclude<CaseAction, ActionRequiringReason | ActionRequiringDeliveryForm>,
  ActionDialogCopy | null
> = {
  // Reversible (se puede cancelar después) y lo hace el mensajero con guantes: sin confirmación.
  recibir: null,
  aceptar: null,
  reanudar: null,
  enviar_prueba: null,
  recibir_prueba: null,
  finalizar: {
    confirmLabel: 'Finalizar',
    description:
      'El trabajo pasará a "Terminado" con la fecha de hoy. No hay ninguna acción para devolverlo a "En proceso".',
  },
}

type DeliveryFormDialogProps = {
  case: CaseDetail
  role: UserRole
  self?: DeliverySelf
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Diálogo con datos de cada acción de entrega (`ActionRequiringDeliveryForm`, derivado de
 * `ACTION_PAYLOAD` en shared: `envio` o `constancia`). Hacen las veces de confirmación: los dos
 * son irreversibles y su texto dice la consecuencia (con quién y cuándo sale; que pasa a la
 * cuenta de la clínica). `Record` exhaustivo: una acción que empiece a pedir datos de entrega
 * no compila sin su diálogo. */
const FORM_DIALOG: Record<ActionRequiringDeliveryForm, ComponentType<DeliveryFormDialogProps>> = {
  marcar_enviado: ShipDialog,
  marcar_entregado: DeliverDialog,
}

/** Barra de acciones de estado del panel «Producción» (`role="group"`, «Acciones del
 * trabajo»): los botones disponibles se derivan de `CASE_TRANSITIONS` (estado actual × rol),
 * nunca a mano, con el peso de `ACTION_EMPHASIS` (un solo primario, primero; lo destructivo al
 * final) y «Repetir» como secundaria cuando aplica (UX3-04/UX3-05). "Aceptar" se
 * deshabilita mientras `missing` no esté vacío (el aviso de qué falta lo pinta
 * `CaseHeader`, no este componente, para no duplicarlo); las acciones de
 * `ActionRequiringReason` (pausar, cancelar) abren un diálogo con motivo
 * obligatorio, las de `ActionRequiringDeliveryForm` (marcar enviado, marcar entregado) abren
 * su diálogo de `FORM_DIALOG`, las que tienen texto en `CONFIRM_DIALOG` piden confirmación, y
 * el resto se envía directo al hacer clic. */
export function CaseActions({
  case: c,
  missing,
  role,
  hasNextStage = false,
  onRemakeCreated,
  self,
  size = 'default',
  className,
}: {
  case: CaseDetail
  missing: string[]
  role: UserRole
  /** El trabajo tiene una fase siguiente (o las fases no han cargado): el primario del panel
   * es «Avanzar fase» y «Finalizar» baja a secundario (UX3-05). */
  hasNextStage?: boolean
  /** Adónde ir tras crear una repetición (Tarea 9): el hijo puede nacer incompleto, así que
   * quien monta la barra navega a su ficha en vez de quedarse en la del padre. */
  onRemakeCreated?: (created: CaseDetail) => void
  /** Quien usa la app: el mensajero envía con él mismo (`ShipDialog`). */
  self?: DeliverySelf
  /** `large`: botones de 56 px a todo el ancho, para la ficha corta del mensajero (#105). */
  size?: 'default' | 'large'
  className?: string
}) {
  const [dialogAction, setDialogAction] = useState<ActionRequiringReason | null>(null)
  const [formAction, setFormAction] = useState<ActionRequiringDeliveryForm | null>(null)
  const [confirm, setConfirm] = useState<({ action: CaseAction } & ActionDialogCopy) | null>(null)
  const action = useCaseAction(c.id)

  const actions = availableActions(c.status)
    .filter((a) => canPerform(role, a))
    .map((a) => ({ action: a, variant: actionVariant(a, hasNextStage) }))
    .sort((x, y) => VARIANT_ORDER[x.variant] - VARIANT_ORDER[y.variant])
  // `RemakeDialog` no recibe `role`: este guardián es toda la defensa de la UI (I-3 de la
  // revisión de la Tarea 9; la API responde 403 de todos modos).
  const showRemake = hasRole(REMAKE_ROLES, role) && canRemake(c.status)

  // Sin acciones ni «Repetir» no se monta nada: ni un contenedor vacío (UX3-25).
  if (actions.length === 0 && !showRemake) return null

  const DeliveryDialog = formAction ? FORM_DIALOG[formAction] : null

  function run(a: CaseAction) {
    if (requiresReason(a)) {
      setDialogAction(a)
      return
    }
    if (requiresDeliveryForm(a)) {
      setFormAction(a)
      return
    }
    const copy = CONFIRM_DIALOG[a]
    if (copy) {
      setConfirm({ action: a, ...copy })
      return
    }
    action.mutate({ accion: a, motivo: null })
  }

  return (
    <div
      role="group"
      aria-label="Acciones del trabajo"
      className={cn(
        size === 'large' ? 'flex flex-col gap-3' : 'flex flex-col gap-2 sm:flex-row sm:flex-wrap',
        className,
      )}
    >
      {actions
        .filter((a) => a.variant !== 'destructive')
        .map(({ action: a, variant }) => (
          <Button
            key={a}
            variant={variant}
            className={size === 'large' ? 'h-14 w-full text-base' : 'w-full sm:w-auto'}
            disabled={(a === 'aceptar' && missing.length > 0) || action.isPending}
            onClick={() => run(a)}
          >
            {CASE_ACTION_LABEL[a]}
          </Button>
        ))}
      {showRemake && <RemakeDialog case={c} onCreated={onRemakeCreated} />}
      {actions
        .filter((a) => a.variant === 'destructive')
        .map(({ action: a, variant }) => (
          <Button
            key={a}
            variant={variant}
            className="w-full sm:ml-auto sm:w-auto"
            disabled={action.isPending}
            onClick={() => run(a)}
          >
            {CASE_ACTION_LABEL[a]}
          </Button>
        ))}
      {DeliveryDialog && (
        <DeliveryDialog
          case={c}
          role={role}
          self={self}
          open
          onOpenChange={(open) => {
            if (!open) setFormAction(null)
          }}
        />
      )}
      {dialogAction && (
        <CaseActionDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialogAction(null)
          }}
          action={dialogAction}
          {...REASON_DIALOG[dialogAction]}
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
