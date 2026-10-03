import { serve } from '@hono/node-server'
import { createApp } from './app.ts'
import { createAuth } from './auth.ts'
import { loadConfig } from './config.ts'
import { createDb } from './db/index.ts'
import { runMigrations } from './db/migrate.ts'
import { reportStartupError } from './lib/startup.ts'
import { createStorage } from './lib/create-storage.ts'

async function main() {
  const config = loadConfig()
  const { db } = createDb(config.DATABASE_URL)
  await runMigrations(db)
  const auth = createAuth(db, config)
  const storage = createStorage(config)
  const app = createApp({ auth, db, webOrigin: config.WEB_ORIGIN, storage })

  serve({ fetch: app.fetch, port: config.PORT }, (info) => {
    console.log(`API escuchando en http://localhost:${info.port} (${config.NODE_ENV})`)
  })
}

// `main.ts` es siempre el punto de entrada del proceso (`tsx src/main.ts` / `node dist/main.js`):
// nada más lo importa, así que no necesita (ni debe llevar) una guarda de "solo como script" —
// esa guarda, mal comparada, dejaba salir el proceso con código 0 sin arrancar si se invocaba
// por un symlink (issue #21, ronda de fixes 1, M-3). Lo que sí hacía falta probar
// (`reportStartupError`) ya vive en `lib/startup.ts`, sin depender de esta guarda.
try {
  await main()
} catch (error) {
  reportStartupError(error)
  process.exit(1)
}
