import { labSettingsSchema } from '@dentalware/shared'
import { Hono } from 'hono'
import type { Db } from '../../db/index.ts'
import { validate } from '../../lib/validate.ts'
import type { AppEnv } from '../auth/session.ts'
import { requireAuth, requireRole } from '../auth/session.ts'
import { getLabSettings, upsertLabSettings } from './repo.ts'

export const labSettingsRoutes = (db: Db) =>
  new Hono<AppEnv>()
    .get('/', requireAuth, async (c) => c.json({ settings: await getLabSettings(db) }, 200))
    .put('/', requireRole('admin'), validate('json', labSettingsSchema), async (c) =>
      c.json({ settings: await upsertLabSettings(db, c.req.valid('json')) }, 200),
    )
