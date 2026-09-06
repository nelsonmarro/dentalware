import { serve } from '@hono/node-server'
import { createApp } from './app.ts'
import { createAuth } from './auth.ts'
import { loadConfig } from './config.ts'
import { createDb } from './db/index.ts'
import { runMigrations } from './db/migrate.ts'

const config = loadConfig()
const { db } = createDb(config.DATABASE_URL)
await runMigrations(db)
const auth = createAuth(db, config)
const app = createApp({ auth, db, webOrigin: config.WEB_ORIGIN })

serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.log(`API escuchando en http://localhost:${info.port} (${config.NODE_ENV})`)
})
