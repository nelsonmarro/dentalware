import type { CaseStatus } from './case-status.ts'
import { percentOfCents } from './money.ts'

/**
 * Reglas puras de cuentas y cobro (Iteración 5, CTA-1/2/3/5). Todo en centavos (`money.ts`):
 * la API y la web convierten desde y hacia la cadena decimal `"12.34"`. Las decisiones que
 * se citan son las del plan `docs/superpowers/plans/2026-10-06-iteracion-5-cuentas.md`.
 */

export const PAYMENT_METHODS = ['efectivo', 'transferencia', 'tarjeta', 'cheque', 'otro'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/** Rótulo de cada método de pago. `Record` exhaustivo: un método nuevo no compila sin rótulo. */
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  cheque: 'Cheque',
  otro: 'Otro',
}

/** Tipos de movimiento de la cuenta de una clínica (CTA-1/5): el cargo de un trabajo entregado,
 * un ajuste (CTA-3) y un pago (CTA-2). */
export const ACCOUNT_MOVEMENT_KINDS = ['cargo', 'ajuste', 'pago'] as const
export type AccountMovementKind = (typeof ACCOUNT_MOVEMENT_KINDS)[number]

/** Rótulo de cada tipo de movimiento. `Record` exhaustivo: un tipo nuevo no compila sin rótulo. */
export const ACCOUNT_MOVEMENT_KIND_LABEL: Record<AccountMovementKind, string> = {
  cargo: 'Cargo',
  ajuste: 'Ajuste',
  pago: 'Pago',
}

/** Cubos de antigüedad de la deuda, por días desde la fecha de cada partida (decisión 9). */
export const AGING_BUCKETS = ['0_30', '31_60', '61_90', '90_mas'] as const
export type AgingBucket = (typeof AGING_BUCKETS)[number]

export const AGING_BUCKET_LABEL: Record<AgingBucket, string> = {
  '0_30': '0–30 días',
  '31_60': '31–60 días',
  '61_90': '61–90 días',
  '90_mas': 'Más de 90 días',
}

/** Estados en los que un trabajo carga a la cuenta de su clínica (decisión 10): entregado, y
 * cobrado cuando lo asignado ya lo cubre. Antes de entregarlo no hay cargo. */
export const BILLED_STATUSES = ['entregado', 'cobrado'] as const satisfies readonly CaseStatus[]

export function isBilled(status: CaseStatus): boolean {
  return (BILLED_STATUSES as readonly CaseStatus[]).includes(status)
}

/** La cuenta de un trabajo en su ficha (Iteración 5): solo para `ACCOUNTS_ROLES` y solo si
 * está entregado o cobrado. Montos en cadena decimal; `adjustments` y `outstanding` con signo. */
export type CaseAccount = {
  charge: string
  adjustments: string
  allocated: string
  outstanding: string
  /** Timestamp ISO (UTC) de cuando quedó cobrado; `null` si no lo está. */
  paidAt: string | null
}

/** Cargo del trabajo en centavos (decisión 4): su `total`, o `total × remake_charge_pct / 100`
 * si es una repetición (`remakeChargePct` no nulo), con el redondeo de `percentOfCents`. */
export function caseChargeCents(c: { totalCents: number; remakeChargePct: number | null }): number {
  return c.remakeChargePct === null ? c.totalCents : percentOfCents(c.totalCents, c.remakeChargePct)
}

/** Pendiente de un trabajo (decisiones 1 y 4): neto (cargo + Σ ajustes del trabajo) − Σ
 * asignaciones vigentes. Puede ser negativo si un descuento supera el cargo. */
export function caseOutstandingCents(
  chargeCents: number,
  adjustmentsCents: number,
  allocatedCents: number,
): number {
  return chargeCents + adjustmentsCents - allocatedCents
}

/** ¿Está cubierto el trabajo? (decisión 5): pendiente ≤ 0. Única regla para pasar
 * `entregado → cobrado` y para devolverlo de `cobrado` a `entregado`. */
export function isSettled(outstandingCents: number): boolean {
  return outstandingCents <= 0
}

/** Reparto sugerido de un pago (decisión 8): de la entrega más antigua a la más nueva
 * (`deliveredAt`; a igualdad, por código), sin pasar del pendiente de cada trabajo ni del monto.
 * Lo que sobra queda sin asignar (saldo a favor). No toca la lista que recibe. */
export function suggestAllocation(
  amountCents: number,
  open: readonly { caseId: string; code: string; deliveredAt: string; outstandingCents: number }[],
): { caseId: string; amountCents: number }[] {
  const ordered = [...open].sort(
    (a, b) => a.deliveredAt.localeCompare(b.deliveredAt) || a.code.localeCompare(b.code),
  )
  const result: { caseId: string; amountCents: number }[] = []
  let left = amountCents
  for (const c of ordered) {
    if (left <= 0) break
    const take = Math.min(left, c.outstandingCents)
    if (take <= 0) continue
    result.push({ caseId: c.caseId, amountCents: take })
    left -= take
  }
  return result
}

/**
 * Lo que un ajuste libera de las asignaciones de un trabajo (Nelson, 2026-10-08): si lo
 * asignado supera su neto (p. ej. un descuento sobre un trabajo ya pagado entero), el exceso
 * vuelve a los pagos, de la asignación más reciente a la más antigua (`createdAt`; a igual
 * fecha, la que llega después es la más reciente). Ninguna queda en negativo: con el neto en 0
 * o menos, se libera todo. Devuelve solo las asignaciones que cambian, con lo que liberan y lo
 * que les queda (0 = se borra). `allocations` son las vigentes (de pagos no anulados).
 */
export function releaseExcess(
  netCents: number,
  allocations: readonly { id: string; amountCents: number; createdAt: Date }[],
): { id: string; releasedCents: number; leftCents: number }[] {
  // Con el neto negativo, el exceso supera lo asignado y se libera todo: ninguna asignación
  // libera más que su monto.
  let excess = allocations.reduce((sum, a) => sum + a.amountCents, 0) - netCents
  const newestFirst = allocations
    .map((a, i) => ({ a, i }))
    .sort((x, y) => y.a.createdAt.getTime() - x.a.createdAt.getTime() || y.i - x.i)
  const result: { id: string; releasedCents: number; leftCents: number }[] = []
  for (const { a } of newestFirst) {
    if (excess <= 0) break
    const released = Math.min(excess, a.amountCents)
    result.push({ id: a.id, releasedCents: released, leftCents: a.amountCents - released })
    excess -= released
  }
  return result
}

const DAY_MS = 86_400_000

function utcDay(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  return Date.UTC(y!, m! - 1, d!)
}

/** Días de calendario de `from` a `to`, ambas fechas de negocio `YYYY-MM-DD`. */
export function daysBetween(from: string, to: string): number {
  return Math.round((utcDay(to) - utcDay(from)) / DAY_MS)
}

function bucketFor(days: number): AgingBucket {
  if (days <= 30) return '0_30'
  if (days <= 60) return '31_60'
  if (days <= 90) return '61_90'
  return '90_mas'
}

type AgingInput = {
  today: string
  charges: readonly { date: string; cents: number }[]
  credits: readonly { cents: number }[]
}

/** Las partidas que siguen pendientes tras descontar lo que resta de la más antigua a la más
 * nueva (decisión 9), de la más antigua a la más nueva. Una sola regla para `agingBuckets` y
 * `oldestOpenDays`: las partidas sin monto positivo no cuentan. */
function openCharges(input: AgingInput): { date: string; cents: number }[] {
  let credit = input.credits.reduce((sum, c) => sum + c.cents, 0)
  const oldestFirst = input.charges
    .filter((c) => c.cents > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
  const open: { date: string; cents: number }[] = []
  for (const charge of oldestFirst) {
    const used = Math.min(Math.max(credit, 0), charge.cents)
    credit -= used
    const left = charge.cents - used
    if (left > 0) open.push({ date: charge.date, cents: left })
  }
  return open
}

/** Antigüedad de la deuda a `today` (decisión 9), en centavos por cubo. `charges` son las
 * partidas que suman (pendiente de cada trabajo entregado por su fecha de entrega y ajustes sin
 * trabajo positivos por su fecha); `credits`, lo que resta (ajustes sin trabajo negativos, en
 * positivo, y el saldo a favor). Lo que resta se descuenta de la partida más antigua a la más
 * nueva; si supera lo que suma, todo queda en cero. Ningún cubo es negativo: las partidas sin
 * monto positivo no cuentan, y una fecha posterior a `today` cae en 0–30. */
export function agingBuckets(input: AgingInput): Record<AgingBucket, number> {
  const buckets: Record<AgingBucket, number> = { '0_30': 0, '31_60': 0, '61_90': 0, '90_mas': 0 }
  for (const charge of openCharges(input)) {
    buckets[bucketFor(daysBetween(charge.date, input.today))] += charge.cents
  }
  return buckets
}

/** Cuántos días tiene vencido (CTA-1): los de la partida pendiente más antigua tras descontar
 * lo que resta, con las mismas reglas que `agingBuckets`; `null` si no queda nada pendiente.
 * Nunca negativo: una fecha posterior a `today` cuenta 0. */
export function oldestOpenDays(input: AgingInput): number | null {
  const [oldest] = openCharges(input)
  return oldest ? Math.max(0, daysBetween(oldest.date, input.today)) : null
}
