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
  if (rows.length === 0) return <EmptyState title={emptyMessage} action={emptyAction} />
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card lg:block">
        <Table>
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
      <ul className="flex flex-col gap-3 lg:hidden">
        {rows.map((row) => (
          <li key={getRowId(row)} className="rounded-xl border border-border bg-card p-4">
            {renderMobile(row)}
          </li>
        ))}
      </ul>
    </>
  )
}
