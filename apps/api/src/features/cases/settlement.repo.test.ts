import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { setupTestDb, truncateAll } from '../../test/setup.ts'
import { createCaseSettlement } from './repo.ts'

/** Otra conexión intenta bloquear la misma fila sin esperar: falla si ya está bloqueada. */
const lockedElsewhere = async (pool: Awaited<ReturnType<typeof setupTestDb>>['pool'], id: string) =>
  pool.query('select id from cases where id = $1 for no key update nowait', [id]).then(
    () => false,
    (e: { code?: string }) => e.code === '55P03',
  )

describe('features/cases/repo: CaseSettlement (cuentas, ADR 35)', () => {
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  let actorId: string
  let clinicId: string
  let doctorId: string
  let seq = 0

  beforeAll(async () => {
    ctx = await setupTestDb()
  })
  afterAll(async () => {
    await ctx.pool.end()
  })
  beforeEach(async () => {
    await truncateAll(ctx.db)
    seq = 0
    const [user] = await ctx.db
      .insert(ctx.schema.users)
      .values({ id: 'usr_recep', name: 'Rosa', email: 'recep.settlement@test.local' })
      .returning()
    actorId = user!.id
    const [clinic] = await ctx.db.insert(ctx.schema.clinics).values({ name: 'Sur' }).returning()
    clinicId = clinic!.id
    const [doctor] = await ctx.db
      .insert(ctx.schema.doctors)
      .values({ clinicId, name: 'Dra. Paredes' })
      .returning()
    doctorId = doctor!.id
  })

  async function insertCase(over: Partial<typeof ctx.schema.cases.$inferInsert> = {}) {
    seq += 1
    const [row] = await ctx.db
      .insert(ctx.schema.cases)
      .values({
        code: `26-0000${seq}`,
        clinicId,
        doctorId,
        patientRef: `Paciente ${seq}`,
        receivedAt: '2026-09-01',
        total: '100.00',
        status: 'entregado',
        deliveredAt: new Date('2026-09-10T17:00:00Z'),
        createdBy: actorId,
        ...over,
      })
      .returning()
    return row!
  }

  const caseRow = async (id: string) => (await ctx.db.query.cases.findFirst({ where: { id } }))!
  const eventsOf = (caseId: string) =>
    ctx.db.query.caseEvents.findMany({ where: { caseId }, orderBy: { createdAt: 'asc' } })

  it('lockCases devuelve los trabajos pedidos, en orden de id, y los bloquea hasta el fin de la transacción', async () => {
    const a = await insertCase({ total: '80.50' })
    const r = await insertCase({ remakeChargePct: '50.00', status: 'cobrado' })
    const otro = await insertCase()
    await ctx.db.transaction(async (tx) => {
      const rows = await createCaseSettlement(tx).lockCases([
        r.id,
        a.id,
        '00000000-0000-4000-8000-000000000000',
      ])
      expect(rows).toEqual(
        [
          {
            id: a.id,
            clinicId,
            status: 'entregado',
            totalCents: 8_050,
            remakeChargePct: null,
            deliveredAt: new Date('2026-09-10T17:00:00Z'),
          },
          {
            id: r.id,
            clinicId,
            status: 'cobrado',
            totalCents: 10_000,
            remakeChargePct: 50,
            deliveredAt: new Date('2026-09-10T17:00:00Z'),
          },
        ].sort((x, y) => x.id.localeCompare(y.id)),
      )
      expect(await lockedElsewhere(ctx.pool, a.id)).toBe(true)
      expect(await lockedElsewhere(ctx.pool, r.id)).toBe(true)
      expect(await lockedElsewhere(ctx.pool, otro.id)).toBe(false)
    })
    expect(await lockedElsewhere(ctx.pool, a.id)).toBe(false)
    expect(await createCaseSettlement(ctx.db).lockCases([])).toEqual([])
  })

  it('setPaid con fecha pasa un entregado a cobrado con paid_at y escribe status_changed', async () => {
    const c = await insertCase()
    const paidAt = new Date('2026-10-06T17:00:00Z')
    await createCaseSettlement(ctx.db).setPaid(c.id, paidAt, actorId)
    expect(await caseRow(c.id)).toMatchObject({ status: 'cobrado', paidAt })
    expect(await eventsOf(c.id)).toEqual([
      expect.objectContaining({
        type: 'status_changed',
        fromValue: 'entregado',
        toValue: 'cobrado',
        actorId,
      }),
    ])
  })

  it('setPaid sin fecha devuelve un cobrado a entregado sin paid_at', async () => {
    const c = await insertCase({ status: 'cobrado', paidAt: new Date('2026-10-01T17:00:00Z') })
    await createCaseSettlement(ctx.db).setPaid(c.id, null, actorId)
    expect(await caseRow(c.id)).toMatchObject({ status: 'entregado', paidAt: null })
    expect(await eventsOf(c.id)).toEqual([
      expect.objectContaining({
        type: 'status_changed',
        fromValue: 'cobrado',
        toValue: 'entregado',
      }),
    ])
  })

  it('setPaid no toca un trabajo que no está en el estado de partida', async () => {
    const yaCobrado = await insertCase({
      status: 'cobrado',
      paidAt: new Date('2026-10-01T17:00:00Z'),
    })
    const enProceso = await insertCase({ status: 'en_proceso', deliveredAt: null })
    const entregado = await insertCase()
    const settlement = createCaseSettlement(ctx.db)
    await settlement.setPaid(yaCobrado.id, new Date('2026-10-06T17:00:00Z'), actorId)
    await settlement.setPaid(enProceso.id, new Date('2026-10-06T17:00:00Z'), actorId)
    await settlement.setPaid(entregado.id, null, actorId)
    expect(await caseRow(yaCobrado.id)).toMatchObject({
      status: 'cobrado',
      paidAt: new Date('2026-10-01T17:00:00Z'),
    })
    expect((await caseRow(enProceso.id)).status).toBe('en_proceso')
    expect((await caseRow(entregado.id)).status).toBe('entregado')
    for (const id of [yaCobrado.id, enProceso.id, entregado.id]) {
      expect(await eventsOf(id)).toEqual([])
    }
  })

  it('addEvent escribe el evento de cobro con su monto y su motivo', async () => {
    const c = await insertCase()
    await createCaseSettlement(ctx.db).addEvent({
      caseId: c.id,
      type: 'payment_applied',
      toValue: '45.00',
      reason: 'Transferencia · TRX-1',
      actorId,
    })
    expect(await eventsOf(c.id)).toEqual([
      expect.objectContaining({
        type: 'payment_applied',
        fromValue: null,
        toValue: '45.00',
        reason: 'Transferencia · TRX-1',
        actorId,
      }),
    ])
  })
})
