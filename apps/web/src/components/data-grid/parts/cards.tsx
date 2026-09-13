import { useGrid, useRootProps } from '../context'
import type { GridRow } from '../types'

/** Tarjetas móviles: `renderCard` si existe; si no, se generan desde `meta.mobile`. */
export function GridCards() {
  const grid = useGrid<never>()
  const { renderCard } = useRootProps()
  const rows = grid.table.getRowModel().rows
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.id} className="rounded-xl border border-border bg-card p-4">
          {renderCard ? renderCard(row.original) : <AutoCard row={row} />}
        </li>
      ))}
    </ul>
  )
}

function AutoCard({ row }: { row: GridRow<never> }) {
  const grid = useGrid<never>()
  const cells = row.getAllCells()
  const byRole = (role: string) =>
    cells.filter((c) => (c.column.columnDef.meta?.mobile ?? 'detail') === role)
  const render = (c: (typeof cells)[number]) => <grid.table.FlexRender key={c.id} cell={c} />
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{byRole('title').map(render)}</span>
        <span>{byRole('badge').map(render)}</span>
      </div>
      {byRole('subtitle').length > 0 && (
        <p className="text-sm text-muted-foreground">{byRole('subtitle').map(render)}</p>
      )}
      {byRole('detail').map((c) => (
        <p key={c.id} className="text-sm">
          <span className="text-muted-foreground">
            {typeof c.column.columnDef.header === 'string'
              ? c.column.columnDef.header
              : c.column.id}
            :{' '}
          </span>
          {render(c)}
        </p>
      ))}
      {byRole('actions').map(render)}
    </div>
  )
}
