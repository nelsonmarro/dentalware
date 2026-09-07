import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Acción de cabecera de Configuración → Productos, según la pestaña activa (UX1-10):
 * antes «Nuevo producto» quedaba visible en la pestaña «Categorías» a la vez que
 * «Nueva categoría» (propia de esa pestaña), confundiendo cuál botón corresponde a
 * la vista actual. Ahora la cabecera muestra un único botón por pestaña.
 */
export function ProductsHeaderAction({
  tab,
  onNewProduct,
  onNewCategory,
}: {
  tab: 'productos' | 'categorias'
  onNewProduct: () => void
  onNewCategory: () => void
}) {
  if (tab === 'categorias') {
    return (
      <Button className="h-11" onClick={onNewCategory}>
        <Plus className="size-4" /> Nueva categoría
      </Button>
    )
  }
  return (
    <Button className="h-11" onClick={onNewProduct}>
      <Plus className="size-4" /> Nuevo producto
    </Button>
  )
}
