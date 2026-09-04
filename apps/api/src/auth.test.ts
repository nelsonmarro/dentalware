import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app.ts'
import { createUser, loginAs, setupTestDb, truncateAll } from './test/setup.ts'

let ctx: Awaited<ReturnType<typeof setupTestDb>>
let app: ReturnType<typeof createApp>

beforeAll(async () => {
  ctx = await setupTestDb()
  app = createApp({ auth: ctx.auth, webOrigin: ctx.config.WEB_ORIGIN })
})
beforeEach(async () => {
  await truncateAll(ctx.db)
})
afterAll(async () => {
  await ctx.pool.end()
})

describe('sesión y /api/me', () => {
  it('401 sin sesión', async () => {
    const res = await app.request('/api/me')
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ message: 'No autenticado' })
  })

  it('devuelve el usuario con su rol tras iniciar sesión', async () => {
    await createUser(ctx.auth, ctx.db, {
      email: 'ana@lab.local',
      password: 'Recepcion1!',
      name: 'Ana',
      role: 'recepcion',
    })
    const cookie = await loginAs(app, 'ana@lab.local', 'Recepcion1!')
    const res = await app.request('/api/me', { headers: { cookie } })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      name: 'Ana',
      email: 'ana@lab.local',
      role: 'recepcion',
    })
  })

  it('rechaza credenciales inválidas', async () => {
    const res = await app.request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ctx.config.WEB_ORIGIN },
      body: JSON.stringify({ email: 'nadie@lab.local', password: 'xxxxxxxx' }),
    })
    expect(res.status).toBe(401)
  })
})

describe('registro de usuarios', () => {
  const signUp = (cookie?: string) =>
    app.request('/api/auth/sign-up/email', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: ctx.config.WEB_ORIGIN,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify({ email: 'nuevo@lab.local', password: 'Nuevo1234!', name: 'Nuevo' }),
    })

  it('bloquea el registro anónimo', async () => {
    const res = await signUp()
    expect(res.status).toBe(403)
  })

  it('bloquea el registro a un técnico', async () => {
    await createUser(ctx.auth, ctx.db, {
      email: 'tec@lab.local',
      password: 'Tecnico12!',
      name: 'Tec',
      role: 'tecnico',
    })
    const cookie = await loginAs(app, 'tec@lab.local', 'Tecnico12!')
    expect((await signUp(cookie)).status).toBe(403)
  })

  it('permite el registro a un admin y el nuevo usuario nace como tecnico', async () => {
    await createUser(ctx.auth, ctx.db, {
      email: 'admin@lab.local',
      password: 'Admin1234!',
      name: 'Admin',
      role: 'admin',
    })
    const cookie = await loginAs(app, 'admin@lab.local', 'Admin1234!')
    const res = await signUp(cookie)
    expect(res.status).toBe(200)
    const nuevoCookie = await loginAs(app, 'nuevo@lab.local', 'Nuevo1234!')
    const me = await app.request('/api/me', { headers: { cookie: nuevoCookie } })
    expect(await me.json()).toMatchObject({ email: 'nuevo@lab.local', role: 'tecnico' })
  })
})

describe('CORS', () => {
  it('no refleja orígenes fuera de la lista blanca', async () => {
    const res = await app.request('/api/health', {
      headers: { origin: 'https://malicioso.example' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('refleja el origen configurado en WEB_ORIGIN', async () => {
    const res = await app.request('/api/health', {
      headers: { origin: ctx.config.WEB_ORIGIN },
    })
    expect(res.headers.get('access-control-allow-origin')).toBe(ctx.config.WEB_ORIGIN)
  })

  it('conserva la cabecera CORS en una respuesta de error (401)', async () => {
    const res = await app.request('/api/me', {
      headers: { origin: ctx.config.WEB_ORIGIN },
    })
    expect(res.status).toBe(401)
    expect(res.headers.get('access-control-allow-origin')).toBe(ctx.config.WEB_ORIGIN)
  })
})

describe('requireRole', () => {
  it('403 para rol no permitido en una ruta protegida de prueba', async () => {
    await createUser(ctx.auth, ctx.db, {
      email: 'men@lab.local',
      password: 'Mensajero1!',
      name: 'Men',
      role: 'mensajero',
    })
    const cookie = await loginAs(app, 'men@lab.local', 'Mensajero1!')
    const res = await app.request('/api/admin/ping', { headers: { cookie } })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ message: 'Sin permiso' })
  })
})
