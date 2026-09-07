import { toIsoDate } from '@dentalware/shared'
import { Link } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/data-table'
import type { CaseListRow } from './api'
import { dueBadge } from './case-views'
import { formatDate } from './date-format'
import { STATUS_COLOR, StatusChip } from './status-chip'

function money(value: string | null) {
  return value === null ? '—' : `$ ${Number(value).toFixed(2)}`
}

function DueCell({ row, today }: { row: CaseListRow; today: string }) {
  const date = row.promisedDate ?? row.dueDate
  const badge = dueBadge(date, today, row.status)
  return (
    <div className="flex items-center gap-2">
      <span>{formatDate(date)}</span>
      {badge === 'hoy' && (
        <Badge className="bg-[color:var(--wax-amber)]/15 text-[color:var(--wax-amber)]">Hoy</Badge>
      )}
      {badge === 'atrasado' && <Badge variant="destructive">Atrasado</Badge>}
    </div>
  )
}

function CodeCell({ row }: { row: CaseListRow }) {
  return (
    <div className="flex items-center gap-2">
      <Link
        to="/trabajos/$caseId"
        params={{ caseId: row.id }}
        className="font-mono font-medium text-primary hover:underline"
      >
        {row.code}
      </Link>
      {row.priority === 'urgente' && <Badge variant="destructive">Urgente</Badge>}
    </div>
  )
}

export function CasesTable({ rows, hidePrices }: { rows: CaseListRow[]; hidePrices: boolean }) {
  const today = toIsoDate(new Date())
  const columns: Column<CaseListRow>[] = [
    {
      key: 'code',
      header: 'Código',
      cell: (r) => <CodeCell row={r} />,
      className: 'border-l-4',
      cellStyle: (r) => ({ borderLeftColor: STATUS_COLOR[r.status] }),
    },
    {
      key: 'clinica',
      header: 'Clínica / Doctor',
      cell: (r) => (
        <div className="flex flex-col">
          <span>{r.clinic.name}</span>
          <span className="text-sm text-muted-foreground">{r.doctor.name}</span>
        </div>
      ),
    },
    { key: 'paciente', header: 'Paciente', cell: (r) => r.patientRef },
    { key: 'trabajo', header: 'Trabajo', cell: (r) => r.itemsSummary ?? '—' },
    { key: 'entrega', header: 'Entrega', cell: (r) => <DueCell row={r} today={today} /> },
    { key: 'estado', header: 'Estado', cell: (r) => <StatusChip status={r.status} /> },
    ...(hidePrices
      ? []
      : ([
          {
            key: 'total',
            header: 'Total',
            cell: (r) => <span className="font-mono">{money(r.total)}</span>,
            className: 'text-right',
          },
        ] satisfies Column<CaseListRow>[])),
  ]
  return (
    <DataTable
      rows={rows}
      getRowId={(r) => r.id}
      emptyMessage="No hay trabajos con estos filtros."
      columns={columns}
      renderMobile={(r) => (
        <div
          className="-m-4 flex flex-col gap-2 rounded-l-xl border-l-4 p-4 pl-3"
          style={{ borderLeftColor: STATUS_COLOR[r.status] }}
        >
          <div className="flex items-center justify-between">
            <CodeCell row={r} />
            <StatusChip status={r.status} />
          </div>
          <p className="text-sm">
            {r.clinic.name} · {r.doctor.name}
          </p>
          <p className="text-sm text-muted-foreground">{r.patientRef}</p>
          <p className="text-sm text-muted-foreground">{r.itemsSummary ?? '—'}</p>
          <div className="flex items-center justify-between">
            <DueCell row={r} today={today} />
            {!hidePrices && <span className="font-mono font-medium">{money(r.total)}</span>}
          </div>
        </div>
      )}
    />
  )
}
