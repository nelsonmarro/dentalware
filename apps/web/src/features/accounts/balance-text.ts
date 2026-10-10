import { fromCents, toSignedCents } from '@dentalware/shared'
import { formatMoney } from '@/lib/format-money'

/** Cómo se lee un saldo: lo que debe la clínica, nada, o saldo a favor (negativo). */
export type BalanceKind = 'debe' | 'cero' | 'a_favor'

/** El saldo partido para pintarlo: su tipo y el monto ya formateado, siempre en positivo. */
export function balanceParts(balance: string): { kind: BalanceKind; amount: string } {
  const cents = toSignedCents(balance)
  if (cents < 0) return { kind: 'a_favor', amount: formatMoney(fromCents(-cents)) }
  return { kind: cents === 0 ? 'cero' : 'debe', amount: formatMoney(balance) }
}

/** El saldo en texto (CTA-1): «$ 12.34» si la clínica debe y «A favor $ 12.34» si el saldo es
 * negativo, con texto y no solo color. */
export function balanceText(balance: string): string {
  const { kind, amount } = balanceParts(balance)
  return kind === 'a_favor' ? `A favor ${amount}` : amount
}

/** El efecto de un movimiento en el saldo (CTA-2/3): «+ $ 90.00» si suma (cargo, recargo),
 * «− $ 50.00» si resta (pago, descuento) y «$ 0.00» sin efecto. Signo con texto, no solo color. */
export function signedAmountText(amount: string): string {
  const cents = toSignedCents(amount)
  if (cents === 0) return formatMoney(amount)
  return `${cents < 0 ? '−' : '+'} ${formatMoney(fromCents(Math.abs(cents)))}`
}
