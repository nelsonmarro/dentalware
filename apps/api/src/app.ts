import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import type { Auth } from './auth.ts'
import type { Db } from './db/index.ts'
import { attachmentsRoutes } from './features/attachments/routes.ts'
import { createAttachmentsRepo } from './features/attachments/repo.ts'
import { createAttachmentsService } from './features/attachments/service.ts'
import { meRoutes } from './features/auth/me.routes.ts'
import type { AppEnv } from './features/auth/session.ts'
import { requireRole, sessionMiddleware } from './features/auth/session.ts'
import { createImportCatalog } from './features/cases/import.repo.ts'
import { importRoutes } from './features/cases/import.routes.ts'
import { createImportService } from './features/cases/import.service.ts'
import { casesRoutes } from './features/cases/routes.ts'
import { createCasesRepo, drizzleUnitOfWork } from './features/cases/repo.ts'
import { createCasesService } from './features/cases/service.ts'
import { clinicsRoutes } from './features/clinics/routes.ts'
import { doctorsRoutes } from './features/doctors/routes.ts'
import { healthRoutes } from './features/health/routes.ts'
import { labSettingsRoutes } from './features/lab-settings/routes.ts'
import { productsRoutes } from './features/products/routes.ts'
import { stagesRoutes } from './features/stages/routes.ts'
import { usersRoutes } from './features/users/routes.ts'
import type { Clock } from './lib/clock.ts'
import { systemClock } from './lib/clock.ts'
import type { IdGenerator } from './lib/ids.ts'
import { randomIds } from './lib/ids.ts'
import { sharpImages } from './lib/images.ts'
import type { Storage } from './lib/storage.ts'

export type AppDeps = {
  auth: Auth
  db: Db
  webOrigin: string
  storage: Storage
  clock?: Clock
  ids?: IdGenerator
}

export function createApp({ auth, db, webOrigin, storage, clock, ids }: AppDeps) {
  const app = new Hono<AppEnv>()

  const casesRepo = createCasesRepo(db)
  const attachmentsRepo = createAttachmentsRepo(db)
  const effectiveClock = clock ?? systemClock
  const casesService = createCasesService({
    cases: casesRepo,
    attachments: attachmentsRepo,
    uow: drizzleUnitOfWork(db),
    clock: effectiveClock,
  })
  const importService = createImportService({
    catalog: createImportCatalog(db),
    uow: drizzleUnitOfWork(db),
    clock: effectiveClock,
  })
  const attachmentsService = createAttachmentsService({
    attachments: attachmentsRepo,
    cases: { exists: async (id) => (await casesRepo.byId(id)) !== undefined },
    events: { add: (e) => casesRepo.addEvent(e) },
    storage,
    images: sharpImages,
    ids: ids ?? randomIds,
  })

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

  // El plugin admin de better-auth (set-role sin auto-guard, remove-user con borrado
  // físico, impersonate-user) no lo usa el frontend: toda la administración de
  // usuarios pasa por /api/users, que valida en español y respeta las reglas del
  // negocio (nadie se bloquea ni se degrada a sí mismo, borrado lógico). Se bloquea
  // la superficie HTTP del plugin antes de llegar al handler de better-auth.
  app.all('/api/auth/admin/*', (c) => c.json({ message: 'No encontrado' }, 404))

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
    .route('/api/trabajos', casesRoutes(casesService, importRoutes(importService)))
    .route('/api/users', usersRoutes(db, auth))
    .route('/api/adjuntos', attachmentsRoutes(attachmentsService))

  app.notFound((c) => c.json({ message: 'Recurso no encontrado' }, 404))
  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ message: err.message || 'Error' }, err.status)
    console.error(err)
    return c.json({ message: 'Error interno' }, 500)
  })

  return routes
}

export type AppType = ReturnType<typeof createApp>
