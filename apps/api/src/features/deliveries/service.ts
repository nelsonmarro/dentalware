import { DELIVERY_MANAGE_ROLES, hasRole } from '@dentalware/shared'
import type { DeliveryFailInput, DeliveryListQuery } from '@dentalware/shared'
import type { Clock } from '../../lib/clock.ts'
import type { RequestContext } from '../../lib/request-context.ts'
import { DeliveryForbiddenError, DeliveryInputError, DeliveryNotPendingError } from './errors.ts'
import type {
  CouriersQuery,
  DeliveriesRepository,
  DeliveriesUnitOfWork,
  DeliveryListItem,
  DeliveryRow,
} from './ports.ts'

/**
 * Casos de uso de entregas (Iteración 4): la lista de mensajeros para los selectores (Tarea
 * 5), «mis entregas del día» (ENT-3) y la entrega fallida con reprogramación (ENT-4/ENT-5,
 * Tarea 6). `deliveries` es de solo lectura para `list` (sin transacción, no la necesita); el
 * `uow` solo lo usa `fail`, que cierra, crea y escribe el evento en una sola transacción.
 */
export function createDeliveriesService(deps: {
  deliveries: DeliveriesRepository
  couriers: CouriersQuery
  uow: DeliveriesUnitOfWork
  clock: Clock
}) {
  return {
    /** Mensajeros activos (`{ id, name }`, ordenados por nombre por el adaptador). */
    couriers() {
      return deps.couriers.activeCouriers()
    },

    /**
     * «Mis entregas del día» (ENT-3, decisión 7 del plan): el mensajero siempre ve las suyas
     * — se fuerza `courierId = ctx.userId` aunque pida otro `mensajeroId` — y admin/recepción
     * pueden ver todas o filtrar por uno. El día de hoy suma las pendientes atrasadas.
     */
    list(q: DeliveryListQuery, ctx: RequestContext): Promise<DeliveryListItem[]> {
      const courierId = ctx.role === 'mensajero' ? ctx.userId : q.mensajeroId
      const includeOverdue = q.dia === deps.clock.today()
      return deps.deliveries.listForDay({ day: q.dia, courierId, includeOverdue })
    },

    /**
     * Cierra la entrega como fallida y reprograma una nueva pendiente en la misma operación
     * (decisión 6 del plan, ENT-5): si la entrega no existe o ya no está `pendiente` (hecha,
     * fallida, o fallida por cancelación del trabajo), 409 uniforme con el literal de
     * `shared` — el mensajero solo puede actuar sobre la suya (403); `nuevaFecha` no puede ser
     * anterior a hoy (422, no se puede expresar en el schema de `shared` porque depende del
     * reloj). Todo en una transacción: `markFailed`, `create` de la nueva pendiente y el
     * evento `delivery_failed` en el trabajo.
     */
    async fail(id: string, input: DeliveryFailInput, ctx: RequestContext): Promise<DeliveryRow> {
      return deps.uow.run(async ({ deliveries, events }) => {
        const found = await deliveries.byId(id)
        if (!found || found.status !== 'pendiente') throw new DeliveryNotPendingError()
        if (!hasRole(DELIVERY_MANAGE_ROLES, ctx.role) && found.courierId !== ctx.userId) {
          throw new DeliveryForbiddenError()
        }
        if (input.nuevaFecha < deps.clock.today()) {
          throw new DeliveryInputError('La nueva fecha no puede ser anterior a hoy', 'nuevaFecha')
        }
        // El cierre es condicional (I-1 de la revisión final del PR 2): si entre `byId` y aquí
        // otra petición la cerró («Entregado», «Recibido», «Cancelar» u otro «No se pudo»),
        // no se pisa su estado ni se reprograma una pendiente fantasma: mismo 409 uniforme.
        // Tras un cierre que sí cambió la fila, `create` no puede chocar con el índice único de
        // pendientes: la única pendiente de este trabajo y tipo era esta, y quien crea otra
        // (`marcar_enviado`, `create` del trabajo) no puede hacerlo mientras esta existe.
        if (!(await deliveries.markFailed(found.id, input.motivo, deps.clock.now()))) {
          throw new DeliveryNotPendingError()
        }
        const next = await deliveries.create({
          caseId: found.caseId,
          type: found.type,
          courierId: found.courierId,
          scheduledFor: input.nuevaFecha,
        })
        await events.addEvent({
          caseId: found.caseId,
          type: 'delivery_failed',
          toValue: input.nuevaFecha,
          reason: input.motivo,
          actorId: ctx.userId,
        })
        return next
      })
    },
  }
}
export type DeliveriesService = ReturnType<typeof createDeliveriesService>
