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
})
