import { USER_ROLES } from '@dentalware/shared'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { setupTestDb, truncateAll } from '../../test/setup.ts'

/**
 * `role: text('role', { enum: [...] })` solo tipa TypeScript: Postgres acepta cualquier texto
 * en esa columna salvo que haya un CHECK. Estos tests insertan con SQL directo (sin pasar por
 * el `enum` de Drizzle, que rechazaría un rol inválido en tiempo de compilación) para probar
 * la restricción real en la base de datos (issue #21).
 */
describe('CHECK de role en users', () => {
  let ctx: Awaited<ReturnType<typeof setupTestDb>>

  beforeAll(async () => {
    ctx = await setupTestDb()
  })
  beforeEach(async () => {
    await truncateAll(ctx.db)
  })
  afterAll(async () => {
    await ctx.pool.end()
  })

  it('rechaza un rol que no es uno de los roles del dominio', async () => {
    await expect(
      ctx.db.execute(
        sql`insert into users (id, name, email, role)
            values ('usr_test_rol_invalido', 'Prueba', 'rol-invalido@test.local', 'superadmin')`,
      ),
    ).rejects.toThrow()
  })

  it('acepta cada uno de los roles válidos del dominio', async () => {
    for (const [i, role] of USER_ROLES.entries()) {
      await ctx.db.execute(
        sql`insert into users (id, name, email, role)
            values (${`usr_test_rol_${i}`}, 'Prueba', ${`rol-${role}@test.local`}, ${role})`,
      )
    }
  })
})
