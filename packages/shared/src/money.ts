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

/** quantity × unit × (1 − discount%) en centavos, redondeo half-up. */
export function lineTotalCents(unitCents: number, quantity: number, discountPct: number): number {
  const gross = unitCents * quantity
  const factor = 1 - discountPct / 100
  return Math.floor(gross * factor + 0.5)
}

export function sumCents(list: readonly number[]): number {
  return list.reduce((a, b) => a + b, 0)
}
