import type { ProductInput } from '@dentalware/shared'
import { createFileRoute } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Product } from '@/features/products/api'
import { CategoriesList } from '@/features/products/categories-list'
import { ProductForm } from '@/features/products/product-form'
import { ProductsTable } from '@/features/products/products-table'
import {
  useCategories,
  useProducts,
  useSaveProduct,
  useSetProductActive,
} from '@/features/products/use-products'

export const Route = createFileRoute('/_app/configuracion/productos')({ component: ProductsPage })

function ProductsPage() {
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState<Product | null | 'new'>(null)
  const categories = useCategories(false)
  const products = useProducts(showInactive)
  const save = useSaveProduct()
  const toggle = useSetProductActive()

  function submit(input: ProductInput) {
    save.mutate(
      { id: editing && editing !== 'new' ? editing.id : undefined, input },
      { onSuccess: () => setEditing(null) },
    )
  }
  const newButton = (
    <Button className="h-11" onClick={() => setEditing('new')}>
      <Plus className="size-4" /> Nuevo producto
    </Button>
  )
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Productos y precios"
        description="Catálogo del laboratorio, sus precios base y unidades de cobro."
        action={newButton}
      />
      <Tabs defaultValue="productos">
        <TabsList>
          <TabsTrigger value="productos">Productos</TabsTrigger>
          <TabsTrigger value="categorias">Categorías</TabsTrigger>
        </TabsList>
        <TabsContent value="productos" className="flex flex-col gap-4 pt-4">
          <div className="flex items-center gap-2">
            <Switch
              id="productos-inactivos"
              checked={showInactive}
              onCheckedChange={setShowInactive}
            />
            <Label htmlFor="productos-inactivos">Mostrar inactivos</Label>
          </div>
          {products.isPending ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <ProductsTable
              products={products.data ?? []}
              onEdit={setEditing}
              onToggle={(p, active) => toggle.mutate({ id: p.id, active })}
              emptyAction={newButton}
            />
          )}
        </TabsContent>
        <TabsContent value="categorias" className="pt-4">
          <CategoriesList />
        </TabsContent>
      </Tabs>
      {editing !== null && (
        <ProductForm
          key={editing === 'new' ? 'new' : editing.id}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          product={editing === 'new' ? null : editing}
          categories={categories.data ?? []}
          onSubmit={submit}
          pending={save.isPending}
        />
      )}
    </div>
  )
}
