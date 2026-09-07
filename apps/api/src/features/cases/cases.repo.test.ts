import { randomUUID } from 'node:crypto'
import { caseListQuerySchema, caseInputSchema, type CaseInput } from '@dentalware/shared'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createUser, setupTestDb, truncateAll } from '../../test/setup.ts'
import {
  CaseInputError,
  CaseStateError,
  addEvent,
  createCase,
  getCase,
  listCases,
  listEvents,
  stripPrices,
  updateCase,
} from './repo.ts'

describe('features/cases/repo', () => {
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  let clinicId: string
  let doctorId: string
  let zr: string
  let ac: string
  let actor: string

  beforeAll(async () => {
    ctx = await setupTestDb()
  })
  afterAll(async () => {
    await ctx.pool.end()
  })
  beforeEach(async () => {
    await truncateAll(ctx.db)
    ;[[clinicId]] = [
      (await ctx.db.insert(ctx.schema.clinics).values({ name: 'Sonrisa' }).returning()).map(
        (r) => r.id,
      ),
    ]
    const [doctor] = await ctx.db
      .insert(ctx.schema.doctors)
      .values({ clinicId, name: 'Dr. Pérez' })
      .returning()
    doctorId = doctor!.id
    const [category] = await ctx.db
      .insert(ctx.schema.productCategories)
      .values({ name: 'Prótesis fija' })
      .returning()
    const [zrProduct] = await ctx.db
      .insert(ctx.schema.products)
      .values({
        code: 'ZR',
        name: 'Zirconio',
        categoryId: category!.id,
        pricingUnit: 'por_pieza',
        basePrice: '45.00',
      })
      .returning()
    zr = zrProduct!.id
    const [acProduct] = await ctx.db
      .insert(ctx.schema.products)
      .values({
        code: 'AC',
        name: 'Acrílico',
        categoryId: category!.id,
        pricingUnit: 'por_arcada',
        basePrice: '80.00',
      })
      .returning()
    ac = acProduct!.id
    await ctx.db.insert(ctx.schema.clinicProductPrices).values({
      clinicId,
      productId: zr,
      price: '40.00',
    })
    actor = await createUser(ctx.auth, ctx.db, {
      email: 'admin@t.local',
      password: 'Admin12345!',
      name: 'Admin',
      role: 'admin',
    })
  })

  function input(overrides: Partial<CaseInput> = {}): CaseInput {
    return caseInputSchema.parse({
      clinicId,
      doctorId,
      patientRef: 'Paciente 1',
      receivedAt: '2026-09-06',
      items: [{ productId: zr, quantity: 1 }],
      ...overrides,
    })
  }

  it('genera códigos AA-NNNNN consecutivos por año', async () => {
    const a = await createCase(ctx.db, input({ receivedAt: '2026-09-06' }), actor)
    const b = await createCase(ctx.db, input({ receivedAt: '2026-09-07' }), actor)
    const c = await createCase(ctx.db, input({ receivedAt: '2027-01-02' }), actor)
    expect((await getCase(ctx.db, a))!.code).toBe('26-00001')
    expect((await getCase(ctx.db, b))!.code).toBe('26-00002')
    expect((await getCase(ctx.db, c))!.code).toBe('27-00001')
  })

  it('resuelve precio especial de la clínica, calcula totales y escribe el evento created', async () => {
    const id = await createCase(
      ctx.db,
      input({
        items: [
          { productId: zr, quantity: 2, teeth: [11, 12], discountPct: 10 },
          { productId: ac, quantity: 1, unitPrice: '75.00' },
        ],
      }),
      actor,
    )
    const c = (await getCase(ctx.db, id))!
    expect(c.items.map((i) => [i.unitPrice, i.lineTotal])).toEqual([
      ['40.00', '72.00'],
      ['75.00', '75.00'],
    ])
    expect(c.total).toBe('147.00')
    expect(c.status).toBe('nuevo')
    expect((await listEvents(ctx.db, id)).map((e) => e.type)).toEqual(['created'])
  })

  it('rechaza productos inexistentes o inactivos con CaseInputError', async () => {
    await expect(
      createCase(ctx.db, input({ items: [{ productId: randomUUID(), quantity: 1 }] }), actor),
    ).rejects.toBeInstanceOf(CaseInputError)
  })

  it('updateCase reemplaza líneas, recalcula total y registra edited y price_changed', async () => {
    const id = await createCase(ctx.db, input(), actor)
    await updateCase(
      ctx.db,
      id,
      input({ items: [{ productId: zr, quantity: 1, unitPrice: '30.00' }] }),
      actor,
    )
    const c = (await getCase(ctx.db, id))!
    expect(c.items).toHaveLength(1)
    expect(c.total).toBe('30.00')
    expect((await listEvents(ctx.db, id)).map((e) => e.type)).toEqual([
      'created',
      'edited',
      'price_changed',
    ])
  })

  it('updateCase lanza CaseStateError fuera de nuevo/en_proceso', async () => {
    const id = await createCase(ctx.db, input(), actor)
    await ctx.db
      .update(ctx.schema.cases)
      .set({ status: 'terminado' })
      .where(eq(ctx.schema.cases.id, id))
    await expect(updateCase(ctx.db, id, input(), actor)).rejects.toBeInstanceOf(CaseStateError)
  })

  it('listCases aplica vistas rápidas, búsqueda y paginación', async () => {
    // hoy = '2026-09-06'; crea: nuevo con dueDate hoy, en_proceso con dueDate ayer, terminado, cancelado
    const nuevoId = await createCase(ctx.db, input({ patientRef: 'Paciente 1' }), actor)
    await ctx.db
      .update(ctx.schema.cases)
      .set({ dueDate: '2026-09-06' })
      .where(eq(ctx.schema.cases.id, nuevoId))

    const enProcesoId = await createCase(ctx.db, input({ patientRef: 'Paciente 2' }), actor)
    await ctx.db
      .update(ctx.schema.cases)
      .set({ status: 'en_proceso', dueDate: '2026-09-05' })
      .where(eq(ctx.schema.cases.id, enProcesoId))

    const terminadoId = await createCase(ctx.db, input({ patientRef: 'Paciente 3' }), actor)
    await ctx.db
      .update(ctx.schema.cases)
      .set({ status: 'terminado' })
      .where(eq(ctx.schema.cases.id, terminadoId))

    const canceladoId = await createCase(ctx.db, input({ patientRef: 'Paciente 4' }), actor)
    await ctx.db
      .update(ctx.schema.cases)
      .set({ status: 'cancelado' })
      .where(eq(ctx.schema.cases.id, canceladoId))

    const r = await listCases(
      ctx.db,
      caseListQuerySchema.parse({ vista: 'vencen_hoy' }),
      '2026-09-06',
    )
    expect(r.cases.map((x) => x.code)).toEqual(['26-00001'])
    expect(
      (
        await listCases(ctx.db, caseListQuerySchema.parse({ vista: 'atrasados' }), '2026-09-06')
      ).cases.map((x) => x.code),
    ).toEqual(['26-00002'])
    expect(
      (await listCases(ctx.db, caseListQuerySchema.parse({ vista: 'listos' }), '2026-09-06')).total,
    ).toBe(1)
    expect(
      (await listCases(ctx.db, caseListQuerySchema.parse({ q: 'Paciente 2' }), '2026-09-06')).cases,
    ).toHaveLength(1)
    expect(
      (await listCases(ctx.db, caseListQuerySchema.parse({ q: '26-00003' }), '2026-09-06')).cases,
    ).toHaveLength(1)
    expect((await listCases(ctx.db, caseListQuerySchema.parse({}), '2026-09-06')).pageSize).toBe(50)
  })

  it('stripPrices anula precios y totales', () => {
    const s = stripPrices({
      total: '10.00',
      items: [{ unitPrice: '1.00', lineTotal: '1.00', discountPct: '0.00', quantity: 1 }],
    })
    expect(s.total).toBeNull()
    expect(s.items[0]).toMatchObject({
      unitPrice: null,
      lineTotal: null,
      discountPct: null,
      quantity: 1,
    })
  })

  it('addEvent registra un evento con actor', async () => {
    const id = await createCase(ctx.db, input(), actor)
    await addEvent(ctx.db, { caseId: id, type: 'comment', reason: 'nota', actorId: actor })
    const events = await listEvents(ctx.db, id)
    expect(events.map((e) => e.type)).toEqual(['created', 'comment'])
    expect(events[1]!.actor).toMatchObject({ id: actor })
  })
})
