import type { AttachmentKind } from '@dentalware/shared'
import { eq } from 'drizzle-orm'
import type { Db } from '../../db/index.ts'
import { attachments } from './schema.ts'

export type NewAttachment = {
  id: string
  caseId: string
  kind: AttachmentKind
  filename: string
  mime: string
  size: number
  width: number | null
  height: number | null
  storagePath: string
  thumbPath: string | null
  uploadedBy: string
}

export function insertAttachment(db: Db, row: NewAttachment) {
  return db
    .insert(attachments)
    .values(row)
    .returning()
    .then(([a]) => a!)
}

export function listAttachments(db: Db, caseId: string) {
  return db.query.attachments.findMany({
    where: { caseId },
    orderBy: { createdAt: 'asc' },
    with: { uploader: { columns: { id: true, name: true } } },
  })
}

export function getAttachment(db: Db, id: string) {
  return db.query.attachments.findFirst({
    where: { id },
    with: { uploader: { columns: { id: true, name: true } } },
  })
}

export async function deleteAttachment(db: Db, id: string) {
  await db.delete(attachments).where(eq(attachments.id, id))
}

type AttachmentRow = {
  id: string
  caseId: string
  kind: AttachmentKind
  filename: string
  mime: string
  size: number
  width: number | null
  height: number | null
  thumbPath: string | null
  createdAt: Date
  uploader: { id: string; name: string } | null
}

export function toDto(a: AttachmentRow) {
  return {
    id: a.id,
    caseId: a.caseId,
    kind: a.kind,
    filename: a.filename,
    mime: a.mime,
    size: a.size,
    width: a.width,
    height: a.height,
    createdAt: a.createdAt,
    uploadedBy: a.uploader,
    url: `/api/adjuntos/${a.id}`,
    thumbUrl: a.thumbPath ? `/api/adjuntos/${a.id}/miniatura` : null,
  }
}
