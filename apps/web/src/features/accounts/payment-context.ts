import {
  fromCents,
  PAYMENT_METHOD_LABEL,
  paymentToApply,
  toSignedCents,
  type PaymentMethod,
} from '@dentalware/shared'
import { formatDate } from '@/features/cases/date-format'
import { formatMoney } from '@/lib/format-money'
import type { ClinicAccount } from './api'
import type { AppliedCase } from './applied-cases'

type Movement = ClinicAccount['movements'][number]

/** Lo que los diálogos de un pago necesitan de su movimiento: `amount` con signo (resta),
 * `remaining`, lo que le queda a favor, y `allocations`, a qué trabajos se aplicó (UX5-03). */
export type PaymentRef = {
  id: string
  date: string
  amount: string
  method: PaymentMethod
  remaining: string
  allocations: readonly AppliedCase[]
}

/** Sobre qué pago actúa el diálogo (`context` de `FormDialog`, UX4-12): el monto en monoespaciada
 * y «Transferencia del 05/10/2026 · Clínica Sur». */
export function paymentContext(payment: PaymentRef, clinicName: string) {
  return {
    code: formatMoney(fromCents(Math.abs(toSignedCents(payment.amount)))),
    label: `${PAYMENT_METHOD_LABEL[payment.method]} del ${formatDate(payment.date)} · ${clinicName}`,
  }
}

/** El pago de un movimiento, si lo es y está vigente: lo que necesitan sus acciones. */
export function livePayment(m: Movement): PaymentRef | null {
  if (m.kind !== 'pago' || m.voided || !m.method) return null
  return {
    id: m.id,
    date: m.date,
    amount: m.amount,
    method: m.method,
    remaining: m.remaining ?? '0.00',
    allocations: m.allocations ?? [],
  }
}

/** El pago que aplica «Aplicar saldo a favor» de la cabecera (UX5-01): el vigente más antiguo
 * con algo a favor (`paymentToApply` de shared); `null` si no hay. */
export function creditPayment(movements: readonly Movement[]): PaymentRef | null {
  const chosen = paymentToApply(
    movements
      .filter((m) => m.kind === 'pago')
      .map((m) => ({
        m,
        id: m.id,
        date: m.date,
        remainingCents: toSignedCents(m.remaining ?? '0'),
        voided: m.voided !== null,
      })),
  )
  return chosen ? livePayment(chosen.m) : null
}
