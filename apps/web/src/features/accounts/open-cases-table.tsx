import { toSignedCents } from '@dentalware/shared'
import { Link } from '@tanstack/react-router'
import { DataGrid, defineColumns, useDataGrid, type GridFeature } from '@/components/data-grid'
import { formatTimestampDate } from '@/features/cases/date-format'
import { formatMoney } from '@/lib/format-money'
import type { ClinicAccount } from './api'
import { signedAmountText } from './balance-text'
import { daysText } from './days-text'

type OpenCase = ClinicAccount['openCases'][number]

/** Sin orden, filtro ni paginación: la lista ya viene de la entrega más antigua a la más nueva,
 * que es el orden en que se cobra (decisión 8). `DataGrid` da la tabla y las tarjetas. */
const FEATURES: GridFeature[] = []

const Money = ({ value, strong = false }: { value: string; strong?: boolean }) => (
  <span className={`font-mono tabular-nums ${strong ? 'font-semibold' : ''}`}>
    {formatMoney(value)}
  </span>
)

const CaseLink = ({ c }: { c: OpenCase }) => (
  <Link
    to="/trabajos/$caseId"
    params={{ caseId: c.id }}
    data-target-size="inline"
    className="font-mono font-medium text-primary hover:underline"
  >
    {c.code}
  </Link>
)

const columns = defineColumns<OpenCase>((col) => [
  col.accessor('code', { header: 'Trabajo', cell: (c) => <CaseLink c={c.row.original} /> }),
  col.accessor('patientRef', { header: 'Paciente' }),
  col.accessor((r) => String(r.deliveredAt), {
    id: 'entregado',
    header: 'Entregado',
    cell: (c) => formatTimestampDate(String(c.row.original.deliveredAt)),
  }),
  col.accessor('days', {
    header: 'Días',
    cell: (c) => <span className="whitespace-nowrap">{daysText(c.getValue())}</span>,
    meta: { align: 'right' },
  }),
  col.accessor('charge', {
    header: 'Cargo',
    cell: (c) => <Money value={c.getValue()} />,
    meta: { align: 'right' },
  }),
  col.accessor('adjustments', {
    header: 'Ajustes',
    cell: (c) =>
      toSignedCents(c.getValue()) === 0 ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <span className="font-mono tabular-nums">{signedAmountText(c.getValue())}</span>
      ),
    meta: { align: 'right' },
  }),
  col.accessor('allocated', {
    header: 'Pagado',
    cell: (c) => <Money value={c.getValue()} />,
    meta: { align: 'right' },
  }),
  col.accessor('outstanding', {
    header: 'Pendiente',
    cell: (c) => <Money value={c.getValue()} strong />,
    meta: { align: 'right' },
  }),
])

/** Tarjeta móvil: el trabajo y lo que debe arriba, el paciente y desde cuándo debajo. */
function OpenCaseCard({ c }: { c: OpenCase }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <CaseLink c={c} />
        <span className="text-base">
          <Money value={c.outstanding} strong />
        </span>
      </div>
      <p className="text-sm">{c.patientRef}</p>
      <p className="text-sm text-muted-foreground">
        Entregado el {formatTimestampDate(String(c.deliveredAt))} · {daysText(c.days)}
      </p>
      <p className="text-xs text-muted-foreground">
        Cargo <Money value={c.charge} />
        {toSignedCents(c.adjustments) !== 0 && (
          <>
            {' · '}Ajustes <span className="font-mono">{signedAmountText(c.adjustments)}</span>
          </>
        )}
        {' · '}Pagado <Money value={c.allocated} />
      </p>
    </div>
  )
}

/** «Por cobrar» (CTA-1/2): los trabajos entregados con pendiente, con lo que deben y los días
 * desde su entrega. */
export function OpenCasesTable({ rows }: { rows: ClinicAccount['openCases'] }) {
  const grid = useDataGrid({
    key: 'cuentas-por-cobrar',
    columns,
    data: rows,
    features: FEATURES,
    getRowId: (r) => r.id,
  })
  return (
    <DataGrid.Root
      grid={grid}
      emptyMessage="Nada por cobrar: todos los trabajos entregados están cobrados."
      renderCard={(c) => <OpenCaseCard c={c} />}
    >
      <DataGrid.Content />
    </DataGrid.Root>
  )
}
