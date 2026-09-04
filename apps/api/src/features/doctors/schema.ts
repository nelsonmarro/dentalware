import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { clinics } from '../clinics/schema.ts'

export const doctors = pgTable(
  'doctors',
  {
    id: uuid().defaultRandom().primaryKey(),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    name: text().notNull(),
    phone: text(),
    email: text(),
    notes: text(),
    active: boolean().notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('doctors_clinic_id_idx').on(t.clinicId)],
)
