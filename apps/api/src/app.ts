import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import type { Auth } from './auth.ts'
import type { AppEnv } from './middleware/session.ts'
import { requireRole, sessionMiddleware } from './middleware/session.ts'
import { healthRoutes } from './routes/health.ts'
import { meRoutes } from './routes/me.ts'

export type AppDeps = { auth: Auth; webOrigin: string }

// Los errores de HTTPException se devuelven siempre como JSON en español.
function errorResponse(err: HTTPException) {
  return Response.json({ message: err.message || 'Error' }, { status: err.status })
}

export function createApp({ auth, webOrigin }: AppDeps) {
  const app = new Hono<AppEnv>()

  app.use(secureHeaders())
  if (process.env.NODE_ENV !== 'test') app.use(logger())
  app.use(
    '/api/*',
    cors({
      origin: (origin) => (origin === webOrigin ? origin : null), // solo el frontend configurado (WEB_ORIGIN)
      credentials: true,
      allowHeaders: ['Content-Type'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  )

  app.use('/api/*', sessionMiddleware(auth))

  // Solo un admin autenticado puede crear usuarios.
  app.use('/api/auth/sign-up/*', requireRole('admin'))
  app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw))

  // Ruta de prueba para el guard de roles (se reutiliza en la Iteración 1 para /api/admin/*).
  const adminRoutes = new Hono<AppEnv>().get('/ping', requireRole('admin'), (c) =>
    c.json({ pong: true }),
  )

  const routes = app
    .route('/api/health', healthRoutes)
    .route('/api/me', meRoutes)
    .route('/api/admin', adminRoutes)

  app.notFound((c) => c.json({ message: 'Recurso no encontrado' }, 404))
  app.onError((err, c) => {
    if (err instanceof HTTPException) return errorResponse(err)
    console.error(err)
    return c.json({ message: 'Error interno del servidor' }, 500)
  })

  return routes
}

export type AppType = ReturnType<typeof createApp>
