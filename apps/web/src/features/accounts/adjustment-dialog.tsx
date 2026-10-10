import {
  ADJUSTMENT_SIGN_LABEL,
  ADJUSTMENT_SIGNS,
  adjustmentFormSchema,
  CASE_STATUS_LABEL,
  discountReleaseCents,
  fromCents,
  OPENING_BALANCE_REASON,
  parseMoneyInput,
  toIsoDate,
  toSignedCents,
  type AdjustmentInput,
  type CaseStatus,
} from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Info } from 'lucide-react'
import { useEffect } from 'react'
import { Controller, useForm, useWatch, type Path } from 'react-hook-form'
import type { z } from 'zod'
import { Combobox } from '@/components/combobox'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { QueuedNotice } from '@/features/cases/queued-notice'
import { ApiError, toastApiError } from '@/lib/api-error'
import { formatMoney } from '@/lib/format-money'
import { applyIssues } from './allocation'
import { DateField } from './date-field'
import { useAccountBusy } from './use-account-busy'
import { useRegisterAdjustment } from './use-register-adjustment'

type FormValues = z.input<typeof adjustmentFormSchema>

/** Campos donde puede caer un 422 de la API. */
const FIELDS = ['signo', 'monto', 'motivo', 'fecha', 'trabajoId']

/** Lo que oye el lector de pantalla cuando aparece el aviso del descuento: sin el monto, para
 * no repetirlo con cada tecla (final review M-1). */
const DISCOUNT_ANNOUNCE = 'Este descuento devuelve dinero al saldo a favor.'

/** Valor interno de «Sin trabajo» en el `Combobox` (que no admite `''`); nunca sale del diálogo. */
const NO_CASE = '__sin_trabajo__'

/** Un trabajo que carga a la cuenta (`billedCases` de la API): su estado, lo que debe con signo
 * y lo ya pagado. */
export type AdjustableCase = {
  id: string
  code: string
  patientRef: string
  status: CaseStatus
  outstanding: string
  allocated: string
}

/**
 * Lo que un descuento ligado a un trabajo devolverá al saldo a favor, dicho antes de confirmar
 * (UX5-15): el monto exacto con `discountReleaseCents` de shared, si el descuento pasa de lo que
 * debe (en uno cobrado, todo lo descontado sale de lo pagado), aparte del texto para la
 * monoespaciada. `null` si no devuelve nada: recargo, sin trabajo, o un descuento que la API
 * rechazará por dejar el neto bajo 0 (también en un cobrado sin nada pagado, como una repetición
 * al 0 %, final review M-2).
 */
function discountNotice(
  c: AdjustableCase | undefined,
  signo: string | undefined,
  monto: string,
): { amount: string; text: string } | null {
  if (!c || signo !== 'descuento') return null
  const cents = parseMoneyInput(monto)
  if (!cents) return null
  const released = discountReleaseCents(
    { outstandingCents: toSignedCents(c.outstanding), allocatedCents: toSignedCents(c.allocated) },
    cents,
  )
  return released
    ? {
        amount: formatMoney(fromCents(released)),
        text: 'de lo ya pagado por este trabajo vuelven al saldo a favor.',
      }
    : null
}

/**
 * «Registrar ajuste» (CTA-3, solo admin): descuento o nota de crédito (resta) o recargo (suma),
 * con monto, motivo obligatorio, fecha (hoy por omisión, nunca después) y trabajo opcional. Sin
 * trabajo solo mueve el saldo de la clínica; con trabajo cambia lo que se debe por él. El atajo
 * «Saldo inicial» deja un recargo sin trabajo con ese motivo, para cargar la deuda al arrancar.
 *
 * Un 422 de la API se pinta bajo su campo (también «El descuento supera lo que vale el
 * trabajo…» en el monto); un 409 cierra el diálogo tras refrescar y avisar.
 */
export function AdjustmentDialog({
  clinic,
  cases,
  open,
  onOpenChange,
}: {
  clinic: { id: string; name: string }
  cases: readonly AdjustableCase[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const adjust = useRegisterAdjustment(clinic.id)
  const { busy, queued } = useAccountBusy(clinic.id)
  const today = toIsoDate(new Date())
  const defaults = (): FormValues => ({
    clinicaId: clinic.id,
    signo: undefined as unknown as FormValues['signo'],
    monto: '',
    motivo: '',
    fecha: today,
    trabajoId: '',
  })
  const { register, handleSubmit, control, formState, setValue, setError, reset } = useForm<
    FormValues,
    unknown,
    AdjustmentInput
  >({ resolver: zodResolver(adjustmentFormSchema), defaultValues: defaults() })

  useEffect(() => {
    if (open) reset(defaults())
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir
  }, [open])

  const [signo, monto, trabajoId, fecha] = useWatch({
    control,
    name: ['signo', 'monto', 'trabajoId', 'fecha'],
  })
  const notice = discountNotice(
    cases.find((c) => c.id === trabajoId),
    signo,
    monto ?? '',
  )

  const items = [
    { value: NO_CASE, label: 'Sin trabajo: solo la clínica' },
    // UX5-11: código en monoespaciada, paciente y lo que debe o el estado con su etiqueta.
    ...cases.map((c) => ({
      value: c.id,
      code: c.code,
      label: c.patientRef,
      detail:
        c.status === 'entregado'
          ? `Debe ${formatMoney(c.outstanding)}`
          : CASE_STATUS_LABEL[c.status],
    })),
  ]

  /** «Saldo inicial»: recargo sin trabajo con ese motivo. */
  function openingBalance() {
    const validate = { shouldValidate: formState.isSubmitted, shouldDirty: true }
    setValue('motivo', OPENING_BALANCE_REASON, validate)
    setValue('signo', 'recargo', validate)
    setValue('trabajoId', '', validate)
  }

  function submit(input: AdjustmentInput) {
    if (busy) return
    adjust.mutate(input, {
      onSuccess: () => onOpenChange(false),
      onError: (err) => {
        if (!(err instanceof ApiError)) return
        if (err.status === 409) onOpenChange(false)
        if (err.status !== 422) return
        const unmapped = applyIssues(err.issues, [], FIELDS, (field, message) =>
          setError(field as Path<FormValues>, { type: 'server', message }),
        )
        if (unmapped) toastApiError(err)
      },
    })
  }

  const errors = formState.errors
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar ajuste"
      context={{ label: clinic.name }}
      description="Un descuento baja lo que debe la clínica y un recargo lo sube. Con trabajo, cambia lo que se debe por ese trabajo."
      // El aviso del descuento va en el pie fijo, junto al botón que confirma: se ve antes de
      // confirmar aunque el cuerpo no quepa. Al lector de pantalla se lo dice una región `sr-only`
      // siempre montada (nunca `display: none`, que la sacaría del árbol y el aviso podría no
      // anunciarse al aparecer; `absolute`, no deja hueco en el pie) con un texto sin el monto:
      // solo cambia cuando el aviso aparece o se va, no con cada tecla del monto (final review
      // M-1). El monto se lee en el aviso visible.
      summary={
        <>
          <p role="status" className="sr-only">
            {notice ? DISCOUNT_ANNOUNCE : ''}
          </p>
          {notice && (
            <p className="flex gap-2 rounded-lg border border-wax-amber/60 bg-wax-amber/10 px-3 py-2 text-sm text-foreground">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-wax-amber-ink" />
              <span>
                <span className="font-mono">{notice.amount}</span> {notice.text}
              </span>
            </p>
          )}
        </>
      }
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button type="submit" form="adjustment-form" disabled={busy}>
            {busy ? 'Guardando…' : 'Registrar ajuste'}
          </Button>
        </>
      }
    >
      <form id="adjustment-form" onSubmit={handleSubmit(submit)} noValidate>
        <FieldGroup>
          <Controller
            name="signo"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel id="ajuste-tipo">Tipo</FieldLabel>
                <div
                  role="group"
                  aria-labelledby="ajuste-tipo"
                  className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                >
                  {ADJUSTMENT_SIGNS.map((sign) => {
                    const pressed = field.value === sign
                    return (
                      <Button
                        key={sign}
                        type="button"
                        variant="outline"
                        aria-pressed={pressed}
                        className="min-h-11 justify-start aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:text-accent-foreground"
                        onClick={() => field.onChange(sign)}
                      >
                        {pressed && <Check aria-hidden />}
                        {ADJUSTMENT_SIGN_LABEL[sign]}
                      </Button>
                    )
                  })}
                </div>
                {fieldState.error && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.monto}>
              <FieldLabel htmlFor="ajuste-monto">Monto</FieldLabel>
              <Input
                {...register('monto')}
                id="ajuste-monto"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                className="h-11 font-mono tabular-nums"
                aria-invalid={!!errors.monto}
              />
              {errors.monto && <FieldError errors={[errors.monto]} />}
            </Field>
            <DateField
              id="ajuste-fecha"
              label="Fecha"
              value={fecha}
              max={today}
              error={errors.fecha}
              registration={register('fecha')}
            />
          </div>
          <Controller
            name="trabajoId"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="ajuste-trabajo">Trabajo</FieldLabel>
                <Combobox
                  id="ajuste-trabajo"
                  aria-label="Trabajo"
                  items={items}
                  value={field.value ? field.value : NO_CASE}
                  onChange={(v) => field.onChange(v === NO_CASE ? '' : v)}
                  placeholder="Elegir trabajo"
                  searchPlaceholder="Buscar por código o paciente"
                  emptyMessage="Ningún trabajo con ese código o paciente"
                  aria-invalid={fieldState.invalid}
                  className="h-11 w-full"
                />
                <FieldDescription>Trabajos entregados o cobrados de esta clínica.</FieldDescription>
                {fieldState.error && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Field data-invalid={!!errors.motivo}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FieldLabel htmlFor="ajuste-motivo">Motivo</FieldLabel>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={openingBalance}
              >
                Saldo inicial
              </Button>
            </div>
            <Textarea
              {...register('motivo')}
              id="ajuste-motivo"
              rows={2}
              placeholder="Por ejemplo: descuento acordado por volumen"
              aria-invalid={!!errors.motivo}
            />
            {errors.motivo && <FieldError errors={[errors.motivo]} />}
          </Field>
          {queued && <QueuedNotice />}
        </FieldGroup>
      </form>
    </FormDialog>
  )
}
