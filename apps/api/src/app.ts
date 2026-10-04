import { USER_ADMIN_ROLES } from '@dentalware/shared'
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
import { createCasesRepo, createUsersQuery, drizzleUnitOfWork } from './features/cases/repo.ts'
import { createCasesService } from './features/cases/service.ts'
import { clinicsRoutes } from './features/clinics/routes.ts'
import {
  createCouriersQuery,
  createDeliveriesRepo,
  drizzleDeliveriesUnitOfWork,
} from './features/deliveries/repo.ts'
import { deliveriesRoutes } from './features/deliveries/routes.ts'
import { createDeliveriesService } from './features/deliveries/service.ts'
import { doctorsRoutes } from './features/doctors/routes.ts'
import { healthRoutes } from './features/health/routes.ts'
import { labSettingsRoutes } from './features/lab-settings/routes.ts'
import { productsRoutes } from './features/products/routes.ts'
import { listStages } from './features/stages/repo.ts'
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
  // La unidad de trabajo de `cases` re-crea el repositorio de entregas sobre su `tx` (ADR 19):
  // la factoría se inyecta aquí para que `cases/repo.ts` no importe `deliveries/repo.ts`.
  const casesUow = drizzleUnitOfWork(db, { deliveries: createDeliveriesRepo })
  const couriersQuery = createCouriersQuery(db)
  const casesService = createCasesService({
    cases: casesRepo,
    attachments: attachmentsRepo,
    // Puerto de la feature `stages` (CRUD simple, sin ports.ts propio): solo las fases activas.
    stages: { active: () => listStages(db, false) },
    // Puerto de la feature `users` (ADR 24: `createUsersQuery` lee `users` por join/lectura de
    // solo lectura desde el `repo.ts` de `cases`, sin importar el `repo`/rutas de `users`).
    users: createUsersQuery(db),
    // `CouriersLookup` es un puerto declarado por `cases`; aquí se cumple con
    // `createCouriersQuery` de `deliveries` (ADR 24): valida el mensajero de una recogida o un
    // envío y da su nombre para el historial, sobre la lista que alimenta el selector.
    couriers: {
      findActiveCourier: async (userId) =>
        (await couriersQuery.activeCouriers()).find((c) => c.id === userId),
    },
    // Lectura de la entrega pendiente para la ficha (M-4), fuera de la transacción; las
    // escrituras de entregas siguen dentro de `uow.run`.
    deliveries: createDeliveriesRepo(db),
    // Sin `tryins` aquí: el servicio solo accede a pruebas en boca dentro de `uow.run`
    // (transaccional, ADR 19). Una instancia suelta invitaría a escribir fuera de la tx.
    uow: casesUow,
    clock: effectiveClock,
  })
  // `uow` propio de `deliveries` (distinto del `casesUow`): compone `createDeliveriesRepo(tx)`
  // con un `CaseEventLog` adaptado de `createCasesRepo(tx).addEvent`, sin que `deliveries/`
  // importe nada de `cases/` (la frontera la cruza solo esta raíz de composición).
  const deliveriesUow = drizzleDeliveriesUnitOfWork(db, {
    events: (tx) => ({ addEvent: (e) => createCasesRepo(tx).addEvent(e) }),
  })
  const deliveriesService = createDeliveriesService({
    deliveries: createDeliveriesRepo(db),
    couriers: couriersQuery,
    uow: deliveriesUow,
    clock: effectiveClock,
  })
  const importService = createImportService({
    catalog: createImportCatalog(db),
    uow: casesUow,
    clock: effectiveClock,
  })
  const attachmentsService = createAttachmentsService({
    attachments: attachmentsRepo,
    cases: { exists: async (id) => (await casesRepo.byId(id)) !== undefined },
    events: { add: (e) => casesRepo.addEvent(e) },
    // `PendingDeliveryLookup` lo declara `attachments`; aquí se cumple con el repo de
    // `deliveries` (ADR 34), sin que una feature importe el `repo.ts` de la otra.
    deliveries: createDeliveriesRepo(db),
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
  app.use('/api/auth/sign-up/*', requireRole(...USER_ADMIN_ROLES))
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
    .route('/api/entregas', deliveriesRoutes(deliveriesService))

  app.notFound((c) => c.json({ message: 'Recurso no encontrado' }, 404))
  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ message: err.message || 'Error' }, err.status)
    console.error(err)
    return c.json({ message: 'Error interno' }, 500)
  })

  return routes
}

export type AppType = ReturnType<typeof createApp>
