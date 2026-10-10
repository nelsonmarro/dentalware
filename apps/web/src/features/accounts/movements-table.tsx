import {
  ACCOUNT_MOVEMENT_KIND_LABEL,
  PAYMENT_METHOD_LABEL,
  toSignedCents,
} from '@dentalware/shared'
import { Link } from '@tanstack/react-router'
import { createContext, useContext } from 'react'
import {
  DataGrid,
  defineColumns,
  pagination,
  useDataGrid,
  type GridFeature,
} from '@/components/data-grid'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/features/cases/date-format'
import { formatMoney } from '@/lib/format-money'
import { cn } from '@/lib/utils'
import type { ClinicAccount } from './api'
import { AppliedCases } from './applied-cases'
import { signedAmountText } from './balance-text'
import { livePayment, paymentContext, type PaymentRef } from './payment-context'

type Movement = ClinicAccount['movements'][number]

const FEATURES: GridFeature[] = [pagination()]

/** Lo que dice cada movimiento debajo de su tipo: el trabajo, el método y la referencia, el
 * motivo, quién lo registró, lo que le queda a favor a un pago y, si se anuló, quién y por qué. */
function MovementDetail({ m }: { m: Movement }) {
  const caseLink = m.case && (
    <Link
      to="/trabajos/$caseId"
      params={{ caseId: m.case.id }}
      data-target-size="inline"
      className="font-mono whitespace-nowrap text-primary hover:underline"
    >
      {m.case.code}
    </Link>
  )
  const remaining = m.kind === 'pago' && !m.voided ? toSignedCents(m.remaining ?? '0') : 0
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{ACCOUNT_MOVEMENT_KIND_LABEL[m.kind]}</span>
        {m.voided && (
          <span className="rounded-md border border-destructive/40 px-1.5 text-xs font-medium text-destructive">
            Anulado
          </span>
        )}
      </p>
      {m.kind === 'cargo' && caseLink && <p className="text-sm">Trabajo {caseLink}</p>}
      {m.kind === 'pago' && m.method && (
        <p className="text-sm">
          {[PAYMENT_METHOD_LABEL[m.method], m.reference].filter(Boolean).join(' · ')}
        </p>
      )}
      {m.kind === 'ajuste' && (
        <p className="text-sm break-words">
          {m.reason}
          {caseLink && <> · Trabajo {caseLink}</>}
        </p>
      )}
      {m.kind === 'pago' && m.allocations && <AppliedCases cases={m.allocations} />}
      {m.kind === 'pago' && m.reason && (
        <p className="text-sm break-words text-muted-foreground">{m.reason}</p>
      )}
      {m.by && <p className="text-xs text-muted-foreground">Registrado por {m.by}</p>}
      {remaining > 0 && (
        <p className="text-sm font-medium text-accent-foreground">
          Le quedan <span className="font-mono">{formatMoney(m.remaining ?? '0')}</span> a favor
        </p>
      )}
      {m.voided && (
        <p className="text-sm break-words text-destructive">
          Anulado por {m.voided.by}: {m.voided.reason}
        </p>
      )}
    </div>
  )
}

/** El efecto en el saldo, con signo; el de un pago anulado, tachado (no cuenta). */
function MovementAmount({ m }: { m: Movement }) {
  return (
    <span
      className={cn(
        'font-mono whitespace-nowrap tabular-nums',
        m.voided && 'text-muted-foreground line-through',
      )}
    >
      {signedAmountText(m.amount)}
    </span>
  )
}

export type MovementActionsConfig = {
  /** Hay trabajos «Por cobrar» a los que aplicar el saldo a favor. */
  canApply: boolean
  /** Solo admin (`ACCOUNT_ADMIN_ROLES`). */
  canVoid: boolean
  disabled: boolean
  onApply: (p: PaymentRef) => void
  onVoid: (p: PaymentRef) => void
}

/** Las acciones llegan por contexto: así las columnas son una constante de módulo y la tabla no
 * se rehace en cada render. */
const ActionsContext = createContext<MovementActionsConfig | null>(null)

/** Qué acciones tiene un movimiento: «Aplicar saldo a favor» en cada pago vigente con algo sin
 * asignar (si hay trabajos por cobrar) y «Anular pago» (admin) en cada pago vigente. `null` si
 * ninguna: la tabla no reserva la columna cuando ninguna fila tiene acciones (UX5-12). */
function movementActions(m: Movement, a: MovementActionsConfig) {
  const p = livePayment(m)
  if (!p) return null
  const apply = a.canApply && toSignedCents(p.remaining) > 0
  return apply || a.canVoid ? { p, apply, void: a.canVoid } : null
}

/** Las acciones de un pago. Lo destructivo, al final y aparte (UX5-18): en la tabla, tras una
 * raya vertical; en la tarjeta, «Aplicar saldo a favor» a lo ancho y «Anular pago» debajo, tras
 * una raya. Los nombres dicen de qué pago se trata. */
function MovementActions({ m, layout }: { m: Movement; layout: 'table' | 'card' }) {
  const a = useContext(ActionsContext)
  const actions = a && movementActions(m, a)
  if (!a || !actions) return null
  const { p } = actions
  const when = formatDate(p.date)
  const card = layout === 'card'
  return (
    <div className={card ? 'flex flex-col gap-2' : 'flex items-center justify-end gap-2'}>
      {actions.apply && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={a.disabled}
          className={cn(card && 'w-full')}
          aria-label={`Aplicar saldo a favor de ${formatMoney(p.remaining)} del ${when}`}
          onClick={() => a.onApply(p)}
        >
          Aplicar saldo a favor
        </Button>
      )}
      {actions.void && (
        <div
          className={
            card
              ? 'flex justify-end border-t border-border pt-2'
              : cn('flex', actions.apply && 'ms-1 border-l border-border ps-3')
          }
        >
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={a.disabled}
            className="text-destructive hover:text-destructive"
            aria-label={`Anular pago de ${paymentContext(p, '').code} del ${when}`}
            onClick={() => a.onVoid(p)}
          >
            Anular pago
          </Button>
        </div>
      )}
    </div>
  )
}

const columns = defineColumns<Movement>((col) => [
  col.accessor('date', {
    header: 'Fecha',
    cell: (c) => <span className="whitespace-nowrap">{formatDate(c.getValue())}</span>,
  }),
  col.accessor('kind', {
    header: 'Movimiento',
    cell: (c) => <MovementDetail m={c.row.original} />,
    // La celda de la tabla es `nowrap`: un motivo largo (ajuste o anulación) se parte aquí en
    // vez de ensanchar la tabla a 1280.
    meta: { cellClassName: 'whitespace-normal min-w-64' },
  }),
  col.accessor('amount', {
    header: 'Monto',
    cell: (c) => <MovementAmount m={c.row.original} />,
    meta: { align: 'right' },
  }),
])

/** Las mismas columnas más la de acciones, para cuando alguna fila tiene alguna. */
const columnsWithActions = defineColumns<Movement>((col) => [
  ...columns,
  col.display({
    id: 'acciones',
    header: () => <span className="sr-only">Acciones</span>,
    cell: (c) => <MovementActions m={c.row.original} layout="table" />,
    meta: { align: 'right', label: 'Acciones' },
  }),
])

/** Tarjeta móvil: el movimiento a la izquierda, su monto y fecha a la derecha y las acciones
 * debajo. */
function MovementCard({ m }: { m: Movement }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <MovementDetail m={m} />
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <MovementAmount m={m} />
          <span className="text-xs text-muted-foreground">{formatDate(m.date)}</span>
        </div>
      </div>
      <MovementActions m={m} layout="card" />
    </div>
  )
}

/**
 * «Movimientos» de la cuenta (CTA-1/2/3): cargos, ajustes y pagos, de lo más nuevo a lo más
 * antiguo, cada uno con su efecto en el saldo con signo. Un pago anulado se ve tachado, con
 * quién lo anuló y por qué. En escritorio, tabla; en móvil, tarjetas con las mismas acciones.
 */
export function MovementsTable({
  rows,
  actions,
}: {
  rows: Movement[]
  actions: MovementActionsConfig
}) {
  const withActions = rows.some((m) => movementActions(m, actions) !== null)
  const grid = useDataGrid({
    key: 'cuentas-movimientos',
    columns: withActions ? columnsWithActions : columns,
    data: rows,
    features: FEATURES,
    getRowId: (r) => `${r.kind}-${r.id}`,
  })
  return (
    <ActionsContext.Provider value={actions}>
      <DataGrid.Root
        grid={grid}
        emptyMessage="Sin movimientos todavía."
        renderCard={(m) => <MovementCard m={m} />}
      >
        <DataGrid.Content />
        <DataGrid.Pagination />
      </DataGrid.Root>
    </ActionsContext.Provider>
  )
}
