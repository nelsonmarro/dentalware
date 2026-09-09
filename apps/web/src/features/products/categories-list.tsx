import type { ProductCategoryInput } from '@dentalware/shared'
import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { ActiveBadge } from '@/components/active-badge'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import type { Category } from './api'
import { CategoryForm } from './category-form'
import { useCategories, useSaveCategory, useSetCategoryActive } from './use-products'

/**
 * `newRequestToken`: dispara la apertura del diálogo "Nueva categoría" desde fuera
 * (la cabecera de la página, ver `ProductsHeaderAction` / UX1-10) cada vez que
 * cambia — reemplaza el botón propio que esta lista mostraba antes (duplicaba la
 * acción de la cabecera cuando la pestaña "Categorías" estaba activa).
 */
export function CategoriesList({ newRequestToken }: { newRequestToken?: number } = {}) {
  const [editing, setEditing] = useState<Category | null | 'new'>(null)
  // Ajusta el estado durante el render (no en un efecto) al detectar que
  // `newRequestToken` cambió — patrón recomendado por React para "reaccionar a un
  // cambio de prop" sin el repintado extra de un efecto.
  const [seenToken, setSeenToken] = useState(newRequestToken)
  if (newRequestToken !== seenToken) {
    setSeenToken(newRequestToken)
    if (newRequestToken) setEditing('new')
  }
  const categories = useCategories(true)
  const save = useSaveCategory()
  const toggle = useSetCategoryActive()

  function submit(input: ProductCategoryInput) {
    save.mutate(
      { id: editing && editing !== 'new' ? editing.id : undefined, input },
      { onSuccess: () => setEditing(null) },
    )
  }
  const newButton = (
    <Button className="h-11" onClick={() => setEditing('new')}>
      <Plus className="size-4" /> Nueva categoría
    </Button>
  )
  const rows = categories.data ?? []
  return (
    <div className="flex flex-col gap-4">
      {categories.isPending ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Aún no hay categorías. Crea la primera con Nueva categoría."
          action={newButton}
        />
      ) : (
        <ul className="flex flex-col gap-2 rounded-xl border border-border bg-card">
          {rows.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 border-b border-border p-4 last:border-b-0"
            >
              <div className="flex flex-col">
                <span className="font-medium">{c.name}</span>
                <span className="font-mono text-xs text-muted-foreground">Orden: {c.sort}</span>
              </div>
              <div className="flex items-center gap-3">
                <ActiveBadge active={c.active} />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Editar ${c.name}`}
                  onClick={() => setEditing(c)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Switch
                  checked={c.active}
                  aria-label={`${c.name} activa`}
                  onCheckedChange={(v) => toggle.mutate({ id: c.id, active: v })}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing !== null && (
        <CategoryForm
          key={editing === 'new' ? 'new' : editing.id}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          category={editing === 'new' ? null : editing}
          onSubmit={submit}
          pending={save.isPending}
        />
      )}
    </div>
  )
}
