import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../app.ts'
import { createUser, loginAs, setupTestDb, truncateAll } from '../../test/setup.ts'

describe('/api/config/laboratorio', () => {
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  let app: ReturnType<typeof createApp>
  let adminCookie: string
  let tecnicoCookie: string

  beforeAll(async () => {
    ctx = await setupTestDb()
    app = createApp({ auth: ctx.auth, db: ctx.db, webOrigin: ctx.config.WEB_ORIGIN })
  })
  beforeEach(async () => {
    await truncateAll(ctx.db)
    await createUser(ctx.auth, ctx.db, {
      email: 'admin@t.local',
      password: 'Admin12345!',
      name: 'Admin',
      role: 'admin',
    })
    await createUser(ctx.auth, ctx.db, {
      email: 'tec@t.local',
      password: 'Tecnico123!',
      name: 'Tec',
      role: 'tecnico',
    })
    adminCookie = await loginAs(app, 'admin@t.local', 'Admin12345!')
    tecnicoCookie = await loginAs(app, 'tec@t.local', 'Tecnico123!')
  })
  afterAll(async () => {
    await ctx.pool.end()
  })

  const json = (cookie: string, method: string, body?: unknown) => ({
    method,
    headers: { 'content-type': 'application/json', cookie, origin: ctx.config.WEB_ORIGIN },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  it('GET devuelve null cuando no hay datos y 401 sin sesión', async () => {
    expect((await app.request('/api/config/laboratorio')).status).toBe(401)
    const res = await app.request('/api/config/laboratorio', json(tecnicoCookie, 'GET'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ settings: null })
  })

  it('PUT crea y luego actualiza la única fila (solo admin)', async () => {
    const forbidden = await app.request(
      '/api/config/laboratorio',
      json(tecnicoCookie, 'PUT', { name: 'X' }),
    )
    expect(forbidden.status).toBe(403)

    const created = await app.request(
      '/api/config/laboratorio',
      json(adminCookie, 'PUT', {
        name: 'Arte Dental',
        address: 'Puerto Rico N27-33 y La Isla',
        phone: '0961440991 / 0996081498',
      }),
    )
    expect(created.status).toBe(200)
    const body = (await created.json()) as {
      settings: { id: string; name: string; ivaPct: number }
    }
    expect(body.settings.name).toBe('Arte Dental')
    expect(body.settings.ivaPct).toBe(15)

    const updated = await app.request(
      '/api/config/laboratorio',
      json(adminCookie, 'PUT', { name: 'Arte Dental Quito', ivaPct: 15 }),
    )
    const body2 = (await updated.json()) as { settings: { id: string; name: string } }
    expect(body2.settings.id).toBe(body.settings.id)
    expect(body2.settings.name).toBe('Arte Dental Quito')
  })

  it('PUT valida con 422 en español', async () => {
    const res = await app.request('/api/config/laboratorio', json(adminCookie, 'PUT', { name: '' }))
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({
      message: 'Datos inválidos',
      issues: [{ path: 'name', message: 'El nombre es obligatorio' }],
    })
  })
})
