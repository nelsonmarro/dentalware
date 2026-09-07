import { toIsoDate } from '@dentalware/shared'
import { Link } from '@tanstack/react-router'
import { CircleAlert, Clock, TriangleAlert } from 'lucide-react'
import { DataTable, type Column } from '@/components/data-table'
import type { CaseListRow } from './api'
import { dueBadge } from './case-views'
import { formatDate } from './date-format'
import { STATUS_COLOR, StatusChip } from './status-chip'

function money(value: string | null) {
  return value === null ? '—' : `$ ${Number(value).toFixed(2)}`
}

/** Icono accesible (UX2-05): reemplaza el chip de texto "Urgente"/"Atrasado"/"Hoy"
 * para liberar el ancho que exigía scroll horizontal a 1280px; `title` da el tooltip
 * nativo y `role="img"` + `aria-label` conservan el texto para lectores de pantalla. */
function StatusIcon({
  label,
  className,
  Icon,
}: {
  label: string
  className: string
  Icon: typeof TriangleAlert
}) {
  return (
    <span title={label} aria-label={label} role="img" className={className}>
      <Icon aria-hidden className="size-4" />
    </span>
  )
}

function DueCell({ row, today }: { row: CaseListRow; today: string }) {
  const date = row.promisedDate ?? row.dueDate
  const badge = dueBadge(date, today, row.status)
  return (
    <div className="flex items-center gap-1.5">
      <span>{formatDate(date)}</span>
      {badge === 'hoy' && (
        <StatusIcon label="Vence hoy" Icon={Clock} className="text-[color:var(--wax-amber)]" />
      )}
      {badge === 'atrasado' && (
        <StatusIcon label="Atrasado" Icon={CircleAlert} className="text-destructive" />
      )}
    </div>
  )
}

function CodeCell({ row }: { row: CaseListRow }) {
  return (
    <div className="flex items-center gap-1.5">
      <Link
        to="/trabajos/$caseId"
        params={{ caseId: row.id }}
        className="font-mono font-medium text-primary hover:underline"
      >
        {row.code}
      </Link>
      {row.priority === 'urgente' && (
        <StatusIcon label="Urgente" Icon={TriangleAlert} className="text-destructive" />
      )}
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
      className: 'max-w-[180px]',
      cell: (r) => {
        const label = `${r.clinic.name} · ${r.doctor.name}`
        return (
          <span className="block truncate" title={label}>
            {label}
          </span>
        )
      },
    },
    {
      key: 'paciente',
      header: 'Paciente',
      className: 'max-w-[140px]',
      cell: (r) => (
        <span className="block truncate" title={r.patientRef}>
          {r.patientRef}
        </span>
      ),
    },
    {
      key: 'trabajo',
      header: 'Trabajo',
      className: 'max-w-[160px]',
      cell: (r) => (
        <span className="block truncate" title={r.itemsSummary ?? '—'}>
          {r.itemsSummary ?? '—'}
        </span>
      ),
    },
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
