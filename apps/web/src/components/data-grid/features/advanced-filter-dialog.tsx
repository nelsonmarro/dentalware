import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useGrid } from '../context'
import { columnLabel } from '../lib/column-label'
import type { GridColumn } from '../types'
import {
  NUMBER_OPERATORS,
  OPERATOR_LABEL,
  SELECT_OPERATORS,
  TEXT_OPERATORS,
  type AdvancedFilter,
  type Condition,
  type Operator,
} from './advanced-filter-logic'
import { getAdvancedFilter, setAdvancedFilter } from './advanced-filter-store'

const SELECT_CLASS =
  'h-11 rounded-lg border border-input bg-transparent px-3 text-base focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:text-sm dark:bg-input/30'

// `meta.filter` decide el conjunto de operadores (spec §3): 'range' → numéricos, 'select' → solo
// igualdad/desigualdad (conjunto cerrado de valores), cualquier otro (incluido 'text') → texto.
function operatorsFor(kind: string | undefined): Operator[] {
  if (kind === 'range') return NUMBER_OPERATORS
  if (kind === 'select') return SELECT_OPERATORS
  return TEXT_OPERATORS
}

/**
 * Cuerpo del diálogo (borrador + acciones). Se monta solo mientras el diálogo está abierto
 * (ver `AdvancedFilterDialog`): así cada apertura arranca con `useState(() => getAdvancedFilter(key))`
 * fresco (el filtro realmente aplicado) sin sincronizar con un efecto — «Cancelar» simplemente
 * desmonta sin haber tocado el store.
 */
function AdvancedFilterForm({
  filterable,
  gridKey,
  onClose,
}: {
  filterable: GridColumn<never>[]
  gridKey: string
  onClose: () => void
}) {
  const [draft, setDraft] = useState<AdvancedFilter>(() => getAdvancedFilter(gridKey))

  const updateCondition = (index: number, patch: Partial<Condition>) => {
    setDraft((d) => ({
      ...d,
      conditions: d.conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }))
  }

  const addCondition = () => {
    const first = filterable[0]
    if (!first) return
    const op = operatorsFor(first.columnDef.meta?.filter)[0]
    if (!op) return
    setDraft((d) => ({ ...d, conditions: [...d.conditions, { column: first.id, op, value: '' }] }))
  }

  const removeCondition = (index: number) => {
    setDraft((d) => ({ ...d, conditions: d.conditions.filter((_, i) => i !== index) }))
  }

  const apply = () => {
    setAdvancedFilter(gridKey, draft)
    onClose()
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${gridKey}-logica`}>Combinar con</Label>
          <select
            id={`${gridKey}-logica`}
            className={SELECT_CLASS}
            value={draft.logic}
            onChange={(e) => setDraft((d) => ({ ...d, logic: e.target.value as 'and' | 'or' }))}
          >
            <option value="and">Todas las condiciones (Y)</option>
            <option value="or">Cualquiera (O)</option>
          </select>
        </div>

        {draft.conditions.map((condition, i) => {
          const column = filterable.find((c) => c.id === condition.column)
          const ops = operatorsFor(column?.columnDef.meta?.filter)
          const n = i + 1
          return (
            <div
              key={`${condition.column}-${i}`}
              className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3"
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${gridKey}-columna-${n}`}>Columna {n}</Label>
                <select
                  id={`${gridKey}-columna-${n}`}
                  className={SELECT_CLASS}
                  value={condition.column}
                  onChange={(e) => {
                    const nextColumn = filterable.find((c) => c.id === e.target.value)
                    const nextOp =
                      operatorsFor(nextColumn?.columnDef.meta?.filter)[0] ?? condition.op
                    updateCondition(i, { column: e.target.value, op: nextOp })
                  }}
                >
                  {filterable.map((c) => (
                    <option key={c.id} value={c.id}>
                      {columnLabel(c)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${gridKey}-operador-${n}`}>Operador {n}</Label>
                <select
                  id={`${gridKey}-operador-${n}`}
                  className={SELECT_CLASS}
                  value={condition.op}
                  onChange={(e) => updateCondition(i, { op: e.target.value as Operator })}
                >
                  {ops.map((op) => (
                    <option key={op} value={op}>
                      {OPERATOR_LABEL[op]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${gridKey}-valor-${n}`}>Valor {n}</Label>
                <Input
                  id={`${gridKey}-valor-${n}`}
                  className="h-11"
                  placeholder={condition.op === 'entre' ? 'mín,máx' : undefined}
                  value={condition.value}
                  onChange={(e) => updateCondition(i, { value: e.target.value })}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Quitar condición ${n}`}
                onClick={() => removeCondition(i)}
              >
                <Trash2 aria-hidden className="size-4" />
              </Button>
            </div>
          )
        })}

        <Button type="button" variant="outline" className="h-11 self-start" onClick={addCondition}>
          Añadir condición
        </Button>
      </div>
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" onClick={apply}>
          Aplicar
        </Button>
      </DialogFooter>
    </>
  )
}

/**
 * Diálogo del filtro avanzado: combina condiciones (columna · operador · valor) con Y/O sobre las
 * columnas con `meta.filter`.
 */
export function AdvancedFilterDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const grid = useGrid<never>()
  const { table, key } = grid
  // `c.accessorFn` lo resuelve TanStack (core, `coreColumnsFeature`) desde el `accessorKey`/
  // `accessorFn` de la definición — es `undefined` solo en una columna `display` (sin accessor),
  // exactamente el mismo criterio que `init.getRowValue` (`use-data-grid.ts`) usa para devolver
  // `undefined`. Sin este filtro, una columna sin valor resoluble (p. ej. acciones) aparecería en
  // el selector y `matches()` siempre compararía contra `undefined`.
  const filterable = table
    .getAllLeafColumns()
    .filter((c) => c.columnDef.meta?.filter && c.accessorFn !== undefined)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-x-hidden overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Filtro avanzado</DialogTitle>
          <DialogDescription>
            Combina condiciones sobre las columnas filtrables con Y (todas) o con O (cualquiera).
          </DialogDescription>
        </DialogHeader>
        {open && (
          <AdvancedFilterForm
            filterable={filterable}
            gridKey={key}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
