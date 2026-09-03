import { sql } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { loadConfig } from '../config.ts'
import { createDb } from './index.ts'
import { runMigrations } from './migrate.ts'

const config = loadConfig()
const { db, pool } = createDb(config.DATABASE_URL)

afterAll(async () => {
  await pool.end()
})

describe('migraciones', () => {
  it('crea las tablas de autenticación', async () => {
    await runMigrations(db)
    const result = await db.execute<{ table_name: string }>(sql`
      select table_name from information_schema.tables
      where table_schema = 'public' order by table_name
    `)
    const names = result.rows.map((r) => r.table_name)
    expect(names).toEqual(
      expect.arrayContaining(['users', 'sessions', 'accounts', 'verifications']),
    )
  })

  it('users tiene la columna role con default tecnico', async () => {
    const result = await db.execute<{ column_default: string | null }>(sql`
      select column_default from information_schema.columns
      where table_name = 'users' and column_name = 'role'
    `)
    expect(result.rows[0]?.column_default).toContain('tecnico')
  })
})
