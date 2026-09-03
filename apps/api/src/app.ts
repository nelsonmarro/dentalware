import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { healthRoutes } from './routes/health.ts'

export type AppDeps = Record<string, never>

export function createApp(_deps: AppDeps) {
  const app = new Hono()

  app.use(secureHeaders())
  if (process.env.NODE_ENV !== 'test') app.use(logger())

  const routes = app.route('/api/health', healthRoutes)

  app.notFound((c) => c.json({ message: 'Recurso no encontrado' }, 404))
  app.onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse()
    console.error(err)
    return c.json({ message: 'Error interno del servidor' }, 500)
  })

  return routes
}

export type AppType = ReturnType<typeof createApp>
