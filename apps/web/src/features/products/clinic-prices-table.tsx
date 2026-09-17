import { createContext, useContext, useState } from 'react'
import {
  DataGrid,
  defineColumns,
  filtering,
  pagination,
  sorting,
  useDataGrid,
} from '@/components/data-grid'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Product } from './api'
import { formatMoney } from './pricing-unit-label'
import {
  useClinicPrices,
  useDeleteClinicPrice,
  useProducts,
  useSaveClinicPrice,
} from './use-products'

const FEATURES = [
  filtering({
    search: {
      id: 'precios-buscar',
      label: 'Buscar producto',
      placeholder: 'Buscar por código o nombre',
    },
  }),
  sorting(),
  pagination(),
]

function PriceCell({
  clinicId,
  product,
  current,
  value,
  onValueChange,
}: {
  clinicId: string
  product: Product
  current?: string
  value: string
  onValueChange: (value: string) => void
}) {
  const save = useSaveClinicPrice()
  const remove = useDeleteClinicPrice()
  const dirty = value.trim() !== (current ?? '')
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (value.trim()) save.mutate({ clinicId, productId: product.id, price: value.trim() })
      }}
    >
      <Input
        aria-label={`Precio especial de ${product.name}`}
        inputMode="decimal"
        placeholder={formatMoney(product.basePrice)}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className="h-11 w-32 font-mono"
      />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={!dirty || !value.trim() || save.isPending}
      >
        Guardar
      </Button>
      {current && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            remove.mutate({ clinicId, productId: product.id })
            onValueChange('')
          }}
        >
          Quitar
        </Button>
      )}
    </form>
  )
}

type DraftsContextValue = {
  clinicId: string
  byProduct: Map<string, string>
  drafts: Record<string, string>
  setValueFor: (id: string, value: string) => void
}

// El grid llama a `cell` como si fuera un COMPONENTE de React (`flexRender`), no como una función
// de un solo uso: su identidad debe permanecer estable entre renders o React desmonta y vuelve a
// montar la celda en cada tecla (el input pierde el foco a mitad de tecleo). `SpecialCell` vive
// fuera de `ClinicPricesTable` (identidad fija) y lee los borradores vigentes por contexto en vez
// de por closure, para no depender de que la definición de columna se recree en cada cambio de
// `drafts`.
const DraftsContext = createContext<DraftsContextValue | null>(null)

function SpecialCell({ row }: { row: { original: Product } }) {
  const ctx = useContext(DraftsContext)
  if (!ctx) return null
  const p = row.original
  const value = ctx.drafts[p.id] ?? ctx.byProduct.get(p.id) ?? ''
  return (
    <PriceCell
      clinicId={ctx.clinicId}
      product={p}
      current={ctx.byProduct.get(p.id)}
      value={value}
      onValueChange={(v) => ctx.setValueFor(p.id, v)}
    />
  )
}

const COLUMNS = defineColumns<Product>((col) => [
  col.accessor((p) => `${p.code} ${p.name}`, {
    id: 'product',
    header: 'Producto',
    cell: (c) => (
      <span>
        <span className="font-mono text-xs">{c.row.original.code}</span> · {c.row.original.name}
      </span>
    ),
    meta: { mobile: 'title' },
  }),
  col.accessor('basePrice', {
    id: 'base',
    header: 'Precio base',
    cell: (c) => <span className="font-mono">{formatMoney(c.row.original.basePrice)}</span>,
    meta: { align: 'right', mobile: 'subtitle' },
    enableGlobalFilter: false,
  }),
  col.display({
    id: 'special',
    header: 'Precio para esta clínica',
    cell: SpecialCell,
    meta: { mobile: 'actions' },
    enableSorting: false,
  }),
])

export function ClinicPricesTable({ clinicId }: { clinicId: string }) {
  const products = useProducts(false)
  const prices = useClinicPrices(clinicId)
  // Borradores por producto: viven aquí (no en `PriceCell`) para que un precio escrito
  // en una fila que luego el buscador oculta (se desmonta del grid) no se pierda
  // al quitar el filtro y volver a montarse.
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  // Ajusta el estado durante el render (no en un efecto) al detectar que `clinicId`
  // cambió, para que un borrador sin guardar de la clínica anterior nunca aparezca
  // como valor de la clínica nueva (mismo patrón que `categories-list.tsx`).
  const [seenClinicId, setSeenClinicId] = useState(clinicId)
  if (clinicId !== seenClinicId) {
    setSeenClinicId(clinicId)
    setDrafts({})
  }
  const byProduct = new Map((prices.data ?? []).map((p) => [p.productId, p.price]))
  const all = products.data ?? []
  const setValueFor = (id: string, value: string) =>
    setDrafts((current) => ({ ...current, [id]: value }))
  const grid = useDataGrid({
    key: 'precios-especiales',
    columns: COLUMNS,
    data: all,
    features: FEATURES,
    getRowId: (p) => p.id,
  })
  // Objeto nuevo cada render a propósito: lo único que debe permanecer estable entre renders es
  // `SpecialCell` (la celda), no este valor — así `useContext` siempre entrega el borrador y el
  // precio vigentes, sin arrastrar un `byProduct` desactualizado tras guardar o quitar un precio.
  const contextValue: DraftsContextValue = { clinicId, byProduct, drafts, setValueFor }
  if (products.isPending || prices.isPending)
    return <p className="text-sm text-muted-foreground">Cargando…</p>
  return (
    <DraftsContext.Provider value={contextValue}>
      <DataGrid.Root
        grid={grid}
        emptyMessage={(q) =>
          q ? `Ningún producto coincide con "${q}"` : 'No hay productos activos.'
        }
      >
        <DataGrid.Toolbar />
        <DataGrid.Content />
        <DataGrid.Pagination />
      </DataGrid.Root>
    </DraftsContext.Provider>
  )
}
