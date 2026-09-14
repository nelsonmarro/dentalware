import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useGrid } from '../context'
import { columnLabel } from '../lib/column-label'
import type { GridFeature } from '../types'
import { AdvancedFilterDialog } from './advanced-filter-dialog'
import { matches, OPERATOR_LABEL } from './advanced-filter-logic'
import {
  advancedFilterSignal,
  clearAdvancedFilter,
  getAdvancedFilter,
  setAdvancedFilter,
  useAdvancedFilter,
} from './advanced-filter-store'

/**
 * Botón «Filtro avanzado» + chips de las condiciones activas. Los hooks se llaman siempre (Rules
 * of Hooks): el `return null` por modo servidor va después, igual que si la feature no estuviera
 * registrada — solo `mode: 'client'` soporta el filtro avanzado (ruling de la Tarea 12).
 */
function Toolbar() {
  const grid = useGrid<never>()
  const { table, key, mode } = grid
  const filter = useAdvancedFilter(key)
  const [open, setOpen] = useState(false)

  // Limpia la entrada del store al desmontar: sin esto, volver a montar un grid con la misma
  // `key` (una tabla que se recrea, dos pruebas que reusan la key) arrastraría el filtro de la
  // vez anterior. La limpieza notifica a quien siga suscrito (ruling I-1 de la revisión).
  useEffect(() => {
    return () => clearAdvancedFilter(key)
  }, [key])

  if (mode !== 'client') return null

  const removeAt = (index: number) => {
    setAdvancedFilter(key, {
      ...filter,
      conditions: filter.conditions.filter((_, i) => i !== index),
    })
  }

  return (
    <>
      <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(true)}>
        Filtro avanzado
      </Button>
      {filter.conditions.map((c, i) => {
        const column = table.getColumn(c.column)
        const label = column ? columnLabel(column) : c.column
        const text = `${label} ${OPERATOR_LABEL[c.op]} ${c.value}`
        return (
          <span
            key={`${c.column}-${c.op}-${c.value}-${i}`}
            className="inline-flex items-center gap-1 rounded-full border border-input bg-muted py-1 pr-1 pl-3 text-sm"
          >
            {text}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Quitar condición ${text}`}
              onClick={() => removeAt(i)}
            >
              <X aria-hidden className="size-4" />
            </Button>
          </span>
        )
      })}
      <AdvancedFilterDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

/**
 * Filtro avanzado (columna · operador · valor, combinadas con Y/O) sobre las columnas con
 * `meta.filter`. Filtra los datos antes de `useTable` (`transformData`, ver `types.ts` y
 * `use-data-grid.ts`) en vez de sumarse a `columnFilteringFeature`/`globalFilteringFeature`: así
 * no choca con la búsqueda global de la feature `filtering` y puede combinar condiciones de
 * cualquier columna con una sola lógica AND/OR (`advanced-filter-logic.ts`). Solo `mode: 'client'`:
 * en modo servidor `transformData` no hace nada y la toolbar no se renderiza.
 */
export function advancedFilter(): GridFeature {
  return {
    id: 'advancedFilter',
    tanstack: {},
    dataSignal: (init) => advancedFilterSignal(init.key),
    transformData: (rows, init) => {
      if (init.mode !== 'client') return rows
      const filter = getAdvancedFilter(init.key)
      if (filter.conditions.length === 0) return rows
      return rows.filter((row) => matches(row as unknown as Record<string, unknown>, filter))
    },
    slots: { toolbar: Toolbar },
  }
}
