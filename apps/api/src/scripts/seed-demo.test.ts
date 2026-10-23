import { count, eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { cases, clinics, labSettings, users } from '../db/schema/index.ts'
import { testPassword } from '../test/passwords.ts'
import { cleanupTestStorage, setupTestDb, truncateAll } from '../test/setup.ts'
import { ensureAdmin } from './seed.ts'
import { seedCatalogs } from './seed-data.ts'
import { assertDemoEnv, seedDemo } from './seed-demo.ts'
import { DEMO_LAB, DEMO_USERS } from './seed-demo-data.ts'

describe('assertDemoEnv', () => {
  it('se niega fuera de NODE_ENV=test: nunca pisa una BD real', () => {
    expect(() => assertDemoEnv('development', 'x')).toThrow(/solo se ejecuta con NODE_ENV=test/)
    expect(() => assertDemoEnv('production', 'x')).toThrow(/solo se ejecuta con NODE_ENV=test/)
  })
  it('exige DEMO_PASSWORD', () => {
    expect(() => assertDemoEnv('test', undefined)).toThrow(/DEMO_PASSWORD/)
    expect(() => assertDemoEnv('test', '')).toThrow(/DEMO_PASSWORD/)
  })
  it('con NODE_ENV=test y contraseña, pasa', () => {
    expect(() => assertDemoEnv('test', testPassword())).not.toThrow()
  })
})

describe('seedDemo', () => {
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  const password = testPassword()
  const admin = { email: 'admin-demo@lab.local', password: testPassword(), name: 'Admin' }

  beforeAll(async () => {
    ctx = await setupTestDb()
  })
  beforeEach(async () => {
    await truncateAll(ctx.db)
    await ensureAdmin(ctx.db, ctx.auth, admin)
    await seedCatalogs(ctx.db)
  })
  afterAll(async () => {
    await cleanupTestStorage(ctx)
    await ctx.pool.end()
  })

  const run = () =>
    seedDemo({
      db: ctx.db,
      auth: ctx.auth,
      storage: ctx.storage,
      adminEmail: admin.email,
      demoPassword: password,
      today: '2026-10-20',
    })

  it('deja un laboratorio ficticio y nada de Arte Dental', async () => {
    await run()
    const [lab] = await ctx.db.select().from(labSettings)
    expect(lab?.name).toBe(DEMO_LAB.name)
    expect(lab?.address).toBe(DEMO_LAB.address)
    // Por ausencia: los valores que escribe el seed normal (seed-data.ts).
    expect(lab?.name).not.toContain('Arte Dental')
    expect(lab?.phone).not.toContain('0961440991')
    expect(lab?.address).not.toContain('Puerto Rico')
  })

  it('crea los usuarios de demostración con su rol y la contraseña dada', async () => {
    await run()
    for (const u of DEMO_USERS) {
      const [row] = await ctx.db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.email, u.email))
      expect(row?.role).toBe(u.role)
    }
    // La contraseña sirve para entrar (Better Auth).
    const signed = await ctx.auth.api.signInEmail({
      body: { email: 'recepcion@demo.local', password },
    })
    expect(signed.user.email).toBe('recepcion@demo.local')
  })

  it('deja un trabajo en cada estado, la repetición, la entrega fallida y las cuentas', async () => {
    const result = await run()
    const byStatus = Object.fromEntries(
      (
        await ctx.db.select({ status: cases.status, n: count() }).from(cases).groupBy(cases.status)
      ).map((r) => [r.status, Number(r.n)]),
    )
    expect(byStatus).toEqual({
      por_recoger: 2, // la recogida pendiente y la ya recogida («En camino al laboratorio»)
      nuevo: 2, // «nuevo» y la repetición
      en_proceso: 3,
      en_espera: 1,
      en_prueba: 1,
      terminado: 1,
      enviado: 3, // dos enviados y la entrega fallida reprogramada
      entregado: 2,
      cobrado: 1,
      cancelado: 1,
    })
    expect(result.cases['vence-hoy']).toMatch(/^[0-9a-f-]{36}$/)
    const [row] = await ctx.db.select({ n: count() }).from(clinics)
    expect(Number(row?.n)).toBe(3)
  })

  it('las fechas salen del día dado, no del reloj de la máquina', async () => {
    const result = await run()
    const [row] = await ctx.db
      .select({ dueDate: cases.dueDate })
      .from(cases)
      .where(eq(cases.id, result.cases['vence-hoy']!))
    expect(row?.dueDate).toBe('2026-10-20')
  })

  it('se niega si ya hay datos de demostración (no duplica)', async () => {
    await run()
    await expect(run()).rejects.toThrow(/ya hay datos de demostración/)
  })
})
