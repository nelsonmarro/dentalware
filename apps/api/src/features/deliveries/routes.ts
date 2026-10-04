import { DELIVERY_MANAGE_ROLES } from '@dentalware/shared'
import { Hono } from 'hono'
import type { AppEnv } from '../auth/session.ts'
import { requireRole } from '../auth/session.ts'
import type { DeliveriesService } from './service.ts'

/** `/api/entregas` (Iteración 4). La Tarea 5 adelanta solo `GET /mensajeros`; la Tarea 6 añade
 * la lista del día y la entrega fallida. */
export const deliveriesRoutes = (service: DeliveriesService) =>
  new Hono<AppEnv>()
    // Solo quien administra entregas (ADR 31: su propia constante): el mensajero envía con él
    // mismo y no necesita la lista; el técnico no programa entregas.
    .get('/mensajeros', requireRole(...DELIVERY_MANAGE_ROLES), async (c) =>
      c.json({ mensajeros: await service.couriers() }, 200),
    )
