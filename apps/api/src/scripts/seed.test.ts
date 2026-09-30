import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { users } from '../db/schema/index.ts'
import { setupTestDb, truncateAll } from '../test/setup.ts'
import { ensureAdmin } from './seed.ts'

/**
 * Crear el admin y asignarle el rol son dos pasos sin atomicidad (Better Auth usa su propia
 * conexión: una transacción de Drizzle no los envuelve a los dos). Si el segundo paso fallara
 * alguna vez, quedaría un usuario con `ADMIN_EMAIL` y un rol distinto de `admin`, y el seed
 * decía «Admin ya existe» sin corregirlo nunca. `ensureAdmin` es idempotente sobre el rol
 * (issue #21).
 */
describe('ensureAdmin', () => {
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  const admin = { email: 'admin-seed@lab.local', password: 'Admin12345!', name: 'Administrador' }

  beforeAll(async () => {
    ctx = await setupTestDb()
  })
  beforeEach(async () => {
    await truncateAll(ctx.db)
  })
  afterAll(async () => {
    await ctx.pool.end()
  })

  async function roleOf(email: string) {
    const [row] = await ctx.db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.email, email))
    return row?.role
  }

  it('crea el admin con rol admin cuando no existe', async () => {
    const result = await ensureAdmin(ctx.db, ctx.auth, admin)

    expect(result).toBe('creado')
    expect(await roleOf(admin.email)).toBe('admin')
  })

  it('no toca nada si el admin ya existe con rol admin', async () => {
    await ensureAdmin(ctx.db, ctx.auth, admin)

    const result = await ensureAdmin(ctx.db, ctx.auth, admin)

    expect(result).toBe('ya existía')
    expect(await roleOf(admin.email)).toBe('admin')
  })

  it('corrige el rol si el admin existe con otro rol (seed idempotente sobre el rol)', async () => {
    await ensureAdmin(ctx.db, ctx.auth, admin)
    await ctx.db.update(users).set({ role: 'tecnico' }).where(eq(users.email, admin.email))

    const result = await ensureAdmin(ctx.db, ctx.auth, admin)

    expect(result).toBe('corregido')
    expect(await roleOf(admin.email)).toBe('admin')
  })
})
