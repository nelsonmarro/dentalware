/** «95 días», «1 día»; `—` si no hay (no debe nada). */
export function daysText(days: number | null): string {
  if (days === null) return '—'
  return days === 1 ? '1 día' : `${days} días`
}
