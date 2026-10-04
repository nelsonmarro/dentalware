import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../app.ts'
import {
  cleanupTestStorage,
  createUser,
  loginAs,
  setupTestDb,
  truncateAll,
} from '../../test/setup.ts'

describe('/api/entregas', () => {
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  let app: ReturnType<typeof createApp>
  let admin: string
  let recepcion: string
  let tecnico: string
  let mensajero: string

  const get = (path: string, cookie: string) =>
    app.request(path, { method: 'GET', headers: cookie ? { cookie } : {} })

  beforeAll(async () => {
    ctx = await setupTestDb()
    app = createApp({
      auth: ctx.auth,
      db: ctx.db,
      webOrigin: ctx.config.WEB_ORIGIN,
      storage: ctx.storage,
    })
  })
  afterAll(async () => {
    await ctx.pool.end()
    await cleanupTestStorage(ctx)
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
      email: 'recep@t.local',
      password: 'Recep12345!',
      name: 'Recepción',
      role: 'recepcion',
    })
    await createUser(ctx.auth, ctx.db, {
      email: 'tec@t.local',
      password: 'Tecnico123!',
      name: 'Ana Técnico',
      role: 'tecnico',
    })
    // En orden inverso al alfabético: sin `orderBy`, Postgres los devolvería así.
    await createUser(ctx.auth, ctx.db, {
      email: 'zoila@t.local',
      password: 'Mensajero1!',
      name: 'Zoila Mensajera',
      role: 'mensajero',
    })
    await createUser(ctx.auth, ctx.db, {
      email: 'bruno@t.local',
      password: 'Mensajero1!',
      name: 'Bruno Mensajero',
      role: 'mensajero',
    })
    admin = await loginAs(app, 'admin@t.local', 'Admin12345!')
    recepcion = await loginAs(app, 'recep@t.local', 'Recep12345!')
    tecnico = await loginAs(app, 'tec@t.local', 'Tecnico123!')
    mensajero = await loginAs(app, 'zoila@t.local', 'Mensajero1!')
  })

  describe('GET /api/entregas/mensajeros', () => {
    it('admin recibe los mensajeros activos ordenados por nombre, solo id y nombre', async () => {
      const res = await get('/api/entregas/mensajeros', admin)
      expect(res.status).toBe(200)
      const body = (await res.json()) as { mensajeros: Record<string, unknown>[] }
      expect(body.mensajeros.map((m) => m.name)).toEqual(['Bruno Mensajero', 'Zoila Mensajera'])
      for (const m of body.mensajeros) expect(Object.keys(m).sort()).toEqual(['id', 'name'])
    })

    it('recepción también la recibe', async () => {
      expect((await get('/api/entregas/mensajeros', recepcion)).status).toBe(200)
    })

    it('mensajero y técnico reciben 403', async () => {
      expect((await get('/api/entregas/mensajeros', mensajero)).status).toBe(403)
      expect((await get('/api/entregas/mensajeros', tecnico)).status).toBe(403)
    })

    // `requireRole` responde 403 uniforme también sin sesión (docs/conventions.md §4): no
    // distingue «sin sesión» de «rol incorrecto», igual que `GET /api/trabajos/tecnicos`.
    it('sin sesión responde 403', async () => {
      expect((await get('/api/entregas/mensajeros', '')).status).toBe(403)
    })
  })
})
