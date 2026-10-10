import {
  accountHeadline,
  AGING_BUCKET_LABEL,
  AGING_BUCKETS,
  toSignedCents,
} from '@dentalware/shared'
import { Link } from '@tanstack/react-router'
import {
  DataGrid,
  defineColumns,
  filtering,
  pagination,
  sorting,
  useDataGrid,
} from '@/components/data-grid'
import { formatMoney } from '@/lib/format-money'
import { pendingText } from './account-headline-text'
import { AGING_TAB_COLOR, agingTab } from './aging-tab'
import type { AccountRow } from './api'
import { BalanceAmount } from './balance-amount'
import { daysText } from './days-text'

const FEATURES = [
  filtering({
    search: { id: 'cuentas-buscar', label: 'Buscar clínica', placeholder: 'Buscar por nombre' },
  }),
  sorting(),
  pagination(),
]

/** Un cubo de antigüedad: el monto, o `—` si está en cero (para que lo vencido resalte). */
function AgingAmount({ value }: { value: string }) {
  return toSignedCents(value) === 0 ? (
    <span className="text-muted-foreground">—</span>
  ) : (
    <span className="font-mono tabular-nums">{formatMoney(value)}</span>
  )
}

const tabStyle = (r: unknown) => ({
  borderLeftColor: AGING_TAB_COLOR[agingTab((r as AccountRow).oldestDays)],
})

const columns = defineColumns<AccountRow>((col) => [
  col.accessor('name', {
    id: 'clinica',
    header: 'Clínica',
    // `data-target-size="inline"`: identificador de fila, no una acción (excepción «inline» de
    // WCAG 2.5.8, igual que el nombre en `clinics-table.tsx`).
    cell: (c) => (
      <Link
        to="/cuentas/$clinicaId"
        params={{ clinicaId: c.row.original.id }}
        data-target-size="inline"
        className="font-medium text-primary hover:underline"
      >
        {c.row.original.name}
      </Link>
    ),
    // `whitespace-normal`: la celda de la tabla es `nowrap`, y un nombre largo («Centro
    // Odontológico Integral … Valle de los Chillos») ensanchaba la tabla hasta desplazarla a 1280
    // (UX5-05); `min-w-48` evita que se parta palabra a palabra.
    meta: {
      cellClassName: 'border-l-4 whitespace-normal min-w-48',
      cellStyle: tabStyle,
      sortLabels: { asc: 'Clínica A–Z', desc: 'Clínica Z–A' },
    },
  }),
  // Ordena por centavos con signo: como texto, «300.00» iría después de «1250.00».
  col.accessor((r) => toSignedCents(r.balance), {
    id: 'saldo',
    header: 'Saldo',
    cell: (c) => <BalanceAmount balance={c.row.original.balance} />,
    enableGlobalFilter: false,
    meta: {
      align: 'right',
      sortLabels: { asc: 'Saldo: de menor a mayor', desc: 'Saldo: de mayor a menor' },
    },
  }),
  ...AGING_BUCKETS.map((bucket) =>
    col.accessor((r) => r.aging[bucket], {
      id: `antiguedad-${bucket}`,
      header: AGING_BUCKET_LABEL[bucket],
      cell: (c) => <AgingAmount value={c.row.original.aging[bucket]} />,
      enableSorting: false,
      enableGlobalFilter: false,
      meta: { align: 'right' as const },
    }),
  ),
  col.accessor((r) => r.oldestDays ?? -1, {
    id: 'mas-antiguo',
    header: 'Más antiguo',
    cell: (c) => <span className="whitespace-nowrap">{daysText(c.row.original.oldestDays)}</span>,
    enableGlobalFilter: false,
    meta: {
      align: 'right',
      sortLabels: { asc: 'Más reciente primero', desc: 'Más antiguo primero' },
    },
  }),
])

/** Tarjeta móvil: toda la tarjeta lleva a la cuenta (un solo objetivo táctil grande), con la
 * pestaña de color de lo más antiguo, el saldo y, si debe, los cuatro cubos. Lo pendiente se lee
 * con `accountHeadline`, igual que en la cabecera de la cuenta: «Nada pendiente» solo sin
 * trabajos por cobrar (final review M-3). */
function AccountCard({ row }: { row: AccountRow }) {
  const tab = agingTab(row.oldestDays)
  const { pending } = accountHeadline({
    balanceCents: toSignedCents(row.balance),
    creditCents: toSignedCents(row.credit),
    openCasesCents: toSignedCents(row.openCasesTotal),
    openCasesCount: row.openCasesCount,
    oldestDays: row.oldestDays,
  })
  return (
    <Link
      to="/cuentas/$clinicaId"
      params={{ clinicaId: row.id }}
      data-aging={tab}
      style={{ borderLeftColor: AGING_TAB_COLOR[tab] }}
      className="-m-4 flex flex-col gap-3 rounded-xl border-l-4 p-4 pl-3 transition-colors duration-150 hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 font-medium break-words text-primary">{row.name}</span>
        <BalanceAmount balance={row.balance} className="shrink-0 text-base" />
      </div>
      <p className="text-sm text-muted-foreground">{pendingText(pending)}</p>
      {row.oldestDays !== null && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3 text-sm">
          {AGING_BUCKETS.map((bucket) => (
            <div key={bucket} className="flex flex-col">
              <dt className="text-xs text-muted-foreground">{AGING_BUCKET_LABEL[bucket]}</dt>
              <dd>
                <AgingAmount value={row.aging[bucket]} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Link>
  )
}

/**
 * «Cuentas» (CTA-1): una fila por clínica con su saldo, la antigüedad por cubo y los días de lo
 * más antiguo, en el orden de la API (de mayor a menor saldo). Busca por clínica y ordena por
 * clínica, saldo o antigüedad. En móvil, tarjetas.
 */
export function AccountsTable({ rows, todas }: { rows: AccountRow[]; todas: boolean }) {
  const grid = useDataGrid({
    key: 'cuentas',
    columns,
    data: rows,
    features: FEATURES,
    getRowId: (r) => r.id,
  })
  return (
    <DataGrid.Root
      grid={grid}
      emptyMessage={(q) =>
        q
          ? `Ninguna clínica coincide con "${q}".`
          : todas
            ? 'Aún no hay clínicas activas.'
            : 'Ninguna clínica debe ni tiene movimientos. Activa «Ver todas las clínicas» para ver el resto.'
      }
      renderCard={(r) => <AccountCard row={r} />}
    >
      <DataGrid.Toolbar />
      <DataGrid.Content />
      <DataGrid.Pagination />
    </DataGrid.Root>
  )
}
