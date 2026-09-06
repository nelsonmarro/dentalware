import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const stages = pgTable('stages', {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  color: text().notNull().default('#0F766E'),
  sort: integer().notNull().default(0),
  active: boolean().notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
