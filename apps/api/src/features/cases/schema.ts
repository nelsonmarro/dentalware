import type { Checklist } from '@dentalware/shared'
import {
  CASE_EVENT_TYPES,
  CASE_PRIORITIES,
  CASE_STATUSES,
  PATIENT_SEXES,
  SHADE_SYSTEMS,
} from '@dentalware/shared'
import { sql } from 'drizzle-orm'
import {
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { clinics } from '../clinics/schema.ts'
import { doctors } from '../doctors/schema.ts'
import { products } from '../products/schema.ts'
import { stages } from '../stages/schema.ts'
import { users } from '../../db/schema/auth.ts'

export const caseStatusEnum = pgEnum('case_status', CASE_STATUSES)
export const casePriorityEnum = pgEnum('case_priority', CASE_PRIORITIES)
export const patientSexEnum = pgEnum('patient_sex', PATIENT_SEXES)
export const shadeSystemEnum = pgEnum('shade_system', SHADE_SYSTEMS)
export const caseEventTypeEnum = pgEnum('case_event_type', CASE_EVENT_TYPES)

/** Secuencia por año para el código AA-NNNNN; se incrementa con upsert atómico. */
export const caseSequences = pgTable('case_sequences', {
  year: integer().primaryKey(),
  last: integer().notNull().default(0),
})

export const cases = pgTable(
  'cases',
  {
    id: uuid().defaultRandom().primaryKey(),
    code: text().notNull().unique(),
    boxNumber: text('box_number'),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    doctorId: uuid('doctor_id')
      .notNull()
      .references(() => doctors.id),
    patientRef: text('patient_ref').notNull(),
    patientAge: integer('patient_age'),
    patientSex: patientSexEnum('patient_sex'),
    status: caseStatusEnum().notNull().default('nuevo'),
    currentStageId: uuid('current_stage_id').references(() => stages.id),
    assignedTechnicianId: text('assigned_technician_id').references(() => users.id),
    priority: casePriorityEnum().notNull().default('normal'),
    receivedAt: date('received_at').notNull(),
    dueDate: date('due_date'),
    promisedDate: date('promised_date'),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    shippedAt: timestamp('shipped_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    shade: text(),
    shadeSystem: shadeSystemEnum('shade_system'),
    reference: text(),
    checklist: jsonb()
      .$type<Checklist>()
      .notNull()
      .default(sql`'{"antagonista":false,"mordida":false,"color":false,"fotos":false}'::jsonb`),
    observations: text(),
    prescription: text(),
    internalNotes: text('internal_notes'),
    holdReason: text('hold_reason'),
    parentCaseId: uuid('parent_case_id'),
    remakeReason: text('remake_reason'),
    remakeResponsibility: text('remake_responsibility'),
    remakeChargePct: numeric('remake_charge_pct', { precision: 5, scale: 2 }),
    total: numeric({ precision: 12, scale: 2 }).notNull().default('0.00'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('cases_status_idx').on(t.status),
    index('cases_clinic_idx').on(t.clinicId),
    index('cases_due_idx').on(t.promisedDate, t.dueDate),
  ],
)

export const caseItems = pgTable(
  'case_items',
  {
    id: uuid().defaultRandom().primaryKey(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    description: text(),
    quantity: integer().notNull().default(1),
    teeth: integer()
      .array()
      .notNull()
      .default(sql`'{}'::integer[]`),
    unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
    discountPct: numeric('discount_pct', { precision: 5, scale: 2 }).notNull().default('0.00'),
    lineTotal: numeric('line_total', { precision: 12, scale: 2 }).notNull(),
    material: text(),
    notes: text(),
    sort: integer().notNull().default(0),
  },
  (t) => [index('case_items_case_idx').on(t.caseId)],
)

export const caseEvents = pgTable(
  'case_events',
  {
    id: uuid().defaultRandom().primaryKey(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    type: caseEventTypeEnum().notNull(),
    fromValue: text('from_value'),
    toValue: text('to_value'),
    reason: text(),
    actorId: text('actor_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('case_events_case_idx').on(t.caseId, t.createdAt)],
)
