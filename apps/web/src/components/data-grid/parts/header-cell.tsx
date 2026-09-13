import { useGrid } from '../context'
import { columnLabel } from '../lib/column-label'
import type { GridHeader } from '../types'
import { ColumnMenu } from './column-menu'

/** Etiqueta de la columna + slots `headerCell` de las features (orden, asa) + menú de columna. */
export function HeaderCell({ header }: { header: GridHeader<never> }) {
  const grid = useGrid<never>()
  const meta = header.column.columnDef.meta
  const label = columnLabel(header.column)
  const slots = grid.features.flatMap((f) =>
    f.slots?.headerCell ? [{ id: f.id, Slot: f.slots.headerCell }] : [],
  )
  return (
    <div className={`flex items-center gap-1 ${meta?.align === 'right' ? 'justify-end' : ''}`}>
      {header.isPlaceholder ? null : <grid.table.FlexRender header={header} />}
      {slots.map(({ id, Slot }) => (
        <Slot key={id} header={header} />
      ))}
      <ColumnMenu column={header.column} label={label} />
    </div>
  )
}
