import { isoDate } from '@dentalware/shared'

/** Formatea una fecha ISO (`AAAA-MM-DD`) a `dd/mm/aaaa`; `null` → `—`. */
export function formatDate(date: string | null): string {
  if (!date) return '—'
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

const LONG_DATE = new Intl.DateTimeFormat('es-EC', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/** Una fecha de negocio (`AAAA-MM-DD`) escrita en español, «Lunes, 1 de junio de 2026» (UX5-08):
 * va bajo los campos de fecha, que Chrome pinta como dd/mm o mm/dd según el idioma de su
 * interfaz. Se formatea en UTC porque la fecha no tiene hora: así el día no se corre con la zona.
 * Sin una fecha completa y real (el campo a medio escribir), `null`. */
export function formatLongDate(date: string | undefined): string | null {
  if (!date || !isoDate.safeParse(date).success) return null
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  const text = LONG_DATE.format(new Date(Date.UTC(year, month - 1, day)))
  return text.charAt(0).toUpperCase() + text.slice(1)
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

/** Día y mes **locales** (`dd/mm`) de un timestamp UTC (M-4 de #118: «Recogido por Luis el
 * 04/10 a las 10:32»). `timeZone` solo en tests. */
export function formatTimestampDayMonth(timestamp: string, timeZone?: string): string {
  // `Intl` en `es-EC` quita el cero del día cuando no hay año («4/10»): se arma con las partes.
  const parts = new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
  }).formatToParts(new Date(timestamp))
  const part = (type: 'day' | 'month') =>
    (parts.find((p) => p.type === type)?.value ?? '').padStart(2, '0')
  return `${part('day')}/${part('month')}`
}

/** El día de algo programado, para insertarlo en una frase (UX4-07/09): «hoy» o «el dd/mm/aaaa»
 * («Entregar hoy en …», «Sale el 09/10/2026 con …»). `today` es `AAAA-MM-DD` local. */
export function dayPhrase(date: string, today: string): string {
  return date === today ? 'hoy' : `el ${formatDate(date)}`
}
