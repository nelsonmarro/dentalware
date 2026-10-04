import { DELIVERY_STATUS_LABEL, type DeliveryStatus } from '@dentalware/shared'
import type { CSSProperties } from 'react'
import { DELIVERY_CLOSED_COLOR } from './delivery-colors'

/** Chip del estado de una entrega cerrada («Hecha» / «Fallida»), con texto. */
export function DeliveryStatusChip({ status }: { status: Exclude<DeliveryStatus, 'pendiente'> }) {
  return (
    <span
      style={{ '--chip': DELIVERY_CLOSED_COLOR[status] } as CSSProperties}
      className="inline-flex items-center rounded-lg border border-[color:var(--chip)]/40 bg-[color:var(--chip)]/10 px-2 py-0.5 text-xs font-medium text-[color:var(--chip)]"
    >
      {DELIVERY_STATUS_LABEL[status]}
    </span>
  )
}
