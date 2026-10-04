import { toIsoDate, type caseInputSchema, type CaseInput } from '@dentalware/shared'
import { ChevronDown, Truck } from 'lucide-react'
import { useState } from 'react'
import { Controller, type UseFormReturn } from 'react-hook-form'
import type { z } from 'zod'
import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { CourierSelect } from '@/features/deliveries/courier-select'
import { cn } from '@/lib/utils'

type CaseFormValues = z.input<typeof caseInputSchema>

/**
 * «Programar recogida» (ENT-1): sección plegable del formulario de nuevo trabajo, no otra
 * pantalla (decisión 2 del plan). Cerrada, el trabajo no lleva `recogida` y nace «Nuevo»;
 * abierta, lleva mensajero y fecha (por omisión, hoy) y nace «Por recoger». Volver a plegarla
 * descarta lo elegido: lo que no se ve no se envía.
 */
export function PickupFields({
  form,
}: {
  form: UseFormReturn<CaseFormValues, unknown, CaseInput>
}) {
  const [open, setOpen] = useState(false)
  const { control, setValue, clearErrors } = form

  function toggle() {
    if (open) {
      setValue('recogida', undefined)
      clearErrors('recogida')
    } else {
      setValue('recogida', { mensajeroId: '', fecha: toIsoDate(new Date()) })
    }
    setOpen(!open)
  }

  return (
    <Card className="gap-0 py-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="pickup-fields"
        aria-labelledby="pickup-title"
        aria-describedby="pickup-hint"
        onClick={toggle}
        className="flex min-h-14 w-full items-center gap-3 rounded-xl px-6 py-3 text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Truck className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col">
          <span id="pickup-title" className="font-medium">
            Programar recogida
          </span>
          <span id="pickup-hint" className="text-sm text-muted-foreground">
            {open
              ? 'El trabajo queda «Por recoger» hasta que el mensajero lo traiga.'
              : 'Si el mensajero tiene que traerlo de la clínica.'}
          </span>
        </span>
        <ChevronDown
          aria-hidden
          className={cn('size-5 shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <CardContent id="pickup-fields" className="grid gap-4 pb-6 sm:grid-cols-2">
          <Controller
            name="recogida.mensajeroId"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="pickup-courier">Mensajero</FieldLabel>
                <CourierSelect
                  id="pickup-courier"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="recogida.fecha"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="pickup-date">Fecha de recogida</FieldLabel>
                <Input
                  {...field}
                  id="pickup-date"
                  type="date"
                  min={toIsoDate(new Date())}
                  className="h-11"
                  value={field.value ?? ''}
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </CardContent>
      )}
    </Card>
  )
}
