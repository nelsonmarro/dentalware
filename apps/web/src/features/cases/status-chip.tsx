import { CASE_STATUS_LABEL, type CaseStatus } from '@dentalware/shared'
import type { CSSProperties } from 'react'

/**
 * Colores del spec §5 (chip + texto, nunca solo color). Cada color cumple contraste
 * AA (>= 4.5:1) como texto sobre el fondo real del chip (`bg-[color]/10` sobre
 * `--card`), no solo entre sí — ver `status-chip.test.tsx`. `cancelado` reutiliza el
 * token `--destructive` en vez de un rojo propio, para no duplicar la decisión de
 * contraste de UX1-02.
 */
export const STATUS_COLOR: Record<CaseStatus, string> = {
  // Spec §6 pide #6B7C93 (gris pizarra), pero ese tono mezclado al 10 % sobre `--card` blanco
  // da 3.8:1 de contraste (`status-chip.test.tsx`), por debajo del 4.5:1 AA que exige esta
  // misma prueba para cada estado. Se oscurece a #52606D (mismo tono, 5.6:1) — desviación de
  // la Tarea 1 de la Iteración 4, documentada en el reporte de la tarea.
  por_recoger: '#52606D',
  nuevo: '#0F766E',
  en_proceso: '#0F766E',
  en_espera: '#89610E',
  en_prueba: '#7655BC',
  terminado: '#367350',
  enviado: '#2D6BAA',
  entregado: '#27764B',
  // Spec §5: `--graphite`, el color del texto principal (`--foreground`). Iteración 5.
  cobrado: '#1E2A2D',
  cancelado: '#B3261E',
}

export function StatusChip({ status }: { status: CaseStatus }) {
  return (
    <span
      data-status={status}
      style={{ '--chip': STATUS_COLOR[status] } as CSSProperties}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[color:var(--chip)]/40 bg-[color:var(--chip)]/10 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-[color:var(--chip)]"
    >
      <span aria-hidden className="size-1.5 rounded-full bg-[color:var(--chip)]" />
      {CASE_STATUS_LABEL[status]}
    </span>
  )
}
