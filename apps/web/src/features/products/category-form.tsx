import { productCategorySchema, type ProductCategoryInput } from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import type { z } from 'zod'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { Category } from './api'

type CategoryFormValues = z.input<typeof productCategorySchema>

export function CategoryForm({
  open,
  onOpenChange,
  category,
  onSubmit,
  pending,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  category: Category | null
  onSubmit: (v: ProductCategoryInput) => void
  pending: boolean
}) {
  const form = useForm<CategoryFormValues, unknown, ProductCategoryInput>({
    resolver: zodResolver(productCategorySchema),
    defaultValues: {
      name: category?.name ?? '',
      sort: category?.sort ?? 0,
    },
  })
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={category ? 'Editar categoría' : 'Nueva categoría'}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="category-form" disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="category-name">Nombre</FieldLabel>
                <Input
                  {...field}
                  id="category-name"
                  className="h-11"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="sort"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="category-sort">Orden</FieldLabel>
                <Input
                  {...field}
                  id="category-sort"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={(field.value ?? 0) as string | number}
                  className="h-11"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </FieldGroup>
      </form>
    </FormDialog>
  )
}
