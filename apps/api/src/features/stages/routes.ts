import { activeQuerySchema, idParamSchema, stageSchema } from '@dentalware/shared'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import type { Db } from '../../db/index.ts'
import { validate } from '../../lib/validate.ts'
import type { AppEnv } from '../auth/session.ts'
import { requireAuth, requireRole } from '../auth/session.ts'
import { createStage, listStages, reorderStages, setStageActive, updateStage } from './repo.ts'

const activeBody = z.object({ active: z.boolean({ error: 'Debe indicar activo o inactivo' }) })
const orderBody = z.object({
  ids: z
    .array(z.uuid({ error: 'Identificador inválido' }))
    .min(1, { error: 'Debe enviar al menos una fase' }),
})

export const stagesRoutes = (db: Db) =>
  new Hono<AppEnv>()
    .get('/', requireAuth, validate('query', activeQuerySchema), async (c) =>
      c.json({ stages: await listStages(db, c.req.valid('query').incluirInactivos) }),
    )
    .put('/orden', requireRole('admin'), validate('json', orderBody), async (c) =>
      c.json({ stages: await reorderStages(db, c.req.valid('json').ids) }),
    )
    .post('/', requireRole('admin'), validate('json', stageSchema), async (c) =>
      c.json({ stage: await createStage(db, c.req.valid('json')) }, 201),
    )
    .put(
      '/:id',
      requireRole('admin'),
      validate('param', idParamSchema),
      validate('json', stageSchema),
      async (c) => {
        const stage = await updateStage(db, c.req.valid('param').id, c.req.valid('json'))
        if (!stage) throw new HTTPException(404, { message: 'La fase no existe' })
        return c.json({ stage })
      },
    )
    .patch(
      '/:id/activo',
      requireRole('admin'),
      validate('param', idParamSchema),
      validate('json', activeBody),
      async (c) => {
        const stage = await setStageActive(db, c.req.valid('param').id, c.req.valid('json').active)
        if (!stage) throw new HTTPException(404, { message: 'La fase no existe' })
        return c.json({ stage })
      },
    )
