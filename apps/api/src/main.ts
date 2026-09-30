import { serve } from '@hono/node-server'
import { fileURLToPath } from 'node:url'
import { createApp } from './app.ts'
import { createAuth } from './auth.ts'
import { loadConfig } from './config.ts'
import { createDb } from './db/index.ts'
import { runMigrations } from './db/migrate.ts'
import { LocalStorage } from './lib/storage.ts'

/**
 * `loadConfig()` ya lanza un `Error` con el detalle en español (`config.ts:48-52`). Sin captura,
 * un error de configuración salía como traza completa de Node en vez de ese mensaje (issue #21).
 */
export function fatalStartupMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Error inesperado al iniciar la API'
}

async function main() {
  const config = loadConfig()
  const { db } = createDb(config.DATABASE_URL)
  await runMigrations(db)
  const auth = createAuth(db, config)
  const storage = new LocalStorage(config.UPLOAD_DIR)
  const app = createApp({ auth, db, webOrigin: config.WEB_ORIGIN, storage })

  serve({ fetch: app.fetch, port: config.PORT }, (info) => {
    console.log(`API escuchando en http://localhost:${info.port} (${config.NODE_ENV})`)
  })
}

// Solo ejecuta `main` cuando el archivo corre como script (`tsx src/main.ts` / `node dist/main.js`),
// no cuando un test importa `fatalStartupMessage` (mismo patrón que `reset-test-db.ts`/`seed.ts`).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await main()
  } catch (error) {
    console.error(fatalStartupMessage(error))
    process.exit(1)
  }
}
