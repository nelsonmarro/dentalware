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

// Lista del día, entrega fallida y «Recogido»: admin, recepción y el propio mensajero
// (decisión 4 del plan); el servicio vuelve a comprobar que actúa sobre lo suyo.
const canAct = requireRole(...DELIVERY_ROLES)

/** Cuerpo del 422 de un `DeliveryInputError`: el mismo contrato que `validate`. */
const inputIssues = (e: DeliveryInputError) => ({
  message: 'Datos inválidos',
  issues: [{ path: e.path, message: e.message }],
})

/** Traduce los errores de dominio del servicio a la respuesta HTTP que espera la web. */
function toHttp(e: unknown): never {
  if (e instanceof DeliveryNotPendingError) throw new HTTPException(409, { message: e.message })
  if (e instanceof DeliveryForbiddenError) throw new HTTPException(403, { message: e.message })
  throw e as Error
}

/** `/api/entregas` (Iteración 4): lista de mensajeros (Tarea 5), la lista del día, la entrega
 * fallida con reprogramación (Tarea 6, ENT-4/ENT-5) y «Recogido» (#118). */
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
          if (e instanceof DeliveryInputError) return c.json(inputIssues(e), 422)
          toHttp(e)
        }
      },
    )
    // «Recogido» (#118): sin cuerpo; el servicio comprueba que es una recogida (422), que el
    // mensajero actúa sobre la suya (`canMarkPickedUp`, 403) y que sigue pendiente (409).
    .post('/:id/recogido', canAct, validate('param', idParamSchema), async (c) => {
      try {
        const entrega = await service.pickUp(c.req.valid('param').id, ctxFrom(c))
        return c.json({ entrega }, 200)
      } catch (e) {
        if (e instanceof DeliveryInputError) return c.json(inputIssues(e), 422)
        toHttp(e)
      }
    })
