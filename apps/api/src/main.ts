import { serve } from '@hono/node-server'
import { createApp } from './app.ts'
import { loadConfig } from './config.ts'

const config = loadConfig()
const app = createApp({})

serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.log(`API escuchando en http://localhost:${info.port}`)
})
