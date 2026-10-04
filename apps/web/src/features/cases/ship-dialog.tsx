import {
  DELIVERY_MANAGE_ROLES,
  hasRole,
  shipmentInputSchema,
  toIsoDate,
  type ShipmentInput,
  type UserRole,
} from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { CourierSelect } from '@/features/deliveries/courier-select'
import { useCouriers } from '@/features/deliveries/use-couriers'
import type { CaseDetail } from './api'
import { formatDate } from './date-format'
import { useCaseAction } from './use-cases'

/** Quién usa la app: el mensajero envía siempre con él mismo (decisión 4 del plan). */
export type DeliverySelf = { id: string; name: string }

/**
 * «Marcar enviado» (ENT-2): el trabajo sale con un mensajero y una fecha de entrega (hoy por
 * omisión). Admin y recepción eligen el mensajero (`DELIVERY_MANAGE_ROLES`); el mensajero va
 * fijo en sí mismo, sin selector (la API rechaza que se asigne a otro) y sin pedir la lista,
 * que no puede leer. La descripción nombra la consecuencia concreta, con quién y cuándo.
 */
export function ShipDialog({
  case: c,
  role,
  self,
  open,
  onOpenChange,
}: {
  case: CaseDetail
  role: UserRole
  self?: DeliverySelf
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const chooses = hasRole(DELIVERY_MANAGE_ROLES, role)
  const today = toIsoDate(new Date())
  const action = useCaseAction(c.id)
  const couriers = useCouriers(chooses)
  const form = useForm<ShipmentInput>({
    resolver: zodResolver(shipmentInputSchema),
    defaultValues: { mensajeroId: chooses ? '' : (self?.id ?? ''), fecha: today },
  })
  const [mensajeroId, fecha] = useWatch({ control: form.control, name: ['mensajeroId', 'fecha'] })
  const courierName = chooses ? couriers.data?.find((m) => m.id === mensajeroId)?.name : self?.name

  function submit(envio: ShipmentInput) {
    action.mutate(
      { accion: 'marcar_enviado', motivo: null, envio },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Marcar enviado"
      description={
        courierName && fecha
          ? `El trabajo sale del laboratorio con ${courierName} el ${formatDate(fecha)}.`
          : 'Elige quién lleva el trabajo a la clínica y qué día.'
      }
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button
            type="submit"
            form="ship-form"
            disabled={!mensajeroId || !fecha || action.isPending}
          >
            {action.isPending ? 'Guardando…' : 'Marcar enviado'}
          </Button>
        </>
      }
    >
      <form
        id="ship-form"
        onSubmit={form.handleSubmit(submit)}
        noValidate
        className="flex flex-col gap-4"
      >
        {chooses ? (
          <Controller
            name="mensajeroId"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="ship-courier">Mensajero</FieldLabel>
                <CourierSelect
                  id="ship-courier"
                  value={field.value}
                  onChange={field.onChange}
                  invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        ) : (
          <Field>
            <FieldLabel htmlFor="ship-courier-self">Mensajero</FieldLabel>
            <p id="ship-courier-self" className="text-base font-medium">
              {self?.name ?? 'Tú'}
            </p>
          </Field>
        )}
        <Controller
          name="fecha"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="ship-date">Fecha de entrega</FieldLabel>
              <Input
                {...field}
                id="ship-date"
                type="date"
                min={today}
                className="h-11"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </form>
    </FormDialog>
  )
}
