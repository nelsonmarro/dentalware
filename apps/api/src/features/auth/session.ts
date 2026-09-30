import type { Context } from 'hono'
import type { UserRole } from '@dentalware/shared'
import { userRoleSchema } from '@dentalware/shared'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import type { RequestContext } from '../../lib/request-context.ts'
import type { Auth, SessionUser } from '../../auth.ts'

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

/**
 * El rol viaja como `string` desde Better Auth: una fila manipulada o una migración a medias
 * podría entregar un valor que no es uno de `USER_ROLES`. Se valida aquí, en la frontera, en
 * vez de castear con `as UserRole`: un rol desconocido nunca debe colarse en un `Record<UserRole, …>`
 * ni caer por casualidad en la rama permisiva de un `if` (issue #21).
 */
function validRoleOf(user: SessionUser | null): UserRole | null {
  if (!user) return null
  const role = userRoleSchema.safeParse(user.role)
  return role.success ? role.data : null
}

export const requireRole = (...roles: UserRole[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const role = validRoleOf(c.var.user)
    // No se distingue "sin sesión" de "rol incorrecto" (ni "rol desconocido"): los tres son
    // 403 (Sin permiso) para no revelar si la ruta requiere autenticación a quien no la tiene.
    if (!role || !roles.includes(role)) {
      throw new HTTPException(403, { message: 'Sin permiso' })
    }
    await next()
  })

/** Traduce la sesión de Hono al contexto que reciben los servicios (ADR 20). */
export function ctxFrom(c: Context<AppEnv>): RequestContext {
  const role = validRoleOf(c.var.user)
  if (!c.var.user || !role) throw new HTTPException(403, { message: 'Sin permiso' })
  return { userId: c.var.user.id, role }
}
