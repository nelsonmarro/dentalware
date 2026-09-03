import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { Db } from './index.ts'

const migrationsFolder = new URL('../../drizzle', import.meta.url).pathname

export async function runMigrations(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder })
}
