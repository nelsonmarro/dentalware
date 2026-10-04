import { caseInputSchema, type CaseInput } from '@dentalware/shared'
import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
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
import { createCasesRepo } from '../cases/repo.ts'
import { createCouriersQuery, createDeliveriesRepo, drizzleDeliveriesUnitOfWork } from './repo.ts'
import { createDeliveriesService } from './service.ts'

// Reloj fijo (I-1 de ADR 32: "hoy" nunca sale de `new Date()`): "hoy" es 2026-10-10 en toda
// esta suite, así se puede fijar lo atrasado, lo de hoy y lo de otro día sin sincronizar con
// el reloj real.
const CLOCK = { today: () => '2026-10-10', now: () => new Date('2026-10-10T12:00:00Z') }

describe('/api/entregas', () => {
  const adminPwd = testPassword()
  const recepcionPwd = testPassword()
  const tecnicoPwd = testPassword()
  const mensajeroPwd = testPassword()
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  let app: ReturnType<typeof createApp>
  let admin: string
  let recepcion: string
  let tecnico: string
  let mensajero: string
  let mensajeroId: string
  let otroMensajeroId: string
  let clinicId: string
  let doctorId: string
  let productId: string
  let actorId: string

  const get = (path: string, cookie: string) =>
    app.request(path, { method: 'GET', headers: cookie ? { cookie } : {} })
  const post = (path: string, cookie: string, body: unknown) =>
    app.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    })

  function caseInput(overrides: Partial<CaseInput> = {}): CaseInput {
    return caseInputSchema.parse({
      clinicId,
      doctorId,
      patientRef: 'Paciente',
      receivedAt: '2026-09-06',
      items: [{ productId, quantity: 1 }],
      ...overrides,
    })
  }

  async function createCase(overrides: Partial<CaseInput> = {}) {
    return (await createCasesRepo(ctx.db).create(caseInput(overrides), actorId)).id
  }

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
    actorId = await createUser(ctx.auth, ctx.db, {
      email: 'admin@t.local',
      password: adminPwd,
      name: 'Admin',
      role: 'admin',
    })
    await createUser(ctx.auth, ctx.db, {
      email: 'recep@t.local',
      password: recepcionPwd,
      name: 'Recepción',
      role: 'recepcion',
    })
    await createUser(ctx.auth, ctx.db, {
      email: 'tec@t.local',
      password: tecnicoPwd,
      name: 'Ana Técnico',
      role: 'tecnico',
    })
    // En orden inverso al alfabético: sin `orderBy`, Postgres los devolvería así.
    mensajeroId = await createUser(ctx.auth, ctx.db, {
      email: 'zoila@t.local',
      password: mensajeroPwd,
      name: 'Zoila Mensajera',
      role: 'mensajero',
    })
    otroMensajeroId = await createUser(ctx.auth, ctx.db, {
      email: 'bruno@t.local',
      password: mensajeroPwd,
      name: 'Bruno Mensajero',
      role: 'mensajero',
    })
    admin = await loginAs(app, 'admin@t.local', adminPwd)
    recepcion = await loginAs(app, 'recep@t.local', recepcionPwd)
    tecnico = await loginAs(app, 'tec@t.local', tecnicoPwd)
    mensajero = await loginAs(app, 'zoila@t.local', mensajeroPwd)

    const [clinic] = await ctx.db
      .insert(ctx.schema.clinics)
      .values({ name: 'Sonrisa', address: 'Av. Amazonas 123', phone: '099-000-0000' })
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

  describe('GET /api/entregas', () => {
    it('el mensajero ve solo las suyas aunque pida otro mensajeroId; no trae dinero', async () => {
      const caseMio = await createCase({ patientRef: 'Mío' })
      const caseOtro = await createCase({ patientRef: 'De otro' })
      await createDeliveriesRepo(ctx.db).create({
        caseId: caseMio,
        type: 'entrega',
        courierId: mensajeroId,
        scheduledFor: '2026-10-10',
      })
      await createDeliveriesRepo(ctx.db).create({
        caseId: caseOtro,
        type: 'entrega',
        courierId: otroMensajeroId,
        scheduledFor: '2026-10-10',
      })

      const res = await get(
        `/api/entregas?dia=2026-10-10&mensajeroId=${otroMensajeroId}`,
        mensajero,
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as { entregas: Record<string, unknown>[] }
      expect(body.entregas.map((e) => (e.case as { patientRef: string }).patientRef)).toEqual([
        'Mío',
      ])
      expect(JSON.stringify(body)).not.toContain('"total"')
      expect(JSON.stringify(body)).not.toContain('"price"')
    })

    it('admin ve las de cualquier mensajero el día que pide', async () => {
      const caseId = await createCase()
      await createDeliveriesRepo(ctx.db).create({
        caseId,
        type: 'entrega',
        courierId: mensajeroId,
        scheduledFor: '2026-10-10',
      })
      const res = await get('/api/entregas?dia=2026-10-10', admin)
      expect(res.status).toBe(200)
      const body = (await res.json()) as { entregas: unknown[] }
      expect(body.entregas).toHaveLength(1)
    })

    it('hoy incluye las pendientes atrasadas; otro día no las trae', async () => {
      const caseId = await createCase({ patientRef: 'Atrasada' })
      await createDeliveriesRepo(ctx.db).create({
        caseId,
        type: 'entrega',
        courierId: mensajeroId,
        scheduledFor: '2026-10-08',
      })
      const hoy = await get('/api/entregas?dia=2026-10-10', admin)
      const hoyBody = (await hoy.json()) as { entregas: unknown[] }
      expect(hoyBody.entregas).toHaveLength(1)

      const otroDia = await get('/api/entregas?dia=2026-10-09', admin)
      const otroDiaBody = (await otroDia.json()) as { entregas: unknown[] }
      expect(otroDiaBody.entregas).toHaveLength(0)
    })

    it('una fallida de un trabajo cancelado se lista como dato no accionable', async () => {
      const caseId = await createCase({ patientRef: 'Cancelado' })
      const created = await createDeliveriesRepo(ctx.db).create({
        caseId,
        type: 'entrega',
        courierId: mensajeroId,
        scheduledFor: '2026-10-10',
      })
      await createDeliveriesRepo(ctx.db).markFailed(
        created.id,
        'Trabajo cancelado: ya no se necesita',
        new Date('2026-10-10T10:00:00Z'),
      )
      await ctx.db
        .update(ctx.schema.cases)
        .set({ status: 'cancelado' })
        .where(eq(ctx.schema.cases.id, caseId))

      const res = await get('/api/entregas?dia=2026-10-10', admin)
      const body = (await res.json()) as {
        entregas: { status: string; case: { status: string } }[]
      }
      expect(body.entregas).toEqual([
        expect.objectContaining({
          status: 'fallida',
          case: expect.objectContaining({
            status: 'cancelado',
          }),
        }),
      ])
    })

    it('técnico recibe 403', async () => {
      expect((await get('/api/entregas?dia=2026-10-10', tecnico)).status).toBe(403)
    })

    it('sin sesión responde 403', async () => {
      expect((await get('/api/entregas?dia=2026-10-10', '')).status).toBe(403)
    })

    it('dia inválido responde 422', async () => {
      expect((await get('/api/entregas?dia=no-es-fecha', admin)).status).toBe(422)
    })
  })

  describe('POST /api/entregas/:id/fallida', () => {
    it('el mensajero cierra la suya como fallida y la reprograma', async () => {
      const caseId = await createCase()
      const created = await createDeliveriesRepo(ctx.db).create({
        caseId,
        type: 'entrega',
        courierId: mensajeroId,
        scheduledFor: '2026-10-10',
      })
      const res = await post(`/api/entregas/${created.id}/fallida`, mensajero, {
        motivo: 'No había nadie',
        nuevaFecha: '2026-10-12',
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { entrega: Record<string, unknown> }
      expect(body.entrega).toMatchObject({
        caseId,
        type: 'entrega',
        courierId: mensajeroId,
        status: 'pendiente',
        scheduledFor: '2026-10-12',
      })

      const vieja = await createDeliveriesRepo(ctx.db).byId(created.id)
      expect(vieja?.status).toBe('fallida')
      expect(vieja?.failedReason).toBe('No había nadie')

      const eventos = await createCasesRepo(ctx.db).events(caseId)
      const evento = eventos.find((e) => e.type === 'delivery_failed')
      expect(evento).toMatchObject({ toValue: '2026-10-12', reason: 'No había nadie' })
    })

    it('admin reprograma la de cualquier mensajero', async () => {
      const caseId = await createCase()
      const created = await createDeliveriesRepo(ctx.db).create({
        caseId,
        type: 'entrega',
        courierId: mensajeroId,
        scheduledFor: '2026-10-10',
      })
      const res = await post(`/api/entregas/${created.id}/fallida`, admin, {
        motivo: 'Clínica cerrada',
        nuevaFecha: '2026-10-12',
      })
      expect(res.status).toBe(200)
    })

    it('de otro mensajero responde 403', async () => {
      const caseId = await createCase()
      const created = await createDeliveriesRepo(ctx.db).create({
        caseId,
        type: 'entrega',
        courierId: otroMensajeroId,
        scheduledFor: '2026-10-10',
      })
      const res = await post(`/api/entregas/${created.id}/fallida`, mensajero, {
        motivo: 'x',
        nuevaFecha: '2026-10-12',
      })
      expect(res.status).toBe(403)
    })

    it('de una entrega ya hecha responde 409 con el mensaje de shared', async () => {
      const caseId = await createCase()
      const created = await createDeliveriesRepo(ctx.db).create({
        caseId,
        type: 'entrega',
        courierId: mensajeroId,
        scheduledFor: '2026-10-10',
      })
      await createDeliveriesRepo(ctx.db).markDone(created.id, new Date(), null)
      const res = await post(`/api/entregas/${created.id}/fallida`, admin, {
        motivo: 'x',
        nuevaFecha: '2026-10-12',
      })
      expect(res.status).toBe(409)
      expect((await res.json()) as { message: string }).toMatchObject({
        message: 'Esta entrega ya no está pendiente.',
      })
    })

    it('con fecha anterior a hoy responde 422', async () => {
      const caseId = await createCase()
      const created = await createDeliveriesRepo(ctx.db).create({
        caseId,
        type: 'entrega',
        courierId: mensajeroId,
        scheduledFor: '2026-10-10',
      })
      const res = await post(`/api/entregas/${created.id}/fallida`, mensajero, {
        motivo: 'x',
        nuevaFecha: '2026-10-09',
      })
      expect(res.status).toBe(422)
    })

    it('técnico recibe 403', async () => {
      const caseId = await createCase()
      const created = await createDeliveriesRepo(ctx.db).create({
        caseId,
        type: 'entrega',
        courierId: mensajeroId,
        scheduledFor: '2026-10-10',
      })
      const res = await post(`/api/entregas/${created.id}/fallida`, tecnico, {
        motivo: 'x',
        nuevaFecha: '2026-10-12',
      })
      expect(res.status).toBe(403)
    })

    // I-1 de la revisión final del PR 2: «No se pudo» compite con las acciones que cierran o
    // anulan la misma entrega. Gane quien gane, nunca un 500, nunca dos pendientes del mismo
    // tipo y nunca un trabajo entregado con su entrega aún pendiente.
    describe('concurrencia', () => {
      /** Un trabajo `enviado` con su entrega pendiente asignada al mensajero y una constancia
       * lista, como lo deja `marcar_enviado` (se arma en la BD para no depender de esa ruta). */
      async function enviadoConEntrega() {
        const caseId = await createCase()
        await ctx.db
          .update(ctx.schema.cases)
          .set({ status: 'enviado' })
          .where(eq(ctx.schema.cases.id, caseId))
        const entrega = await createDeliveriesRepo(ctx.db).create({
          caseId,
          type: 'entrega',
          courierId: mensajeroId,
          scheduledFor: '2026-10-10',
        })
        const constanciaId = randomUUID()
        await ctx.db.insert(ctx.schema.attachments).values({
          id: constanciaId,
          caseId,
          kind: 'constancia',
          filename: 'constancia.jpg',
          mime: 'image/jpeg',
          size: 10,
          storagePath: `${caseId}/${constanciaId}.jpg`,
          uploadedBy: mensajeroId,
        })
        return { caseId, entregaId: entrega.id, constanciaId }
      }

      const pendientesDe = (caseId: string) =>
        ctx.db
          .select()
          .from(ctx.schema.deliveries)
          .where(
            and(
              eq(ctx.schema.deliveries.caseId, caseId),
              eq(ctx.schema.deliveries.status, 'pendiente'),
            ),
          )

      it('«No se pudo» y «Entregado» a la vez: nunca 500 ni una pendiente fantasma', async () => {
        for (let i = 0; i < 10; i++) {
          const { caseId, entregaId, constanciaId } = await enviadoConEntrega()
          const [fallida, entregado] = await Promise.all([
            post(`/api/entregas/${entregaId}/fallida`, mensajero, {
              motivo: 'No había nadie',
              nuevaFecha: '2026-10-12',
            }),
            post(`/api/trabajos/${caseId}/acciones`, admin, {
              accion: 'marcar_entregado',
              constanciaId,
            }),
          ])
          expect([fallida.status, entregado.status].sort()).not.toContain(500)
          if (fallida.status === 409) {
            expect(await fallida.json()).toEqual({ message: 'Esta entrega ya no está pendiente.' })
          }
          if (entregado.status === 409) {
            expect(await entregado.json()).toEqual({
              message: 'La entrega ya no está pendiente. Puede que otra persona la haya cerrado.',
            })
          }
          expect([200, 409]).toContain(fallida.status)
          expect([200, 409]).toContain(entregado.status)
          // Al menos una gana; si gana «Entregado», no queda ninguna entrega pendiente.
          expect(fallida.status === 200 || entregado.status === 200).toBe(true)
          const pendientes = await pendientesDe(caseId)
          expect(pendientes.length).toBeLessThanOrEqual(1)
          const [trabajo] = await ctx.db
            .select()
            .from(ctx.schema.cases)
            .where(eq(ctx.schema.cases.id, caseId))
          if (trabajo!.status === 'entregado') expect(pendientes).toEqual([])
          else expect(pendientes).toHaveLength(1)
        }
        // Sin aserción sobre cuántos conflictos hubo: si las peticiones se serializan (p. ej. en
        // CI), 200/200 es legítimo — «Entregado» cierra la entrega reprogramada —. El cierre
        // condicional lo prueban de forma determinista `repo.test.ts` y los tests de servicio.
      })

      // M-8: `fail` cierra, reprograma y escribe el evento en una sola transacción. Si el
      // evento falla (el último paso), Postgres deshace el cierre y la nueva pendiente.
      it('si el evento del historial falla, la entrega sigue pendiente y no se reprograma', async () => {
        const { caseId, entregaId } = await enviadoConEntrega()
        const service = createDeliveriesService({
          deliveries: createDeliveriesRepo(ctx.db),
          couriers: createCouriersQuery(ctx.db),
          uow: drizzleDeliveriesUnitOfWork(ctx.db, {
            events: () => ({
              addEvent: () => Promise.reject(new Error('el historial no está disponible')),
            }),
          }),
          clock: CLOCK,
        })
        await expect(
          service.fail(
            entregaId,
            { motivo: 'No había nadie', nuevaFecha: '2026-10-12' },
            { userId: mensajeroId, role: 'mensajero' },
          ),
        ).rejects.toThrow('el historial no está disponible')
        const filas = await ctx.db
          .select()
          .from(ctx.schema.deliveries)
          .where(eq(ctx.schema.deliveries.caseId, caseId))
        expect(filas).toEqual([
          expect.objectContaining({ id: entregaId, status: 'pendiente', failedReason: null }),
        ])
      })

      it('dos «No se pudo» a la vez sobre la misma entrega: un 200 y un 409, nunca 500', async () => {
        for (let i = 0; i < 10; i++) {
          const { caseId, entregaId } = await enviadoConEntrega()
          const body = { motivo: 'No había nadie', nuevaFecha: '2026-10-12' }
          const res = await Promise.all([
            post(`/api/entregas/${entregaId}/fallida`, mensajero, body),
            post(`/api/entregas/${entregaId}/fallida`, admin, body),
          ])
          expect(res.map((r) => r.status).sort()).toEqual([200, 409])
          const conflicto = res.find((r) => r.status === 409)!
          expect(await conflicto.json()).toEqual({ message: 'Esta entrega ya no está pendiente.' })
          expect(await pendientesDe(caseId)).toHaveLength(1)
        }
      })
    })

    it('sin sesión responde 403', async () => {
      const caseId = await createCase()
      const created = await createDeliveriesRepo(ctx.db).create({
        caseId,
        type: 'entrega',
        courierId: mensajeroId,
        scheduledFor: '2026-10-10',
      })
      const res = await post(`/api/entregas/${created.id}/fallida`, '', {
        motivo: 'x',
        nuevaFecha: '2026-10-12',
      })
      expect(res.status).toBe(403)
    })
  })
})
