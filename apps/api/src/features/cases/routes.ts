import {
  caseInputSchema,
  caseListQuerySchema,
  commentSchema,
  idParamSchema,
} from '@dentalware/shared'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { validate } from '../../lib/validate.ts'
import type { AppEnv } from '../auth/session.ts'
import { ctxFrom, requireAuth, requireRole } from '../auth/session.ts'
import { CaseInputError, CaseNotFoundError, CaseStateError } from './errors.ts'
import type { CasesService } from './service.ts'

// canWrite ya cubre "sin sesión" y "rol incorrecto" con 403 (ver comentario en session.ts):
// no se combina con requireAuth para no dar 401 antes de llegar al chequeo de rol.
const canWrite = requireRole('admin', 'recepcion')

/** Traduce los errores de dominio del servicio a la respuesta HTTP que espera la web. */
function toHttp(e: unknown): never {
  if (e instanceof CaseStateError) throw new HTTPException(409, { message: e.message })
  if (e instanceof CaseNotFoundError) throw new HTTPException(404, { message: e.message })
  throw e
}

export const casesRoutes = (service: CasesService, importRoutes: Hono<AppEnv>) =>
  new Hono<AppEnv>()
    // Montada antes de `/:id` para que el segmento literal "importar" no se confunda
    // con un identificador de trabajo.
    .route('/importar', importRoutes)
    .get('/', requireAuth, validate('query', caseListQuerySchema), async (c) =>
      c.json(await service.list(c.req.valid('query'), ctxFrom(c)), 200),
    )
    .get('/:id', requireAuth, validate('param', idParamSchema), async (c) => {
      try {
        const { case: found, missing } = await service.detail(c.req.valid('param').id, ctxFrom(c))
        return c.json({ case: found, missing }, 200)
      } catch (e) {
        toHttp(e)
      }
    })
    .post('/', canWrite, validate('json', caseInputSchema), async (c) => {
      try {
        const created = await service.create(c.req.valid('json'), ctxFrom(c))
        return c.json({ case: created }, 201)
      } catch (e) {
        if (e instanceof CaseInputError)
          return c.json(
            { message: 'Datos inválidos', issues: [{ path: e.path, message: e.message }] },
            422,
          )
        toHttp(e)
      }
    })
    .put(
      '/:id',
      canWrite,
      validate('param', idParamSchema),
      validate('json', caseInputSchema),
      async (c) => {
        try {
          const updated = await service.update(
            c.req.valid('param').id,
            c.req.valid('json'),
            ctxFrom(c),
          )
          return c.json({ case: updated }, 200)
        } catch (e) {
          if (e instanceof CaseInputError)
            return c.json(
              { message: 'Datos inválidos', issues: [{ path: e.path, message: e.message }] },
              422,
            )
          toHttp(e)
        }
      },
    )
    .get('/:id/eventos', requireAuth, validate('param', idParamSchema), async (c) =>
      c.json({ events: await service.events(c.req.valid('param').id, ctxFrom(c)) }, 200),
    )
    .post(
      '/:id/comentarios',
      requireAuth,
      validate('param', idParamSchema),
      validate('json', commentSchema),
      async (c) => {
        try {
          const event = await service.comment(
            c.req.valid('param').id,
            c.req.valid('json').text,
            ctxFrom(c),
          )
          return c.json({ event }, 201)
        } catch (e) {
          toHttp(e)
        }
      },
    )
