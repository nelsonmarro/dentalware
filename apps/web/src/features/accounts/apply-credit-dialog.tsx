import { applyCreditFormSchema, toCents, type ApplyCreditInput } from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { useForm, useWatch, type Path } from 'react-hook-form'
import type { z } from 'zod'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { QueuedNotice } from '@/features/cases/queued-notice'
import { ApiError, toastApiError } from '@/lib/api-error'
import { formatMoney } from '@/lib/format-money'
import { AllocationFields } from './allocation-fields'
import { allocationTotals, applyIssues, orderOpenCases, suggestedRows } from './allocation'
import type { ClinicAccount } from './api'
import { paymentContext, type PaymentRef } from './payment-context'
import { useAccountBusy } from './use-account-busy'
import { useApplyCredit } from './use-apply-credit'

/**
 * «Aplicar saldo a favor» de un pago (CTA-2, decisión 3): reparte lo que le queda sin asignar
 * entre los trabajos «Por cobrar». Abre con el reparto sugerido sobre lo que le queda
 * (`suggestAllocation`), editable fila a fila. Un 422 se pinta en su fila; un 409 (el pago ya
 * está anulado) cierra el diálogo tras refrescar y avisar.
 */
export function ApplyCreditDialog({
  clinic,
  payment,
  openCases,
  open,
  onOpenChange,
}: {
  clinic: { id: string; name: string }
  payment: PaymentRef
  openCases: ClinicAccount['openCases']
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const ordered = useMemo(() => orderOpenCases(openCases), [openCases])
  const availableCents = toCents(payment.remaining)
  const schema = useMemo(() => applyCreditFormSchema(availableCents), [availableCents])
  const apply = useApplyCredit(clinic.id, ordered)
  const { busy, queued } = useAccountBusy(clinic.id)

  type FormValues = z.input<typeof schema>
  const defaults = (): FormValues => ({ asignaciones: suggestedRows(ordered, availableCents) })
  const { register, handleSubmit, control, formState, setError, getValues, reset } = useForm<
    FormValues,
    unknown,
    ApplyCreditInput
  >({ resolver: zodResolver(schema), defaultValues: defaults() })

  useEffect(() => {
    if (open) reset(defaults())
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir
  }, [open])

  const rows = useWatch({ control, name: 'asignaciones' })
  const totals = allocationTotals(
    availableCents,
    (rows ?? []).map((r) => r.monto),
  )

  function submit(input: ApplyCreditInput) {
    if (busy) return
    const sent = getValues('asignaciones').flatMap((r, i) => (r.monto.trim() ? [i] : []))
    apply.mutate(
      { paymentId: payment.id, input },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) => {
          if (!(err instanceof ApiError)) return
          if (err.status === 409) onOpenChange(false)
          if (err.status !== 422) return
          const unmapped = applyIssues(err.issues, sent, [], (field, message) =>
            setError(field as Path<FormValues>, { type: 'server', message }),
          )
          if (unmapped) toastApiError(err)
        },
      },
    )
  }

  const errors = formState.errors
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Aplicar saldo a favor"
      context={paymentContext(payment, clinic.name)}
      description="Reparte lo que le queda a este pago entre los trabajos por cobrar; los que queden cubiertos pasan a «Cobrado»."
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button type="submit" form="apply-credit-form" disabled={busy}>
            {busy ? 'Guardando…' : 'Aplicar saldo a favor'}
          </Button>
        </>
      }
    >
      <form
        id="apply-credit-form"
        onSubmit={handleSubmit(submit)}
        noValidate
        className="flex flex-col gap-3"
      >
        <p className="text-sm font-medium">
          Le quedan <span className="font-mono">{formatMoney(payment.remaining)}</span> a favor
        </p>
        <AllocationFields
          cases={ordered}
          field={(i) => register(`asignaciones.${i}.monto`)}
          rowError={(i) => errors.asignaciones?.[i]?.monto?.message}
          totalError={errors.asignaciones?.message ?? errors.asignaciones?.root?.message}
          allocatedCents={totals.allocatedCents}
          leftCents={totals.leftCents}
          leftLabel="Sigue a favor"
          overLabel="Supera lo disponible en"
          emptyText="No hay trabajos por cobrar: el saldo sigue a favor hasta la próxima entrega."
        />
        {queued && <QueuedNotice />}
      </form>
    </FormDialog>
  )
}
