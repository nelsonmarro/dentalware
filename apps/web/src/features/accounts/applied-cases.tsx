import { Link } from '@tanstack/react-router'
import { Fragment } from 'react'
import { formatMoney } from '@/lib/format-money'
import type { ClinicAccount } from './api'
import { listParts } from './list-parts'

/** Lo que un pago vigente tiene asignado a cada trabajo, tal como lo da la API (UX5-03). */
export type AppliedCase = NonNullable<ClinicAccount['movements'][number]['allocations']>[number]

/**
 * «Aplicado a 26-00101 ($ 120.00), 26-00102 ($ 85.50) y 26-00107 ($ 45.00)» (UX5-03): a qué
 * trabajos se aplicó un pago, en el orden de la API (de la entrega más antigua a la más nueva).
 * Cada código lleva a la ficha del trabajo; código y monto, en monoespaciada. No es el
 * identificador de la fila, así que el enlace mide 44 px (36 solo con ratón en escritorio, la
 * tabla densa). Cada trabajo con su monto no se parte; la lista, sí. Sin asignaciones
 * vigentes no dice nada.
 */
export function AppliedCases({ cases }: { cases: readonly AppliedCase[] }) {
  if (cases.length === 0) return null
  return (
    // `whitespace-normal`: la celda de la tabla es `nowrap` y la lista, larga, debe partirse.
    <p className="text-sm break-words whitespace-normal">
      Aplicado a{' '}
      {listParts(cases).map((part, i) =>
        typeof part === 'string' ? (
          <Fragment key={`sep-${i}`}>{part}</Fragment>
        ) : (
          <span key={part.caseId} className="whitespace-nowrap">
            <Link
              to="/trabajos/$caseId"
              params={{ caseId: part.caseId }}
              className="inline-flex min-h-11 items-center font-mono text-primary hover:underline lg:pointer-fine:min-h-9"
            >
              {part.code}
            </Link>{' '}
            (<span className="font-mono tabular-nums">{formatMoney(part.amount)}</span>)
          </span>
        ),
      )}
    </p>
  )
}
