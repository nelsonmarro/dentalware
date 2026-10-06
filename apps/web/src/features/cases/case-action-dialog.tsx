import { caseActionSchema, type CaseAction, type CaseActionInput } from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { ACTION_EMPHASIS } from './action-emphasis'

type CaseActionFormValues = z.input<typeof caseActionSchema>

/** Diálogo de motivo obligatorio para las acciones de `ActionRequiringReason`
 * (pausar, cancelar): un `<textarea>` con validación de `caseActionSchema` antes de
 * habilitar el envío. */
export function CaseActionDialog({
  open,
  onOpenChange,
  action,
  confirmLabel,
  description,
  note,
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  action: CaseAction
  /** Nombre de la acción (UX3-12): título del diálogo y texto del botón principal. */
  confirmLabel: string
  /** Qué le pasa al trabajo al confirmar. */
  description: string
  /** Lo que conviene saber antes de confirmar, en su propia línea (M-1 de #118: cancelar un
   * trabajo que el mensajero ya recogió). */
  note?: string | null
  pending: boolean
  onConfirm: (input: CaseActionInput) => void
}) {
  const { register, handleSubmit, reset, formState } = useForm<
    CaseActionFormValues,
    unknown,
    CaseActionInput
  >({
    resolver: zodResolver(caseActionSchema),
    defaultValues: { accion: action, motivo: '' },
  })

  function handleOpenChange(next: boolean) {
    if (!next) reset({ accion: action, motivo: '' })
    onOpenChange(next)
  }

  function submit(data: CaseActionInput) {
    onConfirm({ accion: action, motivo: data.motivo })
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={confirmLabel}
      description={description}
      footer={
        <>
          {/* "Volver", no "Cancelar": la acción "cancelar" (cancelar trabajo) también abre
           * este diálogo — "Cancelar" junto a la acción leía como una segunda acción de
           * cancelar el trabajo, no como cerrar el diálogo (M-2, revisión de la Tarea 8). */}
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Volver
          </Button>
          {/* M-5: el botón que confirma es el principal del diálogo, salvo que la acción sea
           * destructiva en `ACTION_EMPHASIS` (la misma clasificación que pinta la barra):
           * confirmar «Cancelar trabajo» no puede verse como el primario teal de un avance. */}
          <Button
            type="submit"
            form="case-action-form"
            variant={ACTION_EMPHASIS[action] === 'destructive' ? 'destructive' : 'default'}
            disabled={pending}
          >
            {pending ? 'Guardando…' : confirmLabel}
          </Button>
        </>
      }
    >
      <form
        id="case-action-form"
        onSubmit={handleSubmit(submit)}
        noValidate
        className="flex flex-col gap-4"
      >
        {note && <p className="text-sm font-medium">{note}</p>}
        <Field data-invalid={!!formState.errors.motivo}>
          <FieldLabel htmlFor="case-action-motivo">Motivo</FieldLabel>
          <Textarea
            {...register('motivo')}
            id="case-action-motivo"
            aria-invalid={!!formState.errors.motivo}
            rows={3}
          />
          {formState.errors.motivo && <FieldError errors={[formState.errors.motivo]} />}
        </Field>
      </form>
    </FormDialog>
  )
}
