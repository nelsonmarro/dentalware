import { ATTACHMENT_KINDS, idParamSchema } from '@dentalware/shared'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import { stream } from 'hono/streaming'
import { Readable } from 'node:stream'
import { z } from 'zod'
import { MAX_UPLOAD_BYTES } from '../../lib/images.ts'
import { validate } from '../../lib/validate.ts'
import type { AppEnv } from '../auth/session.ts'
import { ctxFrom, requireAuth, requireRole } from '../auth/session.ts'
import {
  AttachmentNotFoundError,
  CaseNotFoundError,
  FileTooLargeError,
  UnsupportedFileError,
} from './errors.ts'
import type { AttachmentRecord } from './ports.ts'
import { asciiSafeName } from './service.ts'
import type { AttachmentsService } from './service.ts'

const caseParam = z.object({ caseId: z.uuid({ error: 'Identificador inválido' }) })

/** Traduce los errores de dominio del servicio a la respuesta HTTP que espera la web. */
function toHttp(e: unknown): never {
  if (e instanceof CaseNotFoundError) throw new HTTPException(404, { message: e.message })
  if (e instanceof AttachmentNotFoundError) throw new HTTPException(404, { message: e.message })
  if (e instanceof FileTooLargeError) throw new HTTPException(413, { message: e.message })
  if (e instanceof UnsupportedFileError) throw new HTTPException(415, { message: e.message })
  throw e
}

/** Serializa un `AttachmentRecord` al DTO que consume la web (contrato de la ruta HTTP). */
function toDto(a: AttachmentRecord) {
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

export const attachmentsRoutes = (service: AttachmentsService) =>
  new Hono<AppEnv>()
    .use(requireAuth)
    .get('/trabajo/:caseId', validate('param', caseParam), async (c) =>
      c.json({ attachments: (await service.list(c.req.valid('param').caseId)).map(toDto) }, 200),
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
        const requestedKind =
          typeof body['kind'] === 'string' &&
          (ATTACHMENT_KINDS as readonly string[]).includes(body['kind'])
            ? (body['kind'] as (typeof ATTACHMENT_KINDS)[number])
            : null

        try {
          const row = await service.upload(
            {
              caseId,
              filename: file.name,
              mime: file.type,
              size: file.size,
              bytes: new Uint8Array(await file.arrayBuffer()),
              kind: requestedKind,
            },
            ctxFrom(c),
          )
          return c.json({ attachment: toDto(row) }, 201)
        } catch (e) {
          toHttp(e)
        }
      },
    )
    .get('/:id', validate('param', idParamSchema), async (c) => {
      try {
        const { stream: readable, mime, filename } = await service.open(c.req.valid('param').id)
        c.header('Content-Type', mime)
        c.header(
          'Content-Disposition',
          `inline; filename="${asciiSafeName(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        )
        c.header('Cache-Control', 'private, max-age=86400')
        return stream(c, (s) => s.pipe(Readable.toWeb(readable) as ReadableStream))
      } catch (e) {
        toHttp(e)
      }
    })
    .get('/:id/miniatura', validate('param', idParamSchema), async (c) => {
      try {
        const { stream: readable } = await service.openThumbnail(c.req.valid('param').id)
        c.header('Content-Type', 'image/webp')
        c.header('Cache-Control', 'private, max-age=86400')
        return stream(c, (s) => s.pipe(Readable.toWeb(readable) as ReadableStream))
      } catch (e) {
        toHttp(e)
      }
    })
    .delete(
      '/:id',
      requireRole('admin', 'recepcion'),
      validate('param', idParamSchema),
      async (c) => {
        try {
          await service.remove(c.req.valid('param').id, ctxFrom(c))
          return c.body(null, 204)
        } catch (e) {
          toHttp(e)
        }
      },
    )
