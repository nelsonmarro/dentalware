import type { UserRole } from '@dentalware/shared'
import { eq } from 'drizzle-orm'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Auth } from '../auth.ts'
import { createAuth } from '../auth.ts'
import { loadConfig } from '../config.ts'
import type { Db } from '../db/index.ts'
import { createDb } from '../db/index.ts'
import { runMigrations } from '../db/migrate.ts'
import { truncateAll } from '../db/reset.ts'
import * as schema from '../db/schema/index.ts'
import { users } from '../db/schema/index.ts'
import type { AppType } from '../app.ts'
import { LocalStorage } from '../lib/storage.ts'

export { truncateAll }

export async function setupTestDb() {
  const config = loadConfig()
  const { db, pool } = createDb(config.DATABASE_URL)
  await runMigrations(db)
  const auth = createAuth(db, config)
  const storageDir = await mkdtemp(join(tmpdir(), 'dentalware-'))
  const storage = new LocalStorage(storageDir)
  return { config, db, pool, auth, schema, storage, storageDir }
}

/** Borra el directorio temporal de `storage` creado por `setupTestDb` (no toca otros). */
export async function cleanupTestStorage(ctx: { storageDir: string }) {
  await rm(ctx.storageDir, { recursive: true, force: true })
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
