import { useState } from 'react'
import { DataTable } from '@/components/data-table'
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

function PriceCell({
  clinicId,
  product,
  current,
}: {
  clinicId: string
  product: Product
  current?: string
}) {
  const [value, setValue] = useState(current ?? '')
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
        onChange={(e) => setValue(e.target.value)}
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
            setValue('')
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
  if (products.isPending || prices.isPending)
    return <p className="text-sm text-muted-foreground">Cargando…</p>
  const byProduct = new Map((prices.data ?? []).map((p) => [p.productId, p.price]))
  return (
    <DataTable
      rows={products.data ?? []}
      getRowId={(p) => p.id}
      emptyMessage="No hay productos activos."
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
          cell: (p) => (
            <PriceCell
              key={byProduct.get(p.id) ?? 'none'}
              clinicId={clinicId}
              product={p}
              current={byProduct.get(p.id)}
            />
          ),
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
          <PriceCell
            key={byProduct.get(p.id) ?? 'none'}
            clinicId={clinicId}
            product={p}
            current={byProduct.get(p.id)}
          />
        </div>
      )}
    />
  )
}
