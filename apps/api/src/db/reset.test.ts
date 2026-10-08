import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setupTestDb } from '../test/setup.ts'
import { TRUNCATED_TABLES } from './reset.ts'

describe('truncateAll', () => {
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  beforeAll(async () => {
    ctx = await setupTestDb()
  })
  afterAll(async () => {
    await ctx.pool.end()
  })

  // Con `cascade`, una tabla que apunta a otra truncada se vacía igual; nombrarlas todas evita
  // depender de eso (una tabla nueva sin FK a ninguna quedaría sucia entre tests).
  it('nombra todas las tablas del esquema público', async () => {
    const r = await ctx.db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables
          where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
    )
    expect([...TRUNCATED_TABLES].sort()).toEqual(r.rows.map((x) => x.table_name).sort())
  })
})
