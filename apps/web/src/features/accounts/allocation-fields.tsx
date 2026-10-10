import {
  allocationOutcome,
  fromCents,
  toSignedCents,
  type AllocationOutcome,
} from '@dentalware/shared'
import { CircleCheck } from 'lucide-react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { formatMoney } from '@/lib/format-money'
import { cn } from '@/lib/utils'
import { daysText } from './days-text'

/** Un trabajo «Por cobrar» en el reparto. */
export type AllocationCase = {
  id: string
  code: string
  patientRef: string
  outstanding: string
  days: number
}

/** Texto de la consecuencia de una fila (UX5-15), con el monto aparte para la monoespaciada;
 * `null` sin monto: la fila ya dice lo que debe y «Sigue debiendo $ X» lo repetiría. `Record`
 * exhaustivo: un caso nuevo no compila. */
type OutcomeText = { text: string; amount?: string } | null
const OUTCOME_TEXT: {
  [K in AllocationOutcome['kind']]: (o: Extract<AllocationOutcome, { kind: K }>) => OutcomeText
} = {
  sin_monto: () => null,
  cobrado: () => ({ text: 'Queda cobrado' }),
  debiendo: (o) => ({ text: 'Quedará debiendo', amount: formatMoney(fromCents(o.leftCents)) }),
  excede: (o) => ({ text: 'Supera lo que debe en', amount: formatMoney(fromCents(o.overCents)) }),
}

function outcomeText(o: AllocationOutcome): OutcomeText {
  return (OUTCOME_TEXT[o.kind] as (o: AllocationOutcome) => OutcomeText)(o)
}

/**
 * El reparto de un pago entre los trabajos «Por cobrar» (CTA-2), compartido por «Registrar pago»
 * y «Aplicar saldo a favor»: una fila por trabajo, en el orden del reparto sugerido, con lo que
 * debe y desde cuándo, y su monto editable (`inputmode="decimal"`). Bajo cada monto, qué le
 * pasará al trabajo («Queda cobrado», «Quedará debiendo $ X», con `allocationOutcome` de shared,
 * UX5-15), o el error de la fila. La lista se desplaza sola si no cabe (UX5-06); el total en vivo
 * va aparte, en el pie del diálogo (`AllocationSummary`).
 */
export function AllocationFields({
  cases,
  amounts,
  field,
  rowError,
  emptyText,
}: {
  cases: readonly AllocationCase[]
  /** Lo escrito en cada fila, en el orden de `cases`. */
  amounts: readonly string[]
  field: (index: number) => UseFormRegisterReturn
  rowError: (index: number) => string | undefined
  emptyText: string
}) {
  if (cases.length === 0) {
    return <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">{emptyText}</p>
  }
  return (
    <ul
      aria-label="Trabajos por cobrar"
      className="flex max-h-[min(20rem,40svh)] flex-col divide-y divide-border overflow-y-auto overscroll-contain rounded-lg border border-border"
    >
      {cases.map((c, i) => {
        const error = rowError(i)
        const id = `reparto-${c.id}`
        const outcome = allocationOutcome(toSignedCents(c.outstanding), amounts[i] ?? '')
        const text = outcomeText(outcome)
        return (
          <li key={c.id} className="flex flex-col gap-1 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor={id} className="flex min-w-0 flex-col">
                <span className="truncate text-sm">
                  <span className="font-mono font-medium">{c.code}</span> · {c.patientRef}
                </span>
                <span className="text-xs text-muted-foreground">
                  Debe <span className="font-mono">{formatMoney(c.outstanding)}</span> ·{' '}
                  {daysText(c.days)}
                </span>
              </label>
              <Input
                {...field(i)}
                id={id}
                aria-label={`Monto para ${c.code}`}
                aria-invalid={!!error}
                aria-describedby={error || text ? `${id}-nota` : undefined}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                // Al enfocarla con el teclado, la lista se desplaza hasta dejar a la vista también
                // la consecuencia de debajo y el anillo de foco (`scroll-margin`).
                className="h-11 w-28 shrink-0 scroll-mt-3 scroll-mb-10 text-right font-mono tabular-nums"
              />
            </div>
            {error ? (
              <FieldError id={`${id}-nota`} className="text-right">
                {error}
              </FieldError>
            ) : (
              text && (
                <p
                  id={`${id}-nota`}
                  className={cn(
                    'flex items-center justify-end gap-1 text-right text-xs',
                    outcome.kind === 'cobrado' && 'font-medium text-foreground',
                    outcome.kind === 'debiendo' && 'text-muted-foreground',
                    outcome.kind === 'excede' && 'font-medium text-destructive',
                  )}
                >
                  {outcome.kind === 'cobrado' && (
                    <CircleCheck aria-hidden className="size-3.5 shrink-0 text-ok-green" />
                  )}
                  {text.text}
                  {text.amount && (
                    <>
                      {' '}
                      <span className="font-mono">{text.amount}</span>
                    </>
                  )}
                </p>
              )
            )}
          </li>
        )
      })}
    </ul>
  )
}
