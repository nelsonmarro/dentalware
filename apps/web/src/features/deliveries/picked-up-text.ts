import { pickedUpLine, toIsoDate } from '@dentalware/shared'
import { formatTimestampDayMonth, formatTimestampTime } from '@/features/cases/date-format'

/**
 * «Recogido por Luis a las 10:32» si se recogió hoy, o «Recogido por Luis el 04/10 a las 10:32»
 * si fue otro día (M-4 de la revisión final de #118): lo que sigue en camino desde ayer no se
 * lee como de hoy. Día y hora locales; `today` es `AAAA-MM-DD` local. Una sola fuente para la
 * tarjeta de «Entregas» y la ficha completa.
 */
export function pickedUpText(courierName: string, doneAt: string, today: string): string {
  const sameDay = toIsoDate(new Date(doneAt)) === today
  return pickedUpLine(
    courierName,
    formatTimestampTime(doneAt),
    sameDay ? null : formatTimestampDayMonth(doneAt),
  )
}
