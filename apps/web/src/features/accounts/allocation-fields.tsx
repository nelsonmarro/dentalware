import { fromCents } from '@dentalware/shared'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { formatMoney } from '@/lib/format-money'
import { cn } from '@/lib/utils'

/** Un trabajo «Por cobrar» en el reparto. */
export type AllocationCase = {
  id: string
  code: string
  patientRef: string
  outstanding: string
  days: number
}

const daysText = (days: number) => (days === 1 ? '1 día' : `${days} días`)

/**
 * El reparto de un pago entre los trabajos «Por cobrar» (CTA-2), compartido por «Registrar pago»
 * y «Aplicar saldo a favor»: una fila por trabajo, en el orden del reparto sugerido, con lo que
 * debe y desde cuándo, y su monto editable (`inputmode="decimal"`). Debajo, en vivo, lo asignado
 * y lo que queda (`role="status"`). El error de cada fila va bajo su monto y el del total, al pie.
 */
export function AllocationFields({
  cases,
  field,
  rowError,
  totalError,
  allocatedCents,
  leftCents,
  leftLabel,
  overLabel,
  emptyText,
}: {
  cases: readonly AllocationCase[]
  field: (index: number) => UseFormRegisterReturn
  rowError: (index: number) => string | undefined
  totalError?: string
  allocatedCents: number
  /** Lo que queda sin repartir; `null` si aún no hay monto del que repartir. */
  leftCents: number | null
  /** «Queda a favor» / «Sigue a favor». */
  leftLabel: string
  /** «Supera el pago en» / «Supera lo disponible en». */
  overLabel: string
  emptyText: string
}) {
  if (cases.length === 0) {
    return <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">{emptyText}</p>
  }
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {cases.map((c, i) => {
          const error = rowError(i)
          const id = `reparto-${c.id}`
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
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  className="h-11 w-28 shrink-0 text-right font-mono tabular-nums"
                />
              </div>
              {error && <FieldError className="text-right">{error}</FieldError>}
            </li>
          )
        })}
      </ul>
      <p
        role="status"
        className={cn(
          'text-sm',
          leftCents !== null && leftCents < 0 && 'font-medium text-destructive',
        )}
      >
        Asignado <span className="font-mono">{formatMoney(fromCents(allocatedCents))}</span>
        {leftCents !== null && (
          <>
            {' · '}
            {leftCents < 0 ? overLabel : leftLabel}{' '}
            <span className="font-mono">{formatMoney(fromCents(Math.abs(leftCents)))}</span>
          </>
        )}
      </p>
      {totalError && <FieldError>{totalError}</FieldError>}
    </div>
  )
}
