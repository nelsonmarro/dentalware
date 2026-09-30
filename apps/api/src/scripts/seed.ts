import { eq } from 'drizzle-orm'
import type { Auth } from '../auth.ts'
import { createAuth } from '../auth.ts'
import { loadConfig } from '../config.ts'
import type { Db } from '../db/index.ts'
import { createDb } from '../db/index.ts'
import { runMigrations } from '../db/migrate.ts'
import { users } from '../db/schema/index.ts'
import { isMainModule } from '../lib/is-main-module.ts'
import { seedCatalogs } from './seed-data.ts'

export type EnsureAdminResult = 'creado' | 'ya existía' | 'corregido' | 'bloqueado'

/**
 * Crear el admin (Better Auth, `signUpEmail`) y asignarle el rol (Drizzle, `update`) son dos
 * pasos sin atomicidad: Better Auth usa su propia conexión, así que una transacción de Drizzle
 * no envuelve a los dos. Si el segundo paso fallara, quedaría un usuario con `ADMIN_EMAIL` y un
 * rol distinto de `admin`. `ensureAdmin` es idempotente sobre el rol: si el admin ya existe con
 * otro rol, lo corrige en vez de darlo por bueno para siempre (issue #21).
 *
 * Un bloqueo, en cambio, lo decidió una persona a propósito: el seed no lo deshace, solo avisa
 * (`'bloqueado'`) para que quien lo corre sepa por qué el admin no puede entrar.
 */
export async function ensureAdmin(
  db: Db,
  auth: Auth,
  admin: { email: string; password: string; name: string },
): Promise<EnsureAdminResult> {
  const [existing] = await db
    .select({ id: users.id, role: users.role, banned: users.banned })
    .from(users)
    .where(eq(users.email, admin.email))

  if (existing) {
    const wrongRole = existing.role !== 'admin'
    if (wrongRole) await db.update(users).set({ role: 'admin' }).where(eq(users.id, existing.id))
    if (existing.banned) return 'bloqueado'
    return wrongRole ? 'corregido' : 'ya existía'
  }

  const created = await auth.api.signUpEmail({
    body: { email: admin.email, password: admin.password, name: admin.name },
  })
  await db.update(users).set({ role: 'admin' }).where(eq(users.id, created.user.id))
  return 'creado'
}

const ENSURE_ADMIN_MESSAGES: Record<EnsureAdminResult, (email: string) => string> = {
  creado: (email) => `Admin creado: ${email}`,
  'ya existía': (email) => `Admin ya existe: ${email}`,
  corregido: (email) => `Admin ${email} existía con otro rol: corregido a admin`,
  bloqueado: (email) =>
    `Aviso: el admin ${email} está bloqueado y no puede iniciar sesión; el seed no lo desbloquea`,
}

async function main() {
  const config = loadConfig()
  const { db, pool } = createDb(config.DATABASE_URL)
  try {
    await runMigrations(db)
    const auth = createAuth(db, config)

    const result = await ensureAdmin(db, auth, {
      email: config.ADMIN_EMAIL,
      password: config.ADMIN_PASSWORD,
      name: config.ADMIN_NAME,
    })
    const report = result === 'bloqueado' ? console.warn : console.log
    report(ENSURE_ADMIN_MESSAGES[result](config.ADMIN_EMAIL))

    await seedCatalogs(db)
    console.log('Catálogos iniciales listos')
  } finally {
    await pool.end()
  }
}

// Solo ejecuta `main` cuando el archivo corre como script (`tsx src/scripts/seed.ts`), no
// cuando `seed.test.ts` importa `ensureAdmin` (mismo patrón que `reset-test-db.ts`).
// `isMainModule` resuelve symlinks: sin eso, arrancar por uno dejaba el proceso salir con
// código 0 sin sembrar nada (issue #21, ronda de fixes 1, M-3).
if (isMainModule(import.meta.url)) {
  await main()
}
