export function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isWeekend(d: Date): boolean {
  const day = d.getDay()
  return day === 0 || day === 6
}

/**
 * Suma `days` días hábiles a `start`, contando desde el día siguiente.
 * Salta sábados, domingos y las fechas de `holidays` (YYYY-MM-DD).
 */
export function addBusinessDays(start: Date, days: number, holidays: readonly string[] = []): Date {
  if (days < 0) throw new Error('días debe ser >= 0')
  const holidaySet = new Set(holidays)
  const current = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  let remaining = days
  while (remaining > 0) {
    current.setDate(current.getDate() + 1)
    if (isWeekend(current) || holidaySet.has(toIsoDate(current))) continue
    remaining -= 1
  }
  return current
}
