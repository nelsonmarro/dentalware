import type { UserRole } from './roles.ts'

/** Tipo de entrega (Iteración 4): `recogida` trae el trabajo al laboratorio (ENT-1),
 * `entrega` lo lleva a la clínica (ENT-2). */
export const DELIVERY_TYPES = ['recogida', 'entrega'] as const
export type DeliveryType = (typeof DELIVERY_TYPES)[number]

/** Estado de una entrega/recogida puntual, distinto del estado del trabajo (decisión 6 del
 * plan): una entrega fallida no cambia el estado del trabajo, solo se reprograma. */
export const DELIVERY_STATUSES = ['pendiente', 'hecha', 'fallida'] as const
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]

/** `Record` exhaustivo: un tipo de entrega nuevo no compila sin su rótulo. */
export const DELIVERY_TYPE_LABEL: Record<DeliveryType, string> = {
  recogida: 'Recogida',
  entrega: 'Entrega',
}

/** `Record` exhaustivo: un estado de entrega nuevo no compila sin su rótulo. */
export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  pendiente: 'Pendiente',
  hecha: 'Hecha',
  fallida: 'Fallida',
}

/** Quién administra entregas: crea, reprograma y ve las de cualquier mensajero
 * (`GET /api/entregas/mensajeros`, decisión 8 del plan). */
export const DELIVERY_MANAGE_ROLES = ['admin', 'recepcion'] as const satisfies readonly UserRole[]

/** Quién puede actuar sobre una entrega: suma al mensajero, que solo actúa sobre la suya
 * (decisión 4 del plan: el `mensajeroId` debe ser él mismo en `marcar_enviado`, y la entrega
 * pendiente debe estar asignada a él en `recibir`/`marcar_entregado`). */
export const DELIVERY_ROLES = [
  'admin',
  'recepcion',
  'mensajero',
] as const satisfies readonly UserRole[]

/** Quién sube adjuntos que no sean la constancia de entrega (decisión 5 del plan): el
 * mensajero solo puede subir `constancia`, así que queda fuera de esta lista. */
export const ATTACHMENT_UPLOAD_ROLES = [
  'admin',
  'recepcion',
  'tecnico',
] as const satisfies readonly UserRole[]

/** Error de `marcar_entregado` (ENT-4) cuando `constanciaId` no es una foto de constancia de
 * este trabajo: no existe, es de otro trabajo, es de otro tipo o no es una imagen. La API lo
 * devuelve en el 422 y la web lo muestra tal cual. */
export const CONSTANCIA_INVALIDA = 'La foto de constancia no es de este trabajo.'

/** Mensaje del 409 cuando `fail` actúa sobre una entrega que ya no está pendiente (ruling de
 * la Tarea 6): literal único para que la web la reconozca con `useConflictAwareError`. */
export const DELIVERY_NOT_PENDING_MESSAGE = 'Esta entrega ya no está pendiente.'

/** Una entrega/recogida está atrasada si sigue pendiente y su fecha programada ya pasó
 * (decisión 7 del plan: el día de hoy también muestra las pendientes atrasadas). */
export function isOverdueDelivery(
  d: { status: DeliveryStatus; scheduledFor: string },
  today: string,
): boolean {
  return d.status === 'pendiente' && d.scheduledFor < today
}
