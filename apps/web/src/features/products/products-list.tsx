import type { UseQueryResult } from '@tanstack/react-query'
import { LoadError } from '@/components/load-error'
import type { Product } from './api'
import { ProductsTable } from './products-table'

/**
 * Extraído de la ruta `configuracion/productos.tsx` (ronda de fixes 1, UX3-02, punto 3): mismo
 * criterio que `clinics-list.tsx`.
 */
export function ProductsList({
  products,
  onEdit,
  onToggle,
  emptyAction,
}: {
  products: UseQueryResult<Product[]>
  onEdit: (p: Product) => void
  onToggle: (p: Product, active: boolean) => void
  emptyAction?: React.ReactNode
}) {
  if (products.isPending) return <p className="text-sm text-muted-foreground">Cargando…</p>
  if (products.isError) return <LoadError onRetry={() => void products.refetch()} />
  return (
    <ProductsTable
      products={products.data ?? []}
      onEdit={onEdit}
      onToggle={onToggle}
      emptyAction={emptyAction}
    />
  )
}
