import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const clinics = pgTable('clinics', {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  ruc: text(),
  address: text(),
  city: text(),
  phone: text(),
  whatsapp: text(),
  email: text(),
  paymentTermsDays: integer('payment_terms_days').notNull().default(0),
  notes: text(),
  active: boolean().notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
