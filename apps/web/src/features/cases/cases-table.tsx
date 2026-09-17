import type { CaseListQuery } from '@dentalware/shared'
import { CASE_PAGE_SIZE, toIsoDate } from '@dentalware/shared'
import { Link } from '@tanstack/react-router'
import { CircleAlert, Clock, TriangleAlert } from 'lucide-react'
import { useMemo } from 'react'
import {
  DataGrid,
  defineColumns,
  pagination,
  pinning,
  resizing,
  sorting,
  urlState,
  useDataGrid,
} from '@/components/data-grid'
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
      {/* `data-target-size="inline"`: el código es el identificador de fila/tarjeta, no
          una acción — misma excepción "inline" (WCAG 2.5.8) que el nombre de clínica en
          `clinics-table.tsx`. La fila entera no es clicable y "Editar"/las acciones reales
          sí miden 44 px donde existen. */}
      <Link
        to="/trabajos/$caseId"
        params={{ caseId: row.id }}
        data-target-size="inline"
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

export function CasesTable({
  rows,
  total,
  hidePrices,
  search,
  onSearchChange,
}: {
  rows: CaseListRow[]
  total: number
  hidePrices: boolean
  search: Partial<CaseListQuery>
  onSearchChange: (patch: Partial<CaseListQuery>) => void
}) {
  const today = toIsoDate(new Date())

  const columns = useMemo(
    () =>
      defineColumns<CaseListRow>((col) => [
        col.accessor('code', {
          id: 'codigo',
          header: 'Código',
          cell: (c) => <CodeCell row={c.row.original} />,
          meta: {
            cellClassName: 'border-l-4',
            cellStyle: (r) => ({ borderLeftColor: STATUS_COLOR[(r as CaseListRow).status] }),
            width: 140,
          },
        }),
        col.accessor((r) => `${r.clinic.name} · ${r.doctor.name}`, {
          id: 'clinica',
          header: 'Clínica / Doctor',
          cell: (c) => {
            const r = c.row.original
            const label = `${r.clinic.name} · ${r.doctor.name}`
            return (
              <span className="block truncate" title={label}>
                {label}
              </span>
            )
          },
          meta: { cellClassName: 'max-w-[170px]', width: 170 },
        }),
        col.accessor('patientRef', {
          id: 'paciente',
          header: 'Paciente',
          enableSorting: false,
          cell: (c) => (
            <span className="block truncate" title={c.row.original.patientRef}>
              {c.row.original.patientRef}
            </span>
          ),
          meta: { cellClassName: 'max-w-[120px]', width: 120 },
        }),
        col.accessor('itemsSummary', {
          id: 'trabajo',
          header: 'Trabajo',
          enableSorting: false,
          cell: (c) => (
            <span className="block truncate" title={c.row.original.itemsSummary ?? '—'}>
              {c.row.original.itemsSummary ?? '—'}
            </span>
          ),
          meta: { cellClassName: 'max-w-[130px]', width: 130 },
        }),
        col.accessor((r) => r.promisedDate ?? r.dueDate, {
          id: 'entrega',
          header: 'Entrega',
          cell: (c) => <DueCell row={c.row.original} today={today} />,
          meta: { width: 135 },
        }),
        col.accessor('status', {
          id: 'estado',
          header: 'Estado',
          cell: (c) => <StatusChip status={c.row.original.status} />,
          meta: { width: 130 },
        }),
        ...(hidePrices
          ? []
          : [
              col.accessor('total', {
                id: 'total',
                header: 'Total',
                enableSorting: false,
                cell: (c) => <span className="font-mono">{money(c.row.original.total)}</span>,
                meta: { align: 'right' as const, width: 95 },
              }),
            ]),
      ]),
    [hidePrices, today],
  )

  // Solo `pagina`/`orden`: el buscador `q` de trabajos vive en `CasesFilters` (parámetro de
  // servidor) y `filtering()` no se registra aquí para no duplicarlo. Pasar `search.q` a
  // `urlState` sería inofensivo en la práctica (sin `filtering()` no hay `filteredRowModel`
  // que lo use para filtrar, ver `url-state.test.tsx`), pero se omite a propósito para no dejar
  // un `globalFilter` de estado sin dueño visual en esta tabla.
  const FEATURES = useMemo(
    () => [
      sorting(),
      pagination({ pageSize: CASE_PAGE_SIZE }),
      // `resizing`: sin ella, `sorting` + `pinning` añaden un botón de orden y un menú "⋮" de
      // columna a CADA cabecera (antes inexistentes en esta tabla) y, sin `table-layout: fixed`,
      // el ancho de cada columna crece para acomodarlos — la tabla deja de caber en el
      // presupuesto de 960 px a 1280 px (UX2-05, mismo problema que resolvió `products-table.tsx`
      // en la Tarea 13 con el mismo patrón: anchos declarados + `resizing`).
      resizing(),
      pinning({ left: ['codigo'] }),
      urlState({
        search: { pagina: search.pagina, orden: search.orden },
        navigate: (patch) => onSearchChange(patch as Partial<CaseListQuery>),
        pageSize: CASE_PAGE_SIZE,
      }),
    ],
    [search.pagina, search.orden, onSearchChange],
  )

  const grid = useDataGrid({
    key: 'trabajos',
    columns,
    data: rows,
    features: FEATURES,
    mode: 'server',
    rowCount: total,
    getRowId: (r) => r.id,
  })

  return (
    <DataGrid.Root
      grid={grid}
      emptyMessage="No hay trabajos con estos filtros."
      renderCard={(r) => (
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
    >
      {/* Solo `sorting` aporta un slot `toolbar` en esta tabla (pagination/resizing/pinning/
          urlState no tienen UI de toolbar): la barra móvil nunca se pliega aquí (el umbral es 3+
          slots registrados, `parts/toolbar.tsx`) y queda como los "Ordenar por"/"Dirección" de
          `sorting`, la única forma de cambiar el orden en `< lg` — la tabla de escritorio oculta
          las tarjetas y con ellas el botón de orden de cada cabecera. */}
      <DataGrid.Toolbar />
      <DataGrid.Content />
      <DataGrid.Pagination />
    </DataGrid.Root>
  )
}
