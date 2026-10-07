import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { setupTestDb, truncateAll } from '../../test/setup.ts'

/** Violación de un CHECK (23514) concreto; Drizzle envuelve el error de `pg` en `cause`. */
const checkViolation = (constraint: string) =>
  expect.objectContaining({
    cause: expect.objectContaining({ code: '23514', constraint }),
  })

describe('esquema de cuentas', () => {
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  let userId: string
  let clinicId: string
  let caseId: string

  beforeAll(async () => {
    ctx = await setupTestDb()
  })
  afterAll(async () => {
    await ctx.pool.end()
  })
  beforeEach(async () => {
    await truncateAll(ctx.db)
    const [user] = await ctx.db
      .insert(ctx.schema.users)
      .values({ id: 'usr_cuentas', name: 'Admin', email: 'admin.cuentas@test.local' })
      .returning()
    userId = user!.id
    const [clinic] = await ctx.db
      .insert(ctx.schema.clinics)
      .values({ name: 'Clínica Sonrisa' })
      .returning()
    clinicId = clinic!.id
    const [doctor] = await ctx.db
      .insert(ctx.schema.doctors)
      .values({ clinicId, name: 'Dra. Paredes' })
      .returning()
    const [created] = await ctx.db
      .insert(ctx.schema.cases)
      .values({
        code: '26-00001',
        clinicId,
        doctorId: doctor!.id,
        patientRef: 'Paciente 1',
        receivedAt: '2026-10-01',
        total: '100.00',
        status: 'entregado',
        createdBy: userId,
      })
      .returning()
    caseId = created!.id
  })

  it('el enum de método de pago tiene los métodos de shared, en orden', async () => {
    const r = await ctx.db.execute<{ v: string[] }>(
      sql`select enum_range(null::payment_method)::text[] as v`,
    )
    expect(r.rows[0]?.v).toEqual(['efectivo', 'transferencia', 'tarjeta', 'cheque', 'otro'])
  })

  it('case_status tiene cobrado entre entregado y cancelado', async () => {
    const r = await ctx.db.execute<{ v: string[] }>(
      sql`select enum_range(null::case_status)::text[] as v`,
    )
    expect(r.rows[0]?.v).toEqual([
      'por_recoger',
      'nuevo',
      'en_proceso',
      'en_espera',
      'en_prueba',
      'terminado',
      'enviado',
      'entregado',
      'cobrado',
      'cancelado',
    ])
  })

  it('case_event_type acaba en los eventos de cobro', async () => {
    const r = await ctx.db.execute<{ v: string[] }>(
      sql`select enum_range(null::case_event_type)::text[] as v`,
    )
    expect(r.rows[0]?.v.slice(-4)).toEqual([
      'price_changed',
      'payment_applied',
      'payment_voided',
      'adjustment_added',
    ])
  })

  it('un trabajo pasa a cobrado y guarda sus eventos de cobro', async () => {
    await ctx.db.execute(sql`update cases set status = 'cobrado' where id = ${caseId}`)
    await ctx.db.insert(ctx.schema.caseEvents).values([
      { caseId, type: 'payment_applied', toValue: '100.00', reason: 'Efectivo', actorId: userId },
      { caseId, type: 'payment_voided', toValue: '100.00', reason: 'Duplicado', actorId: userId },
      { caseId, type: 'adjustment_added', toValue: '-5.00', reason: 'Descuento', actorId: userId },
    ])
    const r = await ctx.db.execute<{ status: string }>(
      sql`select status from cases where id = ${caseId}`,
    )
    expect(r.rows[0]?.status).toBe('cobrado')
  })

  it('guarda y lee un ajuste con trabajo y otro sin trabajo', async () => {
    await ctx.db.insert(ctx.schema.accountAdjustments).values([
      {
        clinicId,
        caseId,
        amount: '-10.50',
        reason: 'Descuento',
        date: '2026-10-02',
        createdBy: userId,
      },
      {
        clinicId,
        amount: '250.00',
        reason: 'Saldo inicial',
        date: '2026-09-30',
        createdBy: userId,
      },
    ])
    const rows = await ctx.db
      .select()
      .from(ctx.schema.accountAdjustments)
      .orderBy(ctx.schema.accountAdjustments.date)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ caseId: null, amount: '250.00', date: '2026-09-30' })
    expect(rows[1]).toMatchObject({ caseId, amount: '-10.50', reason: 'Descuento' })
    expect(rows[1]?.createdAt).toBeInstanceOf(Date)
  })

  it('guarda un pago con su asignación y su anulación', async () => {
    const [payment] = await ctx.db
      .insert(ctx.schema.payments)
      .values({
        clinicId,
        amount: '150.00',
        method: 'transferencia',
        paidOn: '2026-10-03',
        reference: 'TRX-1',
        notes: 'Pago de octubre',
        createdBy: userId,
      })
      .returning()
    expect(payment).toMatchObject({
      amount: '150.00',
      method: 'transferencia',
      paidOn: '2026-10-03',
      voidedAt: null,
      voidedBy: null,
      voidReason: null,
    })
    const [allocation] = await ctx.db
      .insert(ctx.schema.paymentAllocations)
      .values({ paymentId: payment!.id, caseId, amount: '100.00', createdBy: userId })
      .returning()
    expect(allocation).toMatchObject({ paymentId: payment!.id, caseId, amount: '100.00' })

    const voidedAt = new Date('2026-10-04T15:00:00Z')
    await ctx.db.execute(
      sql`update payments set voided_at = ${voidedAt}, voided_by = ${userId}, void_reason = 'Duplicado' where id = ${payment!.id}`,
    )
    const [read] = await ctx.db.select().from(ctx.schema.payments)
    expect(read).toMatchObject({ voidedAt, voidedBy: userId, voidReason: 'Duplicado' })
  })

  it('rechaza un pago de 0', async () => {
    await expect(
      ctx.db.insert(ctx.schema.payments).values({
        clinicId,
        amount: '0.00',
        method: 'efectivo',
        paidOn: '2026-10-03',
        createdBy: userId,
      }),
    ).rejects.toEqual(checkViolation('payments_amount_check'))
  })

  it('rechaza un pago negativo', async () => {
    await expect(
      ctx.db.insert(ctx.schema.payments).values({
        clinicId,
        amount: '-1.00',
        method: 'efectivo',
        paidOn: '2026-10-03',
        createdBy: userId,
      }),
    ).rejects.toEqual(checkViolation('payments_amount_check'))
  })

  it('rechaza un ajuste de 0', async () => {
    await expect(
      ctx.db.insert(ctx.schema.accountAdjustments).values({
        clinicId,
        amount: '0.00',
        reason: 'Nada',
        date: '2026-10-02',
        createdBy: userId,
      }),
    ).rejects.toEqual(checkViolation('account_adjustments_amount_check'))
  })

  it('rechaza una asignación negativa o de 0', async () => {
    const [payment] = await ctx.db
      .insert(ctx.schema.payments)
      .values({
        clinicId,
        amount: '50.00',
        method: 'efectivo',
        paidOn: '2026-10-03',
        createdBy: userId,
      })
      .returning()
    for (const amount of ['-5.00', '0.00']) {
      await expect(
        ctx.db
          .insert(ctx.schema.paymentAllocations)
          .values({ paymentId: payment!.id, caseId, amount, createdBy: userId }),
      ).rejects.toEqual(checkViolation('payment_allocations_amount_check'))
    }
  })

  it('rechaza un método de pago fuera del enum', async () => {
    await expect(
      ctx.db.execute(
        sql`insert into payments (clinic_id, amount, method, paid_on, created_by) values (${clinicId}, 10, 'bitcoin', '2026-10-03', ${userId})`,
      ),
    ).rejects.toEqual(
      expect.objectContaining({ cause: expect.objectContaining({ code: '22P02' }) }),
    )
  })
})
