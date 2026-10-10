import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
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

  /** Crea un trabajo por la API (queda `nuevo`). */
  async function createCase() {
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
    return ((await created.json()) as { case: { id: string; code: string; total: string } }).case
  }

  /** Crea un trabajo por la API y lo lleva a `entregado` con las acciones existentes. */
  async function deliverCase() {
    const c = await createCase()
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

  describe('pagos (CTA-2)', () => {
    type Pago = { id: string; amount: string; allocated: string; credit: string; voided: unknown }
    type Issues = { message: string; issues: { path: string; message: string }[] }
    type Detail = {
      balance: string
      credit: string
      openCases: { id: string; outstanding: string }[]
      movements: {
        id: string
        kind: string
        amount: string
        remaining: string | null
        voided: unknown
      }[]
    }
    type Event = {
      type: string
      fromValue: string | null
      toValue: string | null
      reason: string | null
    }

    const pago = (over: Record<string, unknown> = {}) => ({
      clinicaId: clinicId,
      monto: '60.00',
      metodo: 'transferencia',
      fecha: '2026-10-06',
      referencia: 'TRX-1',
      asignaciones: [],
      ...over,
    })
    const detail = async () =>
      (await (await get(`/api/cuentas/${clinicId}`, admin)).json()) as Detail
    const caseOf = async (id: string) =>
      (
        (await (await get(`/api/trabajos/${id}`, admin)).json()) as {
          case: { status: string; paidAt: string | null }
        }
      ).case
    const eventsOf = async (id: string, cookie = admin) =>
      ((await (await get(`/api/trabajos/${id}/eventos`, cookie)).json()) as { events: Event[] })
        .events
    const register = async (body: unknown, cookie = recepcion) => {
      const r = await post('/api/cuentas/pagos', cookie, body)
      expect(r.status).toBe(201)
      return ((await r.json()) as { pago: Pago }).pago
    }

    it('permisos: registrar y aplicar saldo a favor admin y recepción; anular, solo admin', async () => {
      expect((await post('/api/cuentas/pagos', '', pago())).status).toBe(401)
      expect((await post('/api/cuentas/pagos', tecnico, pago())).status).toBe(403)
      expect((await post('/api/cuentas/pagos', mensajero, pago())).status).toBe(403)
      await register(pago(), admin)
      const p = await register(pago())

      const c = await deliverCase()
      const aplicar = `/api/cuentas/pagos/${p.id}/asignaciones`
      const body = { asignaciones: [{ trabajoId: c.id, monto: '1.00' }] }
      expect((await post(aplicar, '', body)).status).toBe(401)
      expect((await post(aplicar, tecnico, body)).status).toBe(403)
      expect((await post(aplicar, mensajero, body)).status).toBe(403)
      expect((await post(aplicar, recepcion, body)).status).toBe(201)
      expect((await post(aplicar, admin, body)).status).toBe(201)

      const anular = `/api/cuentas/pagos/${p.id}/anular`
      const motivo = { motivo: 'Duplicado' }
      expect((await post(anular, '', motivo)).status).toBe(401)
      for (const cookie of [recepcion, tecnico, mensajero]) {
        expect((await post(anular, cookie, motivo)).status).toBe(403)
      }
      const anulado = await post(anular, admin, motivo)
      expect(anulado.status).toBe(200)
      expect(((await anulado.json()) as { pago: Pago }).pago).toMatchObject({
        id: p.id,
        voided: { by: 'Admin', reason: 'Duplicado' },
      })
    })

    it('422 con el campo: datos inválidos, otra clínica, más que el pendiente, una clínica que no existe y una fecha futura', async () => {
      const c = await deliverCase()
      const [otra] = await ctx.db
        .insert(ctx.schema.clinics)
        .values({ name: 'Clínica Norte' })
        .returning()
      const cases = [
        [{ monto: '0.00' }, 'monto'],
        [
          { clinicaId: otra!.id, asignaciones: [{ trabajoId: c.id, monto: '10.00' }] },
          'asignaciones.0.trabajoId',
        ],
        [{ asignaciones: [{ trabajoId: c.id, monto: '45.01' }] }, 'asignaciones.0.monto'],
        [{ clinicaId: randomUUID() }, 'clinicaId'],
        [{ fecha: '2026-10-07' }, 'fecha'],
      ] as const
      for (const [over, path] of cases) {
        const r = await post('/api/cuentas/pagos', recepcion, pago(over))
        expect(r.status).toBe(422)
        const body = (await r.json()) as Issues
        expect(body.message).toBe('Datos inválidos')
        expect(body.issues.map((i) => i.path)).toContain(path)
        if (path === 'fecha') {
          expect(body.issues).toContainEqual({
            path: 'fecha',
            message: 'La fecha no puede ser posterior a hoy',
          })
        }
      }
      // Nada se escribió.
      expect(await ctx.db.select().from(ctx.schema.payments)).toEqual([])
      expect((await caseOf(c.id)).status).toBe('entregado')
    })

    it('404 con un pago que no existe y 409 con uno anulado', async () => {
      const nada = randomUUID()
      const body = { asignaciones: [{ trabajoId: randomUUID(), monto: '1.00' }] }
      for (const r of [
        await post(`/api/cuentas/pagos/${nada}/asignaciones`, recepcion, body),
        await post(`/api/cuentas/pagos/${nada}/anular`, admin, { motivo: 'Duplicado' }),
      ]) {
        expect(r.status).toBe(404)
        expect(await r.json()).toEqual({ message: 'No encontrado' })
      }
      const p = await register(pago())
      expect(
        (await post(`/api/cuentas/pagos/${p.id}/anular`, admin, { motivo: 'Duplicado' })).status,
      ).toBe(200)
      const otraVez = await post(`/api/cuentas/pagos/${p.id}/anular`, admin, {
        motivo: 'Duplicado',
      })
      expect(otraVez.status).toBe(409)
      expect(await otraVez.json()).toEqual({ message: 'El pago ya está anulado' })
      const aplicar = await post(`/api/cuentas/pagos/${p.id}/asignaciones`, recepcion, body)
      expect(aplicar.status).toBe(409)
      expect(await aplicar.json()).toEqual({
        message: 'El pago está anulado: no tiene saldo a favor',
      })
      expect((await post(`/api/cuentas/pagos/${p.id}/anular`, admin, { motivo: ' ' })).status).toBe(
        422,
      )
    })

    it('flujo completo: pagar, quedar a favor, aplicar el saldo a favor y anular', async () => {
      const uno = await deliverCase()
      expect((await detail()).balance).toBe('45.00')

      // 60.00: 45.00 cierran el primer trabajo y 15.00 quedan a favor.
      const p = await register(pago({ asignaciones: [{ trabajoId: uno.id, monto: '45.00' }] }))
      expect(p).toMatchObject({
        amount: '60.00',
        allocated: '45.00',
        credit: '15.00',
        voided: null,
      })
      expect(await caseOf(uno.id)).toMatchObject({
        status: 'cobrado',
        paidAt: CLOCK.now().toISOString(),
      })
      expect(await detail()).toMatchObject({ balance: '-15.00', credit: '15.00', openCases: [] })
      // El movimiento del pago dice lo que le queda sin asignar.
      expect((await detail()).movements.find((m) => m.id === p.id)).toMatchObject({
        kind: 'pago',
        remaining: '15.00',
      })
      const eventos = await eventsOf(uno.id)
      expect(eventos.slice(-2)).toEqual([
        expect.objectContaining({
          type: 'payment_applied',
          toValue: '45.00',
          reason: 'Transferencia · TRX-1',
        }),
        expect.objectContaining({
          type: 'status_changed',
          fromValue: 'entregado',
          toValue: 'cobrado',
        }),
      ])
      // El técnico ve que hubo un pago, sin monto ni referencia.
      expect(
        (await eventsOf(uno.id, tecnico)).find((e) => e.type === 'payment_applied'),
      ).toMatchObject({
        toValue: null,
        reason: null,
      })

      // El saldo a favor se aplica al segundo trabajo, que queda con 30.00 pendientes.
      const dos = await deliverCase()
      const aplicado = await post(`/api/cuentas/pagos/${p.id}/asignaciones`, recepcion, {
        asignaciones: [{ trabajoId: dos.id, monto: '15.00' }],
      })
      expect(aplicado.status).toBe(201)
      expect(((await aplicado.json()) as { pago: Pago }).pago).toMatchObject({
        allocated: '60.00',
        credit: '0.00',
      })
      expect(await detail()).toMatchObject({
        balance: '30.00',
        credit: '0.00',
        openCases: [{ id: dos.id, outstanding: '30.00' }],
      })
      expect((await detail()).movements.find((m) => m.id === p.id)?.remaining).toBe('0.00')
      const masDeLoQueQueda = await post(`/api/cuentas/pagos/${p.id}/asignaciones`, recepcion, {
        asignaciones: [{ trabajoId: dos.id, monto: '0.01' }],
      })
      expect(masDeLoQueQueda.status).toBe(422)

      // Anular: el primero vuelve a entregado, nada queda a favor y el pago se ve anulado.
      const anulado = await post(`/api/cuentas/pagos/${p.id}/anular`, admin, {
        motivo: 'Transferencia rechazada',
      })
      expect(anulado.status).toBe(200)
      expect(await caseOf(uno.id)).toMatchObject({ status: 'entregado', paidAt: null })
      const after = await detail()
      expect(after).toMatchObject({ balance: '90.00', credit: '0.00' })
      expect(after.openCases.map((c) => [c.id, c.outstanding])).toEqual(
        expect.arrayContaining([
          [uno.id, '45.00'],
          [dos.id, '45.00'],
        ]),
      )
      expect(after.movements.find((m) => m.kind === 'pago')).toMatchObject({
        amount: '-60.00',
        remaining: '0.00',
        voided: { by: 'Admin', reason: 'Transferencia rechazada' },
      })
      expect((await eventsOf(uno.id)).slice(-2)).toEqual([
        expect.objectContaining({
          type: 'payment_voided',
          toValue: '45.00',
          reason: 'Transferencia rechazada',
        }),
        expect.objectContaining({
          type: 'status_changed',
          fromValue: 'cobrado',
          toValue: 'entregado',
        }),
      ])
      expect((await eventsOf(dos.id)).at(-1)).toMatchObject({
        type: 'payment_voided',
        toValue: '15.00',
      })
    })

    it('registrar un pago y aplicar saldo a favor dicen qué trabajos cerraron (UX5-04)', async () => {
      const uno = await deliverCase()
      const dos = await deliverCase()
      // 60.00: 45.00 cierran `uno` y 15.00 dejan a `dos` debiendo 30.00.
      const r = await post('/api/cuentas/pagos', recepcion, {
        ...pago({
          asignaciones: [
            { trabajoId: dos.id, monto: '15.00' },
            { trabajoId: uno.id, monto: '45.00' },
          ],
        }),
      })
      expect(r.status).toBe(201)
      const { pago: p } = (await r.json()) as { pago: Pago & { settled: unknown } }
      expect(p.settled).toEqual([{ id: uno.id, code: uno.code }])

      // Un anticipo de 30.00 queda a favor y, aplicado a `dos`, lo cierra.
      const anticipo = await register(pago({ monto: '30.00' }))
      const aplicado = await post(`/api/cuentas/pagos/${anticipo.id}/asignaciones`, recepcion, {
        asignaciones: [{ trabajoId: dos.id, monto: '30.00' }],
      })
      expect(aplicado.status).toBe(201)
      expect(((await aplicado.json()) as { pago: { settled: unknown } }).pago.settled).toEqual([
        { id: dos.id, code: dos.code },
      ])
    })

    it('el movimiento del pago dice a qué trabajos se aplicó y cuáles reabre; anulado, ninguno (UX5-03)', async () => {
      const uno = await deliverCase()
      const dos = await deliverCase()
      // 60.00: 45.00 cierran `uno` y 15.00 dejan a `dos` debiendo 30.00. Un segundo pago de
      // 10.00 a `dos` no sale en este movimiento.
      const p = await register(
        pago({
          asignaciones: [
            { trabajoId: dos.id, monto: '15.00' },
            { trabajoId: uno.id, monto: '45.00' },
          ],
        }),
      )
      await register(
        pago({ monto: '10.00', asignaciones: [{ trabajoId: dos.id, monto: '10.00' }] }),
      )
      type Applied = { allocations: unknown }
      const movimiento = async () =>
        (await detail()).movements.find((m) => m.id === p.id) as unknown as Applied
      // `uno` se entregó antes que `dos`: va primero aunque llegó segundo en el reparto.
      expect((await movimiento()).allocations).toEqual([
        { caseId: uno.id, code: uno.code, amount: '45.00', reopens: true },
        { caseId: dos.id, code: dos.code, amount: '15.00', reopens: false },
      ])

      const anulado = await post(`/api/cuentas/pagos/${p.id}/anular`, admin, {
        motivo: 'Duplicado',
      })
      expect(anulado.status).toBe(200)
      expect((await movimiento()).allocations).toEqual([])
      expect((await caseOf(uno.id)).status).toBe('entregado')
    })

    /** Un pago de 60.00 con 45.00 en un trabajo (le quedan 15.00 a favor) y otros dos
     * trabajos entregados de 45.00 sin pagar. */
    async function creditAndTwoCases() {
      const uno = await deliverCase()
      const p = await register(pago({ asignaciones: [{ trabajoId: uno.id, monto: '45.00' }] }))
      const dos = await deliverCase()
      const tres = await deliverCase()
      return { p, uno, dos, tres }
    }
    const applyCredit = (paymentId: string, trabajoId: string) =>
      post(`/api/cuentas/pagos/${paymentId}/asignaciones`, recepcion, {
        asignaciones: [{ trabajoId, monto: '15.00' }],
      })
    const allocationsOfPayment = (paymentId: string) =>
      ctx.db
        .select()
        .from(ctx.schema.paymentAllocations)
        .where(eq(ctx.schema.paymentAllocations.paymentId, paymentId))

    it('concurrencia: dos «Aplicar saldo a favor» del mismo pago a trabajos distintos no lo pasan de su monto', async () => {
      const { p, dos, tres } = await creditAndTwoCases()
      const intentos = await Promise.all([applyCredit(p.id, dos.id), applyCredit(p.id, tres.id)])
      expect(intentos.map((r) => r.status).sort()).toEqual([201, 422])
      const rechazado = intentos.find((r) => r.status === 422)!
      expect(((await rechazado.json()) as Issues).issues).toEqual([
        { path: 'asignaciones', message: 'Supera el saldo a favor de este pago (0.00)' },
      ])
      const allocations = await allocationsOfPayment(p.id)
      expect(allocations).toHaveLength(2)
      expect(allocations.reduce((sum, a) => sum + Number(a.amount) * 100, 0)).toBe(6_000)
      expect(await detail()).toMatchObject({ credit: '0.00', balance: '75.00' })
    })

    it('concurrencia: aplicar el saldo a favor y anular el mismo pago deja un estado coherente en cualquier orden', async () => {
      const { p, uno, dos } = await creditAndTwoCases()
      const [aplicar, anular] = await Promise.all([
        applyCredit(p.id, dos.id),
        post(`/api/cuentas/pagos/${p.id}/anular`, admin, { motivo: 'Duplicado' }),
      ])
      expect(anular.status).toBe(200)
      expect([201, 409]).toContain(aplicar.status)
      const voidedOnDos = (await eventsOf(dos.id)).filter((e) => e.type === 'payment_voided')
      if (aplicar.status === 201) {
        // Se aplicó antes de anular: la anulación también devuelve lo de `dos`.
        expect(voidedOnDos).toEqual([expect.objectContaining({ toValue: '15.00' })])
        expect(await allocationsOfPayment(p.id)).toHaveLength(2)
      } else {
        // Se anuló antes: el pago ya no tiene saldo a favor y `dos` no recibe nada.
        expect(await aplicar.json()).toEqual({
          message: 'El pago está anulado: no tiene saldo a favor',
        })
        expect(voidedOnDos).toEqual([])
        expect(await allocationsOfPayment(p.id)).toHaveLength(1)
      }
      // En los dos órdenes: el pago no cuenta y los trabajos deben todo.
      expect(await caseOf(uno.id)).toMatchObject({ status: 'entregado', paidAt: null })
      const after = await detail()
      expect(after).toMatchObject({ balance: '135.00', credit: '0.00' })
      expect(after.openCases.map((c) => c.outstanding)).toEqual(['45.00', '45.00', '45.00'])
    })

    it('concurrencia: pagos simultáneos al mismo trabajo no lo sobrepagan', async () => {
      const c = await deliverCase()
      const intentos = await Promise.all(
        Array.from({ length: 4 }, () =>
          post(
            '/api/cuentas/pagos',
            recepcion,
            pago({ monto: '30.00', asignaciones: [{ trabajoId: c.id, monto: '30.00' }] }),
          ),
        ),
      )
      const statuses = intentos.map((r) => r.status).sort()
      expect(statuses).toEqual([201, 422, 422, 422])
      for (const r of intentos.filter((x) => x.status === 422)) {
        expect(((await r.json()) as Issues).issues).toEqual([
          { path: 'asignaciones.0.monto', message: 'Supera lo pendiente del trabajo (15.00)' },
        ])
      }
      expect(await ctx.db.select().from(ctx.schema.payments)).toHaveLength(1)
      expect((await detail()).openCases).toEqual([
        expect.objectContaining({ id: c.id, allocated: '30.00', outstanding: '15.00' }),
      ])
    })
  })

  describe('ajustes (CTA-3)', () => {
    type Issues = { message: string; issues: { path: string; message: string }[] }
    type Event = {
      type: string
      fromValue: string | null
      toValue: string | null
      reason: string | null
    }
    type Detail = {
      balance: string
      aging: Record<string, string>
      oldestDays: number | null
      openCases: { id: string; adjustments: string; outstanding: string }[]
      credit: string
      movements: {
        id: string
        kind: string
        amount: string
        by: string | null
        reason: string | null
        remaining: string | null
      }[]
    }

    const ajuste = (over: Record<string, unknown> = {}) => ({
      clinicaId: clinicId,
      monto: '150.00',
      motivo: 'Saldo inicial',
      fecha: '2026-06-30',
      ...over,
    })
    const detail = async () =>
      (await (await get(`/api/cuentas/${clinicId}`, admin)).json()) as Detail
    const caseOf = async (id: string) =>
      (
        (await (await get(`/api/trabajos/${id}`, admin)).json()) as {
          case: { status: string; paidAt: string | null }
        }
      ).case
    const eventsOf = async (id: string, cookie = admin) =>
      ((await (await get(`/api/trabajos/${id}/eventos`, cookie)).json()) as { events: Event[] })
        .events
    const addAdjustment = async (body: unknown) => {
      const r = await post('/api/cuentas/ajustes', admin, body)
      expect(r.status).toBe(201)
      return ((await r.json()) as { ajuste: Record<string, unknown> }).ajuste
    }
    const pay = async (trabajoId: string, monto: string) => {
      const r = await post('/api/cuentas/pagos', recepcion, {
        clinicaId: clinicId,
        monto,
        metodo: 'efectivo',
        fecha: '2026-10-06',
        asignaciones: [{ trabajoId, monto }],
      })
      expect(r.status).toBe(201)
      return ((await r.json()) as { pago: { id: string } }).pago.id
    }

    it('permisos: solo el administrador registra ajustes', async () => {
      expect((await post('/api/cuentas/ajustes', '', ajuste())).status).toBe(401)
      for (const cookie of [recepcion, tecnico, mensajero]) {
        const r = await post('/api/cuentas/ajustes', cookie, ajuste())
        expect(r.status).toBe(403)
        expect(await r.json()).toEqual({ message: 'Sin permiso' })
      }
      expect(await ctx.db.select().from(ctx.schema.accountAdjustments)).toEqual([])
      await addAdjustment(ajuste())
    })

    it('saldo inicial: suma al saldo, entra en la antigüedad por su fecha y el movimiento dice quién', async () => {
      const ajustado = await addAdjustment(ajuste())
      expect(ajustado).toEqual({
        id: expect.any(String),
        clinicId,
        case: null,
        amount: '150.00',
        reason: 'Saldo inicial',
        date: '2026-06-30',
        createdAt: expect.any(String),
        by: 'Admin',
        released: '0.00',
      })
      const d = await detail()
      // 2026-06-30 → 98 días a 2026-10-06.
      expect(d).toMatchObject({
        balance: '150.00',
        aging: { '0_30': '0.00', '31_60': '0.00', '61_90': '0.00', '90_mas': '150.00' },
        oldestDays: 98,
        openCases: [],
      })
      expect(d.movements).toEqual([
        expect.objectContaining({
          kind: 'ajuste',
          amount: '150.00',
          by: 'Admin',
          reason: 'Saldo inicial',
        }),
      ])
      // La clínica aparece en «Cuentas» por su saldo inicial.
      expect(await (await get('/api/cuentas', recepcion)).json()).toMatchObject({
        clinics: [{ id: clinicId, balance: '150.00', oldestDays: 98 }],
      })
    })

    it('422 con el campo: motivo vacío, monto 0, otra clínica, trabajo sin entregar o inexistente, fecha futura', async () => {
      const entregado = await deliverCase()
      const nuevo = await createCase()
      const [otra] = await ctx.db
        .insert(ctx.schema.clinics)
        .values({ name: 'Clínica Norte' })
        .returning()
      const cases = [
        [{ motivo: ' ' }, 'motivo'],
        [{ monto: '0.00' }, 'monto'],
        [{ clinicaId: otra!.id, trabajoId: entregado.id }, 'trabajoId'],
        [{ trabajoId: nuevo.id }, 'trabajoId'],
        [{ trabajoId: randomUUID() }, 'trabajoId'],
        [{ clinicaId: randomUUID() }, 'clinicaId'],
        [{ fecha: '2026-10-07' }, 'fecha'],
      ] as const
      for (const [over, path] of cases) {
        const r = await post('/api/cuentas/ajustes', admin, ajuste(over))
        expect(r.status).toBe(422)
        const body = (await r.json()) as Issues
        expect(body.message).toBe('Datos inválidos')
        expect(body.issues.map((i) => i.path)).toContain(path)
        if (path === 'fecha') {
          expect(body.issues).toContainEqual({
            path: 'fecha',
            message: 'La fecha no puede ser posterior a hoy',
          })
        }
      }
      expect(await ctx.db.select().from(ctx.schema.accountAdjustments)).toEqual([])
    })

    it('un descuento que deja el neto del trabajo por debajo de 0 da 422 en monto; hasta el cargo vale', async () => {
      const c = await deliverCase()
      expect(c.total).toBe('45.00')
      const r = await post(
        '/api/cuentas/ajustes',
        admin,
        ajuste({ trabajoId: c.id, monto: '-45.01', motivo: 'Descuento' }),
      )
      expect(r.status).toBe(422)
      expect(await r.json()).toEqual({
        message: 'Datos inválidos',
        issues: [
          {
            path: 'monto',
            message: 'El descuento supera lo que vale el trabajo; regístralo sin trabajo',
          },
        ],
      })
      expect(await ctx.db.select().from(ctx.schema.accountAdjustments)).toEqual([])
      expect((await caseOf(c.id)).status).toBe('entregado')

      await addAdjustment(ajuste({ trabajoId: c.id, monto: '-45.00', motivo: 'Cortesía' }))
      expect((await caseOf(c.id)).status).toBe('cobrado')
      expect(await detail()).toMatchObject({ balance: '0.00', credit: '0.00', openCases: [] })
    })

    it('un descuento que cubre lo pendiente cierra el trabajo y un recargo lo reabre', async () => {
      const c = await deliverCase()
      await pay(c.id, '40.00')
      expect((await caseOf(c.id)).status).toBe('entregado')

      await addAdjustment(ajuste({ trabajoId: c.id, monto: '-5.00', motivo: 'Pronto pago' }))
      expect(await caseOf(c.id)).toMatchObject({
        status: 'cobrado',
        paidAt: CLOCK.now().toISOString(),
      })
      expect((await eventsOf(c.id)).slice(-2)).toEqual([
        expect.objectContaining({
          type: 'adjustment_added',
          toValue: '-5.00',
          reason: 'Pronto pago',
        }),
        expect.objectContaining({
          type: 'status_changed',
          fromValue: 'entregado',
          toValue: 'cobrado',
        }),
      ])
      expect(await detail()).toMatchObject({ balance: '0.00', openCases: [] })

      await addAdjustment(
        ajuste({ trabajoId: c.id, monto: '2.50', motivo: 'Recargo por urgencia' }),
      )
      expect(await caseOf(c.id)).toMatchObject({ status: 'entregado', paidAt: null })
      expect((await eventsOf(c.id)).slice(-2)).toEqual([
        expect.objectContaining({ type: 'adjustment_added', toValue: '2.50' }),
        expect.objectContaining({
          type: 'status_changed',
          fromValue: 'cobrado',
          toValue: 'entregado',
        }),
      ])
      expect(await detail()).toMatchObject({
        balance: '2.50',
        openCases: [{ id: c.id, adjustments: '-2.50', outstanding: '2.50' }],
      })
    })

    it('un descuento sobre un trabajo pagado entero devuelve el exceso al pago, que se aplica a otro trabajo', async () => {
      const cents = (v: string) => Math.round(Number(v) * 100)
      /** Cuadre de la decisión 10: saldo = Σ pendientes + Σ ajustes sin trabajo (aquí, 0) − a favor. */
      const expectBalanced = (d: Detail) =>
        expect(cents(d.balance)).toBe(
          d.openCases.reduce((sum, c) => sum + cents(c.outstanding), 0) - cents(d.credit),
        )
      const uno = await deliverCase()
      const p = await pay(uno.id, '45.00')

      const ajustado = await addAdjustment(
        ajuste({ trabajoId: uno.id, monto: '-5.00', motivo: 'Descuento tardío' }),
      )
      expect(ajustado).toMatchObject({ amount: '-5.00', released: '5.00' })
      expect((await caseOf(uno.id)).status).toBe('cobrado')
      const after = await detail()
      expect(after).toMatchObject({ balance: '-5.00', credit: '5.00', openCases: [] })
      expect(after.movements.find((m) => m.id === p)).toMatchObject({ remaining: '5.00' })
      expectBalanced(after)
      // UX5-03: el movimiento del ajuste dice lo que devolvió al saldo a favor.
      expect(after.movements.find((m) => m.kind === 'ajuste')).toMatchObject({
        reason: 'Descuento tardío · $ 5.00 vuelven al saldo a favor',
      })
      const [asignada] = await ctx.db
        .select()
        .from(ctx.schema.paymentAllocations)
        .where(eq(ctx.schema.paymentAllocations.paymentId, p))
      expect(asignada?.amount).toBe('40.00')
      expect((await eventsOf(uno.id)).at(-1)).toMatchObject({
        type: 'adjustment_added',
        toValue: '-5.00',
        reason: 'Descuento tardío · $ 5.00 vuelven al saldo a favor',
      })
      expect((await eventsOf(uno.id, tecnico)).at(-1)).toMatchObject({
        type: 'adjustment_added',
        toValue: null,
        reason: null,
      })

      // Otro trabajo con 5.00 pendientes: «Aplicar saldo a favor» de ese pago lo cierra.
      const dos = await deliverCase()
      await pay(dos.id, '40.00')
      const aplicado = await post(`/api/cuentas/pagos/${p}/asignaciones`, recepcion, {
        asignaciones: [{ trabajoId: dos.id, monto: '5.00' }],
      })
      expect(aplicado.status).toBe(201)
      expect((await caseOf(dos.id)).status).toBe('cobrado')
      const end = await detail()
      expect(end).toMatchObject({ balance: '0.00', credit: '0.00', openCases: [] })
      expect(end.movements.find((m) => m.id === p)).toMatchObject({ remaining: '0.00' })
      expectBalanced(end)
    })

    it('concurrencia: un pago que cubre el trabajo y un descuento a la vez dejan un estado coherente en cualquier orden', async () => {
      const cents = (v: string) => Math.round(Number(v) * 100)
      for (let i = 0; i < 4; i++) {
        const c = await deliverCase()
        const sendPayment = () =>
          post('/api/cuentas/pagos', recepcion, {
            clinicaId: clinicId,
            monto: '45.00',
            metodo: 'efectivo',
            fecha: '2026-10-06',
            asignaciones: [{ trabajoId: c.id, monto: '45.00' }],
          })
        const sendDiscount = () =>
          post(
            '/api/cuentas/ajustes',
            admin,
            ajuste({ trabajoId: c.id, monto: '-5.00', motivo: 'Descuento' }),
          )
        // Alterna cuál sale primero, para recorrer los dos órdenes.
        const [pago, descuento] =
          i % 2 === 0
            ? await Promise.all([sendPayment(), sendDiscount()])
            : await Promise.all([sendDiscount(), sendPayment()]).then(([d, p]) => [p, d] as const)
        expect(descuento.status).toBe(201)
        const { ajuste: a } = (await descuento.json()) as { ajuste: { released: string } }
        if (pago.status === 201) {
          // El pago llegó antes: el descuento devolvió el exceso a ese pago.
          expect(a.released).toBe('5.00')
        } else {
          // El descuento llegó antes: el pago ya no cabe en el pendiente nuevo.
          expect(pago.status).toBe(422)
          expect(((await pago.json()) as Issues).issues).toEqual([
            { path: 'asignaciones.0.monto', message: 'Supera lo pendiente del trabajo (40.00)' },
          ])
          expect(a.released).toBe('0.00')
        }
        // Σ asignado ≤ neto (45.00 − 5.00) y el estado sigue a lo que queda pendiente.
        const vigentes = await ctx.db
          .select({ amount: ctx.schema.paymentAllocations.amount })
          .from(ctx.schema.paymentAllocations)
          .where(eq(ctx.schema.paymentAllocations.caseId, c.id))
        const asignado = vigentes.reduce((sum, x) => sum + cents(x.amount), 0)
        expect(asignado).toBeLessThanOrEqual(4_000)
        expect((await caseOf(c.id)).status).toBe(asignado === 4_000 ? 'cobrado' : 'entregado')
      }
      // Cuadre de la decisión 10 con todo lo anterior (sin ajustes sueltos).
      const d = await detail()
      expect(cents(d.balance)).toBe(
        d.openCases.reduce((sum, x) => sum + cents(x.outstanding), 0) - cents(d.credit),
      )
    })

    it('historial por rol: técnico y mensajero ven el ajuste sin monto ni motivo', async () => {
      const c = await deliverCase()
      await addAdjustment(ajuste({ trabajoId: c.id, monto: '-5.00', motivo: 'Descuento acordado' }))
      expect((await eventsOf(c.id, recepcion)).at(-1)).toMatchObject({
        type: 'adjustment_added',
        toValue: '-5.00',
        reason: 'Descuento acordado',
      })
      for (const cookie of [tecnico, mensajero]) {
        expect((await eventsOf(c.id, cookie)).at(-1)).toMatchObject({
          type: 'adjustment_added',
          toValue: null,
          reason: null,
        })
      }
    })
  })

  describe('estado de cuenta (CTA-5)', () => {
    type Statement = {
      clinic: Record<string, unknown>
      range: { desde: string; hasta: string }
      openingDate: string
      openingBalance: string
      movements: { kind: string; amount: string; balance: string; voided: unknown }[]
      totals: Record<string, string>
      closingBalance: string
      credit: string
      aging: Record<string, string>
      oldestDays: number | null
      openCases: { id: string; outstanding: string; days: number }[]
    }
    const url = (q: string) => `/api/cuentas/${clinicId}/estado?${q}`
    const OCTUBRE = 'desde=2026-10-01&hasta=2026-10-06'

    async function pay(body: Record<string, unknown>) {
      const r = await post('/api/cuentas/pagos', recepcion, {
        clinicaId: clinicId,
        metodo: 'efectivo',
        asignaciones: [],
        ...body,
      })
      expect(r.status).toBe(201)
      return ((await r.json()) as { pago: { id: string } }).pago.id
    }

    it('401 sin sesión, 403 técnico y mensajero, 200 admin y recepción', async () => {
      expect((await get(url(OCTUBRE), '')).status).toBe(401)
      expect((await get(url(OCTUBRE), tecnico)).status).toBe(403)
      expect((await get(url(OCTUBRE), mensajero)).status).toBe(403)
      expect((await get(url(OCTUBRE), admin)).status).toBe(200)
      expect((await get(url(OCTUBRE), recepcion)).status).toBe(200)
    })

    it('422 con desde posterior a hasta, sin fechas o con un id que no es uuid; 404 sin clínica', async () => {
      const r = await get(url('desde=2026-10-07&hasta=2026-10-06'), admin)
      expect(r.status).toBe(422)
      expect(await r.json()).toMatchObject({
        message: 'Datos inválidos',
        issues: [
          expect.objectContaining({
            path: 'hasta',
            message: 'La fecha final no puede ser anterior a la inicial',
          }),
        ],
      })
      expect((await get(url('desde=2026-10-01'), admin)).status).toBe(422)
      expect((await get(url('desde=ayer&hasta=hoy'), admin)).status).toBe(422)
      expect((await get(`/api/cuentas/abc/estado?${OCTUBRE}`, admin)).status).toBe(422)
      const missing = await get(`/api/cuentas/${randomUUID()}/estado?${OCTUBRE}`, admin)
      expect(missing.status).toBe(404)
      expect(await missing.json()).toEqual({ message: 'No encontrado' })
    })

    // I-2 de la revisión final del PR 2 (reloj de la suite: hoy es 2026-10-06).
    it('422 en hasta si es posterior a hoy', async () => {
      const r = await get(url('desde=2026-10-01&hasta=2026-10-31'), admin)
      expect(r.status).toBe(422)
      expect(await r.json()).toEqual({
        message: 'Datos inválidos',
        issues: [{ path: 'hasta', message: 'La fecha final no puede ser posterior a hoy' }],
      })
    })

    it('saldo inicial, movimientos con saldo corrido y saldo final; con hasta = hoy cuadra con la cuenta', async () => {
      await ctx.db
        .update(ctx.schema.clinics)
        .set({
          ruc: '1790012345001',
          address: 'Av. Amazonas N34-120',
          city: 'Quito',
          phone: '022345678',
        })
        .where(eq(ctx.schema.clinics.id, clinicId))
      const ini = await post('/api/cuentas/ajustes', admin, {
        clinicaId: clinicId,
        monto: '150.00',
        motivo: 'Saldo inicial',
        fecha: '2026-06-30',
      })
      expect(ini.status).toBe(201)
      // Anticipo de septiembre: a favor, antes del rango.
      await pay({ monto: '10.00', fecha: '2026-09-15' })
      const c = await deliverCase()
      await pay({
        monto: '20.00',
        fecha: '2026-10-06',
        asignaciones: [{ trabajoId: c.id, monto: '20.00' }],
      })
      const anulado = await pay({ monto: '5.00', fecha: '2026-10-05' })
      const voided = await post(`/api/cuentas/pagos/${anulado}/anular`, admin, {
        motivo: 'Duplicado',
      })
      expect(voided.status).toBe(200)

      const r = await get(url(OCTUBRE), recepcion)
      expect(r.status).toBe(200)
      const s = (await r.json()) as Statement
      expect(s.clinic).toEqual({
        id: clinicId,
        name: 'Clínica Sur',
        ruc: '1790012345001',
        address: 'Av. Amazonas N34-120',
        city: 'Quito',
        phone: '022345678',
      })
      expect(s.range).toEqual({ desde: '2026-10-01', hasta: '2026-10-06' })
      expect(s.openingDate).toBe('2026-09-30')
      // 150 − 10.
      expect(s.openingBalance).toBe('140.00')
      expect(s.movements.map((m) => [m.kind, m.amount, m.balance, m.voided !== null])).toEqual([
        ['pago', '-5.00', '140.00', true],
        ['cargo', '45.00', '185.00', false],
        ['pago', '-20.00', '165.00', false],
      ])
      expect(s.totals).toEqual({ cargo: '45.00', ajuste: '0.00', pago: '-20.00' })
      expect(s.closingBalance).toBe('165.00')
      expect(s.openCases).toEqual([
        expect.objectContaining({ id: c.id, outstanding: '25.00', days: 0 }),
      ])

      const account = (await (await get(`/api/cuentas/${clinicId}`, admin)).json()) as Statement & {
        balance: string
      }
      expect(s.closingBalance).toBe(account.balance)
      expect(s.credit).toBe(account.credit)
      expect(s.aging).toEqual(account.aging)
      expect(s.oldestDays).toBe(account.oldestDays)
      expect(s.openCases).toEqual(account.openCases)
    })
  })
})
