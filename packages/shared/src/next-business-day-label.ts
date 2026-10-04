import { addBusinessDays, toIsoDate } from './business-days.ts'

/** Nombres de los días en español y minúscula, indexados como `Date.getDay()` (0 = domingo).
 * Tabla propia y no `Intl`: el texto no depende de la configuración regional del entorno. */
const DAY_NAMES = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
] as const

/**
 * Rótulo de la vista «vencen_manana» (UX4-04): la vista cubre hasta el siguiente día hábil
 * (ADR 30), así que dice «mañana» solo cuando ese día es mañana y, si no (viernes, sábado),
 * nombra el día: «Vencen el lunes». `today` es `YYYY-MM-DD`.
 */
export function nextBusinessDayLabel(today: string): string {
  const start = new Date(`${today}T00:00:00`)
  const next = addBusinessDays(start, 1, [])
  const tomorrow = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
  if (toIsoDate(next) === toIsoDate(tomorrow)) return 'Vencen mañana'
  return `Vencen el ${DAY_NAMES[next.getDay()]}`
}
