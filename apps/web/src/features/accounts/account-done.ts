import { toSignedCents } from '@dentalware/shared'
import { formatMoney } from '@/lib/format-money'

/** Un trabajo que cerró el pago, tal como lo devuelve la API (`settled`, UX5-04). */
type SettledRef = { code: string }

const list = new Intl.ListFormat('es', { type: 'conjunction' })

/** «cobrado 26-00101», «cobrados 26-00101, 26-00102 y 26-00103»; `null` si no cerró ninguno. */
function settledText(settled: readonly SettledRef[]): string | null {
  if (settled.length === 0) return null
  const codes = list.format(settled.map((c) => c.code))
  return settled.length === 1 ? `cobrado ${codes}` : `cobrados ${codes}`
}

/** Aviso de «Registrar pago»: los trabajos que cerró la API y lo que quedó a favor. */
export function paymentDoneText(settled: readonly SettledRef[], credit: string): string {
  const closed = settledText(settled)
  const head = closed ? `Pago registrado: ${closed}` : 'Pago registrado'
  return toSignedCents(credit) > 0 ? `${head} · ${formatMoney(credit)} a favor` : head
}

/** Aviso de «Aplicar saldo a favor»: los trabajos que cerró la API. */
export function creditDoneText(settled: readonly SettledRef[]): string {
  const closed = settledText(settled)
  return closed ? `Saldo a favor aplicado: ${closed}` : 'Saldo a favor aplicado'
}

/** Aviso de «Registrar ajuste»: si un descuento devolvió algo a los pagos, lo dice. */
export function adjustmentDoneText(released: string): string {
  return toSignedCents(released) > 0
    ? `Ajuste registrado: ${formatMoney(released)} vuelven al saldo a favor`
    : 'Ajuste registrado'
}
