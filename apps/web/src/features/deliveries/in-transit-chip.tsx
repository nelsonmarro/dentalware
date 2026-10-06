import { IN_TRANSIT_TO_LAB } from '@dentalware/shared'
import { Truck } from 'lucide-react'
import type { CSSProperties } from 'react'
import { IN_TRANSIT_COLOR } from './delivery-colors'

/** Chip «En camino al laboratorio» (#118): la recogida está hecha y el trabajo aún no llegó.
 * Icono y texto, nunca solo color. */
export function InTransitChip() {
  return (
    <span
      style={{ '--chip': IN_TRANSIT_COLOR } as CSSProperties}
      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[color:var(--chip)]/40 bg-[color:var(--chip)]/10 px-2 py-0.5 text-xs font-medium text-[color:var(--chip)]"
    >
      <Truck aria-hidden className="size-3.5" />
      {IN_TRANSIT_TO_LAB}
    </span>
  )
}
