import { PAYMENT_METHODS } from '@dentalware/shared'
import { sql } from 'drizzle-orm'
import {
  check,
  date,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from '../../db/schema/auth.ts'
import { cases } from '../cases/schema.ts'
import { clinics } from '../clinics/schema.ts'

export const paymentMethodEnum = pgEnum('payment_method', PAYMENT_METHODS)

/**
 * Ajuste de la cuenta de una clínica (CTA-3), con signo: positivo suma a lo que debe y negativo
 * resta. Ligado a un trabajo cambia su neto (decisión 1 del plan de la Iteración 5); sin trabajo
 * (p. ej. «Saldo inicial») solo mueve el saldo de la clínica.
 */
export const accountAdjustments = pgTable(
  'account_adjustments',
  {
    id: uuid().defaultRandom().primaryKey(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    caseId: uuid('case_id').references(() => cases.id),
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    reason: text().notNull(),
    date: date({ mode: 'string' }).notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('account_adjustments_clinic_idx').on(t.clinicId),
    index('account_adjustments_case_idx').on(t.caseId),
    check('account_adjustments_amount_check', sql`${t.amount} <> 0`),
  ],
)

/**
 * Pago de una clínica (CTA-2). No se edita ni se borra: se anula (`voided_*`, solo admin y con
 * motivo; decisión 2). Lo que no asigna queda a favor de la clínica (decisión 3).
 */
export const payments = pgTable(
  'payments',
  {
    id: uuid().defaultRandom().primaryKey(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    method: paymentMethodEnum().notNull(),
    paidOn: date('paid_on', { mode: 'string' }).notNull(),
    reference: text(),
    notes: text(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidedBy: text('voided_by').references(() => users.id),
    voidReason: text('void_reason'),
  },
  (t) => [
    index('payments_clinic_idx').on(t.clinicId),
    check('payments_amount_check', sql`${t.amount} > 0`),
  ],
)

/** Parte de un pago asignada a un trabajo entregado. Al anular el pago deja de contar, sin borrarse. */
export const paymentAllocations = pgTable(
  'payment_allocations',
  {
    id: uuid().defaultRandom().primaryKey(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id),
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('payment_allocations_payment_idx').on(t.paymentId),
    index('payment_allocations_case_idx').on(t.caseId),
    check('payment_allocations_amount_check', sql`${t.amount} > 0`),
  ],
)
