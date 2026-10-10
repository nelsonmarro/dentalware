import { toSignedCents } from '@dentalware/shared'
import { formatMoney } from '@/lib/format-money'

/** «1 trabajo cobrado», «2 trabajos cobrados». */
function settledText(settled: number): string {
  return settled === 1 ? '1 trabajo cobrado' : `${settled} trabajos cobrados`
}

/** Aviso de «Registrar pago»: cuántos trabajos cerró y cuánto quedó a favor. */
export function paymentDoneText(settled: number, credit: string): string {
  const parts = [
    settled > 0 ? settledText(settled) : null,
    toSignedCents(credit) > 0 ? `${formatMoney(credit)} a favor` : null,
  ].filter(Boolean)
  return parts.length === 0 ? 'Pago registrado' : `Pago registrado: ${parts.join(' y ')}`
}

/** Aviso de «Aplicar saldo a favor». */
export function creditDoneText(settled: number): string {
  return settled > 0 ? `Saldo a favor aplicado: ${settledText(settled)}` : 'Saldo a favor aplicado'
}

/** Aviso de «Registrar ajuste»: si un descuento devolvió algo a los pagos, lo dice. */
export function adjustmentDoneText(released: string): string {
  return toSignedCents(released) > 0
    ? `Ajuste registrado: ${formatMoney(released)} vuelven al saldo a favor`
    : 'Ajuste registrado'
}
