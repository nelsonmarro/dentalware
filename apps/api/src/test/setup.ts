import type { UserRole } from '@dentalware/shared'
import { eq, sql } from 'drizzle-orm'
import type { Auth } from '../auth.ts'
import { createAuth } from '../auth.ts'
import { loadConfig } from '../config.ts'
import type { Db } from '../db/index.ts'
import { createDb } from '../db/index.ts'
import { runMigrations } from '../db/migrate.ts'
import { users } from '../db/schema/index.ts'
import type { AppType } from '../app.ts'

export async function setupTestDb() {
  const config = loadConfig()
  const { db, pool } = createDb(config.DATABASE_URL)
  await runMigrations(db)
  const auth = createAuth(db, config)
  return { config, db, pool, auth }
}

export async function truncateAll(db: Db) {
  await db.execute(sql`truncate table "sessions", "accounts", "verifications", "users" cascade`)
}

export async function createUser(
  auth: Auth,
  db: Db,
  input: { email: string; password: string; name: string; role: UserRole },
) {
  const created = await auth.api.signUpEmail({
    body: { email: input.email, password: input.password, name: input.name },
  })
  // `role` tiene input:false: se fija en servidor, nunca desde el body.
  await db.update(users).set({ role: input.role }).where(eq(users.id, created.user.id))
  return created.user.id
}

export async function loginAs(app: AppType, email: string, password: string): Promise<string> {
  const res = await app.request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: loadConfig().WEB_ORIGIN },
    body: JSON.stringify({ email, password }),
  })
  if (res.status !== 200) throw new Error(`login falló: ${res.status} ${await res.text()}`)
  const cookie = res.headers.get('set-cookie')
  if (!cookie) throw new Error('sin set-cookie')
  return cookie.split(';')[0]!
}
