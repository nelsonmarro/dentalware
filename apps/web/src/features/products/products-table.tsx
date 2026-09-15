import { FlaskConical, Pencil } from 'lucide-react'
import { useMemo } from 'react'
import { ActiveBadge } from '@/components/active-badge'
import {
  advancedFilter,
  DataGrid,
  defineColumns,
  filtering,
  grouping,
  pagination,
  resizing,
  sorting,
  useDataGrid,
} from '@/components/data-grid'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import type { Product } from './api'
import { formatMoney, PRICING_UNIT_LABEL } from './pricing-unit-label'

const FEATURES = [
  filtering({
    search: { id: 'productos-buscar', label: 'Buscar producto', placeholder: 'Código o nombre' },
    columns: true,
  }),
  advancedFilter(),
  grouping(),
  sorting(),
  resizing(),
  pagination(),
]

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
  const columns = useMemo(
    () =>
      defineColumns<Product>((col) => [
        col.accessor('code', {
          header: 'Código',
          cell: (c) => <span className="font-mono text-sm">{c.getValue()}</span>,
          meta: { mobile: 'subtitle', width: 104 },
        }),
        col.accessor('name', {
          header: 'Producto',
          cell: (c) => (
            <span className="block truncate font-medium" title={c.row.original.name}>
              {c.getValue()}
            </span>
          ),
          meta: { mobile: 'title', width: 132, filter: 'text' },
        }),
        col.accessor((p) => p.category?.name ?? '—', {
          id: 'category',
          header: 'Categoría',
          meta: { filter: 'select', groupable: true, mobile: 'subtitle', width: 161 },
        }),
        col.accessor('pricingUnit', {
          header: 'Se cobra',
          cell: (c) => PRICING_UNIT_LABEL[c.row.original.pricingUnit],
          meta: { mobile: 'detail', width: 113 },
          enableGlobalFilter: false,
        }),
        col.accessor((p) => Number(p.basePrice), {
          id: 'price',
          header: 'Precio base',
          cell: (c) => <span className="font-mono">{formatMoney(c.row.original.basePrice)}</span>,
          aggregatedCell: (c) => formatMoney(c.getValue() as number),
          meta: { align: 'right', aggregate: 'sum', mobile: 'detail', width: 132 },
        }),
        col.accessor('turnaroundDays', {
          id: 'days',
          header: 'Días',
          cell: (c) => {
            const p = c.row.original
            return (
              <span className="inline-flex items-center gap-1">
                {p.turnaroundDays}
                {p.requiresTryIn && (
                  <span title="Requiere prueba" aria-label="Requiere prueba" role="img">
                    <FlaskConical aria-hidden className="size-3.5 text-muted-foreground" />
                  </span>
                )}
              </span>
            )
          },
          // Sin `meta.aggregate` (no lo pide el brief para esta columna), pero `rowAggregationFeature`
          // sigue sumando por defecto cualquier columna numérica agrupada salvo que se le diga lo
          // contrario: sin este `aggregatedCell` la fila de grupo mostraría la suma de días de
          // TODOS sus productos (p. ej. "261"), un número sin sentido de negocio.
          aggregatedCell: () => null,
          meta: { filter: 'range', width: 85 },
        }),
        col.accessor('active', {
          header: 'Estado',
          cell: (c) => <ActiveBadge active={c.getValue()} />,
          meta: { mobile: 'badge', width: 102 },
          enableGlobalFilter: false,
        }),
        col.display({
          id: 'actions',
          header: '',
          meta: { mobile: 'actions', align: 'right', width: 128 },
          cell: (c) => {
            const p = c.row.original
            return (
              <div className="flex items-center justify-end gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Editar ${p.name}`}
                  onClick={() => onEdit(p)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Switch
                  checked={p.active}
                  aria-label={`${p.name} activo`}
                  onCheckedChange={(v) => onToggle(p, v)}
                />
              </div>
            )
          },
        }),
      ]),
    [onEdit, onToggle],
  )
  const grid = useDataGrid({
    key: 'productos',
    columns,
    data: products,
    features: FEATURES,
    getRowId: (p) => p.id,
  })
  return (
    <DataGrid.Root
      grid={grid}
      emptyMessage={(q) =>
        q
          ? `Ningún producto coincide con "${q}"`
          : 'Aún no hay productos. Crea el primero con Nuevo producto.'
      }
      emptyAction={emptyAction}
    >
      <DataGrid.Toolbar />
      <DataGrid.Content />
      <DataGrid.Pagination />
    </DataGrid.Root>
  )
}
