import { serve } from '@hono/node-server'
import { fileURLToPath } from 'node:url'
import { createApp } from './app.ts'
import { createAuth } from './auth.ts'
import { loadConfig } from './config.ts'
import { createDb } from './db/index.ts'
import { runMigrations } from './db/migrate.ts'
import { reportStartupError } from './lib/startup.ts'
import { LocalStorage } from './lib/storage.ts'

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

// Solo ejecuta `main` cuando el archivo corre como script (`tsx src/main.ts` / `node dist/main.js`).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await main()
  } catch (error) {
    reportStartupError(error)
    process.exit(1)
  }
}
