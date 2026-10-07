import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { setupTestDb, truncateAll } from '../../test/setup.ts'
import { createAccountsRepo } from './repo.ts'

describe('features/accounts/repo', () => {
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  let adminId: string
  let recepId: string
  let surId: string
  let norteId: string
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
    const [admin, recep] = await ctx.db
      .insert(ctx.schema.users)
      .values([
        { id: 'usr_admin', name: 'Ana Admin', email: 'admin.repo@test.local' },
        { id: 'usr_recep', name: 'Rosa Recepción', email: 'recep.repo@test.local' },
      ])
      .returning()
    adminId = admin!.id
    recepId = recep!.id
    const [sur, norte] = await ctx.db
      .insert(ctx.schema.clinics)
      .values([{ name: 'Clínica Sur' }, { name: 'Clínica Norte', active: false }])
      .returning()
    surId = sur!.id
    norteId = norte!.id
    const [doctor] = await ctx.db
      .insert(ctx.schema.doctors)
      .values({ clinicId: surId, name: 'Dra. Paredes' })
      .returning()
    doctorId = doctor!.id
  })

  async function insertCase(over: Partial<typeof ctx.schema.cases.$inferInsert> = {}) {
    seq += 1
    const [row] = await ctx.db
      .insert(ctx.schema.cases)
      .values({
        code: `26-0000${seq}`,
        clinicId: surId,
        doctorId,
        patientRef: `Paciente ${seq}`,
        receivedAt: '2026-09-01',
        total: '100.00',
        status: 'entregado',
        deliveredAt: new Date('2026-09-10T17:00:00Z'),
        createdBy: adminId,
        ...over,
      })
      .returning()
    return row!
  }

  async function insertPayment(over: Partial<typeof ctx.schema.payments.$inferInsert> = {}) {
    const [row] = await ctx.db
      .insert(ctx.schema.payments)
      .values({
        clinicId: surId,
        amount: '50.00',
        method: 'efectivo',
        paidOn: '2026-10-01',
        createdBy: recepId,
        ...over,
      })
      .returning()
    return row!
  }

  it('clinicById y clinics devuelven id, nombre y si está activa', async () => {
    const repo = createAccountsRepo(ctx.db)
    expect(await repo.clinicById(surId)).toEqual({ id: surId, name: 'Clínica Sur', active: true })
    expect(await repo.clinicById('00000000-0000-4000-8000-000000000000')).toBeUndefined()
    expect(await repo.clinics()).toEqual(
      expect.arrayContaining([
        { id: surId, name: 'Clínica Sur', active: true },
        { id: norteId, name: 'Clínica Norte', active: false },
      ]),
    )
  })

  it('billedCases: solo entregados y cobrados, con total, repetición, ajustes y asignaciones vigentes', async () => {
    const a = await insertCase({ total: '120.50' })
    const remake = await insertCase({ status: 'cobrado', remakeChargePct: '50.00' })
    await insertCase({ status: 'enviado', deliveredAt: null })
    await insertCase({ status: 'en_proceso', deliveredAt: null })
    await ctx.db.insert(ctx.schema.accountAdjustments).values([
      {
        clinicId: surId,
        caseId: a.id,
        amount: '-10.25',
        reason: 'Desc',
        date: '2026-09-11',
        createdBy: adminId,
      },
      {
        clinicId: surId,
        caseId: a.id,
        amount: '5.00',
        reason: 'Rec',
        date: '2026-09-12',
        createdBy: adminId,
      },
      {
        clinicId: surId,
        amount: '99.00',
        reason: 'Suelto',
        date: '2026-09-12',
        createdBy: adminId,
      },
    ])
    const vigente = await insertPayment({ amount: '80.00' })
    const anulado = await insertPayment({
      amount: '30.00',
      voidedAt: new Date('2026-10-02T15:00:00Z'),
      voidedBy: adminId,
      voidReason: 'Duplicado',
    })
    await ctx.db.insert(ctx.schema.paymentAllocations).values([
      { paymentId: vigente.id, caseId: a.id, amount: '20.00', createdBy: recepId },
      { paymentId: vigente.id, caseId: remake.id, amount: '50.00', createdBy: recepId },
      { paymentId: anulado.id, caseId: a.id, amount: '30.00', createdBy: recepId },
    ])

    const rows = await createAccountsRepo(ctx.db).billedCases(surId)
    expect(rows.sort((x, y) => x.code.localeCompare(y.code))).toEqual([
      {
        id: a.id,
        clinicId: surId,
        code: a.code,
        patientRef: a.patientRef,
        status: 'entregado',
        deliveredAt: new Date('2026-09-10T17:00:00Z'),
        totalCents: 12_050,
        remakeChargePct: null,
        adjustmentsCents: -525,
        allocatedCents: 2_000,
      },
      {
        id: remake.id,
        clinicId: surId,
        code: remake.code,
        patientRef: remake.patientRef,
        status: 'cobrado',
        deliveredAt: new Date('2026-09-10T17:00:00Z'),
        totalCents: 10_000,
        remakeChargePct: 50,
        adjustmentsCents: 0,
        allocatedCents: 5_000,
      },
    ])
  })

  it('billedCases sin clínica trae las de todas; con clínica, solo las suyas', async () => {
    await insertCase()
    await insertCase({ clinicId: norteId })
    const repo = createAccountsRepo(ctx.db)
    expect((await repo.billedCases()).map((c) => c.clinicId).sort()).toEqual(
      [surId, norteId].sort(),
    )
    expect((await repo.billedCases(norteId)).map((c) => c.clinicId)).toEqual([norteId])
  })

  it('billedCases usa la última modificación si faltara la fecha de entrega', async () => {
    const c = await insertCase({
      deliveredAt: null,
      updatedAt: new Date('2026-09-20T17:00:00Z'),
    })
    const [row] = await createAccountsRepo(ctx.db).billedCases(surId)
    expect(row?.id).toBe(c.id)
    expect(row?.deliveredAt).toEqual(new Date('2026-09-20T17:00:00Z'))
  })

  it('adjustments: con signo, trabajo (código) o sin él, fecha y quién lo registró', async () => {
    const c = await insertCase()
    const [ligado, suelto] = await ctx.db
      .insert(ctx.schema.accountAdjustments)
      .values([
        {
          clinicId: surId,
          caseId: c.id,
          amount: '-10.25',
          reason: 'Descuento',
          date: '2026-09-11',
          createdBy: adminId,
        },
        {
          clinicId: surId,
          amount: '99.00',
          reason: 'Saldo inicial',
          date: '2026-01-01',
          createdBy: adminId,
        },
        {
          clinicId: norteId,
          amount: '1.00',
          reason: 'Otra',
          date: '2026-01-01',
          createdBy: adminId,
        },
      ])
      .returning()
    const rows = await createAccountsRepo(ctx.db).adjustments(surId)
    expect(rows.sort((x, y) => x.date.localeCompare(y.date))).toEqual([
      {
        id: suelto!.id,
        clinicId: surId,
        case: null,
        amountCents: 9_900,
        reason: 'Saldo inicial',
        date: '2026-01-01',
        createdAt: suelto!.createdAt,
        createdByName: 'Ana Admin',
      },
      {
        id: ligado!.id,
        clinicId: surId,
        case: { id: c.id, code: c.code },
        amountCents: -1_025,
        reason: 'Descuento',
        date: '2026-09-11',
        createdAt: ligado!.createdAt,
        createdByName: 'Ana Admin',
      },
    ])
    expect(await createAccountsRepo(ctx.db).adjustments()).toHaveLength(3)
  })

  it('payments: vigentes y anulados, con lo asignado de cada uno, quién y la anulación', async () => {
    const c = await insertCase()
    const vigente = await insertPayment({
      amount: '80.00',
      method: 'cheque',
      reference: 'CH-1',
      notes: 'Parcial',
    })
    const anulado = await insertPayment({
      amount: '30.00',
      paidOn: '2026-10-02',
      voidedAt: new Date('2026-10-03T15:00:00Z'),
      voidedBy: adminId,
      voidReason: 'Duplicado',
    })
    await insertPayment({ clinicId: norteId })
    await ctx.db.insert(ctx.schema.paymentAllocations).values([
      { paymentId: vigente.id, caseId: c.id, amount: '20.00', createdBy: recepId },
      { paymentId: anulado.id, caseId: c.id, amount: '30.00', createdBy: recepId },
    ])
    const rows = await createAccountsRepo(ctx.db).payments(surId)
    expect(rows.sort((x, y) => x.paidOn.localeCompare(y.paidOn))).toEqual([
      {
        id: vigente.id,
        clinicId: surId,
        amountCents: 8_000,
        allocatedCents: 2_000,
        method: 'cheque',
        paidOn: '2026-10-01',
        reference: 'CH-1',
        notes: 'Parcial',
        createdAt: vigente.createdAt,
        createdByName: 'Rosa Recepción',
        voided: null,
      },
      {
        id: anulado.id,
        clinicId: surId,
        amountCents: 3_000,
        allocatedCents: 3_000,
        method: 'efectivo',
        paidOn: '2026-10-02',
        reference: null,
        notes: null,
        createdAt: anulado.createdAt,
        createdByName: 'Rosa Recepción',
        voided: {
          at: new Date('2026-10-03T15:00:00Z'),
          byName: 'Ana Admin',
          reason: 'Duplicado',
        },
      },
    ])
    expect(await createAccountsRepo(ctx.db).payments()).toHaveLength(3)
  })
})
