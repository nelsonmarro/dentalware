import type { CaseInput, caseInputSchema } from '@dentalware/shared'
import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Controller, useFieldArray, useWatch, type UseFormReturn } from 'react-hook-form'
import type { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Product } from '@/features/products/api'
import { formatMoney } from '@/features/products/pricing-unit-label'
import { useMediaQuery } from '@/lib/use-media-query'
import { computeTotals } from './case-totals'
import { TeethDialog } from './teeth-dialog'

// Tailwind `lg` empieza en 1024px; debe coincidir con el breakpoint de `CaseItemRow`
// (mismo patrón que `DESKTOP_QUERY` en `components/data-table.tsx`).
const DESKTOP_QUERY = '(min-width: 1024px)'

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
  // `mountClinicId` fija la clínica con la que se abrió el formulario (nueva o de
  // edición, cuando `prices`/`products` ya traen los precios resueltos por el
  // servidor); mientras la persona no la haya cambiado ni una vez (`hasLeftMountClinic`
  // sigue en `false`), cualquier disparo del efecto se ignora — así la llegada
  // asíncrona de `prices`/`products` al montar no pisa el precio ya guardado. En
  // cuanto cambia de clínica una sola vez, `hasLeftMountClinic` queda en `true` para
  // siempre: si más tarde vuelve a la clínica original, el efecto sigue recalculando
  // (con los precios vigentes de esa clínica) en vez de asumir que "ya está resuelto"
  // solo por coincidir el id, que es justo lo que dejaba los precios de la clínica
  // anterior pegados al volver (A → B → A).
  const manualPrice = useRef<Set<string>>(new Set())
  const mountClinicId = useRef(clinicId)
  const hasLeftMountClinic = useRef(false)
  useEffect(() => {
    if (clinicId !== mountClinicId.current) hasLeftMountClinic.current = true
    if (clinicId === mountClinicId.current && !hasLeftMountClinic.current) return
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
      if (product.pricingUnit === 'por_pieza') {
        // Recalcula con las piezas ya marcadas (si las hay); no se limita a dejar la
        // cantidad que tuviera el producto anterior, que puede no coincidir (ver
        // UX2-03: cambiar A → B → A no debe dejar pegada una cantidad vieja).
        const teeth = getValues(`items.${index}.teeth`) ?? []
        setValue(`items.${index}.quantity`, teeth.length || 1, {
          shouldDirty: true,
          shouldValidate: true,
        })
      } else {
        setValue(`items.${index}.teeth`, [])
      }
    }
  }

  function handleTeethSaved(index: number, teeth: number[]) {
    setValue(`items.${index}.quantity`, teeth.length || 1, {
      shouldDirty: true,
      shouldValidate: true,
    })
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

  const isDesktop = useMediaQuery(DESKTOP_QUERY)

  return (
    <div className="flex flex-col gap-3">
      {itemsErrorMessage && <FieldError errors={[{ message: itemsErrorMessage }]} />}
      {isDesktop && fields.length > 0 && <CaseItemsHeader canEditPrice={canEditPrice} />}
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
          onTeethSaved={(teeth) => handleTeethSaved(index, teeth)}
          onRemove={() => remove(index)}
        />
      ))}
      <Button type="button" variant="outline" className="h-11 self-start" onClick={handleAdd}>
        <Plus /> Agregar línea
      </Button>
    </div>
  )
}

/** Plantilla del grid de línea, compartida por `CaseItemsHeader` y `CaseItemRow` para
 * que nunca queden desalineadas entre sí (punto extra de la revisión de la Task 3):
 * el grid tiene 7 celdas (Producto ocupa 2) sin "Precio unitario" — técnico— y 8 con
 * ella —admin/recepción—; con `grid-cols-7` fijo y 8 celdas, "Nota" bajaba a una
 * segunda línea. Los literales completos (`grid-cols-8`, `lg:grid-cols-8`, etc.)
 * deben aparecer tal cual en el código fuente para que Tailwind los genere. */
function itemsGridTemplate(canEditPrice: boolean): { header: string; row: string } {
  return canEditPrice
    ? { header: 'grid-cols-8', row: 'lg:grid-cols-8' }
    : { header: 'grid-cols-7', row: 'lg:grid-cols-7' }
}

/** Fila de encabezados de columna en escritorio (UX2-04): en móvil las `FieldLabel`
 * de cada campo ya son visibles; en `lg:` quedan `sr-only` (repetir la etiqueta en
 * cada línea sería ruido), así que esta fila —oculta a lectores de pantalla, que ya
 * tienen la etiqueta accesible de cada campo— reemplaza esa referencia visual. Usa
 * la misma plantilla de columnas (`itemsGridTemplate`) y los mismos `col-span` que
 * `CaseItemRow` para que las columnas queden alineadas con los campos de la primera
 * línea. */
function CaseItemsHeader({ canEditPrice }: { canEditPrice: boolean }) {
  return (
    <div
      aria-hidden
      data-testid="case-items-header"
      className={cn(
        'grid gap-2 px-3 text-xs font-medium text-muted-foreground',
        itemsGridTemplate(canEditPrice).header,
      )}
    >
      <span className="col-span-2">Producto</span>
      <span>Cantidad</span>
      <span>Piezas</span>
      {canEditPrice && <span>Precio unitario</span>}
      <span>Descuento %</span>
      <span>Material</span>
      <span>Nota</span>
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
  onTeethSaved,
  onRemove,
}: {
  index: number
  control: UseFormReturn<CaseFormValues, unknown, CaseInput>['control']
  products: Product[]
  product: Product | undefined
  canEditPrice: boolean
  onProductChange: (productId: string) => void
  onPriceEdited: () => void
  onTeethSaved: (teeth: number[]) => void
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
      className={cn(
        'grid grid-cols-2 gap-3 rounded-lg border border-border p-3 lg:items-start lg:gap-2',
        itemsGridTemplate(canEditPrice).row,
      )}
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
        render={({ field }) => {
          const isPorPieza = product?.pricingUnit === 'por_pieza'
          return (
            <Field>
              <FieldLabel className="text-xs lg:sr-only" htmlFor={`item-${index}-cantidad`}>
                Cantidad
              </FieldLabel>
              <Input
                id={`item-${index}-cantidad`}
                aria-label="Cantidad"
                // Solo lectura: para `por_pieza` la cantidad la fija el número de piezas
                // marcadas (ver `handleTeethSaved`/`handleProductChange`), no se escribe a
                // mano; se usa `type="text"` en vez de "number" para no mostrar flechas de
                // incremento que en algunos navegadores ignoran `readOnly`.
                type={isPorPieza ? 'text' : 'number'}
                inputMode={isPorPieza ? 'numeric' : undefined}
                min={isPorPieza ? undefined : 1}
                max={isPorPieza ? undefined : 99}
                className="h-11"
                readOnly={isPorPieza}
                aria-readonly={isPorPieza}
                name={field.name}
                ref={field.ref}
                onBlur={field.onBlur}
                onChange={isPorPieza ? undefined : field.onChange}
                value={(field.value ?? '') as string | number}
              />
              {isPorPieza && (
                <FieldDescription className="text-xs">Según las piezas marcadas</FieldDescription>
              )}
            </Field>
          )
        }}
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
                  onSave={(teeth) => {
                    field.onChange(teeth)
                    onTeethSaved(teeth)
                  }}
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
