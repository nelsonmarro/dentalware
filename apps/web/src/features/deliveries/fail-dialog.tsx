import {
  addBusinessDays,
  DELIVERY_FAIL_REASONS,
  deliveryFailSchema,
  toIsoDate,
  type DeliveryFailInput,
  type DeliveryType,
} from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import type { z } from 'zod'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useFailDelivery } from './use-fail-delivery'

type FailFormValues = z.input<typeof deliveryFailSchema>

/** Título por tipo: dice qué no se pudo hacer. `Record` exhaustivo: un tipo de entrega nuevo
 * no compila sin su texto. */
const TITLE: Record<DeliveryType, string> = {
  recogida: 'No se pudo recoger',
  entrega: 'No se pudo entregar',
}

const DESCRIPTION: Record<DeliveryType, string> = {
  recogida:
    'La recogida queda como fallida con su motivo y se programa otra para la nueva fecha, con el mismo mensajero.',
  entrega:
    'La entrega queda como fallida con su motivo y se programa otra para la nueva fecha, con el mismo mensajero. El trabajo sigue enviado.',
}

/**
 * «No se pudo» (ENT-5, decisión 6 del plan): motivo obligatorio y nueva fecha, por omisión el
 * siguiente día hábil (sin feriados, ADR 30). Una sola operación: cierra la entrega como
 * fallida y programa la siguiente; el estado del trabajo no cambia. La fecha mínima es hoy,
 * como valida la API.
 *
 * UX4-12: nombra el trabajo y la clínica, y ofrece los motivos frecuentes como chips de 44 px
 * que rellenan el campo (editable después). Van antes del campo, así que el foco inicial cae en
 * el primero y no abre el teclado del celular.
 */
export function FailDialog({
  delivery,
  open,
  onOpenChange,
}: {
  delivery: {
    id: string
    type: DeliveryType
    case: { code: string }
    clinic: { name: string }
  }
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const now = new Date()
  const today = toIsoDate(now)
  const nextBusinessDay = toIsoDate(addBusinessDays(now, 1, []))
  const fail = useFailDelivery(delivery.id)
  const { register, handleSubmit, formState, setValue, control } = useForm<
    FailFormValues,
    unknown,
    DeliveryFailInput
  >({
    resolver: zodResolver(deliveryFailSchema),
    defaultValues: { motivo: '', nuevaFecha: nextBusinessDay },
  })

  const motivo = useWatch({ control, name: 'motivo' })

  function submit(input: DeliveryFailInput) {
    fail.mutate(input, { onSuccess: () => onOpenChange(false) })
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={TITLE[delivery.type]}
      context={{ code: delivery.case.code, label: delivery.clinic.name }}
      description={DESCRIPTION[delivery.type]}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button type="submit" form="fail-delivery-form" disabled={fail.isPending}>
            {fail.isPending ? 'Guardando…' : 'Reprogramar'}
          </Button>
        </>
      }
    >
      <form
        id="fail-delivery-form"
        onSubmit={handleSubmit(submit)}
        noValidate
        className="flex flex-col gap-4"
      >
        <Field data-invalid={!!formState.errors.motivo}>
          <FieldLabel htmlFor="fail-motivo">Motivo</FieldLabel>
          <div role="group" aria-label="Motivos frecuentes" className="flex flex-wrap gap-2">
            {DELIVERY_FAIL_REASONS.map((reason) => (
              <Button
                key={reason}
                type="button"
                variant={motivo === reason ? 'secondary' : 'outline'}
                aria-pressed={motivo === reason}
                className="min-h-11 rounded-full aria-pressed:border-primary aria-pressed:text-primary"
                onClick={() =>
                  setValue('motivo', reason, {
                    shouldDirty: true,
                    shouldValidate: formState.isSubmitted,
                  })
                }
              >
                {/* M-8 (revisión T9): el pulsado no se distingue solo por el color. */}
                {motivo === reason && <Check aria-hidden />}
                {reason}
              </Button>
            ))}
          </div>
          <Textarea
            {...register('motivo')}
            id="fail-motivo"
            rows={3}
            placeholder="Por ejemplo: la clínica estaba cerrada"
            aria-invalid={!!formState.errors.motivo}
          />
          {formState.errors.motivo && <FieldError errors={[formState.errors.motivo]} />}
        </Field>
        <Field data-invalid={!!formState.errors.nuevaFecha}>
          <FieldLabel htmlFor="fail-fecha">Nueva fecha</FieldLabel>
          <Input
            {...register('nuevaFecha')}
            id="fail-fecha"
            type="date"
            min={today}
            className="h-11"
            aria-invalid={!!formState.errors.nuevaFecha}
          />
          {formState.errors.nuevaFecha && <FieldError errors={[formState.errors.nuevaFecha]} />}
        </Field>
      </form>
    </FormDialog>
  )
}
