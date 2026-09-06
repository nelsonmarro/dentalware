import { activeQuerySchema, doctorSchema, idParamSchema } from '@dentalware/shared'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import type { Db } from '../../db/index.ts'
import { validate } from '../../lib/validate.ts'
import type { AppEnv } from '../auth/session.ts'
import { requireAuth, requireRole } from '../auth/session.ts'
import { clinicExists, createDoctor, listDoctors, setDoctorActive, updateDoctor } from './repo.ts'

const listQuery = activeQuerySchema.extend({
  clinicId: z.uuid({ error: 'Identificador inválido' }).optional(),
})
const activeBody = z.object({ active: z.boolean({ error: 'Debe indicar activo o inactivo' }) })

async function assertClinic(db: Db, clinicId: string) {
  if (!(await clinicExists(db, clinicId)))
    throw new HTTPException(422, { message: 'La clínica no existe' })
}

export const doctorsRoutes = (db: Db) =>
  new Hono<AppEnv>()
    .get('/', requireAuth, validate('query', listQuery), async (c) => {
      const q = c.req.valid('query')
      return c.json(
        {
          doctors: await listDoctors(db, {
            clinicId: q.clinicId,
            includeInactive: q.incluirInactivos,
          }),
        },
        200,
      )
    })
    .post('/', requireRole('admin'), validate('json', doctorSchema), async (c) => {
      const input = c.req.valid('json')
      await assertClinic(db, input.clinicId)
      return c.json({ doctor: await createDoctor(db, input) }, 201)
    })
    .put(
      '/:id',
      requireRole('admin'),
      validate('param', idParamSchema),
      validate('json', doctorSchema),
      async (c) => {
        const input = c.req.valid('json')
        await assertClinic(db, input.clinicId)
        const doctor = await updateDoctor(db, c.req.valid('param').id, input)
        if (!doctor) throw new HTTPException(404, { message: 'El doctor no existe' })
        return c.json({ doctor }, 200)
      },
    )
    .patch(
      '/:id/activo',
      requireRole('admin'),
      validate('param', idParamSchema),
      validate('json', activeBody),
      async (c) => {
        const doctor = await setDoctorActive(
          db,
          c.req.valid('param').id,
          c.req.valid('json').active,
        )
        if (!doctor) throw new HTTPException(404, { message: 'El doctor no existe' })
        return c.json({ doctor }, 200)
      },
    )
