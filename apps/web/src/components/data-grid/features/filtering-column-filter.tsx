import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { columnLabel } from '../lib/column-label'
import type { GridColumn } from '../types'

/**
 * Control de filtro de una columna según `meta.filter`: `select` con los valores únicos
 * (faceted), `range` con mínimo/máximo numérico, o texto libre por defecto. Es un `<select>`
 * nativo (no el `Select` de shadcn/Radix) para que el filtro se pueda accionar con teclado y
 * probar con `userEvent.selectOptions`.
 */
export function ColumnFilter({ column }: { column: GridColumn<never> }) {
  const kind = column.columnDef.meta?.filter
  const label = columnLabel(column)
  const value = column.getFilterValue()

  if (kind === 'select') {
    const options = Array.from(column.getFacetedUniqueValues().keys())
      .map(String)
      .sort((a, b) => a.localeCompare(b))
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`filtro-${column.id}`}>Filtrar {label}</Label>
        <select
          id={`filtro-${column.id}`}
          className="h-11 rounded-lg border border-input bg-transparent px-3 text-base focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:text-sm dark:bg-input/30"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => column.setFilterValue(e.target.value || undefined)}
        >
          <option value="">Todas</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    )
  }

  if (kind === 'range') {
    const [min, max] = (Array.isArray(value) ? value : [undefined, undefined]) as [
      number | undefined,
      number | undefined,
    ]
    const set = (next: [number | undefined, number | undefined]) =>
      column.setFilterValue(next[0] === undefined && next[1] === undefined ? undefined : next)
    return (
      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`min-${column.id}`}>{label} mínimo</Label>
          <Input
            id={`min-${column.id}`}
            inputMode="numeric"
            className="h-11 w-24"
            value={min ?? ''}
            onChange={(e) => set([e.target.value === '' ? undefined : Number(e.target.value), max])}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`max-${column.id}`}>{label} máximo</Label>
          <Input
            id={`max-${column.id}`}
            inputMode="numeric"
            className="h-11 w-24"
            value={max ?? ''}
            onChange={(e) => set([min, e.target.value === '' ? undefined : Number(e.target.value)])}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`filtro-${column.id}`}>Filtrar {label}</Label>
      <Input
        id={`filtro-${column.id}`}
        type="search"
        className="h-11"
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => column.setFilterValue(e.target.value || undefined)}
      />
    </div>
  )
}
