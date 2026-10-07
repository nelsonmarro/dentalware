import { toCents, toSignedCents } from '@dentalware/shared'
import { and, eq, inArray, isNull, sql, type Column, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { Db, Tx } from '../../db/index.ts'
import { users } from '../../db/schema/auth.ts'
import { cases } from '../cases/schema.ts'
import { clinics } from '../clinics/schema.ts'
import type { AccountsRepository } from './ports.ts'
import { accountAdjustments, paymentAllocations, payments } from './schema.ts'

/** Estados cuyo trabajo carga a la cuenta (decisión 10 del plan de la Iteración 5). */
const BILLED_STATUSES = ['entregado', 'cobrado'] as const

/**
 * Lectura de cuentas: `createAccountsRepo(db | Tx) satisfies AccountsRepository`. Lee `cases`,
 * `clinics` y `users` por join de solo lectura (ADR 24); los ajustes, pagos y asignaciones son
 * de esta feature. Solo trae los datos: las sumas por trabajo y por pago son las únicas cuentas
 * en SQL, y el cargo, el pendiente, el saldo y la antigüedad los calcula el servicio con las
 * reglas de `shared`.
 */
export function createAccountsRepo(db: Db | Tx) {
  const byClinic = (column: Column, clinicId?: string): SQL | undefined =>
    clinicId === undefined ? undefined : eq(column, clinicId)

  return {
    async clinicById(id) {
      const [row] = await db
        .select({ id: clinics.id, name: clinics.name, active: clinics.active })
        .from(clinics)
        .where(eq(clinics.id, id))
        .limit(1)
      return row
    },

    async clinics() {
      return db.select({ id: clinics.id, name: clinics.name, active: clinics.active }).from(clinics)
    },

    async billedCases(clinicId) {
      // Σ ajustes del trabajo y Σ asignaciones de pagos vigentes (las de un pago anulado dejan
      // de contar sin borrarse, decisión 2), agrupadas por trabajo y unidas por `leftJoin`: una
      // fila por trabajo, sin N+1.
      const adj = db
        .select({
          caseId: accountAdjustments.caseId,
          cents: sql<string>`sum(${accountAdjustments.amount})`.as('adjustments_sum'),
        })
        .from(accountAdjustments)
        .groupBy(accountAdjustments.caseId)
        .as('case_adjustments')
      const alloc = db
        .select({
          caseId: paymentAllocations.caseId,
          cents: sql<string>`sum(${paymentAllocations.amount})`.as('allocated_sum'),
        })
        .from(paymentAllocations)
        .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
        .where(isNull(payments.voidedAt))
        .groupBy(paymentAllocations.caseId)
        .as('case_allocations')
      const adjustments = sql<string>`coalesce(${adj.cents}, 0)`
      const allocated = sql<string>`coalesce(${alloc.cents}, 0)`
      const rows = await db
        .select({
          id: cases.id,
          clinicId: cases.clinicId,
          code: cases.code,
          patientRef: cases.patientRef,
          status: cases.status,
          // «Marcar entregado» siempre fija `delivered_at`; si faltara (dato cargado a mano), la
          // última modificación, para que el cargo no quede sin fecha.
          deliveredAt: sql<Date>`coalesce(${cases.deliveredAt}, ${cases.updatedAt})`.mapWith(
            cases.deliveredAt,
          ),
          total: cases.total,
          remakeChargePct: cases.remakeChargePct,
          adjustments,
          allocated,
        })
        .from(cases)
        .leftJoin(adj, eq(adj.caseId, cases.id))
        .leftJoin(alloc, eq(alloc.caseId, cases.id))
        .where(and(inArray(cases.status, BILLED_STATUSES), byClinic(cases.clinicId, clinicId)))
      return rows.map((r) => ({
        id: r.id,
        clinicId: r.clinicId,
        code: r.code,
        patientRef: r.patientRef,
        status: r.status,
        deliveredAt: r.deliveredAt,
        totalCents: toCents(r.total),
        remakeChargePct: r.remakeChargePct === null ? null : Number(r.remakeChargePct),
        adjustmentsCents: toSignedCents(String(r.adjustments)),
        allocatedCents: toCents(String(r.allocated)),
      }))
    },

    async adjustments(clinicId) {
      const rows = await db
        .select({
          id: accountAdjustments.id,
          clinicId: accountAdjustments.clinicId,
          caseId: cases.id,
          caseCode: cases.code,
          amount: accountAdjustments.amount,
          reason: accountAdjustments.reason,
          date: accountAdjustments.date,
          createdAt: accountAdjustments.createdAt,
          createdByName: users.name,
        })
        .from(accountAdjustments)
        .innerJoin(users, eq(accountAdjustments.createdBy, users.id))
        .leftJoin(cases, eq(accountAdjustments.caseId, cases.id))
        .where(byClinic(accountAdjustments.clinicId, clinicId))
      return rows.map((r) => ({
        id: r.id,
        clinicId: r.clinicId,
        case: r.caseId !== null && r.caseCode !== null ? { id: r.caseId, code: r.caseCode } : null,
        amountCents: toSignedCents(r.amount),
        reason: r.reason,
        date: r.date,
        createdAt: r.createdAt,
        createdByName: r.createdByName,
      }))
    },

    async payments(clinicId) {
      const voider = alias(users, 'voider')
      // Σ de todas sus asignaciones: en un pago vigente, lo que falta hasta su monto es saldo
      // a favor (decisión 3); en uno anulado, lo que tenía repartido.
      const alloc = db
        .select({
          paymentId: paymentAllocations.paymentId,
          cents: sql<string>`sum(${paymentAllocations.amount})`.as('allocated_sum'),
        })
        .from(paymentAllocations)
        .groupBy(paymentAllocations.paymentId)
        .as('payment_allocated')
      const allocated = sql<string>`coalesce(${alloc.cents}, 0)`
      const rows = await db
        .select({
          id: payments.id,
          clinicId: payments.clinicId,
          amount: payments.amount,
          allocated,
          method: payments.method,
          paidOn: payments.paidOn,
          reference: payments.reference,
          notes: payments.notes,
          createdAt: payments.createdAt,
          createdByName: users.name,
          voidedAt: payments.voidedAt,
          voidedByName: voider.name,
          voidReason: payments.voidReason,
        })
        .from(payments)
        .innerJoin(users, eq(payments.createdBy, users.id))
        .leftJoin(voider, eq(payments.voidedBy, voider.id))
        .leftJoin(alloc, eq(alloc.paymentId, payments.id))
        .where(byClinic(payments.clinicId, clinicId))
      return rows.map((r) => ({
        id: r.id,
        clinicId: r.clinicId,
        amountCents: toCents(r.amount),
        allocatedCents: toCents(String(r.allocated)),
        method: r.method,
        paidOn: r.paidOn,
        reference: r.reference,
        notes: r.notes,
        createdAt: r.createdAt,
        createdByName: r.createdByName,
        // El servicio de anulación (Tarea 4) fija los tres campos a la vez.
        voided:
          r.voidedAt === null
            ? null
            : { at: r.voidedAt, byName: r.voidedByName ?? '', reason: r.voidReason ?? '' },
      }))
    },
  } satisfies AccountsRepository
}
