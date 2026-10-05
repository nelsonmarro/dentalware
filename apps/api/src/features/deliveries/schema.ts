import { DELIVERY_STATUSES, DELIVERY_TYPES } from '@dentalware/shared'
import { sql } from 'drizzle-orm'
import {
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from '../../db/schema/auth.ts'
import { attachments } from '../attachments/schema.ts'
import { cases } from '../cases/schema.ts'

export const deliveryTypeEnum = pgEnum('delivery_type', DELIVERY_TYPES)
export const deliveryStatusEnum = pgEnum('delivery_status', DELIVERY_STATUSES)

export const deliveries = pgTable(
  'deliveries',
  {
    id: uuid().primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    type: deliveryTypeEnum().notNull(),
    status: deliveryStatusEnum().notNull().default('pendiente'),
    // Mismo tipo de columna y FK que `cases.assignedTechnicianId`: Better Auth no genera
    // ids UUID (ruling de la Tarea 1), así que `courier_id` es `text`, no `uuid`.
    courierId: text('courier_id')
      .notNull()
      .references(() => users.id),
    scheduledFor: date('scheduled_for', { mode: 'string' }).notNull(),
    // También es el momento en que se cerró una entrega `fallida` (antes de reprogramar), no
    // solo cuándo se completó una `hecha`: `markFailed` y `markDone` escriben aquí.
    doneAt: timestamp('done_at', { withTimezone: true }),
    // RESTRICT: la constancia de una entrega no se borra (UX4-06). El servicio de adjuntos ya lo
    // comprueba antes; la FK cierra la carrera con «Marcar entregado» y el repo la traduce a 409.
    proofAttachmentId: uuid('proof_attachment_id').references(() => attachments.id, {
      onDelete: 'restrict',
    }),
    failedReason: text('failed_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('deliveries_day_idx').on(t.scheduledFor, t.status),
    index('deliveries_case_idx').on(t.caseId),
    // Como mucho una pendiente por trabajo y tipo (integridad de `pendingFor`).
    uniqueIndex('deliveries_one_pending_idx')
      .on(t.caseId, t.type)
      .where(sql`${t.status} = 'pendiente'`),
  ],
)
