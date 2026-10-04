import type { ReactNode } from 'react'

export type AlertChipTone = 'destructive' | 'amber'

/** Clases por tono; el texto es siempre el `children` que pasa cada sitio que lo usa
 * (conventions.md §5: nunca solo color). `amber` usa `--wax-amber-ink` como tinta, no
 * `--wax-amber`: ese último solo da 2,45:1 sobre `--card`, por debajo de AA (UX3-01,
 * verificado en `theme-tokens.test.ts`); el borde y el fondo siguen en `--wax-amber`. */
const TONE_CLASS: Record<AlertChipTone, string> = {
  destructive: 'border-destructive/40 bg-destructive/10 text-destructive',
  amber:
    'border-[color:var(--wax-amber)]/40 bg-[color:var(--wax-amber)]/10 text-[color:var(--wax-amber-ink)]',
}

/**
 * Chip de texto para una alerta puntual del trabajo ("Urgente", "Vence hoy", "Atrasado"):
 * mismo espíritu que `StatusChip` (texto + color, nunca solo color) pero para una señal
 * aparte del estado. Compartido entre `cases-table.tsx` (tarjeta móvil de la lista) y
 * `my-cases.tsx` ("Mis trabajos" del inicio del técnico) — ronda de fixes 1 de la Tarea 1
 * (UX3-01): antes cada pantalla repetía las mismas clases Tailwind por su cuenta.
 */
export function AlertChip({ tone, children }: { tone: AlertChipTone; children: ReactNode }) {
  return (
    <span className={`rounded-lg border px-2 py-0.5 text-xs font-medium ${TONE_CLASS[tone]}`}>
      {children}
    </span>
  )
}
