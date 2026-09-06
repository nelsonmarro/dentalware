import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { appRelations } from './relations.ts'
import { authRelations } from './schema/auth.ts'

// authRelations usa defineRelationsPart: debe ir después de las relaciones completas.
export const relations = { ...appRelations, ...authRelations }

export function createDb(url: string) {
  const pool = new Pool({ connectionString: url, max: 10 })
  pool.on('error', (err) => {
    console.error('Error en el pool de Postgres:', err)
  })
  const db = drizzle({ client: pool, relations })
  return { db, pool }
}

export type Db = ReturnType<typeof createDb>['db']
