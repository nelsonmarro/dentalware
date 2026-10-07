import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../app.ts'
import { testPassword } from '../../test/passwords.ts'
import {
  cleanupTestStorage,
  createUser,
  loginAs,
  setupTestDb,
  truncateAll,
} from '../../test/setup.ts'

// Reloj fijo: "hoy" es 2026-10-06 en toda la suite (la entrega queda con esa fecha).
const CLOCK = { today: () => '2026-10-06', now: () => new Date('2026-10-06T17:00:00Z') }
const ZERO = { '0_30': '0.00', '31_60': '0.00', '61_90': '0.00', '90_mas': '0.00' }

describe('/api/cuentas', () => {
  const pwd = testPassword()
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  let app: ReturnType<typeof createApp>
  let admin: string
  let recepcion: string
  let tecnico: string
  let mensajero: string
  let mensajeroId: string
  let clinicId: string
  let doctorId: string
  let productId: string

  const get = (path: string, cookie: string) =>
    app.request(path, { method: 'GET', headers: cookie ? { cookie } : {} })
  const post = (path: string, cookie: string, body: unknown) =>
    app.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(body),
    })

  beforeAll(async () => {
    ctx = await setupTestDb()
    app = createApp({
      auth: ctx.auth,
      db: ctx.db,
      webOrigin: ctx.config.WEB_ORIGIN,
      storage: ctx.storage,
      clock: CLOCK,
    })
  })
  afterAll(async () => {
    await ctx.pool.end()
    await cleanupTestStorage(ctx)
  })
  beforeEach(async () => {
    await truncateAll(ctx.db)
    for (const [email, name, role] of [
      ['admin@t.local', 'Admin', 'admin'],
      ['recep@t.local', 'Recepción', 'recepcion'],
      ['tec@t.local', 'Ana Técnico', 'tecnico'],
    ] as const) {
      await createUser(ctx.auth, ctx.db, { email, password: pwd, name, role })
    }
    mensajeroId = await createUser(ctx.auth, ctx.db, {
      email: 'men@t.local',
      password: pwd,
      name: 'Beto Mensajero',
      role: 'mensajero',
    })
    admin = await loginAs(app, 'admin@t.local', pwd)
    recepcion = await loginAs(app, 'recep@t.local', pwd)
    tecnico = await loginAs(app, 'tec@t.local', pwd)
    mensajero = await loginAs(app, 'men@t.local', pwd)

    const [clinic] = await ctx.db
      .insert(ctx.schema.clinics)
      .values({ name: 'Clínica Sur' })
      .returning()
    clinicId = clinic!.id
    const [doctor] = await ctx.db
      .insert(ctx.schema.doctors)
      .values({ clinicId, name: 'Dra. Paredes' })
      .returning()
    doctorId = doctor!.id
    const [category] = await ctx.db
      .insert(ctx.schema.productCategories)
      .values({ name: 'Prótesis fija' })
      .returning()
    const [product] = await ctx.db
      .insert(ctx.schema.products)
      .values({
        code: 'ZR',
        name: 'Zirconio',
        categoryId: category!.id,
        pricingUnit: 'por_pieza',
        basePrice: '45.00',
      })
      .returning()
    productId = product!.id
  })

  /** Crea un trabajo por la API y lo lleva a `entregado` con las acciones existentes. */
  async function deliverCase() {
    const created = await post('/api/trabajos', recepcion, {
      clinicId,
      doctorId,
      patientRef: 'Paciente 1',
      receivedAt: '2026-10-01',
      dueDate: '2026-10-20',
      prescription: 'Corona completa de zirconio',
      items: [{ productId, quantity: 1, teeth: [11, 12] }],
    })
    expect(created.status).toBe(201)
    const { case: c } = (await created.json()) as { case: { id: string; total: string } }
    const act = async (body: unknown) => {
      const r = await post(`/api/trabajos/${c.id}/acciones`, admin, body)
      expect(r.status).toBe(200)
    }
    await act({ accion: 'aceptar' })
    await act({ accion: 'finalizar' })
    await act({ accion: 'marcar_enviado', envio: { mensajeroId, fecha: CLOCK.today() } })
    const constanciaId = randomUUID()
    await ctx.db.insert(ctx.schema.attachments).values({
      id: constanciaId,
      caseId: c.id,
      kind: 'constancia',
      filename: 'constancia.jpg',
      mime: 'image/jpeg',
      size: 10,
      storagePath: `${c.id}/${constanciaId}.jpg`,
      uploadedBy: mensajeroId,
    })
    await act({ accion: 'marcar_entregado', constanciaId })
    return c
  }

  describe('permisos', () => {
    it.each([
      ['GET /api/cuentas', () => '/api/cuentas'],
      ['GET /api/cuentas/:id', () => `/api/cuentas/${clinicId}`],
    ])(
      '%s: 401 sin sesión, 403 técnico y mensajero, 200 admin y recepción',
      async (_label, path) => {
        const url = path()
        expect((await get(url, '')).status).toBe(401)
        expect((await get(url, tecnico)).status).toBe(403)
        expect((await get(url, mensajero)).status).toBe(403)
        expect((await get(url, admin)).status).toBe(200)
        expect((await get(url, recepcion)).status).toBe(200)
      },
    )
  })

  it('una clínica que no existe da 404', async () => {
    const r = await get(`/api/cuentas/${randomUUID()}`, admin)
    expect(r.status).toBe(404)
    expect(await r.json()).toEqual({ message: 'No encontrado' })
  })

  it('un id que no es uuid y un todas no válido dan 422', async () => {
    expect((await get('/api/cuentas/abc', admin)).status).toBe(422)
    expect((await get('/api/cuentas?todas=si', admin)).status).toBe(422)
  })

  it('el saldo cambia al entregar un trabajo', async () => {
    const before = await get(`/api/cuentas/${clinicId}`, recepcion)
    expect(await before.json()).toEqual({
      clinic: { id: clinicId, name: 'Clínica Sur' },
      balance: '0.00',
      credit: '0.00',
      aging: ZERO,
      oldestDays: null,
      openCases: [],
      movements: [],
    })
    // Sin movimientos, la lista no la muestra salvo con `todas=1`.
    expect(await (await get('/api/cuentas', admin)).json()).toEqual({ clinics: [] })
    expect(await (await get('/api/cuentas?todas=1', admin)).json()).toEqual({
      clinics: [
        { id: clinicId, name: 'Clínica Sur', balance: '0.00', aging: ZERO, oldestDays: null },
      ],
    })

    const delivered = await deliverCase()
    expect(delivered.total).toBe('45.00')

    const after = (await (await get(`/api/cuentas/${clinicId}`, admin)).json()) as {
      balance: string
      aging: Record<string, string>
      oldestDays: number | null
      openCases: unknown[]
      movements: unknown[]
    }
    expect(after.balance).toBe('45.00')
    expect(after.aging).toEqual({ ...ZERO, '0_30': '45.00' })
    expect(after.oldestDays).toBe(0)
    expect(after.openCases).toEqual([
      expect.objectContaining({
        id: delivered.id,
        deliveredAt: '2026-10-06T17:00:00.000Z',
        charge: '45.00',
        outstanding: '45.00',
        days: 0,
      }),
    ])
    expect(after.movements).toEqual([
      expect.objectContaining({ kind: 'cargo', date: '2026-10-06', amount: '45.00' }),
    ])
    expect(await (await get('/api/cuentas', recepcion)).json()).toEqual({
      clinics: [
        {
          id: clinicId,
          name: 'Clínica Sur',
          balance: '45.00',
          aging: { ...ZERO, '0_30': '45.00' },
          oldestDays: 0,
        },
      ],
    })
  })
})
