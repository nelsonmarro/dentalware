import { Pencil } from 'lucide-react'
import { ActiveBadge } from '@/components/active-badge'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import type { Product } from './api'
import { formatMoney, PRICING_UNIT_LABEL } from './pricing-unit-label'

export function ProductsTable({
  products,
  onEdit,
  onToggle,
  emptyAction,
}: {
  products: Product[]
  onEdit: (p: Product) => void
  onToggle: (p: Product, active: boolean) => void
  emptyAction?: React.ReactNode
}) {
  const actions = (p: Product) => (
    <div className="flex items-center justify-end gap-3">
      <Button variant="ghost" size="icon" aria-label={`Editar ${p.name}`} onClick={() => onEdit(p)}>
        <Pencil className="size-4" />
      </Button>
      <Switch
        checked={p.active}
        aria-label={`${p.name} activo`}
        onCheckedChange={(v) => onToggle(p, v)}
      />
    </div>
  )
  return (
    <DataTable
      rows={products}
      getRowId={(p) => p.id}
      emptyMessage="Aún no hay productos. Crea el primero con Nuevo producto."
      emptyAction={emptyAction}
      columns={[
        {
          key: 'code',
          header: 'Código',
          cell: (p) => <span className="font-mono text-sm">{p.code}</span>,
        },
        {
          key: 'name',
          header: 'Producto',
          cell: (p) => <span className="font-medium">{p.name}</span>,
        },
        { key: 'category', header: 'Categoría', cell: (p) => p.category?.name ?? '—' },
        { key: 'unit', header: 'Se cobra', cell: (p) => PRICING_UNIT_LABEL[p.pricingUnit] },
        {
          key: 'price',
          header: 'Precio base',
          cell: (p) => <span className="font-mono">{formatMoney(p.basePrice)}</span>,
          className: 'text-right',
        },
        { key: 'days', header: 'Días', cell: (p) => p.turnaroundDays },
        { key: 'tryin', header: 'Prueba', cell: (p) => (p.requiresTryIn ? 'Sí' : 'No') },
        { key: 'active', header: 'Estado', cell: (p) => <ActiveBadge active={p.active} /> },
        { key: 'actions', header: '', cell: actions, className: 'text-right' },
      ]}
      renderMobile={(p) => (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">
              <span className="font-mono text-xs text-muted-foreground">{p.code}</span> {p.name}
            </span>
            <ActiveBadge active={p.active} />
          </div>
          <p className="text-sm text-muted-foreground">
            {p.category?.name ?? '—'} · {PRICING_UNIT_LABEL[p.pricingUnit]}
          </p>
          <p className="font-mono text-sm">{formatMoney(p.basePrice)}</p>
          {actions(p)}
        </div>
      )}
    />
  )
}
