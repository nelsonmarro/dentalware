import type { CaseStatus, PaymentMethod } from '@dentalware/shared'

/**
 * Puertos de lectura de cuentas (CTA-1, Iteración 5). El cargo de un trabajo no tiene tabla: se
 * deriva del trabajo entregado (decisión 4 del plan), que el repo lee de `cases` por join de
 * solo lectura (ADR 24). Los ajustes, pagos y asignaciones son de esta feature. Todo en
 * centavos: el repo convierte desde `numeric` y el servicio devuelve la cadena decimal.
 */

/** Trabajo `entregado` o `cobrado` de una clínica, con lo que hace falta para su pendiente. */
export type BilledCase = {
  id: string
  clinicId: string
  code: string
  patientRef: string
  status: CaseStatus
  /** Fecha de entrega (`delivered_at`); la de su última modificación si faltara, que por la
   * API no ocurre: «Marcar entregado» siempre la fija. */
  deliveredAt: Date
  totalCents: number
  remakeChargePct: number | null
  /** Σ ajustes ligados al trabajo, con signo (decisión 1). */
  adjustmentsCents: number
  /** Σ asignaciones de pagos vigentes (las de un pago anulado no cuentan, decisión 2). */
  allocatedCents: number
}

/** Ajuste de la cuenta (CTA-3), con signo, ligado o no a un trabajo. */
export type AdjustmentEntry = {
  id: string
  clinicId: string
  case: { id: string; code: string } | null
  amountCents: number
  reason: string
  date: string // YYYY-MM-DD
  createdAt: Date
  createdByName: string
}

/** Pago de una clínica (CTA-2), vigente o anulado. */
export type PaymentEntry = {
  id: string
  clinicId: string
  amountCents: number
  /** Σ de sus asignaciones; lo que falta hasta `amountCents` es saldo a favor si está vigente. */
  allocatedCents: number
  method: PaymentMethod
  paidOn: string // YYYY-MM-DD
  reference: string | null
  notes: string | null
  createdAt: Date
  createdByName: string
  voided: { at: Date; byName: string; reason: string } | null
}

export type ClinicRef = { id: string; name: string; active: boolean }

/** Los datos de la clínica para el encabezado del estado de cuenta (CTA-5). */
export type ClinicHeader = {
  id: string
  name: string
  ruc: string | null
  address: string | null
  city: string | null
  phone: string | null
}

/** Una asignación de un pago a un trabajo (de cualquier pago, vigente o anulado). */
export type PaymentAllocation = { paymentId: string; caseId: string; amountCents: number }

/** Pago nuevo (CTA-2): lo registra quien está en sesión. */
export type NewPayment = {
  clinicId: string
  amountCents: number
  method: PaymentMethod
  paidOn: string // YYYY-MM-DD
  reference: string | null
  notes: string | null
  createdBy: string
}

/** Ajuste nuevo (CTA-3): lo registra el administrador en sesión. */
export type NewAdjustment = {
  clinicId: string
  caseId: string | null
  amountCents: number
  reason: string
  date: string // YYYY-MM-DD
  createdBy: string
}

/** Un pago bloqueado (`FOR NO KEY UPDATE`) para asignar lo que le queda o anularlo. */
export type LockedPayment = {
  id: string
  clinicId: string
  amountCents: number
  method: PaymentMethod
  reference: string | null
  voided: boolean
}

/** Lo que mueve el pendiente de un trabajo y es de esta feature: Σ ajustes del trabajo y Σ
 * asignaciones de pagos vigentes (decisiones 1, 2 y 4). */
export type CaseAccountTotals = { caseId: string; adjustmentsCents: number; allocatedCents: number }

/** Una asignación vigente (de un pago no anulado) a un trabajo. */
export type LiveAllocation = {
  id: string
  paymentId: string
  amountCents: number
  createdAt: Date
}

/** Lectura y escritura de las cuentas. Sin `clinicId`, de todas las clínicas (la lista de
 * «Cuentas»). Las escrituras solo se llaman dentro de `AccountsUnitOfWork.run`. */
export interface AccountsRepository {
  clinicById(id: string): Promise<ClinicRef | undefined>
  clinics(): Promise<ClinicRef[]>
  clinicHeader(id: string): Promise<ClinicHeader | undefined>
  billedCases(clinicId?: string): Promise<BilledCase[]>
  adjustments(clinicId?: string): Promise<AdjustmentEntry[]>
  payments(clinicId?: string): Promise<PaymentEntry[]>
  paymentById(id: string): Promise<PaymentEntry | undefined>
  /** Asignaciones de los pagos de la clínica, vigentes y anuladas, sin orden garantizado: el
   * estado de cuenta (CTA-5) suma las de los pagos vigentes con fecha hasta su corte. */
  allocations(clinicId: string): Promise<PaymentAllocation[]>
  adjustmentById(id: string): Promise<AdjustmentEntry | undefined>
  /** Σ ajustes y Σ asignaciones vigentes de cada trabajo pedido (0 si no tiene). */
  caseTotals(caseIds: readonly string[]): Promise<CaseAccountTotals[]>
  createPayment(p: NewPayment): Promise<{ id: string }>
  createAdjustment(a: NewAdjustment): Promise<{ id: string }>
  /** Bloquea el pago hasta el fin de la transacción: dos asignaciones de su saldo a favor, o
   * una asignación y su anulación, no se cruzan. */
  lockPayment(id: string): Promise<LockedPayment | undefined>
  /** Asignaciones del pago (todas: la anulación las deja sin borrar), sin orden garantizado:
   * quien las usa suma por trabajo. */
  allocationsOf(paymentId: string): Promise<{ caseId: string; amountCents: number }[]>
  addAllocations(
    paymentId: string,
    allocations: readonly { caseId: string; amountCents: number }[],
    createdBy: string,
  ): Promise<void>
  voidPayment(id: string, v: { at: Date; by: string; reason: string }): Promise<void>
  /** Asignaciones vigentes del trabajo (las de pagos anulados no), sin orden garantizado:
   * `releaseExcess` de shared las ordena por `createdAt`. */
  liveAllocationsOf(caseId: string): Promise<LiveAllocation[]>
  /** Deja la asignación en `amountCents` (lo liberado vuelve a su pago como saldo a favor);
   * con 0, borra la fila (el CHECK `amount > 0` sigue valiendo). */
  shrinkAllocation(id: string, amountCents: number): Promise<void>
}

/** Un trabajo bloqueado para cobrarlo, con lo que hace falta para su cargo (decisión 4). */
export type SettlementCase = {
  id: string
  clinicId: string
  status: CaseStatus
  totalCents: number
  remakeChargePct: number | null
  deliveredAt: Date | null
}

/**
 * Puerto de escritura sobre `cases` (ADR 35, patrón de ADR 34): `accounts` cambia el estado del
 * trabajo (`entregado ⇄ cobrado`) y escribe sus eventos sin importar nada de `cases/`. Lo cumple
 * el repo de `cases` sobre la misma `tx` del `AccountsUnitOfWork` (`app.ts`).
 */
export interface CaseSettlement {
  /** Bloquea los trabajos (`FOR NO KEY UPDATE`, en orden de id) hasta el fin de la transacción
   * y los devuelve: dos pagos al mismo trabajo leen su pendiente uno después del otro. Los que
   * no existen no vienen. */
  lockCases(caseIds: readonly string[]): Promise<SettlementCase[]>
  /** `paidAt` no nulo: `entregado → cobrado` con `paid_at`; nulo: `cobrado → entregado` sin
   * él. Escribe `status_changed`. Nada si el trabajo no está en el estado de partida. */
  setPaid(caseId: string, paidAt: Date | null, actorId: string): Promise<void>
  addEvent(e: {
    caseId: string
    type: 'payment_applied' | 'payment_voided' | 'adjustment_added'
    /** Monto en cadena decimal (con signo en el ajuste). */
    toValue: string
    /** Método y referencia del pago, o el motivo. */
    reason: string | null
    actorId: string
  }): Promise<void>
}

/** Atomicidad de pagos, asignaciones, anulaciones y ajustes (ADR 19): las escrituras de la cuenta y las
 * del trabajo en una sola transacción. */
export interface AccountsUnitOfWork {
  run<T>(fn: (r: { accounts: AccountsRepository; cases: CaseSettlement }) => Promise<T>): Promise<T>
}
