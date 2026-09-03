import { eq } from 'drizzle-orm'
import { createAuth } from '../auth.ts'
import { loadConfig } from '../config.ts'
import { createDb } from '../db/index.ts'
import { runMigrations } from '../db/migrate.ts'
import { users } from '../db/schema/index.ts'

const config = loadConfig()
const { db, pool } = createDb(config.DATABASE_URL)
await runMigrations(db)
const auth = createAuth(db, config)

const existing = await db
  .select({ id: users.id })
  .from(users)
  .where(eq(users.email, config.ADMIN_EMAIL))
if (existing.length > 0) {
  console.log(`Admin ya existe: ${config.ADMIN_EMAIL}`)
} else {
  const created = await auth.api.signUpEmail({
    body: { email: config.ADMIN_EMAIL, password: config.ADMIN_PASSWORD, name: config.ADMIN_NAME },
  })
  await db.update(users).set({ role: 'admin' }).where(eq(users.id, created.user.id))
  console.log(`Admin creado: ${config.ADMIN_EMAIL}`)
}
await pool.end()
