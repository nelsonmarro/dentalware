import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import type { AppEnv } from './session.ts'
import { ctxFrom } from './session.ts'

const appWith = (user: AppEnv['Variables']['user']) =>
  new Hono<AppEnv>()
    .use(async (c, next) => {
      c.set('user', user)
      c.set('session', null)
      await next()
    })
    .get('/', (c) => c.json(ctxFrom(c)))

describe('ctxFrom', () => {
  it('construye el contexto de petición con id y rol del usuario en sesión', async () => {
    const res = await appWith({ id: 'u1', role: 'recepcion' } as never).request('/')
    expect(await res.json()).toEqual({ userId: 'u1', role: 'recepcion' })
  })
  it('responde 403 Sin permiso si no hay sesión', async () => {
    const res = await appWith(null).request('/')
    expect(res.status).toBe(403)
  })
})
