import type { CaseStatus } from './case-status.ts'
import type { CasePriority } from './schemas/cases.ts'
import {
  CANCELLED_DELIVERY_REASON_PREFIX,
  isClosedByCancellation,
  isOverdueDelivery,
  type DeliveryStatus,
  type DeliveryType,
} from './deliveries.ts'

/** Lo que la lista del día necesita de una entrega para resumirla y ordenarla. */
type DayDelivery = {
  type: DeliveryType
  status: DeliveryStatus
  scheduledFor: string
  failedReason: string | null
  case: { status: CaseStatus; priority: CasePriority }
}

/** Motivos frecuentes de «No se pudo» (UX4-12): chips que rellenan el motivo, editable, para no
 * escribirlo con guantes y prisa. */
export const DELIVERY_FAIL_REASONS = [
  'Clínica cerrada',
  'Nadie para recibir',
  'Dirección incorrecta',
  'Falta pago',
] as const

/** Cómo terminó una entrega cerrada, tal como la ve quien la lee (UX4-17): la que cerró la
 * cancelación del trabajo está **anulada** (ya no hay que ir), no fallida. */
export const DELIVERY_OUTCOMES = ['hecha', 'fallida', 'anulada'] as const
export type DeliveryOutcome = (typeof DELIVERY_OUTCOMES)[number]

/** `Record` exhaustivo: un resultado nuevo no compila sin su rótulo. */
export const DELIVERY_OUTCOME_LABEL: Record<DeliveryOutcome, string> = {
  hecha: 'Hecha',
  fallida: 'Fallida',
  anulada: 'Anulada',
}

/** El resultado de una entrega cerrada; `null` si sigue pendiente. */
export function deliveryOutcome(d: Pick<DayDelivery, 'status' | 'failedReason'>) {
  if (d.status === 'pendiente') return null
  return isClosedByCancellation(d) ? 'anulada' : d.status
}

/** La nota de una entrega anulada (UX4-17): «Trabajo cancelado: {motivo}», sin los dos puntos
 * colgando si la cancelación no trajo motivo. */
export function cancelledDeliveryNote(failedReason: string | null): string {
  const motivo = failedReason?.startsWith(CANCELLED_DELIVERY_REASON_PREFIX)
    ? failedReason.slice(CANCELLED_DELIVERY_REASON_PREFIX.length).trim()
    : ''
  return motivo ? `${CANCELLED_DELIVERY_REASON_PREFIX}${motivo}` : 'Trabajo cancelado'
}

/** Pendiente de verdad: sin cerrar y de un trabajo que no se canceló (una pendiente de un
 * cancelado no debería existir; si llega, no se cuenta ni se ofrece). */
export function isActionableDelivery(d: Pick<DayDelivery, 'status' | 'case'>): boolean {
  return d.status === 'pendiente' && d.case.status !== 'cancelado'
}

/** ¿Esta recogida viene en camino al laboratorio (#118)? Hecha (el mensajero marcó «Recogido»)
 * y con el trabajo aún por recoger, hasta que recepción marca «Recibido». Es la forma de lista de
 * `isInTransitToLab`: la fila ya es la recogida hecha. */
export function isDeliveryInTransit(d: Pick<DayDelivery, 'type' | 'status' | 'case'>): boolean {
  return d.type === 'recogida' && d.status === 'hecha' && d.case.status === 'por_recoger'
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * Resumen del día de «Entregas» (UX4-18): «2 pendientes · 1 atrasada · 1 en camino · 1 hecha ·
 * 1 fallida · 1 anulada». Las pendientes siempre; el resto, solo si hay alguna. Lo que viene en
 * camino (#118) se cuenta aparte y no como hecho: el día de hoy también trae las recogidas en
 * camino de otros días, que no se hicieron hoy.
 */
export function deliveryDaySummary(items: DayDelivery[], today: string): string {
  const pending = items.filter(isActionableDelivery)
  const inTransit = items.filter(isDeliveryInTransit).length
  const count = (o: DeliveryOutcome) =>
    items.filter((d) => !isDeliveryInTransit(d) && deliveryOutcome(d) === o).length
  const overdue = pending.filter((d) => isOverdueDelivery(d, today)).length
  const parts: [number, string, string][] = [
    [overdue, 'atrasada', 'atrasadas'],
    [inTransit, 'en camino', 'en camino'],
    [count('hecha'), 'hecha', 'hechas'],
    [count('fallida'), 'fallida', 'fallidas'],
    [count('anulada'), 'anulada', 'anuladas'],
  ]
  return [
    plural(pending.length, 'pendiente', 'pendientes'),
    ...parts.filter(([n]) => n > 0).map(([n, one, many]) => plural(n, one, many)),
  ].join(' · ')
}

/**
 * Orden dentro de una parada (UX4-19): primero lo que queda por hacer, y de eso lo urgente,
 * luego lo atrasado y luego por fecha programada; después lo que viene en camino, que aún espera
 * «Recibido» (#118), y al final lo cerrado. Empate: 0 (el `sort` estable conserva el orden de
 * llegada).
 */
export function compareStopDeliveries(a: DayDelivery, b: DayDelivery, today: string): number {
  const open = [isActionableDelivery(a), isActionableDelivery(b)] as const
  if (open[0] !== open[1]) return open[0] ? -1 : 1
  if (!open[0]) return Number(isDeliveryInTransit(b)) - Number(isDeliveryInTransit(a))
  const rank = (d: DayDelivery) =>
    (d.case.priority === 'urgente' ? 0 : 2) + (isOverdueDelivery(d, today) ? 0 : 1)
  return rank(a) - rank(b) || a.scheduledFor.localeCompare(b.scheduledFor)
}
