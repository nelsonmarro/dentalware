import { stageSchema, type StageInput } from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import type { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { FormDialog } from '@/components/form-dialog'
import type { Stage } from './api'

type StageFormValues = z.input<typeof stageSchema>

export function StageForm({
  open,
  onOpenChange,
  stage,
  onSubmit,
  pending,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  stage: Stage | null
  onSubmit: (v: StageInput) => void
  pending: boolean
}) {
  const form = useForm<StageFormValues, unknown, StageInput>({
    resolver: zodResolver(stageSchema),
    defaultValues: {
      name: stage?.name ?? '',
      color: stage?.color ?? '#0F766E',
      sort: stage?.sort ?? 0,
    },
  })
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={stage ? 'Editar fase' : 'Nueva fase'}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="stage-form" disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="stage-form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="stage-name">Nombre</FieldLabel>
                <Input
                  {...field}
                  id="stage-name"
                  className="h-11"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="color"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="stage-color">Color</FieldLabel>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    aria-label="Elegir color"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    className="h-11 w-14 cursor-pointer rounded-lg border"
                  />
                  <Input
                    {...field}
                    id="stage-color"
                    className="h-11 font-mono uppercase"
                    aria-invalid={fieldState.invalid}
                  />
                </div>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </FieldGroup>
      </form>
    </FormDialog>
  )
}
