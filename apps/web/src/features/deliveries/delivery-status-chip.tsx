import { DELIVERY_OUTCOME_LABEL, type DeliveryOutcome } from '@dentalware/shared'
import type { CSSProperties } from 'react'
import { DELIVERY_OUTCOME_COLOR } from './delivery-colors'

/** Chip de cómo terminó una entrega cerrada («Hecha», «Fallida» o «Anulada», UX4-17), con
 * texto: nunca solo color. */
export function DeliveryStatusChip({ outcome }: { outcome: DeliveryOutcome }) {
  return (
    <span
      style={{ '--chip': DELIVERY_OUTCOME_COLOR[outcome] } as CSSProperties}
      className="inline-flex shrink-0 items-center rounded-lg border border-[color:var(--chip)]/40 bg-[color:var(--chip)]/10 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-[color:var(--chip)]"
    >
      {DELIVERY_OUTCOME_LABEL[outcome]}
    </span>
  )
}
