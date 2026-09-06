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
    app = createApp({
      auth: ctx.auth,
      db: ctx.db,
      webOrigin: ctx.config.WEB_ORIGIN,
      storage: ctx.storage,
    })
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

  it('el reordenamiento exige exactamente todos los ids (activos e inactivos)', async () => {
    const a = (await (
      await app.request(
        '/api/config/fases',
        req(admin, 'POST', { name: 'Recepción', color: '#5B6A6E' }),
      )
    ).json()) as { stage: { id: string } }
    const b = (await (
      await app.request(
        '/api/config/fases',
        req(admin, 'POST', { name: 'Modelo', color: '#0F766E' }),
      )
    ).json()) as { stage: { id: string } }
    const c = (await (
      await app.request(
        '/api/config/fases',
        req(admin, 'POST', { name: 'Acabado', color: '#2F8F5B' }),
      )
    ).json()) as { stage: { id: string } }
    await app.request(
      `/api/config/fases/${b.stage.id}/activo`,
      req(admin, 'PATCH', { active: false }),
    )

    const partial = await app.request(
      '/api/config/fases/orden',
      req(admin, 'PUT', { ids: [c.stage.id, a.stage.id] }),
    )
    expect(partial.status).toBe(422)
    expect(((await partial.json()) as { message: string }).message).toBe(
      'Debe reordenar todas las fases',
    )

    const full = await app.request(
      '/api/config/fases/orden',
      req(admin, 'PUT', { ids: [c.stage.id, a.stage.id, b.stage.id] }),
    )
    expect(full.status).toBe(200)
    const list = (await (
      await app.request('/api/config/fases?incluirInactivos=true', req(admin, 'GET'))
    ).json()) as { stages: { id: string; sort: number }[] }
    const byId = Object.fromEntries(list.stages.map((s) => [s.id, s.sort]))
    expect(byId[c.stage.id]).toBe(0)
    expect(byId[a.stage.id]).toBe(1)
    expect(byId[b.stage.id]).toBe(2)
    expect(new Set(list.stages.map((s) => s.sort)).size).toBe(3)
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
