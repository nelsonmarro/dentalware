import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const labSettings = pgTable('lab_settings', {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  ruc: text(),
  address: text(),
  phone: text(),
  logoUrl: text('logo_url'),
  codePrefix: text('code_prefix'),
  ivaPct: integer('iva_pct').notNull().default(15),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
