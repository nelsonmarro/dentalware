import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

export function createDb(url: string) {
  const pool = new Pool({ connectionString: url, max: 10 })
  const db = drizzle({ client: pool })
  return { db, pool }
}

export type Db = ReturnType<typeof createDb>['db']
