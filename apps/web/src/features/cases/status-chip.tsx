import type { CaseStatus } from '@dentalware/shared'
import type { CSSProperties } from 'react'

export const STATUS_LABEL: Record<CaseStatus, string> = {
  nuevo: 'Nuevo',
  en_proceso: 'En proceso',
  en_espera: 'En espera',
  en_prueba: 'En prueba',
  terminado: 'Terminado',
  enviado: 'Enviado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

/** Colores del spec §5 (chip + texto, nunca solo color). */
export const STATUS_COLOR: Record<CaseStatus, string> = {
  nuevo: '#0F766E',
  en_proceso: '#0F766E',
  en_espera: '#D99A16',
  en_prueba: '#7C5CBF',
  terminado: '#8CC9A6',
  enviado: '#2F6FB0',
  entregado: '#2F8F5B',
  cancelado: '#D6453D',
}

export function StatusChip({ status }: { status: CaseStatus }) {
  return (
    <span
      data-status={status}
      style={{ '--chip': STATUS_COLOR[status] } as CSSProperties}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--chip)]/40 bg-[color:var(--chip)]/10 px-2 py-0.5 text-xs font-medium text-[color:var(--chip)]"
    >
      <span aria-hidden className="size-1.5 rounded-full bg-[color:var(--chip)]" />
      {STATUS_LABEL[status]}
    </span>
  )
}
