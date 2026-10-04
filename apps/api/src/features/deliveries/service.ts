import type { CouriersQuery } from './ports.ts'

/**
 * Casos de uso de entregas (Iteración 4). Por ahora solo la lista de mensajeros para los
 * selectores de la web (decisión 8 del plan, adelantada en la Tarea 5); la Tarea 6 suma la
 * lista del día y la entrega fallida con sus puertos (`DeliveriesRepository`,
 * `DeliveriesUnitOfWork`, `Clock`). Nace como servicio, no como CRUD simple con el repo en la
 * ruta (`docs/architecture.md` §3.4), porque la feature ya tiene reglas en camino: la ruta no
 * cambia de forma cuando la Tarea 6 la complete.
 */
export function createDeliveriesService(deps: { couriers: CouriersQuery }) {
  return {
    /** Mensajeros activos (`{ id, name }`, ordenados por nombre por el adaptador). */
    couriers() {
      return deps.couriers.activeCouriers()
    },
  }
}
export type DeliveriesService = ReturnType<typeof createDeliveriesService>
