import { activeQuerySchema, clinicSchema, idParamSchema } from '@dentalware/shared'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import type { Db } from '../../db/index.ts'
import { validate } from '../../lib/validate.ts'
import type { AppEnv } from '../auth/session.ts'
import { requireAuth, requireRole } from '../auth/session.ts'
import {
  createClinic,
  getClinicWithDoctors,
  listClinics,
  setClinicActive,
  updateClinic,
} from './repo.ts'

const activeBody = z.object({ active: z.boolean({ error: 'Debe indicar activo o inactivo' }) })

export const clinicsRoutes = (db: Db) =>
  new Hono<AppEnv>()
    .get('/', requireAuth, validate('query', activeQuerySchema), async (c) =>
      c.json({ clinics: await listClinics(db, c.req.valid('query').incluirInactivos) }, 200),
    )
    .get('/:id', requireAuth, validate('param', idParamSchema), async (c) => {
      const clinic = await getClinicWithDoctors(db, c.req.valid('param').id)
      if (!clinic) throw new HTTPException(404, { message: 'La clínica no existe' })
      return c.json({ clinic }, 200)
    })
    .post('/', requireRole('admin'), validate('json', clinicSchema), async (c) =>
      c.json({ clinic: await createClinic(db, c.req.valid('json')) }, 201),
    )
    .put(
      '/:id',
      requireRole('admin'),
      validate('param', idParamSchema),
      validate('json', clinicSchema),
      async (c) => {
        const clinic = await updateClinic(db, c.req.valid('param').id, c.req.valid('json'))
        if (!clinic) throw new HTTPException(404, { message: 'La clínica no existe' })
        return c.json({ clinic }, 200)
      },
    )
    .patch(
      '/:id/activo',
      requireRole('admin'),
      validate('param', idParamSchema),
      validate('json', activeBody),
      async (c) => {
        const clinic = await setClinicActive(
          db,
          c.req.valid('param').id,
          c.req.valid('json').active,
        )
        if (!clinic) throw new HTTPException(404, { message: 'La clínica no existe' })
        return c.json({ clinic }, 200)
      },
    )
