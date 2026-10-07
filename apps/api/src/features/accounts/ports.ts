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

/** Lectura de las cuentas. Sin `clinicId`, de todas las clínicas (la lista de «Cuentas»). */
export interface AccountsRepository {
  clinicById(id: string): Promise<ClinicRef | undefined>
  clinics(): Promise<ClinicRef[]>
  billedCases(clinicId?: string): Promise<BilledCase[]>
  adjustments(clinicId?: string): Promise<AdjustmentEntry[]>
  payments(clinicId?: string): Promise<PaymentEntry[]>
}
