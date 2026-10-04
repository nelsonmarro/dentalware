import type { CasePriority, CaseStatus, DeliveryStatus, DeliveryType } from '@dentalware/shared'
// Solo tipos: la forma de fila se deriva del schema (mismo ruling que `cases/ports.ts`, ADR 25).
import type { deliveries } from './schema.ts'

export type DeliveryRow = typeof deliveries.$inferSelect

export type NewDelivery = {
  caseId: string
  type: DeliveryType
  courierId: string
  scheduledFor: string // YYYY-MM-DD
}

/** Una fila de «Mis entregas del día»: sin dinero (decisión 7 del plan). `case.status` deja ver
 * una entrega `fallida` cuyo trabajo quedó `cancelado` (ruling de la Tarea 6, M-? de la Tarea 2):
 * la lista la sigue mostrando como dato histórico, pero no es accionable (`fail` la rechaza con
 * 409 porque ya no está `pendiente`, igual que cualquier otra entrega cerrada). */
export type DeliveryListItem = {
  id: string
  type: DeliveryType
  status: DeliveryStatus
  scheduledFor: string
  /** Fecha en la que se cerró la entrega: cuándo se hizo (`hecha`) o cuándo se cerró como
   * fallida antes de reprogramar (`fallida`) — no solo la de una entrega completada. */
  doneAt: Date | null
  failedReason: string | null
  case: {
    id: string
    code: string
    patientRef: string | null
    status: CaseStatus
    priority: CasePriority
  }
  clinic: { id: string; name: string; address: string | null; phone: string | null }
  courier: { id: string; name: string }
}

export interface DeliveriesRepository {
  create(d: NewDelivery): Promise<DeliveryRow>
  byId(id: string): Promise<DeliveryRow | undefined>
  /** La entrega pendiente de un tipo para un trabajo (como mucho una). */
  pendingFor(caseId: string, type: DeliveryType): Promise<DeliveryRow | undefined>
  markDone(id: string, doneAt: Date, proofAttachmentId: string | null): Promise<void>
  markFailed(id: string, reason: string, at: Date): Promise<void>
  /** Las del día; con `includeOverdue`, también las pendientes de días anteriores. */
  listForDay(q: {
    day: string
    courierId?: string
    includeOverdue: boolean
  }): Promise<DeliveryListItem[]>
}

export type Named = { id: string; name: string }

/** Puerto de OTRA feature (usuarios, ADR 24/29): mensajeros activos para el selector, sin
 * exponer correo, rol ni baneo — mismo patrón que `UsersQuery.activeTechnicians` de `cases`. */
export interface CouriersQuery {
  activeCouriers(): Promise<Named[]>
}

/**
 * Puerto propio de `deliveries` (ADR 24/26, simétrico a `DeliveryLog` de `cases`): escribe en
 * el historial del trabajo sin que esta feature importe nada de `cases/`. Lo cumple
 * `createCasesRepo(tx).addEvent` adaptado en la raíz de composición (`app.ts`).
 */
export interface CaseEventLog {
  addEvent(e: {
    caseId: string
    type: 'delivery_failed'
    toValue: string
    reason: string
    actorId: string
  }): Promise<void>
}

/** Atomicidad de `fail` (ADR 19): cierra la entrega, crea la nueva pendiente y escribe el
 * evento en una sola transacción, sin que el servicio conozca `db.transaction`. */
export interface DeliveriesUnitOfWork {
  run<T>(
    fn: (r: { deliveries: DeliveriesRepository; events: CaseEventLog }) => Promise<T>,
  ): Promise<T>
}
