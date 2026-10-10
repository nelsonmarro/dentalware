import {
  ACCOUNT_MOVEMENT_KIND_LABEL,
  ACCOUNT_MOVEMENT_KINDS,
  AGING_BUCKET_LABEL,
  AGING_BUCKETS,
  PAYMENT_METHOD_LABEL,
  toSignedCents,
  type AccountMovementKind,
} from '@dentalware/shared'
import type { LabSettings } from '@/features/config/api'
import { formatDate, formatTimestampDate } from '@/features/cases/date-format'
import { formatMoney } from '@/lib/format-money'
import { cn } from '@/lib/utils'
import type { AccountStatement as Statement } from './api'
import { BalanceBreakdown } from './balance-breakdown'
import { balanceParts, signedAmountText } from './balance-text'
import { daysText } from './days-text'

type Movement = Statement['movements'][number]

/** Celdas que en móvil no caben y se leen dentro de otra (la fecha bajo el detalle, el paciente
 * bajo el trabajo); en pantalla ancha y en papel van en su columna. */
const WIDE_ONLY = 'hidden sm:table-cell print:table-cell'
const NARROW_ONLY = 'sm:hidden print:hidden'
const CELL = 'px-2 py-2 align-top print:px-1 print:py-0.5'
const NUM = 'w-px text-right whitespace-nowrap'
/** Un título de sección no se queda solo al pie de una hoja: va con lo que le sigue (UX5-13). */
const SECTION_TITLE = 'text-sm font-semibold break-after-avoid print:text-print-body'
/** El código del trabajo no se parte en el guion («26-» / «00105», UX5-13/14). */
const CODE = 'font-mono whitespace-nowrap'
/** El saldo final, subrayado doble como en un libro de cuentas. */
const CLOSING = 'border-b-4 border-double border-foreground pb-0.5 font-semibold'

/** Rótulo del total de cada tipo en el cuadre. `Record` exhaustivo: un tipo nuevo no compila
 * sin el suyo. */
const TOTAL_LABEL: Record<AccountMovementKind, string> = {
  cargo: 'Cargos',
  ajuste: 'Ajustes',
  pago: 'Pagos',
}

/** Un saldo en monoespaciada; el negativo, con el rótulo «A favor» (texto, no solo color). */
function Balance({ value, className }: { value: string; className?: string }) {
  const { kind, amount } = balanceParts(value)
  return (
    <span className={className}>
      {kind === 'a_favor' && (
        <>
          <span className="text-xs font-medium print:text-print-small">A favor</span>{' '}
        </>
      )}
      <span className="font-mono whitespace-nowrap tabular-nums">{amount}</span>
    </span>
  )
}

/** Lo que dice cada movimiento: su tipo, el trabajo, el método y la referencia o el motivo y,
 * si es un pago anulado, quién lo anuló y por qué. En móvil, también su fecha. */
function MovementDetail({ m }: { m: Movement }) {
  const code = m.case && <span className={CODE}>{m.case.code}</span>
  return (
    <div className="flex min-w-0 flex-col gap-0.5 print:gap-0">
      <p className="flex flex-wrap items-center gap-2 font-medium">
        {ACCOUNT_MOVEMENT_KIND_LABEL[m.kind]}
        {m.voided && (
          <span className="rounded border border-destructive/50 px-1.5 text-xs font-medium text-destructive print:border-foreground print:text-print-small print:text-foreground">
            Anulado
          </span>
        )}
      </p>
      {m.kind === 'cargo' && code && <p>Trabajo {code}</p>}
      {m.kind === 'ajuste' && (
        <p className="break-words">
          {m.reason}
          {code && <> · Trabajo {code}</>}
        </p>
      )}
      {m.kind === 'pago' && m.method && (
        <p>{[PAYMENT_METHOD_LABEL[m.method], m.reference].filter(Boolean).join(' · ')}</p>
      )}
      {/* M5: quién anuló un pago y por qué son datos internos; el estado de cuenta se manda a la
       * clínica y solo dice «Anulado». La pantalla de la cuenta sí los muestra. */}
      <p className={cn('font-mono text-xs text-muted-foreground', NARROW_ONLY)}>
        {formatDate(m.date)}
      </p>
    </div>
  )
}

/** El cuadre del periodo (decisión 12): saldo inicial, lo que sumó o restó cada tipo y el saldo
 * final, que es la suma de todo. En papel y en pantalla ancha, una franja de cinco columnas. */
function PeriodSummary({ s }: { s: Statement }) {
  const item = 'flex items-baseline justify-between gap-3 sm:flex-col sm:items-start sm:gap-1'
  return (
    <section aria-labelledby="estado-resumen" className="flex flex-col gap-2 print:gap-1">
      <h2 id="estado-resumen" className={SECTION_TITLE}>
        Resumen del periodo
      </h2>
      <ol className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-lg border border-border p-3 text-sm sm:grid-cols-[auto_repeat(3,minmax(0,1fr))_auto] print:grid-cols-[auto_repeat(3,minmax(0,1fr))_auto] print:gap-x-3 print:gap-y-0 print:p-1.5 print:text-print-body [&>li]:print:flex-col [&>li]:print:items-start [&>li]:print:gap-0">
        <li className={item}>
          <span className="whitespace-nowrap text-muted-foreground">
            Saldo al {formatDate(s.openingDate)}
          </span>
          <Balance value={s.openingBalance} />
        </li>
        {ACCOUNT_MOVEMENT_KINDS.map((kind) => (
          <li key={kind} className={item}>
            <span className="text-muted-foreground">{TOTAL_LABEL[kind]}</span>
            <span className="font-mono whitespace-nowrap tabular-nums">
              {signedAmountText(s.totals[kind])}
            </span>
          </li>
        ))}
        <li
          className={cn(
            item,
            'border-t-4 border-double border-foreground pt-2 sm:border-t-0 sm:border-l-4 sm:pt-0 sm:pl-3 print:border-t-0 print:border-l-4 print:pt-0 print:pl-2',
          )}
        >
          <span className="font-medium whitespace-nowrap">
            Saldo al {formatDate(s.range.hasta)}
          </span>
          <Balance value={s.closingBalance} className="font-semibold" />
        </li>
      </ol>
    </section>
  )
}

/** El saldo corrido de una fila en móvil, bajo su monto (UX5-14): la columna «Saldo» solo va en
 * pantalla ancha y en papel, para que «Detalle» tenga sitio a 360. */
function NarrowBalance({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={cn('mt-0.5 block text-xs whitespace-normal text-muted-foreground', NARROW_ONLY)}
    >
      {children}
    </span>
  )
}

/** Movimientos del rango con su saldo corrido, entre el saldo inicial y el final (subrayado
 * doble, como en un libro de cuentas). Un pago anulado se ve tachado y no suma. En móvil, el
 * saldo corrido va bajo el monto. */
function MovementsLedger({ s }: { s: Statement }) {
  const hasta = formatDate(s.range.hasta)
  return (
    <section aria-labelledby="estado-movimientos" className="flex flex-col gap-2 print:gap-1">
      <h2 id="estado-movimientos" className={SECTION_TITLE}>
        Movimientos
      </h2>
      <table
        aria-labelledby="estado-movimientos"
        className="w-full border-collapse text-sm print:text-print-body"
      >
        <thead>
          <tr className="border-b border-foreground text-left text-xs text-muted-foreground print:text-print-small">
            <th scope="col" className={cn(CELL, WIDE_ONLY, 'w-px font-medium')}>
              Fecha
            </th>
            <th scope="col" className={cn(CELL, 'font-medium')}>
              Detalle
            </th>
            <th scope="col" className={cn(CELL, NUM, 'font-medium')}>
              Monto
            </th>
            <th scope="col" className={cn(CELL, NUM, WIDE_ONLY, 'font-medium')}>
              Saldo
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border">
            <td className={cn(CELL, WIDE_ONLY)} />
            <td className={cn(CELL, 'text-muted-foreground')}>
              <span className="whitespace-nowrap">Saldo al {formatDate(s.openingDate)}</span>
            </td>
            <td className={cn(CELL, NUM)}>
              <Balance value={s.openingBalance} className={NARROW_ONLY} />
            </td>
            <td className={cn(CELL, NUM, WIDE_ONLY)}>
              <Balance value={s.openingBalance} />
            </td>
          </tr>
          {s.movements.map((m) => (
            <tr
              key={`${m.kind}-${m.id}`}
              className="break-inside-avoid border-b border-border last:border-b-0"
            >
              <td className={cn(CELL, WIDE_ONLY, 'font-mono whitespace-nowrap')}>
                {formatDate(m.date)}
              </td>
              <td className={CELL}>
                <MovementDetail m={m} />
              </td>
              <td className={cn(CELL, NUM)}>
                <span
                  className={cn(
                    'font-mono tabular-nums',
                    m.voided && 'text-muted-foreground line-through',
                  )}
                >
                  {signedAmountText(m.amount)}
                </span>
                <NarrowBalance>
                  {m.voided ? (
                    'No suma'
                  ) : (
                    <>
                      Saldo <Balance value={m.balance} />
                    </>
                  )}
                </NarrowBalance>
              </td>
              <td className={cn(CELL, NUM, WIDE_ONLY)}>
                {m.voided ? (
                  <span className="text-xs text-muted-foreground print:text-print-small">
                    No suma
                  </span>
                ) : (
                  <Balance value={m.balance} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-foreground">
            <td className={cn(CELL, WIDE_ONLY)} />
            <th scope="row" className={cn(CELL, 'text-left font-semibold')}>
              <span className="whitespace-nowrap">Saldo al {hasta}</span>
            </th>
            <td className={cn(CELL, NUM)}>
              <Balance value={s.closingBalance} className={cn(CLOSING, NARROW_ONLY)} />
            </td>
            <td className={cn(CELL, NUM, WIDE_ONLY)}>
              <Balance value={s.closingBalance} className={CLOSING} />
            </td>
          </tr>
        </tfoot>
      </table>
      {s.movements.length === 0 && (
        <p className="text-sm text-muted-foreground print:text-print-body">
          Sin movimientos en este periodo.
        </p>
      )}
    </section>
  )
}

/** Antigüedad de lo que se debe a la fecha `hasta` (decisión 9), con lo más antiguo y el saldo
 * a favor si lo hay. */
function AgingBlock({ s }: { s: Statement }) {
  return (
    <section
      aria-labelledby="estado-antiguedad"
      className="flex break-inside-avoid flex-col gap-2 print:gap-1"
    >
      <h2 id="estado-antiguedad" className={SECTION_TITLE}>
        Antigüedad al {formatDate(s.range.hasta)}
      </h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-border p-3 sm:grid-cols-4 print:grid-cols-4 print:gap-y-0 print:p-1.5">
        {AGING_BUCKETS.map((b) => (
          <div key={b} className="flex flex-col gap-0.5 print:gap-0">
            <dt className="text-xs text-muted-foreground print:text-print-small">
              {AGING_BUCKET_LABEL[b]}
            </dt>
            <dd className="text-sm print:text-print-body">
              {toSignedCents(s.aging[b]) === 0 ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <span className="font-mono tabular-nums">{formatMoney(s.aging[b])}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm print:text-print-body">
        <p>{s.oldestDays === null ? 'Nada pendiente' : `Más antiguo: ${daysText(s.oldestDays)}`}</p>
        {toSignedCents(s.credit) > 0 && (
          <p>
            Saldo a favor <span className="font-mono font-semibold">{formatMoney(s.credit)}</span>
          </p>
        )}
      </div>
    </section>
  )
}

/** «Por cobrar» a la fecha `hasta`: cada trabajo con pendiente y los días desde su entrega, y
 * al pie el desglose del saldo final (UX5-02): trabajos + saldo inicial y ajustes sin trabajo −
 * saldo a favor, con los números de la API. */
function OpenCasesBlock({ s }: { s: Statement }) {
  const hasta = formatDate(s.range.hasta)
  return (
    <section aria-labelledby="estado-por-cobrar" className="flex flex-col gap-2 print:gap-1">
      <h2 id="estado-por-cobrar" className={SECTION_TITLE}>
        Por cobrar al {hasta}
      </h2>
      {s.openCases.length === 0 ? (
        <p className="text-sm text-muted-foreground print:text-print-body">
          Nada por cobrar al {hasta}.
        </p>
      ) : (
        <table
          aria-labelledby="estado-por-cobrar"
          className="w-full border-collapse text-sm print:text-print-body"
        >
          <thead>
            <tr className="border-b border-foreground text-left text-xs text-muted-foreground print:text-print-small">
              <th scope="col" className={cn(CELL, 'font-medium')}>
                Trabajo
              </th>
              <th scope="col" className={cn(CELL, WIDE_ONLY, 'font-medium')}>
                Paciente
              </th>
              <th scope="col" className={cn(CELL, WIDE_ONLY, 'font-medium')}>
                Entregado
              </th>
              <th scope="col" className={cn(CELL, NUM, 'font-medium')}>
                Días
              </th>
              <th scope="col" className={cn(CELL, NUM, 'font-medium')}>
                Pendiente
              </th>
            </tr>
          </thead>
          <tbody>
            {s.openCases.map((c) => (
              <tr key={c.id} className="break-inside-avoid border-b border-border">
                <td className={CELL}>
                  <span className={cn(CODE, 'font-medium')}>{c.code}</span>
                  <span className={cn('block text-xs text-muted-foreground', NARROW_ONLY)}>
                    {c.patientRef}
                  </span>
                </td>
                <td className={cn(CELL, WIDE_ONLY)}>{c.patientRef}</td>
                <td className={cn(CELL, WIDE_ONLY, 'font-mono whitespace-nowrap')}>
                  {formatTimestampDate(String(c.deliveredAt))}
                </td>
                <td className={cn(CELL, NUM)}>{daysText(c.days)}</td>
                <td className={cn(CELL, NUM)}>
                  <span className="font-mono tabular-nums">{formatMoney(c.outstanding)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <BalanceBreakdown breakdown={s.breakdown} className="break-inside-avoid" />
    </section>
  )
}

/**
 * Estado de cuenta imprimible de una clínica (CTA-5, decisión 12), como la orden impresa: el
 * encabezado del laboratorio (CFG-1) y el de la clínica, el cuadre del periodo, los movimientos
 * con su saldo corrido, la antigüedad y «Por cobrar» a la fecha `hasta`. En papel todo se mide
 * en `rem` (`print:text-print-*`), para que escale con la raíz de impresión (`index.css`); los
 * bordes y el texto llevan la información, porque el fondo no se imprime por omisión.
 */
export function AccountStatement({
  statement: s,
  lab,
  issuedOn,
}: {
  statement: Statement
  /** Datos del laboratorio (CFG-1); sin configurar, el estado sale sin su encabezado. */
  lab: LabSettings | null
  /** Fecha de emisión (`YYYY-MM-DD`, hoy). */
  issuedOn: string
}) {
  const place = [s.clinic.address, s.clinic.city].filter(Boolean).join(', ')
  return (
    <article className="mx-auto flex w-full max-w-[860px] min-w-0 flex-col gap-6 rounded-xl border border-border bg-card p-4 text-foreground sm:p-8 print:max-w-none print:gap-3 print:rounded-none print:border-0 print:bg-transparent print:p-0 print:text-print-base print:leading-tight">
      <header className="flex flex-col gap-4 border-b-2 border-foreground pb-4 sm:flex-row sm:items-start sm:justify-between print:flex-row print:items-start print:justify-between print:gap-2 print:pb-2">
        <div className="flex items-start gap-3">
          {lab?.logoUrl && (
            <img
              src={lab.logoUrl}
              alt={`Logo de ${lab.name}`}
              className="h-12 w-auto object-contain print:h-9"
            />
          )}
          {lab && (
            <div className="flex flex-col gap-0.5 text-sm print:gap-0 print:text-print-body">
              <p className="text-lg font-semibold print:text-sm">{lab.name}</p>
              {lab.address && <p>{lab.address}</p>}
              {lab.phone && <p>Cel.: {lab.phone}</p>}
              {lab.ruc && <p className="text-muted-foreground">RUC: {lab.ruc}</p>}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1 sm:items-end sm:text-right print:items-end print:gap-0 print:text-right">
          <h1 className="text-2xl font-semibold tracking-tight print:text-base">
            Estado de cuenta
          </h1>
          <p className="font-mono text-sm print:text-print-body">
            Del {formatDate(s.range.desde)} al {formatDate(s.range.hasta)}
          </p>
          <p className="text-xs text-muted-foreground print:text-print-small">
            Emitido el {formatDate(issuedOn)}
          </p>
        </div>
      </header>

      <section aria-labelledby="estado-clinica" className="flex flex-col gap-1 print:gap-0">
        <h2
          id="estado-clinica"
          className="break-after-avoid text-xs text-muted-foreground print:text-print-small"
        >
          Clínica
        </h2>
        <p className="text-xl font-semibold print:text-sm">{s.clinic.name}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm print:text-print-body">
          {s.clinic.ruc && <p>RUC: {s.clinic.ruc}</p>}
          {place && <p>{place}</p>}
          {s.clinic.phone && <p>Tel.: {s.clinic.phone}</p>}
        </div>
      </section>

      <PeriodSummary s={s} />
      <MovementsLedger s={s} />
      <AgingBlock s={s} />
      <OpenCasesBlock s={s} />
    </article>
  )
}
