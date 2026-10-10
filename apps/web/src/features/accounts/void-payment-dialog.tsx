import { voidPaymentInputSchema, type VoidPaymentInput } from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { QueuedNotice } from '@/features/cases/queued-notice'
import { ApiError } from '@/lib/api-error'
import { paymentContext, type PaymentRef } from './payment-context'
import { useAccountBusy } from './use-account-busy'
import { useVoidPayment } from './use-void-payment'

type FormValues = z.input<typeof voidPaymentInputSchema>

/**
 * «Anular pago» (CTA-2, solo admin, decisión 2): no tiene vuelta, así que nombra la consecuencia
 * y pide el motivo, obligatorio. Es un `FormDialog` y no un `ConfirmDialog` porque lleva campo,
 * como «Cancelar trabajo». El botón principal va en destructivo. Un 409 (otra persona ya lo
 * anuló) cierra el diálogo tras refrescar y avisar.
 */
export function VoidPaymentDialog({
  clinic,
  payment,
  open,
  onOpenChange,
}: {
  clinic: { id: string; name: string }
  payment: PaymentRef
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const voidIt = useVoidPayment(clinic.id)
  const { busy, queued } = useAccountBusy(clinic.id)
  const { register, handleSubmit, formState, reset } = useForm<
    FormValues,
    unknown,
    VoidPaymentInput
  >({ resolver: zodResolver(voidPaymentInputSchema), defaultValues: { motivo: '' } })

  useEffect(() => {
    if (open) reset({ motivo: '' })
  }, [open, reset])

  function submit(input: VoidPaymentInput) {
    if (busy) return
    voidIt.mutate(
      { paymentId: payment.id, input },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) => {
          if (err instanceof ApiError && err.status === 409) onOpenChange(false)
        },
      },
    )
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Anular pago"
      context={paymentContext(payment, clinic.name)}
      description="El pago deja de contar en el saldo y queda tachado en los movimientos. Los trabajos que cerró este pago vuelven a «Entregado»."
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button type="submit" form="void-payment-form" variant="destructive" disabled={busy}>
            {busy ? 'Guardando…' : 'Anular pago'}
          </Button>
        </>
      }
    >
      <form
        id="void-payment-form"
        onSubmit={handleSubmit(submit)}
        noValidate
        className="flex flex-col gap-4"
      >
        <Field data-invalid={!!formState.errors.motivo}>
          <FieldLabel htmlFor="anular-motivo">Motivo</FieldLabel>
          <Textarea
            {...register('motivo')}
            id="anular-motivo"
            rows={3}
            placeholder="Por ejemplo: se registró dos veces"
            aria-invalid={!!formState.errors.motivo}
          />
          {formState.errors.motivo && <FieldError errors={[formState.errors.motivo]} />}
        </Field>
        {queued && <QueuedNotice />}
      </form>
    </FormDialog>
  )
}
