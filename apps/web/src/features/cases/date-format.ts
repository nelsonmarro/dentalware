/** Formatea una fecha ISO (`AAAA-MM-DD`) a `dd/mm/aaaa`; `null` → `—`. */
export function formatDate(date: string | null): string {
  if (!date) return '—'
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

/** Fecha de calendario **local** (`dd/mm/aaaa`) de un timestamp UTC (`createdAt` de un evento).
 * No sirve cortar el ISO con `.slice(0, 10)`: eso da el día en UTC, y en Ecuador (UTC−5) algo
 * que pasó a las 19:30 del día 10 saldría como del 11 (N-2 de la re-revisión de la ola).
 * `timeZone` solo se pasa en tests; en la app manda la zona del navegador. */
export function formatTimestampDate(timestamp: string, timeZone?: string): string {
  return new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone,
  }).format(new Date(timestamp))
}

/** Hora **local** en 24 h (`HH:MM`) de un timestamp UTC (#118: «Recogido por Luis a las 10:32»).
 * Mismo criterio que `formatTimestampDate`: `timeZone` solo en tests. */
export function formatTimestampTime(timestamp: string, timeZone?: string): string {
  return new Intl.DateTimeFormat('es-EC', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(new Date(timestamp))
}

/** El día de algo programado, para insertarlo en una frase (UX4-07/09): «hoy» o «el dd/mm/aaaa»
 * («Entregar hoy en …», «Sale el 09/10/2026 con …»). `today` es `AAAA-MM-DD` local. */
export function dayPhrase(date: string, today: string): string {
  return date === today ? 'hoy' : `el ${formatDate(date)}`
}
