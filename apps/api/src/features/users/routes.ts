import { createUserSchema, updateUserSchema } from '@dentalware/shared'
import { APIError } from 'better-auth/api'
import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import type { Auth } from '../../auth.ts'
import type { Db } from '../../db/index.ts'
import { users } from '../../db/schema/index.ts'
import { validate } from '../../lib/validate.ts'
import type { AppEnv } from '../auth/session.ts'
import { requireRole } from '../auth/session.ts'

const idParam = z.object({ id: z.string().min(1, { error: 'Identificador inválido' }) })
const banBody = z.object({ banned: z.boolean(), reason: z.string().trim().max(200).optional() })
const publicUser = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  banned: users.banned,
  createdAt: users.createdAt,
}

/**
 * Traduce los errores del plugin admin de better-auth a HTTPException en español.
 * `err.status` siempre es "BAD_REQUEST" en las rutas del plugin (better-call usa el
 * nombre del status, no el número); lo que distingue el caso es `err.body.code`, el
 * código estable de ADMIN_ERROR_CODES (auth@1.7.2 dist/plugins/admin/error-codes.mjs).
 * `create-user` con correo repetido usa `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`
 * (el código `USER_ALREADY_EXISTS` existe pero esa ruta no lo usa).
 */
function translate(err: unknown): never {
  if (err instanceof APIError) {
    if (err.body?.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') {
      throw new HTTPException(409, { message: 'Ya existe un usuario con ese correo' })
    }
    throw new HTTPException(400, { message: 'No se pudo completar la operación' })
  }
  throw err
}

export const usersRoutes = (db: Db, auth: Auth) =>
  new Hono<AppEnv>()
    .use(requireRole('admin'))
    .get('/', async (c) =>
      c.json({ users: await db.select(publicUser).from(users).orderBy(asc(users.name)) }, 200),
    )
    .post('/', validate('json', createUserSchema), async (c) => {
      const input = c.req.valid('json')
      try {
        const created = await auth.api.createUser({
          // El plugin admin tipa `role` como InferAdminRolesFromOption<Options>, que sin
          // `roles` (control de acceso) configurado colapsa a "admin" | "user" — no a
          // nuestro UserRole. En runtime no valida contra esa unión (solo lo hace si se
          // configura `roles`), así que el cast es seguro; ver comentario en `translate`.
          body: {
            email: input.email,
            password: input.password,
            name: input.name,
            role: input.role as unknown as 'admin' | 'user',
          },
          headers: c.req.raw.headers,
        })
        const [row] = await db.select(publicUser).from(users).where(eq(users.id, created.user.id))
        return c.json({ user: row! }, 201)
      } catch (err) {
        translate(err)
      }
    })
    .patch('/:id', validate('param', idParam), validate('json', updateUserSchema), async (c) => {
      const { id } = c.req.valid('param')
      const input = c.req.valid('json')
      if (id === c.var.user!.id && input.role && input.role !== c.var.user!.role) {
        throw new HTTPException(422, { message: 'No puedes modificar tu propio acceso' })
      }
      try {
        if (input.role) {
          await auth.api.setRole({
            body: { userId: id, role: input.role as unknown as 'admin' | 'user' },
            headers: c.req.raw.headers,
          })
        }
        if (input.password) {
          await auth.api.setUserPassword({
            body: { userId: id, newPassword: input.password },
            headers: c.req.raw.headers,
          })
        }
        if (input.name) {
          await db
            .update(users)
            .set({ name: input.name, updatedAt: new Date() })
            .where(eq(users.id, id))
        }
      } catch (err) {
        translate(err)
      }
      const [row] = await db.select(publicUser).from(users).where(eq(users.id, id))
      if (!row) throw new HTTPException(404, { message: 'El usuario no existe' })
      return c.json({ user: row }, 200)
    })
    .patch('/:id/bloqueo', validate('param', idParam), validate('json', banBody), async (c) => {
      const { id } = c.req.valid('param')
      const { banned, reason } = c.req.valid('json')
      if (id === c.var.user!.id)
        throw new HTTPException(422, { message: 'No puedes modificar tu propio acceso' })
      try {
        if (banned) {
          await auth.api.banUser({
            body: { userId: id, banReason: reason ?? 'Acceso desactivado' },
            headers: c.req.raw.headers,
          })
        } else {
          await auth.api.unbanUser({ body: { userId: id }, headers: c.req.raw.headers })
        }
      } catch (err) {
        translate(err)
      }
      const [row] = await db.select(publicUser).from(users).where(eq(users.id, id))
      if (!row) throw new HTTPException(404, { message: 'El usuario no existe' })
      return c.json({ user: row }, 200)
    })
