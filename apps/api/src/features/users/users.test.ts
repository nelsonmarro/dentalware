import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../app.ts'
import { createUser, loginAs, setupTestDb, truncateAll } from '../../test/setup.ts'

describe('/api/users', () => {
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  let app: ReturnType<typeof createApp>
  let admin: string
  let adminId: string

  beforeAll(async () => {
    ctx = await setupTestDb()
    app = createApp({
      auth: ctx.auth,
      db: ctx.db,
      webOrigin: ctx.config.WEB_ORIGIN,
      storage: ctx.storage,
    })
  })
  beforeEach(async () => {
    await truncateAll(ctx.db)
    adminId = await createUser(ctx.auth, ctx.db, {
      email: 'admin@t.local',
      password: 'Admin12345!',
      name: 'Admin',
      role: 'admin',
    })
    admin = await loginAs(app, 'admin@t.local', 'Admin12345!')
  })
  afterAll(async () => {
    await ctx.pool.end()
  })
  const req = (cookie: string, method: string, body?: unknown) => ({
    method,
    headers: { 'content-type': 'application/json', cookie, origin: ctx.config.WEB_ORIGIN },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  it('admin crea un usuario con rol, aparece en la lista y puede iniciar sesión', async () => {
    const r = await app.request(
      '/api/users',
      req(admin, 'POST', {
        name: 'Ana',
        email: 'ana@t.local',
        password: 'Secreta123',
        role: 'recepcion',
      }),
    )
    expect(r.status).toBe(201)
    expect(((await r.json()) as { user: { role: string } }).user.role).toBe('recepcion')
    const list = (await (await app.request('/api/users', req(admin, 'GET'))).json()) as {
      users: { email: string; role: string }[]
    }
    expect(list.users.map((u) => u.email)).toEqual(['admin@t.local', 'ana@t.local'])
    const cookie = await loginAs(app, 'ana@t.local', 'Secreta123')
    const me = (await (await app.request('/api/me', req(cookie, 'GET'))).json()) as { role: string }
    expect(me.role).toBe('recepcion')
    expect((await app.request('/api/users', req(cookie, 'GET'))).status).toBe(403)
  })

  it('correo duplicado → 409; cambia rol y contraseña; bloqueo impide login', async () => {
    await app.request(
      '/api/users',
      req(admin, 'POST', {
        name: 'Ana',
        email: 'ana@t.local',
        password: 'Secreta123',
        role: 'recepcion',
      }),
    )
    const dup = await app.request(
      '/api/users',
      req(admin, 'POST', {
        name: 'Ana2',
        email: 'ana@t.local',
        password: 'Secreta123',
        role: 'tecnico',
      }),
    )
    expect(dup.status).toBe(409)
    const list = (await (await app.request('/api/users', req(admin, 'GET'))).json()) as {
      users: { id: string; email: string }[]
    }
    const ana = list.users.find((u) => u.email === 'ana@t.local')!
    const upd = await app.request(
      `/api/users/${ana.id}`,
      req(admin, 'PATCH', { role: 'tecnico', password: 'Nueva12345' }),
    )
    expect(upd.status).toBe(200)
    expect(((await upd.json()) as { user: { role: string } }).user.role).toBe('tecnico')
    await loginAs(app, 'ana@t.local', 'Nueva12345')
    const ban = await app.request(
      `/api/users/${ana.id}/bloqueo`,
      req(admin, 'PATCH', { banned: true, reason: 'Salió del laboratorio' }),
    )
    expect(((await ban.json()) as { user: { banned: boolean } }).user.banned).toBe(true)
    await expect(loginAs(app, 'ana@t.local', 'Nueva12345')).rejects.toThrow()
  })

  it('la superficie HTTP del plugin admin de better-auth está bloqueada; /api/users sigue funcionando', async () => {
    const setRole = await app.request(
      '/api/auth/admin/set-role',
      req(admin, 'POST', { userId: adminId, role: 'tecnico' }),
    )
    expect(setRole.status).toBe(404)
    expect(await setRole.json()).toEqual({ message: 'No encontrado' })

    const listUsers = await app.request('/api/auth/admin/list-users', req(admin, 'GET'))
    expect(listUsers.status).toBe(404)
    expect(await listUsers.json()).toEqual({ message: 'No encontrado' })

    expect((await app.request('/api/users', req(admin, 'GET'))).status).toBe(200)
    const created = await app.request(
      '/api/users',
      req(admin, 'POST', {
        name: 'Beta',
        email: 'beta@t.local',
        password: 'Secreta123',
        role: 'tecnico',
      }),
    )
    expect(created.status).toBe(201)
    const { user } = (await created.json()) as { user: { id: string } }
    const patched = await app.request(
      `/api/users/${user.id}`,
      req(admin, 'PATCH', { role: 'recepcion' }),
    )
    expect(patched.status).toBe(200)
    expect(((await patched.json()) as { user: { role: string } }).user.role).toBe('recepcion')
  })

  it('el admin no puede bloquearse ni degradarse a sí mismo', async () => {
    const self = await app.request(
      `/api/users/${adminId}/bloqueo`,
      req(admin, 'PATCH', { banned: true }),
    )
    expect(self.status).toBe(422)
    expect(await self.json()).toEqual({ message: 'No puedes modificar tu propio acceso' })
    const role = await app.request(
      `/api/users/${adminId}`,
      req(admin, 'PATCH', { role: 'tecnico' }),
    )
    expect(role.status).toBe(422)
  })
})
