import {
  allocationTotals,
  parseMoneyInput,
  PAYMENT_METHOD_LABEL,
  PAYMENT_METHODS,
  paymentFormSchema,
  toIsoDate,
  type PaymentInput,
} from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch, type Path } from 'react-hook-form'
import type { z } from 'zod'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { QueuedNotice } from '@/features/cases/queued-notice'
import { ApiError, toastApiError } from '@/lib/api-error'
import { AllocationFields } from './allocation-fields'
import { AllocationSummary } from './allocation-summary'
import { applyIssues, orderOpenCases, suggestedRows } from './allocation'
import type { ClinicAccount } from './api'
import { useAccountBusy } from './use-account-busy'
import { useRegisterPayment } from './use-register-payment'

type FormValues = z.input<typeof paymentFormSchema>

/** Campos del formulario donde puede caer un 422 de la API (además del reparto). */
const FIELDS = ['monto', 'metodo', 'fecha', 'referencia', 'notas']

/**
 * «Registrar pago» (CTA-2): monto, método, fecha (hoy por omisión, nunca después), referencia y
 * notas, y el reparto entre los trabajos «Por cobrar». Al escribir el monto, el reparto se
 * rellena con `suggestAllocation` (de la entrega más antigua a la más nueva); cada fila se puede
 * cambiar. Lo que no se reparte queda a favor de la clínica.
 *
 * Un 422 de la API se pinta bajo su campo, también en su fila del reparto (`applyIssues`); un 409
 * cierra el diálogo (ya avisó `useRegisterPayment`, tras refrescar).
 */
export function PaymentDialog({
  clinic,
  openCases,
  open,
  onOpenChange,
}: {
  clinic: { id: string; name: string }
  openCases: ClinicAccount['openCases']
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // Los trabajos del reparto se congelan al abrir (I-1 de la revisión final del PR 2): «Por
  // cobrar» puede volver a pedirse con el diálogo abierto, y las filas del formulario
  // (`asignaciones[i].trabajoId`) y sus rótulos tienen que seguir siendo los mismos trabajos.
  // Se toman al abrir, ajustando el estado durante el render (como `TeethDialog`), así que el
  // efecto de abajo ya los ve.
  const [ordered, setOrdered] = useState(() => orderOpenCases(openCases))
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setOrdered(orderOpenCases(openCases))
  }
  const pay = useRegisterPayment(clinic.id)
  const { busy, queued } = useAccountBusy(clinic.id)
  const today = toIsoDate(new Date())

  const defaults = (): FormValues => ({
    clinicaId: clinic.id,
    monto: '',
    metodo: undefined as unknown as FormValues['metodo'],
    fecha: today,
    referencia: '',
    notas: '',
    asignaciones: suggestedRows(ordered, null),
  })
  const { register, handleSubmit, control, formState, setValue, setError, getValues, reset } =
    useForm<FormValues, unknown, PaymentInput>({
      resolver: zodResolver(paymentFormSchema),
      defaultValues: defaults(),
    })

  // Cada vez que se abre, desde cero y con los trabajos «Por cobrar» de ahora, que ya no cambian
  // hasta cerrarlo.
  useEffect(() => {
    if (open) reset(defaults())
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir
  }, [open])

  const monto = useWatch({ control, name: 'monto' })
  const rows = useWatch({ control, name: 'asignaciones' })
  const totals = allocationTotals(
    parseMoneyInput(monto),
    (rows ?? []).map((r) => r.monto),
  )

  /** Al escribir el monto, el reparto sugerido. */
  function fill(value: string) {
    suggestedRows(ordered, parseMoneyInput(value)).forEach((row, i) =>
      setValue(`asignaciones.${i}.monto`, row.monto, { shouldValidate: formState.isSubmitted }),
    )
  }

  function submit(input: PaymentInput) {
    if (busy) return
    // Las filas del formulario que viajan, en orden: la asignación `j` de la API es `sent[j]`.
    const sent = getValues('asignaciones').flatMap((r, i) => (r.monto.trim() ? [i] : []))
    pay.mutate(input, {
      onSuccess: () => onOpenChange(false),
      onError: (err) => {
        if (!(err instanceof ApiError)) return
        if (err.status === 409) onOpenChange(false)
        if (err.status !== 422) return
        const unmapped = applyIssues(err.issues, sent, FIELDS, (field, message) =>
          setError(field as Path<FormValues>, { type: 'server', message }),
        )
        if (unmapped) toastApiError(err)
      },
    })
  }

  const errors = formState.errors
  const totalError = errors.asignaciones?.message ?? errors.asignaciones?.root?.message

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar pago"
      context={{ label: clinic.name }}
      description="Los trabajos que el pago cubra pasan a «Cobrado»; lo que no se aplique queda a favor de la clínica."
      summary={
        ordered.length > 0 && (
          <AllocationSummary
            allocatedCents={totals.allocatedCents}
            leftCents={totals.leftCents}
            leftLabel="Queda a favor"
            overLabel="Supera el pago en"
            error={totalError}
          />
        )
      }
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button type="submit" form="payment-form" disabled={busy}>
            {busy ? 'Guardando…' : 'Registrar pago'}
          </Button>
        </>
      }
    >
      <form id="payment-form" onSubmit={handleSubmit(submit)} noValidate>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.monto}>
              <FieldLabel htmlFor="pago-monto">Monto</FieldLabel>
              <Input
                {...register('monto', { onChange: (e) => fill(String(e.target.value)) })}
                id="pago-monto"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                className="h-11 font-mono tabular-nums"
                aria-invalid={!!errors.monto}
              />
              {errors.monto && <FieldError errors={[errors.monto]} />}
            </Field>
            <Controller
              name="metodo"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="pago-metodo">Método</FieldLabel>
                  <Select
                    name={field.name}
                    value={field.value ?? ''}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger
                      id="pago-metodo"
                      className="h-11 w-full"
                      aria-invalid={fieldState.invalid}
                    >
                      <SelectValue placeholder="Elegir método" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {PAYMENT_METHOD_LABEL[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.error && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Field data-invalid={!!errors.fecha}>
              <FieldLabel htmlFor="pago-fecha">Fecha</FieldLabel>
              <Input
                {...register('fecha')}
                id="pago-fecha"
                type="date"
                max={today}
                className="h-11"
                aria-invalid={!!errors.fecha}
              />
              {errors.fecha && <FieldError errors={[errors.fecha]} />}
            </Field>
            <Field data-invalid={!!errors.referencia}>
              <FieldLabel htmlFor="pago-referencia">Referencia</FieldLabel>
              <Input
                {...register('referencia')}
                id="pago-referencia"
                autoComplete="off"
                placeholder="N.º de transferencia o cheque"
                className="h-11"
                aria-invalid={!!errors.referencia}
              />
              {errors.referencia && <FieldError errors={[errors.referencia]} />}
            </Field>
          </div>
          <Field data-invalid={!!errors.notas}>
            <FieldLabel htmlFor="pago-notas">Notas</FieldLabel>
            <Input
              {...register('notas')}
              id="pago-notas"
              autoComplete="off"
              className="h-11"
              aria-invalid={!!errors.notas}
            />
            {errors.notas && <FieldError errors={[errors.notas]} />}
          </Field>
          <section aria-labelledby="pago-reparto" className="flex flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              <h3 id="pago-reparto" className="text-sm font-medium">
                A qué trabajos se aplica
              </h3>
              {ordered.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Se aplica de la entrega más antigua a la más nueva. Puedes cambiar cada monto.
                </p>
              )}
            </div>
            <AllocationFields
              cases={ordered}
              amounts={(rows ?? []).map((r) => r.monto)}
              field={(i) => register(`asignaciones.${i}.monto`)}
              rowError={(i) => errors.asignaciones?.[i]?.monto?.message}
              emptyText="No hay trabajos por cobrar: todo el pago queda a favor."
            />
          </section>
          {queued && <QueuedNotice />}
        </FieldGroup>
      </form>
    </FormDialog>
  )
}
