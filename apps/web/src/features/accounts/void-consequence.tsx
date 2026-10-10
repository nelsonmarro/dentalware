import { Fragment } from 'react'
import { formatMoney } from '@/lib/format-money'
import type { AppliedCase } from './applied-cases'
import { listParts } from './list-parts'

/**
 * Qué le pasa a cada trabajo al anular un pago (UX5-03), con lo que da la API: «Se quita lo
 * aplicado a 26-00101 ($ 50.00) y 26-00107 ($ 30.00).» y, de esos, los que hoy están cobrados y
 * dejarían de estarlo (`reopens`, la misma regla `isSettled` que aplica la anulación): «Vuelve a
 * «Entregado»: 26-00101.». Sin asignaciones vigentes: «No estaba aplicado a ningún trabajo.».
 */
export function VoidConsequence({ cases }: { cases: readonly AppliedCase[] }) {
  if (cases.length === 0) {
    return <p className="text-sm">No estaba aplicado a ningún trabajo.</p>
  }
  const reopened = cases.filter((c) => c.reopens)
  return (
    <div className="flex flex-col gap-1 rounded-md border bg-muted/40 p-3 text-sm">
      <p>
        Se quita lo aplicado a{' '}
        {listParts(cases).map((part, i) =>
          typeof part === 'string' ? (
            <Fragment key={`sep-${i}`}>{part}</Fragment>
          ) : (
            <span key={part.caseId} className="whitespace-nowrap">
              <span className="font-mono">{part.code}</span> (
              <span className="font-mono tabular-nums">{formatMoney(part.amount)}</span>)
            </span>
          ),
        )}
        .
      </p>
      {reopened.length > 0 && (
        <p className="font-medium">
          {reopened.length === 1 ? 'Vuelve' : 'Vuelven'} a «Entregado»:{' '}
          {listParts(reopened).map((part, i) =>
            typeof part === 'string' ? (
              <Fragment key={`sep-${i}`}>{part}</Fragment>
            ) : (
              <span key={part.caseId} className="font-mono">
                {part.code}
              </span>
            ),
          )}
          .
        </p>
      )}
    </div>
  )
}
