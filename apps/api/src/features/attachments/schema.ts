import { ATTACHMENT_KINDS } from '@dentalware/shared'
import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from '../../db/schema/auth.ts'
import { cases } from '../cases/schema.ts'

export const attachmentKindEnum = pgEnum('attachment_kind', ATTACHMENT_KINDS)

export const attachments = pgTable(
  'attachments',
  {
    id: uuid().defaultRandom().primaryKey(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    kind: attachmentKindEnum().notNull(),
    filename: text().notNull(),
    mime: text().notNull(),
    size: integer().notNull(),
    width: integer(),
    height: integer(),
    storagePath: text('storage_path').notNull(),
    thumbPath: text('thumb_path'),
    uploadedBy: text('uploaded_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('attachments_case_idx').on(t.caseId)],
)
