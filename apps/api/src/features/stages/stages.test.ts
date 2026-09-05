import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../app.ts'
import { createUser, loginAs, setupTestDb, truncateAll } from '../../test/setup.ts'

describe('/api/config/fases', () => {
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  let app: ReturnType<typeof createApp>
  let admin: string
  let tecnico: string

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
    admin = await loginAs(app, 'admin@t.local', 'Admin12345!')
    tecnico = await loginAs(app, 'tec@t.local', 'Tecnico123!')
  })
  afterAll(async () => {
    await ctx.pool.end()
  })
  const req = (cookie: string, method: string, body?: unknown) => ({
    method,
    headers: { 'content-type': 'application/json', cookie, origin: ctx.config.WEB_ORIGIN },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  it('crea fases, el técnico las lee ordenadas y admin las reordena', async () => {
    const a = (await (
      await app.request(
        '/api/config/fases',
        req(admin, 'POST', { name: 'Modelo', color: '#0F766E', sort: 2 }),
      )
    ).json()) as { stage: { id: string } }
    const b = (await (
      await app.request(
        '/api/config/fases',
        req(admin, 'POST', { name: 'Recepción', color: '#5B6A6E', sort: 1 }),
      )
    ).json()) as { stage: { id: string } }
    const list = (await (await app.request('/api/config/fases', req(tecnico, 'GET'))).json()) as {
      stages: { name: string }[]
    }
    expect(list.stages.map((s) => s.name)).toEqual(['Recepción', 'Modelo'])
    expect(
      (
        await app.request(
          '/api/config/fases',
          req(tecnico, 'POST', { name: 'X', color: '#000000' }),
        )
      ).status,
    ).toBe(403)
    const re = await app.request(
      '/api/config/fases/orden',
      req(admin, 'PUT', { ids: [a.stage.id, b.stage.id] }),
    )
    expect(re.status).toBe(200)
    const list2 = (await (await app.request('/api/config/fases', req(admin, 'GET'))).json()) as {
      stages: { name: string; sort: number }[]
    }
    expect(list2.stages.map((s) => [s.name, s.sort])).toEqual([
      ['Modelo', 0],
      ['Recepción', 1],
    ])
  })

  it('valida color y desactiva', async () => {
    const bad = await app.request(
      '/api/config/fases',
      req(admin, 'POST', { name: 'X', color: 'teal' }),
    )
    expect(bad.status).toBe(422)
    const { stage } = (await (
      await app.request(
        '/api/config/fases',
        req(admin, 'POST', { name: 'Acabado', color: '#2F8F5B' }),
      )
    ).json()) as { stage: { id: string } }
    const off = await app.request(
      `/api/config/fases/${stage.id}/activo`,
      req(admin, 'PATCH', { active: false }),
    )
    expect(((await off.json()) as { stage: { active: boolean } }).stage.active).toBe(false)
    const list = (await (await app.request('/api/config/fases', req(admin, 'GET'))).json()) as {
      stages: unknown[]
    }
    expect(list.stages).toHaveLength(0)
  })
})
