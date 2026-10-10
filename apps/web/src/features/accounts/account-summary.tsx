import {
  accountHeadline,
  fromCents,
  AGING_BUCKET_LABEL,
  AGING_BUCKETS,
  toSignedCents,
  type AgingBucket,
} from '@dentalware/shared'
import { formatMoney } from '@/lib/format-money'
import { pendingText } from './account-headline-text'
import { AGING_TAB_COLOR, agingTab } from './aging-tab'
import { BalanceAmount } from './balance-amount'

/**
 * La cabecera de la cuenta de una clínica (CTA-1/2): el saldo, con una sola lectura
 * (`accountHeadline`, UX5-01): «A favor» solo si el saldo es negativo, el saldo a favor sin
 * aplicar en una línea si el saldo ya lo descuenta y «Nada pendiente» solo sin trabajos por
 * cobrar; después la antigüedad por cubo. Es el «ticket» de la lista, con la pestaña de color de lo
 * más antiguo; debajo del saldo, una regleta reparte lo que se debe entre los cuatro cubos con
 * sus colores. Ambas solo acompañan: los cubos llevan su rótulo y su monto en texto.
 */
export function AccountSummary({
  balance,
  credit,
  openCasesTotal,
  openCasesCount,
  aging,
  oldestDays,
}: {
  balance: string
  credit: string
  /** Σ de «Por cobrar» (`breakdown.openCases`). */
  openCasesTotal: string
  openCasesCount: number
  aging: Record<AgingBucket, string>
  oldestDays: number | null
}) {
  const cents = AGING_BUCKETS.map((b) => toSignedCents(aging[b]))
  const total = cents.reduce((a, b) => a + b, 0)
  const tab = agingTab(oldestDays)
  const headline = accountHeadline({
    balanceCents: toSignedCents(balance),
    creditCents: toSignedCents(credit),
    openCasesCents: toSignedCents(openCasesTotal),
    openCasesCount,
    oldestDays,
  })

  return (
    <section
      aria-labelledby="cuenta-saldo"
      data-aging={tab}
      style={{ borderLeftColor: AGING_TAB_COLOR[tab] }}
      className="flex flex-col gap-4 rounded-xl border border-l-4 border-border bg-card p-4 sm:p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 id="cuenta-saldo" className="text-sm text-muted-foreground">
          Saldo
        </h2>
        <BalanceAmount balance={balance} className="text-3xl leading-none" />
        {headline.unappliedCreditCents !== null && (
          <p className="text-sm text-accent-foreground">
            Ya descuenta{' '}
            <span className="font-mono font-semibold">
              {formatMoney(fromCents(headline.unappliedCreditCents))}
            </span>{' '}
            a favor sin aplicar
          </p>
        )}
        <p className="text-sm text-muted-foreground">{pendingText(headline.pending)}</p>
      </div>
      {total > 0 && (
        <div aria-hidden className="flex h-2 overflow-hidden rounded-full bg-muted">
          {AGING_BUCKETS.map((b, i) =>
            (cents[i] ?? 0) > 0 ? (
              <span
                key={b}
                style={{
                  width: `${((cents[i] ?? 0) / total) * 100}%`,
                  backgroundColor: AGING_TAB_COLOR[b],
                }}
              />
            ) : null,
          )}
        </div>
      )}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {AGING_BUCKETS.map((b, i) => (
          <div key={b} className="flex flex-col gap-0.5">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: AGING_TAB_COLOR[b] }}
              />
              {AGING_BUCKET_LABEL[b]}
            </dt>
            <dd className="text-sm">
              {(cents[i] ?? 0) === 0 ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <span className="font-mono tabular-nums">{formatMoney(aging[b])}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
