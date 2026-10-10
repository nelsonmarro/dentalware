import { toSignedCents } from '@dentalware/shared'
import type { ReactNode } from 'react'
import { formatDate } from '@/features/cases/date-format'
import { formatMoney } from '@/lib/format-money'
import { cn } from '@/lib/utils'
import type { ClinicAccount } from './api'
import { BalanceAmount } from './balance-amount'
import { signedAmountText } from './balance-text'

type Breakdown = ClinicAccount['breakdown']

/** Un monto del desglose: «$ 245.00» si suma y «− $ 30.00» si resta (signo con texto). */
const amountText = (value: string) =>
  toSignedCents(value) < 0 ? signedAmountText(value) : formatMoney(value)

function Line({ term, children }: { term: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 print:py-0.5">
      <dt className="min-w-0 text-muted-foreground">{term}</dt>
      <dd className="font-mono whitespace-nowrap tabular-nums">{children}</dd>
    </div>
  )
}

/**
 * De qué se compone el saldo (UX5-02, ADR 35), al pie de «Por cobrar» y en el estado de cuenta:
 * los trabajos por cobrar, el saldo inicial y los ajustes sin trabajo (solo si no suman 0, con
 * la fecha del más antiguo), el saldo a favor (si hay) y el saldo, bajo doble raya como en un
 * libro de cuentas. Los números vienen de la API (`breakdown`): la vista no suma nada. Sin nada
 * que desglosar (todo en 0) no pinta nada. En papel, en `rem` (`print:text-print-*`).
 */
export function BalanceBreakdown({
  breakdown: b,
  className,
}: {
  breakdown: Breakdown
  className?: string
}) {
  const unlinked = toSignedCents(b.unlinkedAdjustments)
  const credit = toSignedCents(b.credit)
  if (toSignedCents(b.openCases) === 0 && unlinked === 0 && credit <= 0) return null
  return (
    <dl
      aria-label="Desglose del saldo"
      className={cn(
        'flex w-full flex-col text-sm sm:ml-auto sm:max-w-md print:ml-auto print:max-w-[24rem] print:text-print-body',
        className,
      )}
    >
      <Line term="Trabajos">{formatMoney(b.openCases)}</Line>
      {unlinked !== 0 && (
        <Line
          term={
            <>
              Saldo inicial y ajustes sin trabajo
              {b.unlinkedSince && (
                <span className="block text-xs print:text-print-small">
                  (desde el {formatDate(b.unlinkedSince)})
                </span>
              )}
            </>
          }
        >
          {amountText(b.unlinkedAdjustments)}
        </Line>
      )}
      {credit > 0 && <Line term="Saldo a favor">− {formatMoney(b.credit)}</Line>}
      <div className="mt-1 flex items-baseline justify-between gap-4 border-t-4 border-double border-foreground pt-2 print:mt-0.5 print:pt-1">
        <dt className="font-semibold">Saldo</dt>
        <dd>
          <BalanceAmount balance={b.balance} className="text-base print:text-print-body" />
        </dd>
      </div>
    </dl>
  )
}
