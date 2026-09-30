import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import type { AppEnv } from './session.ts'
import { ctxFrom, requireAuth, requireRole } from './session.ts'

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
  it('responde 403 Sin permiso si el rol de la sesión no es uno de los roles del dominio', async () => {
    const res = await appWith({ id: 'u1', role: 'superadmin' } as never).request('/')
    expect(res.status).toBe(403)
    expect(await res.text()).toBe('Sin permiso')
  })
})

describe('requireAuth', () => {
  const appWithAuth = (user: AppEnv['Variables']['user']) =>
    new Hono<AppEnv>()
      .use(async (c, next) => {
        c.set('user', user)
        c.set('session', null)
        await next()
      })
      .get('/', requireAuth, (c) => c.json({ ok: true }))

  it('401 No autenticado si no hay sesión', async () => {
    const res = await appWithAuth(null).request('/')
    expect(res.status).toBe(401)
    expect(await res.text()).toBe('No autenticado')
  })

  it('deja pasar cualquier rol válido del dominio', async () => {
    const res = await appWithAuth({ id: 'u1', role: 'tecnico' } as never).request('/')
    expect(res.status).toBe(200)
  })

  it('responde 403 (no 200) si el rol de la sesión no es uno de los roles del dominio (M-1, ronda de fixes 1)', async () => {
    const res = await appWithAuth({ id: 'u1', role: 'superadmin' } as never).request('/')
    expect(res.status).toBe(403)
    expect(await res.text()).toBe('Sin permiso')
  })
})

describe('requireRole', () => {
  const appWithGuard = (user: AppEnv['Variables']['user']) =>
    new Hono<AppEnv>()
      .use(async (c, next) => {
        c.set('user', user)
        c.set('session', null)
        await next()
      })
      .get('/', requireRole('admin', 'recepcion', 'tecnico', 'mensajero'), (c) =>
        c.json({ ok: true }),
      )

  it('deja pasar cualquier rol válido del dominio', async () => {
    const res = await appWithGuard({ id: 'u1', role: 'tecnico' } as never).request('/')
    expect(res.status).toBe(200)
  })
  it('responde 403 si el rol de la sesión no es uno de los roles del dominio', async () => {
    const res = await appWithGuard({ id: 'u1', role: 'superadmin' } as never).request('/')
    expect(res.status).toBe(403)
    expect(await res.text()).toBe('Sin permiso')
  })
})
