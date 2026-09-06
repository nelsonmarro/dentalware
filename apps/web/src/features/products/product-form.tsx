import { PRICING_UNITS, productSchema, type ProductInput } from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import type { z } from 'zod'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { Category, Product } from './api'
import { PRICING_UNIT_LABEL } from './pricing-unit-label'

type ProductFormValues = z.input<typeof productSchema>

export function ProductForm({
  open,
  onOpenChange,
  product,
  categories,
  onSubmit,
  pending,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  product: Product | null
  categories: Category[]
  onSubmit: (v: ProductInput) => void
  pending: boolean
}) {
  const form = useForm<ProductFormValues, unknown, ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      code: product?.code ?? '',
      name: product?.name ?? '',
      categoryId: product?.categoryId ?? categories[0]?.id ?? '',
      pricingUnit: product?.pricingUnit ?? 'por_pieza',
      basePrice: product?.basePrice ?? '0.00',
      turnaroundDays: product?.turnaroundDays ?? 5,
      requiresTryIn: product?.requiresTryIn ?? false,
    },
  })
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={product ? 'Editar producto' : 'Nuevo producto'}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="product-form" disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4">
            <Controller
              name="code"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="product-code">Código</FieldLabel>
                  <Input
                    {...field}
                    id="product-code"
                    className="h-11 font-mono uppercase"
                    aria-invalid={fieldState.invalid}
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="product-name">Nombre</FieldLabel>
                  <Input
                    {...field}
                    id="product-name"
                    className="h-11"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </div>
          <Controller
            name="categoryId"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="product-category">Categoría</FieldLabel>
                <Select name={field.name} value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="product-category"
                    className="h-11"
                    aria-invalid={fieldState.invalid}
                  >
                    <SelectValue placeholder="Elegir categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <div className="grid grid-cols-2 gap-4">
            <Controller
              name="pricingUnit"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="product-unit">Se cobra</FieldLabel>
                  <Select name={field.name} value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="product-unit" className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRICING_UNITS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {PRICING_UNIT_LABEL[u]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="basePrice"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="product-price">Precio base (USD)</FieldLabel>
                  <Input
                    {...field}
                    id="product-price"
                    inputMode="decimal"
                    className="h-11 font-mono"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </div>
          <Controller
            name="turnaroundDays"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="product-days">Días hábiles de entrega</FieldLabel>
                <Input
                  {...field}
                  id="product-days"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={(field.value ?? 0) as string | number}
                  className="h-11"
                  aria-invalid={fieldState.invalid}
                />
                <FieldDescription>
                  Se usa para calcular la fecha comprometida del trabajo.
                </FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="requiresTryIn"
            control={form.control}
            render={({ field }) => (
              <Field orientation="horizontal">
                <Switch
                  id="product-tryin"
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                />
                <FieldLabel htmlFor="product-tryin">Requiere prueba en clínica</FieldLabel>
              </Field>
            )}
          />
        </FieldGroup>
      </form>
    </FormDialog>
  )
}
