import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import type { Auth } from './auth.ts'
import type { Db } from './db/index.ts'
import { meRoutes } from './features/auth/me.routes.ts'
import type { AppEnv } from './features/auth/session.ts'
import { requireRole, sessionMiddleware } from './features/auth/session.ts'
import { clinicsRoutes } from './features/clinics/routes.ts'
import { doctorsRoutes } from './features/doctors/routes.ts'
import { healthRoutes } from './features/health/routes.ts'
import { labSettingsRoutes } from './features/lab-settings/routes.ts'
import { productsRoutes } from './features/products/routes.ts'
import { stagesRoutes } from './features/stages/routes.ts'
import { usersRoutes } from './features/users/routes.ts'

export type AppDeps = { auth: Auth; db: Db; webOrigin: string }

export function createApp({ auth, db, webOrigin }: AppDeps) {
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
    .route('/api/config/laboratorio', labSettingsRoutes(db))
    .route('/api/config/clinicas', clinicsRoutes(db))
    .route('/api/config/doctores', doctorsRoutes(db))
    .route('/api/config/productos', productsRoutes(db))
    .route('/api/config/fases', stagesRoutes(db))
    .route('/api/users', usersRoutes(db, auth))

  app.notFound((c) => c.json({ message: 'Recurso no encontrado' }, 404))
  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ message: err.message || 'Error' }, err.status)
    console.error(err)
    return c.json({ message: 'Error interno' }, 500)
  })

  return routes
}

export type AppType = ReturnType<typeof createApp>
