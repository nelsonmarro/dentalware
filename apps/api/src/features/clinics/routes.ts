import {
  activeBodySchema,
  activeQuerySchema,
  clinicSchema,
  idParamSchema,
  SETTINGS_ROLES,
} from '@dentalware/shared'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
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
    .post('/', requireRole(...SETTINGS_ROLES), validate('json', clinicSchema), async (c) =>
      c.json({ clinic: await createClinic(db, c.req.valid('json')) }, 201),
    )
    .put(
      '/:id',
      requireRole(...SETTINGS_ROLES),
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
      requireRole(...SETTINGS_ROLES),
      validate('param', idParamSchema),
      validate('json', activeBodySchema),
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
