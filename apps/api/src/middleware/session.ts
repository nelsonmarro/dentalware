import type { UserRole } from '@dentalware/shared'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import type { Auth, SessionUser } from '../auth.ts'

export type AppEnv = {
  Variables: {
    user: SessionUser | null
    session: Auth['$Infer']['Session']['session'] | null
  }
}

export const sessionMiddleware = (auth: Auth) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const result = await auth.api.getSession({ headers: c.req.raw.headers })
    c.set('user', result?.user ?? null)
    c.set('session', result?.session ?? null)
    await next()
  })

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.var.user) throw new HTTPException(401, { message: 'No autenticado' })
  await next()
})

export const requireRole = (...roles: UserRole[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const user = c.var.user
    // No se distingue "sin sesión" de "rol incorrecto": ambos son 403 (Sin permiso)
    // para no revelar si la ruta requiere autenticación a quien no la tiene.
    if (!user || !roles.includes(user.role as UserRole)) {
      throw new HTTPException(403, { message: 'Sin permiso' })
    }
    await next()
  })
