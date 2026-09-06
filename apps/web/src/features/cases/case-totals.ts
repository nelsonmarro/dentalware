import { fromCents, lineTotalCents, sumCents, toCents } from '@dentalware/shared'

export type TotalsItem = { unitPrice: string | null; quantity: number; discountPct: number }

/** Total por línea (cantidad × precio unitario × (1 − descuento %)) y total del trabajo.
 * Una línea sin precio (`unitPrice: null`, por ejemplo mientras el producto no tiene
 * precio resuelto) cuenta como `'0.00'` en vez de romper el cálculo. */
export function computeTotals(items: readonly TotalsItem[]): { lines: string[]; total: string } {
  const cents = items.map((item) =>
    item.unitPrice === null
      ? 0
      : lineTotalCents(toCents(item.unitPrice), item.quantity, item.discountPct),
  )
  return { lines: cents.map(fromCents), total: fromCents(sumCents(cents)) }
}
