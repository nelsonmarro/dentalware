import { caseActionSchema, type CaseAction, type CaseActionInput } from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'

type CaseActionFormValues = z.input<typeof caseActionSchema>

/** Diálogo de motivo obligatorio para las acciones de `ACTIONS_REQUIRING_REASON`
 * (pausar, cancelar): un `<textarea>` con validación de `caseActionSchema` antes de
 * habilitar el envío. */
export function CaseActionDialog({
  open,
  onOpenChange,
  action,
  title,
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  action: CaseAction
  title: string
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
      title={title}
      footer={
        <>
          {/* "Volver", no "Cancelar": la acción "cancelar" (cancelar trabajo) también abre
           * este diálogo — "Cancelar" junto a "Confirmar" leía como una segunda acción de
           * cancelar el trabajo, no como cerrar el diálogo (M-2, revisión de la Tarea 8). */}
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Volver
          </Button>
          <Button type="submit" form="case-action-form" disabled={pending}>
            {pending ? 'Guardando…' : 'Confirmar'}
          </Button>
        </>
      }
    >
      <form id="case-action-form" onSubmit={handleSubmit(submit)} noValidate>
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
