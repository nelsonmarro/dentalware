import type { CaseInput, caseInputSchema } from '@dentalware/shared'
import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Controller, useFieldArray, useWatch, type UseFormReturn } from 'react-hook-form'
import type { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Product } from '@/features/products/api'
import { formatMoney } from '@/features/products/pricing-unit-label'
import { computeTotals } from './case-totals'
import { TeethDialog } from './teeth-dialog'

type CaseFormValues = z.input<typeof caseInputSchema>

function newItem(): CaseFormValues['items'][number] {
  return {
    productId: '',
    description: '',
    quantity: 1,
    teeth: [],
    unitPrice: null,
    discountPct: 0,
    material: '',
    notes: '',
  }
}

/** Precio efectivo de un producto para la clínica actual: precio especial si existe, si no el base. */
function effectivePrice(product: Product, prices: ReadonlyMap<string, string>): string {
  return prices.get(product.id) ?? product.basePrice
}

export function CaseItemsEditor({
  form,
  clinicId,
  products,
  prices,
  canEditPrice,
}: {
  form: UseFormReturn<CaseFormValues, unknown, CaseInput>
  clinicId: string
  products: Product[]
  prices: ReadonlyMap<string, string>
  canEditPrice: boolean
}) {
  const { control, setValue, getValues, formState } = form
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const productsById = new Map(products.map((p) => [p.id, p]))

  // Piezas/precio editados a mano: no se pisan al recalcular por cambio de clínica.
  // `initialClinicId` fija la clínica con la que se abrió el formulario (nueva o de
  // edición, cuando `prices`/`products` ya traen los precios resueltos por el servidor);
  // solo se recalcula cuando la clínica actual deja de ser esa, es decir, cuando la
  // persona realmente la cambia en este formulario — nunca por la sola llegada
  // asíncrona de `prices`/`products` al montar.
  const manualPrice = useRef<Set<string>>(new Set())
  const initialClinicId = useRef(clinicId)
  useEffect(() => {
    if (clinicId === initialClinicId.current) return
    fields.forEach((field, index) => {
      if (manualPrice.current.has(field.id)) return
      const productId = getValues(`items.${index}.productId`)
      const product = productsById.get(productId)
      if (!product) return
      setValue(`items.${index}.unitPrice`, effectivePrice(product, prices))
    })
    // Solo debe recalcular cuando cambia la clínica o llegan sus precios; no en cada
    // tecleo de las demás líneas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId, prices, products])

  function handleAdd() {
    append(newItem())
  }

  function handleProductChange(index: number, productId: string) {
    setValue(`items.${index}.productId`, productId)
    manualPrice.current.delete(fields[index]?.id ?? '')
    const product = productsById.get(productId)
    if (product) {
      setValue(`items.${index}.unitPrice`, effectivePrice(product, prices))
      if (product.pricingUnit !== 'por_pieza') setValue(`items.${index}.teeth`, [])
    }
  }

  function handlePriceEdited(index: number) {
    const id = fields[index]?.id
    if (id) manualPrice.current.add(id)
  }

  const itemsErrors = formState.errors.items
  // El error de "al menos una línea" es de todo el arreglo: cuando no hay filas, zod lo
  // deja en `errors.items` directamente; en cuanto existe alguna fila, react-hook-form
  // lo mueve a `errors.items.root` para no chocar con los errores de cada línea.
  const itemsErrorMessage =
    (itemsErrors as { message?: string } | undefined)?.message ?? itemsErrors?.root?.message

  return (
    <div className="flex flex-col gap-3">
      {itemsErrorMessage && <FieldError errors={[{ message: itemsErrorMessage }]} />}
      {fields.map((field, index) => (
        <CaseItemRow
          key={field.id}
          index={index}
          control={control}
          products={products}
          product={productsById.get(getValues(`items.${index}.productId`))}
          canEditPrice={canEditPrice}
          onProductChange={(productId) => handleProductChange(index, productId)}
          onPriceEdited={() => handlePriceEdited(index)}
          onRemove={() => remove(index)}
        />
      ))}
      <Button type="button" variant="outline" className="h-11 self-start" onClick={handleAdd}>
        <Plus /> Agregar línea
      </Button>
    </div>
  )
}

function CaseItemRow({
  index,
  control,
  products,
  product,
  canEditPrice,
  onProductChange,
  onPriceEdited,
  onRemove,
}: {
  index: number
  control: UseFormReturn<CaseFormValues, unknown, CaseInput>['control']
  products: Product[]
  product: Product | undefined
  canEditPrice: boolean
  onProductChange: (productId: string) => void
  onPriceEdited: () => void
  onRemove: () => void
}) {
  const [teethOpen, setTeethOpen] = useState(false)
  const item = useWatch({ control, name: `items.${index}` })
  const lineTotal = computeTotals([
    {
      unitPrice: item?.unitPrice ?? null,
      quantity: Number(item?.quantity ?? 0) || 0,
      discountPct: Number(item?.discountPct ?? 0) || 0,
    },
  ]).lines[0]

  return (
    <fieldset
      data-testid="case-item-row"
      className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3 lg:grid-cols-7 lg:items-end lg:gap-2"
    >
      <legend className="sr-only">Línea {index + 1}</legend>
      <Field className="col-span-2 lg:col-span-2">
        <FieldLabel className="text-xs lg:sr-only" htmlFor={`item-${index}-producto`}>
          Producto
        </FieldLabel>
        <Select
          name={`items.${index}.productId`}
          value={item?.productId ?? ''}
          onValueChange={onProductChange}
        >
          <SelectTrigger
            id={`item-${index}-producto`}
            aria-label="Producto"
            className="h-11 w-full"
          >
            <SelectValue placeholder="Elegir producto" />
          </SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.code} — {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Controller
        name={`items.${index}.quantity`}
        control={control}
        render={({ field }) => (
          <Field>
            <FieldLabel className="text-xs lg:sr-only" htmlFor={`item-${index}-cantidad`}>
              Cantidad
            </FieldLabel>
            <Input
              {...field}
              id={`item-${index}-cantidad`}
              aria-label="Cantidad"
              type="number"
              min={1}
              max={99}
              className="h-11"
              value={(field.value ?? '') as string | number}
            />
          </Field>
        )}
      />
      <Field>
        <span className="text-xs text-muted-foreground lg:sr-only">Piezas</span>
        {product?.pricingUnit === 'por_pieza' ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => setTeethOpen(true)}
            >
              Piezas ({item?.teeth?.length ?? 0})
            </Button>
            <Controller
              name={`items.${index}.teeth`}
              control={control}
              render={({ field }) => (
                <TeethDialog
                  open={teethOpen}
                  onOpenChange={setTeethOpen}
                  value={field.value ?? []}
                  onSave={field.onChange}
                  title={`Piezas — línea ${index + 1}`}
                />
              )}
            />
          </>
        ) : (
          <span className="flex h-11 items-center text-sm text-muted-foreground">
            {product?.pricingUnit === 'por_arcada' ? 'Arcada' : '—'}
          </span>
        )}
      </Field>
      {canEditPrice && (
        <Controller
          name={`items.${index}.unitPrice`}
          control={control}
          render={({ field }) => (
            <Field>
              <FieldLabel className="text-xs lg:sr-only" htmlFor={`item-${index}-precio`}>
                Precio unitario
              </FieldLabel>
              <Input
                id={`item-${index}-precio`}
                aria-label="Precio unitario"
                type="number"
                step="0.01"
                min={0}
                className="h-11"
                value={field.value ?? ''}
                onChange={(e) => {
                  field.onChange(e.target.value)
                  onPriceEdited()
                }}
              />
            </Field>
          )}
        />
      )}
      <Controller
        name={`items.${index}.discountPct`}
        control={control}
        render={({ field }) => (
          <Field>
            <FieldLabel className="text-xs lg:sr-only" htmlFor={`item-${index}-descuento`}>
              Descuento %
            </FieldLabel>
            <Input
              {...field}
              id={`item-${index}-descuento`}
              aria-label="Descuento %"
              type="number"
              min={0}
              max={100}
              className="h-11"
              value={(field.value ?? '') as string | number}
            />
          </Field>
        )}
      />
      <Controller
        name={`items.${index}.material`}
        control={control}
        render={({ field }) => (
          <Field>
            <FieldLabel className="text-xs lg:sr-only" htmlFor={`item-${index}-material`}>
              Material
            </FieldLabel>
            <Input
              {...field}
              id={`item-${index}-material`}
              aria-label="Material"
              className="h-11"
              value={field.value ?? ''}
            />
          </Field>
        )}
      />
      <div className="col-span-2 flex items-end justify-between gap-2 lg:col-span-1">
        <Controller
          name={`items.${index}.notes`}
          control={control}
          render={({ field }) => (
            <Field className="flex-1">
              <FieldLabel className="text-xs lg:sr-only" htmlFor={`item-${index}-nota`}>
                Nota
              </FieldLabel>
              <Input
                {...field}
                id={`item-${index}-nota`}
                aria-label="Nota"
                className="h-11"
                value={field.value ?? ''}
              />
            </Field>
          )}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label={`Quitar línea ${index + 1}`}
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      </div>
      <div className="col-span-2 flex items-center justify-between text-sm lg:col-span-7 lg:border-t lg:pt-2">
        <span className="text-muted-foreground">Total de la línea</span>
        <span className="font-mono font-medium">{formatMoney(lineTotal ?? '0.00')}</span>
      </div>
    </fieldset>
  )
}
