import { clinicSchema, type ClinicInput } from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import type { z } from 'zod'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { Clinic } from './api'

type ClinicFormValues = z.input<typeof clinicSchema>

export function ClinicForm({
  open,
  onOpenChange,
  clinic,
  onSubmit,
  pending,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  clinic: Clinic | null
  onSubmit: (v: ClinicInput) => void
  pending: boolean
}) {
  const form = useForm<ClinicFormValues, unknown, ClinicInput>({
    resolver: zodResolver(clinicSchema),
    defaultValues: {
      name: clinic?.name ?? '',
      ruc: clinic?.ruc ?? '',
      address: clinic?.address ?? '',
      city: clinic?.city ?? '',
      phone: clinic?.phone ?? '',
      whatsapp: clinic?.whatsapp ?? '',
      email: clinic?.email ?? '',
      paymentTermsDays: clinic?.paymentTermsDays ?? 0,
      notes: clinic?.notes ?? '',
    },
  })
  const text = <K extends keyof ClinicFormValues>(
    name: K,
    label: string,
    props: React.ComponentProps<typeof Input> = {},
    description?: string,
  ) => (
    <Controller
      name={name}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={`clinic-${name}`}>{label}</FieldLabel>
          <Input
            {...field}
            {...props}
            id={`clinic-${name}`}
            value={(field.value ?? '') as string | number}
            className="h-11"
            aria-invalid={fieldState.invalid}
          />
          {description && <FieldDescription>{description}</FieldDescription>}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={clinic ? 'Editar clínica' : 'Nueva clínica'}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="clinic-form" disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="clinic-form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          {text('name', 'Nombre')}
          {text('ruc', 'RUC', { inputMode: 'numeric' })}
          {text('city', 'Ciudad')}
          {text('address', 'Dirección')}
          {text('phone', 'Teléfono', { type: 'tel' })}
          {text(
            'whatsapp',
            'WhatsApp',
            { type: 'tel', placeholder: '+593991234567' },
            'Formato internacional; se usa para los avisos.',
          )}
          {text('email', 'Correo', { type: 'email' })}
          {text('paymentTermsDays', 'Días de crédito', {
            type: 'number',
            inputMode: 'numeric',
            min: 0,
          })}
          <Controller
            name="notes"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="clinic-notes">Notas</FieldLabel>
                <Textarea {...field} id="clinic-notes" value={field.value ?? ''} rows={3} />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </FieldGroup>
      </form>
    </FormDialog>
  )
}
