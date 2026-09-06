import type { ReactNode } from 'react'
import { EmptyState } from '@/components/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useMediaQuery } from '@/lib/use-media-query'

// Tailwind `lg` empieza en 1024px; debe coincidir con las clases `lg:*` de abajo.
const DESKTOP_QUERY = '(min-width: 1024px)'

export type Column<T> = {
  key: string
  header: string
  cell: (row: T) => ReactNode
  className?: string
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  emptyMessage,
  emptyAction,
  renderMobile,
}: {
  columns: Column<T>[]
  rows: T[]
  getRowId: (row: T) => string
  emptyMessage: string
  emptyAction?: ReactNode
  renderMobile: (row: T) => ReactNode
}) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  if (rows.length === 0) return <EmptyState title={emptyMessage} action={emptyAction} />
  // Se renderiza una sola variante a la vez (no una oculta con CSS): así cada fila
  // y cada control (switches, botones) existe una única vez en el DOM, sin ids ni
  // aria-labels duplicados.
  if (isDesktop) {
    return (
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table className="[&_tr>*:last-child]:pr-5">
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key} className={c.className}>
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={getRowId(row)}>
                {columns.map((c) => (
                  <TableCell key={c.key} className={c.className}>
                    {c.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={getRowId(row)} className="rounded-xl border border-border bg-card p-4">
          {renderMobile(row)}
        </li>
      ))}
    </ul>
  )
}
