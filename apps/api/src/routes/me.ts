import { Hono } from 'hono'
import type { AppEnv } from '../middleware/session.ts'
import { requireAuth } from '../middleware/session.ts'

export const meRoutes = new Hono<AppEnv>().get('/', requireAuth, (c) => {
  const u = c.var.user!
  return c.json({ id: u.id, name: u.name, email: u.email, role: u.role })
})
