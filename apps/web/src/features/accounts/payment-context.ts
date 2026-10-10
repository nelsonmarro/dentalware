import {
  fromCents,
  PAYMENT_METHOD_LABEL,
  toSignedCents,
  type PaymentMethod,
} from '@dentalware/shared'
import { formatDate } from '@/features/cases/date-format'
import { formatMoney } from '@/lib/format-money'

/** Lo que los diálogos de un pago necesitan de su movimiento: `amount` con signo (resta) y
 * `remaining`, lo que le queda a favor. */
export type PaymentRef = {
  id: string
  date: string
  amount: string
  method: PaymentMethod
  remaining: string
}

/** Sobre qué pago actúa el diálogo (`context` de `FormDialog`, UX4-12): el monto en monoespaciada
 * y «Transferencia del 05/10/2026 · Clínica Sur». */
export function paymentContext(payment: PaymentRef, clinicName: string) {
  return {
    code: formatMoney(fromCents(Math.abs(toSignedCents(payment.amount)))),
    label: `${PAYMENT_METHOD_LABEL[payment.method]} del ${formatDate(payment.date)} · ${clinicName}`,
  }
}
