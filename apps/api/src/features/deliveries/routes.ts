import {
  DELIVERY_MANAGE_ROLES,
  DELIVERY_ROLES,
  deliveryFailSchema,
  deliveryListQuerySchema,
  idParamSchema,
} from '@dentalware/shared'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { validate } from '../../lib/validate.ts'
import type { AppEnv } from '../auth/session.ts'
import { ctxFrom, requireRole } from '../auth/session.ts'
import { DeliveryForbiddenError, DeliveryInputError, DeliveryNotPendingError } from './errors.ts'
import type { DeliveriesService } from './service.ts'

// Quien administra entregas (ADR 31: su propia constante, DELIVERY_MANAGE_ROLES): el mensajero
// no necesita la lista de mensajeros ni el técnico programa entregas.
const canManage = requireRole(...DELIVERY_MANAGE_ROLES)

// Lista del día y entrega fallida: admin, recepción y el propio mensajero (decisión 4 del
// plan); el servicio vuelve a comprobar que actúa sobre lo suyo.
const canAct = requireRole(...DELIVERY_ROLES)

/** Traduce los errores de dominio del servicio a la respuesta HTTP que espera la web. */
function toHttp(e: unknown): never {
  if (e instanceof DeliveryNotPendingError) throw new HTTPException(409, { message: e.message })
  if (e instanceof DeliveryForbiddenError) throw new HTTPException(403, { message: e.message })
  throw e as Error
}

/** `/api/entregas` (Iteración 4): lista de mensajeros (Tarea 5) más la lista del día y la
 * entrega fallida con reprogramación (Tarea 6, ENT-4/ENT-5). */
export const deliveriesRoutes = (service: DeliveriesService) =>
  new Hono<AppEnv>()
    .get('/mensajeros', canManage, async (c) =>
      c.json({ mensajeros: await service.couriers() }, 200),
    )
    .get('/', canAct, validate('query', deliveryListQuerySchema), async (c) =>
      c.json({ entregas: await service.list(c.req.valid('query'), ctxFrom(c)) }, 200),
    )
    .post(
      '/:id/fallida',
      canAct,
      validate('param', idParamSchema),
      validate('json', deliveryFailSchema),
      async (c) => {
        try {
          const entrega = await service.fail(
            c.req.valid('param').id,
            c.req.valid('json'),
            ctxFrom(c),
          )
          return c.json({ entrega }, 200)
        } catch (e) {
          if (e instanceof DeliveryInputError)
            return c.json(
              { message: 'Datos inválidos', issues: [{ path: e.path, message: e.message }] },
              422,
            )
          toHttp(e)
        }
      },
    )
