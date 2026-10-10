import { fromCents } from '@dentalware/shared'
import { FieldError } from '@/components/ui/field'
import { formatMoney } from '@/lib/format-money'
import { cn } from '@/lib/utils'

/**
 * Lo aplicado del reparto y lo que queda, en vivo (`role="status"`), con el error del total
 * debajo. Va en el pie fijo del diálogo (`FormDialog` `summary`, UX5-06): se ve mientras se
 * edita cualquier fila, aunque la lista se desplace.
 */
export function AllocationSummary({
  allocatedCents,
  leftCents,
  leftLabel,
  overLabel,
  error,
}: {
  allocatedCents: number
  /** Lo que queda sin aplicar; `null` si aún no hay monto del que repartir. */
  leftCents: number | null
  /** «Queda a favor» / «Sigue a favor». */
  leftLabel: string
  /** «Supera el pago en» / «Supera lo disponible en». */
  overLabel: string
  error?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <p
        role="status"
        className={cn(
          'text-sm',
          leftCents !== null && leftCents < 0 && 'font-medium text-destructive',
        )}
      >
        Aplicado <span className="font-mono">{formatMoney(fromCents(allocatedCents))}</span>
        {leftCents !== null && (
          <>
            {' · '}
            {leftCents < 0 ? overLabel : leftLabel}{' '}
            <span className="font-mono">{formatMoney(fromCents(Math.abs(leftCents)))}</span>
          </>
        )}
      </p>
      {error && <FieldError>{error}</FieldError>}
    </div>
  )
}
