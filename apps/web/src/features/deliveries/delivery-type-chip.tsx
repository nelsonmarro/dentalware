import { DELIVERY_TYPE_LABEL, type DeliveryType } from '@dentalware/shared'
import { PackageCheck, PackageOpen } from 'lucide-react'
import type { CSSProperties } from 'react'
import { DELIVERY_TYPE_COLOR } from './delivery-colors'

const TYPE_ICON: Record<DeliveryType, typeof PackageOpen> = {
  recogida: PackageOpen,
  entrega: PackageCheck,
}

/** Chip del tipo de una entrega («Recogida» / «Entrega»): icono y texto, nunca solo color. */
export function DeliveryTypeChip({ type }: { type: DeliveryType }) {
  const Icon = TYPE_ICON[type]
  return (
    <span
      style={{ '--chip': DELIVERY_TYPE_COLOR[type] } as CSSProperties}
      className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--chip)]/40 bg-[color:var(--chip)]/10 px-2 py-0.5 text-xs font-medium text-[color:var(--chip)]"
    >
      <Icon aria-hidden className="size-3.5" />
      {DELIVERY_TYPE_LABEL[type]}
    </span>
  )
}
