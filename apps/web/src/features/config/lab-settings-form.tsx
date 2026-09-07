import { labSettingsSchema, type LabSettingsInput } from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import type { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { LabSettings } from './api'

type LabSettingsFormValues = z.input<typeof labSettingsSchema>

export function LabSettingsForm({
  initial,
  onSubmit,
  pending,
}: {
  initial: LabSettings | null
  onSubmit: (v: LabSettingsInput) => void
  pending: boolean
}) {
  const form = useForm<LabSettingsFormValues, unknown, LabSettingsInput>({
    resolver: zodResolver(labSettingsSchema),
    defaultValues: {
      name: initial?.name ?? '',
      ruc: initial?.ruc ?? '',
      address: initial?.address ?? '',
      phone: initial?.phone ?? '',
      logoUrl: initial?.logoUrl ?? '',
      codePrefix: initial?.codePrefix ?? '',
      ivaPct: initial?.ivaPct ?? 15,
    },
  })
  const text = <K extends keyof LabSettingsFormValues>(
    name: K,
    label: string,
    props: React.ComponentProps<typeof Input> = {},
  ) => (
    <Controller
      name={name}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={`lab-${name}`}>{label}</FieldLabel>
          <Input
            {...field}
            {...props}
            id={`lab-${name}`}
            value={(field.value ?? '') as string | number}
            aria-invalid={fieldState.invalid}
            className="h-11"
          />
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex max-w-2xl flex-col gap-6 rounded-xl border border-border bg-card p-6"
      noValidate
    >
      <FieldGroup>
        {text('name', 'Nombre del laboratorio', { autoComplete: 'organization' })}
        {text('ruc', 'RUC', { inputMode: 'numeric', autoComplete: 'off' })}
        {text('address', 'Dirección', { autoComplete: 'street-address' })}
        {text('phone', 'Teléfonos', { autoComplete: 'tel' })}
        {text('codePrefix', 'Prefijo del código de trabajo')}
        {text('ivaPct', 'IVA informativo (%)', { type: 'number', inputMode: 'numeric' })}
        {text('logoUrl', 'URL del logo')}
      </FieldGroup>
      <div className="flex justify-end">
        <Button type="submit" className="h-11 w-full sm:w-auto" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  )
}
