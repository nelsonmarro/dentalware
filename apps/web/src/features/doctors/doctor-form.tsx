import { doctorSchema, type DoctorInput } from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import type { z } from 'zod'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { Doctor } from './api'

type DoctorFormValues = z.input<typeof doctorSchema>

export function DoctorForm({
  open,
  onOpenChange,
  clinicId,
  doctor,
  onSubmit,
  pending,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  clinicId: string
  doctor: Doctor | null
  onSubmit: (v: DoctorInput) => void
  pending: boolean
}) {
  const form = useForm<DoctorFormValues, unknown, DoctorInput>({
    resolver: zodResolver(doctorSchema),
    defaultValues: {
      clinicId,
      name: doctor?.name ?? '',
      phone: doctor?.phone ?? '',
      email: doctor?.email ?? '',
      notes: doctor?.notes ?? '',
    },
  })
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={doctor ? 'Editar doctor' : 'Nuevo doctor'}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="doctor-form" disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="doctor-form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="doctor-name">Nombre</FieldLabel>
                <Input
                  {...field}
                  id="doctor-name"
                  className="h-11"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="phone"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="doctor-phone">Teléfono</FieldLabel>
                <Input
                  {...field}
                  id="doctor-phone"
                  type="tel"
                  value={field.value ?? ''}
                  className="h-11"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="doctor-email">Correo</FieldLabel>
                <Input
                  {...field}
                  id="doctor-email"
                  type="email"
                  value={field.value ?? ''}
                  className="h-11"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="notes"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="doctor-notes">Notas</FieldLabel>
                <Textarea {...field} id="doctor-notes" value={field.value ?? ''} rows={3} />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </FieldGroup>
      </form>
    </FormDialog>
  )
}
