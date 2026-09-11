import { ALLOWED_MIME, isImage, MAX_UPLOAD_BYTES } from '../../lib/upload-policy.ts'
import type { IdGenerator } from '../../lib/ids.ts'
import type { RequestContext } from '../../lib/request-context.ts'
import type { Storage } from '../../lib/storage.ts'
import {
  AttachmentNotFoundError,
  CaseNotFoundError,
  FileTooLargeError,
  UnsupportedFileError,
} from './errors.ts'
import type {
  AttachmentRecord,
  AttachmentsRepository,
  CaseEventLog,
  CasesQuery,
  ImageProcessor,
  OpenedFile,
  UploadInput,
} from './ports.ts'

const PDF_MAGIC = Buffer.from('%PDF-')

/** Limpia el nombre de archivo para mostrarlo en la UI y para Content-Disposition. */
export const safeName = (n: string) =>
  n.replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ ]/g, '_').slice(0, 120) || 'archivo'
/** Variante solo-ASCII del nombre, para el parámetro `filename` (RFC 6266) de Content-Disposition. */
export const asciiSafeName = (n: string) => n.replace(/[^\x20-\x7E]/g, '_')

export function createAttachmentsService(deps: {
  attachments: AttachmentsRepository
  cases: CasesQuery
  events: CaseEventLog
  storage: Storage
  images: ImageProcessor
  ids: IdGenerator
}) {
  const mustGetAttachment = async (id: string) => {
    const found = await deps.attachments.byId(id)
    if (!found) throw new AttachmentNotFoundError()
    return found
  }

  return {
    list(caseId: string): Promise<AttachmentRecord[]> {
      return deps.attachments.byCase(caseId)
    },

    /**
     * Reproduce el flujo previo de la ruta: comprobar trabajo, tamaño, MIME permitido,
     * normalizar imagen (o validar la firma del PDF), guardar original + miniatura y
     * registrar el evento `attachment_added`.
     */
    async upload(input: UploadInput, ctx: RequestContext): Promise<AttachmentRecord> {
      if (!(await deps.cases.exists(input.caseId))) throw new CaseNotFoundError()
      if (input.size > MAX_UPLOAD_BYTES) {
        throw new FileTooLargeError('El archivo supera los 25 MB')
      }
      if (!(ALLOWED_MIME as readonly string[]).includes(input.mime)) {
        throw new UnsupportedFileError('Solo se admiten imágenes JPEG, PNG, WebP o PDF')
      }

      const id = deps.ids.next()
      let data = input.bytes
      let mime = input.mime
      let width: number | null = null
      let height: number | null = null
      let thumbPath: string | null = null
      let ext = 'pdf'

      if (isImage(input.mime)) {
        let img: { data: Uint8Array; width: number; height: number }
        try {
          img = await deps.images.normalize(input.bytes)
        } catch {
          throw new UnsupportedFileError('El archivo no es una imagen válida')
        }
        data = img.data
        width = img.width
        height = img.height
        mime = 'image/jpeg'
        ext = 'jpg'
        thumbPath = `${input.caseId}/${id}.thumb.webp`
        await deps.storage.put(thumbPath, await deps.images.thumbnail(input.bytes))
      } else if (input.mime === 'application/pdf') {
        if (!Buffer.from(input.bytes.subarray(0, PDF_MAGIC.length)).equals(PDF_MAGIC)) {
          throw new UnsupportedFileError('El archivo no es un PDF válido')
        }
      }

      const storagePath = `${input.caseId}/${id}.${ext}`
      await deps.storage.put(storagePath, data)

      const row = await deps.attachments.insert({
        id,
        caseId: input.caseId,
        kind: input.kind ?? (isImage(input.mime) ? 'photo' : 'document'),
        filename: safeName(input.filename),
        mime,
        size: data.byteLength,
        width,
        height,
        storagePath,
        thumbPath,
        uploadedBy: ctx.userId,
      })
      await deps.events.add({
        caseId: input.caseId,
        type: 'attachment_added',
        toValue: row.filename,
        actorId: ctx.userId,
      })
      return row
    },

    async open(id: string): Promise<OpenedFile> {
      const a = await mustGetAttachment(id)
      return { stream: await deps.storage.open(a.storagePath), mime: a.mime, filename: a.filename }
    },

    async openThumbnail(id: string): Promise<OpenedFile> {
      const a = await mustGetAttachment(id)
      if (!a.thumbPath) throw new AttachmentNotFoundError('Sin miniatura')
      return {
        stream: await deps.storage.open(a.thumbPath),
        mime: 'image/webp',
        filename: a.filename,
      }
    },

    async remove(id: string, ctx: RequestContext): Promise<void> {
      const a = await mustGetAttachment(id)
      await deps.attachments.remove(a.id)
      await deps.storage.remove(a.storagePath)
      if (a.thumbPath) await deps.storage.remove(a.thumbPath)
      await deps.events.add({
        caseId: a.caseId,
        type: 'attachment_removed',
        fromValue: a.filename,
        actorId: ctx.userId,
      })
    },
  }
}
export type AttachmentsService = ReturnType<typeof createAttachmentsService>
