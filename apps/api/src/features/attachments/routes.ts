import { ATTACHMENT_KINDS, idParamSchema } from '@dentalware/shared'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import { stream } from 'hono/streaming'
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import { z } from 'zod'
import type { Db } from '../../db/index.ts'
import {
  ALLOWED_MIME,
  isImage,
  makeThumbnail,
  MAX_UPLOAD_BYTES,
  normalizeImage,
} from '../../lib/images.ts'
import type { Storage } from '../../lib/storage.ts'
import { validate } from '../../lib/validate.ts'
import type { AppEnv } from '../auth/session.ts'
import { requireAuth, requireRole } from '../auth/session.ts'
import { addEvent, getCase } from '../cases/repo.ts'
import {
  deleteAttachment,
  getAttachment,
  insertAttachment,
  listAttachments,
  toDto,
} from './repo.ts'

const caseParam = z.object({ caseId: z.uuid({ error: 'Identificador inválido' }) })
const PDF_MAGIC = Buffer.from('%PDF-')

/** Limpia el nombre de archivo para Content-Disposition y para mostrarlo en la UI. */
const safeName = (n: string) => n.replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ ]/g, '_').slice(0, 120) || 'archivo'
/** Variante solo-ASCII del nombre, para el parámetro `filename` (RFC 6266) de Content-Disposition. */
const asciiSafeName = (n: string) => n.replace(/[^\x20-\x7E]/g, '_')

export const attachmentsRoutes = (db: Db, storage: Storage) =>
  new Hono<AppEnv>()
    .use(requireAuth)
    .get('/trabajo/:caseId', validate('param', caseParam), async (c) =>
      c.json(
        { attachments: (await listAttachments(db, c.req.valid('param').caseId)).map(toDto) },
        200,
      ),
    )
    .post(
      '/trabajo/:caseId',
      bodyLimit({
        maxSize: MAX_UPLOAD_BYTES + 1024 * 1024,
        onError: (c) => c.json({ message: 'El archivo supera los 25 MB' }, 413),
      }),
      validate('param', caseParam),
      async (c) => {
        const { caseId } = c.req.valid('param')
        if (!(await getCase(db, caseId)))
          throw new HTTPException(404, { message: 'El trabajo no existe' })

        const body = await c.req.parseBody()
        const file = body['file']
        if (!(file instanceof File)) {
          return c.json(
            {
              message: 'Datos inválidos',
              issues: [{ path: 'file', message: 'Adjunta un archivo' }],
            },
            422,
          )
        }
        if (file.size > MAX_UPLOAD_BYTES) {
          throw new HTTPException(413, { message: 'El archivo supera los 25 MB' })
        }
        if (!(ALLOWED_MIME as readonly string[]).includes(file.type)) {
          throw new HTTPException(415, {
            message: 'Solo se admiten imágenes JPEG, PNG, WebP o PDF',
          })
        }

        const requestedKind =
          typeof body['kind'] === 'string' &&
          (ATTACHMENT_KINDS as readonly string[]).includes(body['kind'])
            ? (body['kind'] as (typeof ATTACHMENT_KINDS)[number])
            : null

        const raw = new Uint8Array(await file.arrayBuffer())
        const id = randomUUID()
        let data: Uint8Array = raw
        let mime = file.type
        let width: number | null = null
        let height: number | null = null
        let thumbPath: string | null = null
        let ext = 'pdf'

        if (isImage(file.type)) {
          let img: Awaited<ReturnType<typeof normalizeImage>>
          try {
            img = await normalizeImage(raw)
          } catch {
            throw new HTTPException(415, { message: 'El archivo no es una imagen válida' })
          }
          data = img.data
          width = img.width
          height = img.height
          mime = 'image/jpeg'
          ext = 'jpg'
          thumbPath = `${caseId}/${id}.thumb.webp`
          await storage.put(thumbPath, await makeThumbnail(raw))
        } else if (file.type === 'application/pdf') {
          if (!Buffer.from(raw.subarray(0, PDF_MAGIC.length)).equals(PDF_MAGIC)) {
            throw new HTTPException(415, { message: 'El archivo no es un PDF válido' })
          }
        }

        const storagePath = `${caseId}/${id}.${ext}`
        await storage.put(storagePath, data)

        const user = c.var.user!
        const row = await insertAttachment(db, {
          id,
          caseId,
          kind: requestedKind ?? (isImage(file.type) ? 'photo' : 'document'),
          filename: safeName(file.name),
          mime,
          size: data.byteLength,
          width,
          height,
          storagePath,
          thumbPath,
          uploadedBy: user.id,
        })
        await addEvent(db, {
          caseId,
          type: 'attachment_added',
          toValue: row.filename,
          actorId: user.id,
        })
        return c.json(
          { attachment: toDto({ ...row, uploader: { id: user.id, name: user.name } }) },
          201,
        )
      },
    )
    .get('/:id', validate('param', idParamSchema), async (c) => {
      const a = await getAttachment(db, c.req.valid('param').id)
      if (!a) throw new HTTPException(404, { message: 'El adjunto no existe' })
      c.header('Content-Type', a.mime)
      c.header(
        'Content-Disposition',
        `inline; filename="${asciiSafeName(a.filename)}"; filename*=UTF-8''${encodeURIComponent(a.filename)}`,
      )
      c.header('Cache-Control', 'private, max-age=86400')
      const readable = await storage.open(a.storagePath)
      return stream(c, (s) => s.pipe(Readable.toWeb(readable) as ReadableStream))
    })
    .get('/:id/miniatura', validate('param', idParamSchema), async (c) => {
      const a = await getAttachment(db, c.req.valid('param').id)
      if (!a?.thumbPath) throw new HTTPException(404, { message: 'Sin miniatura' })
      c.header('Content-Type', 'image/webp')
      c.header('Cache-Control', 'private, max-age=86400')
      const readable = await storage.open(a.thumbPath)
      return stream(c, (s) => s.pipe(Readable.toWeb(readable) as ReadableStream))
    })
    .delete(
      '/:id',
      requireRole('admin', 'recepcion'),
      validate('param', idParamSchema),
      async (c) => {
        const a = await getAttachment(db, c.req.valid('param').id)
        if (!a) throw new HTTPException(404, { message: 'El adjunto no existe' })
        await deleteAttachment(db, a.id)
        await storage.remove(a.storagePath)
        if (a.thumbPath) await storage.remove(a.thumbPath)
        await addEvent(db, {
          caseId: a.caseId,
          type: 'attachment_removed',
          fromValue: a.filename,
          actorId: c.var.user!.id,
        })
        return c.body(null, 204)
      },
    )
