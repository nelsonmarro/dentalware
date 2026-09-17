import { Fragment } from 'react'
import { useGrid, useRootProps } from '../context'
import { columnLabel } from '../lib/column-label'
import type { GridRow } from '../types'

/**
 * Tarjetas móviles: `renderCard` si existe; si no, se generan desde `meta.mobile`. Con la
 * feature `grouping` activa, `table.getRowModel().rows` ya llega aplanado (fila de grupo e
 * hijas intercaladas, `paginateExpandedRows` por defecto): una fila de grupo solo aporta su
 * encabezado (`<h3>` «<valor> (<n>)»); sus hijas siguen como filas propias en el mismo `rows.map`
 * y no deben volver a pintarse a partir de `row.subRows` (las duplicaría).
 */
export function GridCards() {
  const grid = useGrid<never>()
  const { renderCard } = useRootProps()
  const rows = grid.table.getRowModel().rows
  const hasGrouping = grid.has('grouping')
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) =>
        hasGrouping && row.getIsGrouped() ? (
          <li key={row.id}>
            <h3 className="px-1 text-sm font-medium text-muted-foreground">
              {String(row.groupingValue)} ({row.subRows.length})
            </h3>
          </li>
        ) : (
          <li key={row.id} className="rounded-xl border border-border bg-card p-4">
            {renderCard ? renderCard(row.original) : <AutoCard row={row} />}
          </li>
        ),
      )}
    </ul>
  )
}

function AutoCard({ row }: { row: GridRow<never> }) {
  const grid = useGrid<never>()
  const hasGrouping = grid.has('grouping')
  const cells = row.getAllCells()
  // Con `grouping` activo, la columna agrupada es "placeholder" (`cell.getIsPlaceholder()`) en
  // toda fila que no sea el propio encabezado de grupo: su valor ya se muestra ahí arriba, así
  // que aquí se omite (si no, una tarjeta bajo «Prótesis removible (3)» mostraría un «· » colgando
  // sin nada antes, con el valor real pero renderizado vacío por el `cell` de la columna).
  // `getIsPlaceholder` solo existe cuando `columnGroupingFeature` está registrado (`grouping()`
  // en la lista de `features`): se guarda con `hasGrouping` para no reventar en tablas sin
  // agrupación, donde el método ni siquiera existe en runtime.
  const byRole = (role: string) =>
    cells.filter(
      (c) =>
        (c.column.columnDef.meta?.mobile ?? 'detail') === role &&
        !(hasGrouping && c.getIsPlaceholder()),
    )
  const render = (c: (typeof cells)[number]) => <grid.table.FlexRender key={c.id} cell={c} />
  // Se filtra por el valor crudo (`getValue()`), no por el render: una celda que en escritorio
  // pinta "—" para un valor nulo (`cell: (c) => c.getValue() ?? '—'`) no debe aportar ese "—" a
  // la tarjeta ni un separador vacío junto a ella.
  const subtitleCells = byRole('subtitle').filter((c) => {
    const value = c.getValue()
    return value !== null && value !== undefined && value !== ''
  })
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{byRole('title').map(render)}</span>
        <span>{byRole('badge').map(render)}</span>
      </div>
      {subtitleCells.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {subtitleCells.map((c, i) => (
            <Fragment key={c.id}>
              {/* `whitespace-nowrap` en el propio separador: sus dos espacios internos dejan de
                  ser puntos de quiebre de línea, así que el navegador no puede partir la línea
                  justo antes del separador (huérfano al inicio de la siguiente, M-4 de la
                  revisión final del PR 2) ni entre el separador y el valor que lo sigue. */}
              {i > 0 && (
                <span aria-hidden className="whitespace-nowrap">
                  {' · '}
                </span>
              )}
              {render(c)}
            </Fragment>
          ))}
        </p>
      )}
      {byRole('detail').map((c) => (
        <p key={c.id} className="text-sm">
          <span className="text-muted-foreground">{columnLabel(c.column)}: </span>
          {render(c)}
        </p>
      ))}
      {byRole('actions').map(render)}
    </div>
  )
}
