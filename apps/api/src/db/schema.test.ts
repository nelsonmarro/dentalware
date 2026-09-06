import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setupTestDb, truncateAll } from '../test/setup.ts'

describe('esquema de configuración', () => {
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  beforeAll(async () => {
    ctx = await setupTestDb()
    await truncateAll(ctx.db)
  })
  afterAll(async () => {
    await ctx.pool.end()
  })

  it('crea las tablas de configuración', async () => {
    const r = await ctx.db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    )
    const names = r.rows.map((x) => x.table_name)
    for (const t of [
      'lab_settings',
      'clinics',
      'doctors',
      'product_categories',
      'products',
      'clinic_product_prices',
      'stages',
      'cases',
      'case_items',
      'case_events',
      'case_sequences',
      'attachments',
    ]) {
      expect(names).toContain(t)
    }
  })

  it('consulta relacional clínica → doctores', async () => {
    const [clinic] = await ctx.db
      .insert(ctx.schema.clinics)
      .values({ name: 'Clínica Sonrisa' })
      .returning()
    await ctx.db.insert(ctx.schema.doctors).values({ clinicId: clinic!.id, name: 'Dra. Paredes' })
    const rows = await ctx.db.query.clinics.findMany({ with: { doctors: true } })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.doctors[0]?.name).toBe('Dra. Paredes')
  })

  it('crea un trabajo con líneas y eventos y los consulta con sus relaciones', async () => {
    const [user] = await ctx.db
      .insert(ctx.schema.users)
      .values({ id: 'usr_test_admin', name: 'Admin', email: 'admin.schema@test.local' })
      .returning()
    const adminId = user!.id
    const [clinic] = await ctx.db
      .insert(ctx.schema.clinics)
      .values({ name: 'Clínica Sonrisa' })
      .returning()
    const [doctor] = await ctx.db
      .insert(ctx.schema.doctors)
      .values({ clinicId: clinic!.id, name: 'Dra. Paredes' })
      .returning()
    const [category] = await ctx.db
      .insert(ctx.schema.productCategories)
      .values({ name: 'Coronas' })
      .returning()
    const [product] = await ctx.db
      .insert(ctx.schema.products)
      .values({
        code: 'COR-1',
        name: 'Corona de zirconio',
        categoryId: category!.id,
        pricingUnit: 'por_pieza',
        basePrice: '50.00',
      })
      .returning()

    const [createdCase] = await ctx.db
      .insert(ctx.schema.cases)
      .values({
        code: '26-00001',
        clinicId: clinic!.id,
        doctorId: doctor!.id,
        patientRef: 'Paciente 1',
        receivedAt: '2026-09-06',
        total: '100.00',
        createdBy: adminId,
      })
      .returning()

    await ctx.db.insert(ctx.schema.caseItems).values([
      {
        caseId: createdCase!.id,
        productId: product!.id,
        quantity: 1,
        unitPrice: '50.00',
        lineTotal: '50.00',
      },
      {
        caseId: createdCase!.id,
        productId: product!.id,
        quantity: 1,
        unitPrice: '50.00',
        lineTotal: '50.00',
      },
    ])
    await ctx.db.insert(ctx.schema.caseEvents).values({
      caseId: createdCase!.id,
      type: 'created',
      actorId: adminId,
    })

    const found = await ctx.db.query.cases.findFirst({
      with: { items: { with: { product: true } }, clinic: true, events: true },
    })
    expect(found?.clinic.name).toBe('Clínica Sonrisa')
    expect(found?.items).toHaveLength(2)
    expect(found?.items[0]?.product.code).toBe('COR-1')
    expect(found?.events).toHaveLength(1)
    expect(found?.events[0]?.type).toBe('created')
  })

  it('incrementa la secuencia anual de forma atómica con upsert', async () => {
    const year = 2099
    const r1 = await ctx.db.execute<{ last: number }>(
      sql`insert into case_sequences (year, last) values (${year}, 1)
          on conflict (year) do update set last = case_sequences.last + 1
          returning last`,
    )
    expect(r1.rows[0]?.last).toBe(1)
    const r2 = await ctx.db.execute<{ last: number }>(
      sql`insert into case_sequences (year, last) values (${year}, 1)
          on conflict (year) do update set last = case_sequences.last + 1
          returning last`,
    )
    expect(r2.rows[0]?.last).toBe(2)
  })
})
