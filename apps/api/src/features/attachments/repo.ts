import { eq } from 'drizzle-orm'
import type { Db } from '../../db/index.ts'
import type { AttachmentsQuery } from '../cases/ports.ts'
import type { AttachmentsRepository } from './ports.ts'
import { attachments } from './schema.ts'

/**
 * Repositorio de adjuntos: cumple `AttachmentsRepository` (su propio puerto) y también
 * `AttachmentsQuery` de `cases` (`hasDocument`), que se inyecta en la raíz de composición
 * sin que ninguna de las dos features importe el adaptador de la otra.
 */
export function createAttachmentsRepo(db: Db): AttachmentsRepository & AttachmentsQuery {
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
      await db.delete(attachments).where(eq(attachments.id, id))
    },
    async hasDocument(caseId) {
      const found = await db.query.attachments.findFirst({
        where: { caseId, kind: 'document' },
        columns: { id: true },
      })
      return found !== undefined
    },
  } satisfies AttachmentsRepository & AttachmentsQuery
}
