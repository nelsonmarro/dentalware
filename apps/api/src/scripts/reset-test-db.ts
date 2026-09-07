import { fileURLToPath } from 'node:url'
import { loadConfig } from '../config.ts'
import { createDb } from '../db/index.ts'
import { runMigrations } from '../db/migrate.ts'
import { truncateAll } from '../db/reset.ts'

/**
 * Los E2E (Playwright) y los tests unitarios comparten `dentalware_test`: si un test
 * unitario deja filas sin truncar al final de la corrida (p. ej. `cases`/`case_sequences`
 * de la última suite en ejecutarse), un E2E que arranca sobre esa BD puede chocar con
 * datos residuales (código de trabajo duplicado). Este script deja la BD de test vacía
 * (mismas tablas que `truncateAll`) antes de cada corrida de E2E.
 *
 * Nunca debe correr fuera de `NODE_ENV=test`: sería catastrófico vaciar por error la BD
 * de desarrollo o producción.
 */
export function assertTestEnv(nodeEnv: string): void {
  if (nodeEnv !== 'test') {
    throw new Error(
      `reset-test-db solo se ejecuta con NODE_ENV=test (recibido "${nodeEnv}"): vaciaría una BD real`,
    )
  }
}

async function main() {
  const config = loadConfig()
  assertTestEnv(config.NODE_ENV)
  const { db, pool } = createDb(config.DATABASE_URL)
  try {
    await runMigrations(db)
    await truncateAll(db)
    console.log('BD de test limpia')
  } finally {
    await pool.end()
  }
}

// Solo ejecuta `main` cuando el archivo corre como script (`tsx src/scripts/reset-test-db.ts`),
// no cuando `reset-test-db.test.ts` importa `assertTestEnv`.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main()
}
