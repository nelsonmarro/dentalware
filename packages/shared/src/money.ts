const MONEY = /^\d{1,10}(\.\d{1,2})?$/

export function toCents(value: string): number {
  if (!MONEY.test(value)) throw new Error(`Monto inválido: ${value}`)
  const [int, dec = ''] = value.split('.')
  return Number(int) * 100 + Number((dec + '00').slice(0, 2))
}

export function fromCents(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) throw new Error(`Centavos inválidos: ${cents}`)
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

/** Centavos de lo que alguien escribe en un campo de monto: admite coma decimal y espacios
 * alrededor; `null` si no es un monto sin signo con hasta 2 decimales (vacío incluido). */
export function parseMoneyInput(text: string): number | null {
  const value = text.trim().replace(',', '.')
  return MONEY.test(value) ? toCents(value) : null
}

/** Como `toCents`, admitiendo un `-` delante: montos con signo (ajustes, saldos). */
export function toSignedCents(value: string): number {
  return value.startsWith('-') ? -toCents(value.slice(1)) : toCents(value)
}

/** Como `fromCents`, admitiendo centavos negativos: `-1250` → `"-12.50"`. */
export function fromSignedCents(cents: number): string {
  return cents < 0 ? `-${fromCents(-cents)}` : fromCents(cents)
}

/** quantity × unit × (1 − discount%) en centavos, redondeo half-up. */
export function lineTotalCents(unitCents: number, quantity: number, discountPct: number): number {
  const gross = unitCents * quantity
  const factor = 1 - discountPct / 100
  return Math.floor(gross * factor + 0.5)
}

export function sumCents(list: readonly number[]): number {
  return list.reduce((a, b) => a + b, 0)
}

/** `pct` % de un monto en centavos (pct entero 0–100), redondeo half-up, todo en enteros. */
export function percentOfCents(cents: number, pct: number): number {
  return Math.floor((cents * pct + 50) / 100)
}
