import { eq } from 'drizzle-orm'
import type { Db } from '../../db/index.ts'
import type { AttachmentsQuery } from '../cases/ports.ts'
import { AttachmentInUseError } from './errors.ts'
import type { AttachmentsRepository } from './ports.ts'
import { attachments } from './schema.ts'

/** `foreign_key_violation` de Postgres; Drizzle envuelve el error de `pg` en `cause`. */
const isForeignKeyViolation = (e: unknown): boolean =>
  e instanceof Error &&
  typeof e.cause === 'object' &&
  e.cause !== null &&
  'code' in e.cause &&
  e.cause.code === '23503'

/**
 * Repositorio de adjuntos: cumple `AttachmentsRepository` (su propio puerto) y también
 * `AttachmentsQuery` de `cases` (`hasDocument`, `constancia`), que se inyecta en la raíz de composición
 * sin que ninguna de las dos features importe el adaptador de la otra.
 */
export function createAttachmentsRepo(db: Db) {
  const byId = (id: string) =>
    db.query.attachments.findFirst({
      where: { id },
      with: { uploader: { columns: { id: true, name: true } } },
    })

  return {
    async insert(row) {
      const [a] = await db.insert(attachments).values(row).returning()
      return (await byId(a!.id))!
    },
    byId,
    byCase: (caseId) =>
      db.query.attachments.findMany({
        where: { caseId },
        orderBy: { createdAt: 'asc' },
        with: { uploader: { columns: { id: true, name: true } } },
      }),
    async remove(id) {
      try {
        await db.delete(attachments).where(eq(attachments.id, id))
      } catch (e) {
        // Solo `deliveries.proof_attachment_id` referencia un adjunto, con `ON DELETE RESTRICT`:
        // la constancia la ligó una entrega entre la comprobación del servicio y este DELETE.
        if (isForeignKeyViolation(e)) throw new AttachmentInUseError()
        throw e
      }
    },
    async hasDocument(caseId) {
      const found = await db.query.attachments.findFirst({
        where: { caseId, kind: 'document' },
        columns: { id: true },
      })
      return found !== undefined
    },
    // Solo si el adjunto es de `caseId` (ENT-4): una constancia de otro trabajo no existe aquí.
    constancia: (caseId, attachmentId) =>
      db.query.attachments.findFirst({
        where: { id: attachmentId, caseId },
        columns: { mime: true, kind: true },
      }),
  } satisfies AttachmentsRepository & AttachmentsQuery
}
