import {
  boolean,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { PRICING_UNITS } from '@dentalware/shared'
import { clinics } from '../clinics/schema.ts'

export const pricingUnitEnum = pgEnum('pricing_unit', PRICING_UNITS)

export const productCategories = pgTable('product_categories', {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  sort: integer().notNull().default(0),
  active: boolean().notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const products = pgTable('products', {
  id: uuid().defaultRandom().primaryKey(),
  code: text().notNull().unique(),
  name: text().notNull(),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => productCategories.id),
  pricingUnit: pricingUnitEnum('pricing_unit').notNull(),
  basePrice: numeric('base_price', { precision: 10, scale: 2 }).notNull(),
  turnaroundDays: integer('turnaround_days').notNull().default(5),
  requiresTryIn: boolean('requires_try_in').notNull().default(false),
  active: boolean().notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const clinicProductPrices = pgTable(
  'clinic_product_prices',
  {
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    price: numeric({ precision: 10, scale: 2 }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.clinicId, t.productId] })],
)
