import { useState } from 'react'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Product } from './api'
import { formatMoney } from './pricing-unit-label'
import {
  useClinicPrices,
  useDeleteClinicPrice,
  useProducts,
  useSaveClinicPrice,
} from './use-products'

/** Insensible a mayúsculas y acentos: "híbrida" coincide con "hibrida". */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function matchesSearch(product: Product, query: string): boolean {
  const q = normalize(query)
  if (!q) return true
  return normalize(product.code).includes(q) || normalize(product.name).includes(q)
}

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

export function ClinicPricesTable({ clinicId }: { clinicId: string }) {
  const products = useProducts(false)
  const prices = useClinicPrices(clinicId)
  const [search, setSearch] = useState('')
  // Borradores por producto: viven aquí (no en `PriceCell`) para que un precio escrito
  // en una fila que luego el buscador oculta (se desmonta del `DataTable`) no se pierda
  // al quitar el filtro y volver a montarse.
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  if (products.isPending || prices.isPending)
    return <p className="text-sm text-muted-foreground">Cargando…</p>
  const byProduct = new Map((prices.data ?? []).map((p) => [p.productId, p.price]))
  const all = products.data ?? []
  const filtered = all.filter((p) => matchesSearch(p, search))
  const trimmedSearch = search.trim()
  const emptyMessage = trimmedSearch
    ? `Ningún producto coincide con "${trimmedSearch}"`
    : 'No hay productos activos.'
  const valueFor = (p: Product) => drafts[p.id] ?? byProduct.get(p.id) ?? ''
  const setValueFor = (id: string, value: string) =>
    setDrafts((current) => ({ ...current, [id]: value }))
  const priceCell = (p: Product) => (
    <PriceCell
      clinicId={clinicId}
      product={p}
      current={byProduct.get(p.id)}
      value={valueFor(p)}
      onValueChange={(value) => setValueFor(p.id, value)}
    />
  )
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5 sm:max-w-xs">
        <Label htmlFor="precios-buscar">Buscar producto</Label>
        <Input
          id="precios-buscar"
          type="search"
          placeholder="Buscar por código o nombre"
          className="h-11"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <DataTable
        rows={filtered}
        getRowId={(p) => p.id}
        emptyMessage={emptyMessage}
        columns={[
          {
            key: 'product',
            header: 'Producto',
            cell: (p) => (
              <span>
                <span className="font-mono text-xs">{p.code}</span> · {p.name}
              </span>
            ),
          },
          {
            key: 'base',
            header: 'Precio base',
            cell: (p) => <span className="font-mono">{formatMoney(p.basePrice)}</span>,
            className: 'text-right',
          },
          {
            key: 'special',
            header: 'Precio para esta clínica',
            cell: priceCell,
          },
        ]}
        renderMobile={(p) => (
          <div className="flex flex-col gap-2">
            <span className="font-medium">
              {p.name} <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
            </span>
            <span className="text-sm text-muted-foreground">
              Base: <span className="font-mono">{formatMoney(p.basePrice)}</span>
            </span>
            {priceCell(p)}
          </div>
        )}
      />
    </div>
  )
}
