import type { CaseAction } from './case-status.ts'
import { hasRole, type UserRole } from './roles.ts'

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

/** Mensaje del 409 al borrar una constancia que referencia una entrega hecha (UX4-06): la
 * entrega quedaría «Hecha» sin foto. Una constancia sin usar sí se borra. */
export const DELIVERY_PROOF_LOCKED_MESSAGE = 'Es la constancia de la entrega: no se puede borrar.'

/** Mensaje del 409 cuando `fail` actúa sobre una entrega que ya no está pendiente (ruling de
 * la Tarea 6). La web no lo compara: `useConflictAwareError` reacciona al status 409 (refresca
 * y muestra este texto tal cual); el literal es el contrato de la API y de sus pruebas. */
export const DELIVERY_NOT_PENDING_MESSAGE = 'Esta entrega ya no está pendiente.'

/** Mensaje del 409 cuando `recibir`, `marcar_entregado` o `cancelar` van a cerrar la entrega
 * pendiente que acaban de leer y otra petición la cerró antes (p. ej. «No se pudo» a la vez,
 * I-1 de la revisión final del PR 2): el cierre es condicional y no pisa el de la otra. */
export const DELIVERY_ALREADY_CLOSED_MESSAGE =
  'La entrega ya no está pendiente. Puede que otra persona la haya cerrado.'

/** Prefijo del motivo con el que `cancelar` cierra la recogida o entrega pendiente del trabajo
 * (ruling de la Tarea 6): es lo que distingue esa entrega de una fallida real anterior. */
export const CANCELLED_DELIVERY_REASON_PREFIX = 'Trabajo cancelado: '

/** Motivo de la entrega que cierra la cancelación del trabajo (API, `CasesService.action`). */
export function cancelledDeliveryReason(motivo: string | null): string {
  return `${CANCELLED_DELIVERY_REASON_PREFIX}${motivo ?? ''}`
}

/** ¿La cerró la cancelación del trabajo? Solo una `fallida` con el prefijo de cancelación (M-3
 * de la revisión final del PR 2): una recogida `hecha` o una fallida real anterior a la
 * cancelación conservan su estado y su motivo en la web, aunque el trabajo esté cancelado. */
export function isClosedByCancellation(d: {
  status: DeliveryStatus
  failedReason: string | null
}): boolean {
  return d.status === 'fallida' && !!d.failedReason?.startsWith(CANCELLED_DELIVERY_REASON_PREFIX)
}

/** Una entrega/recogida está atrasada si sigue pendiente y su fecha programada ya pasó
 * (decisión 7 del plan: el día de hoy también muestra las pendientes atrasadas). */
export function isOverdueDelivery(
  d: { status: DeliveryStatus; scheduledFor: string },
  today: string,
): boolean {
  return d.status === 'pendiente' && d.scheduledFor < today
}

/** Qué entrega pendiente cierra cada acción de estado: `recibir` cierra la recogida (ENT-1) y
 * `marcar_entregado` la entrega (ENT-4). `Record` exhaustivo: una acción nueva no compila sin
 * decidir si cierra una entrega (y, con ella, si el mensajero solo la hace sobre la suya). */
export const DELIVERY_CLOSED_BY_ACTION: Record<CaseAction, DeliveryType | null> = {
  recibir: 'recogida',
  aceptar: null,
  pausar: null,
  reanudar: null,
  enviar_prueba: null,
  recibir_prueba: null,
  finalizar: null,
  marcar_enviado: null,
  marcar_entregado: 'entrega',
  cancelar: null,
}

/** Qué acción de estado cierra cada tipo de entrega (la inversa de `DELIVERY_CLOSED_BY_ACTION`,
 * probada contra ella): la recogida se cierra con «Recibido» y la entrega con «Marcar
 * entregado». `Record` exhaustivo; una sola fuente para la tarjeta de la web y para «No se
 * pudo» (`fail`), que exige el mismo permiso que la acción que cierra la entrega. */
export const DELIVERY_CLOSING_ACTION: Record<DeliveryType, CaseAction> = {
  recogida: 'recibir',
  entrega: 'marcar_entregado',
}

/** La entrega o recogida pendiente de un trabajo, tal como la ve quien decide si puede
 * cerrarla: de qué tipo es y a qué mensajero está asignada. */
export type PendingDelivery = { type: DeliveryType; courierId: string }

/**
 * ¿Puede `actor` hacer `action` sobre el trabajo cuya entrega pendiente es `pending`?
 * (decisión 4 del plan, M-4 de la revisión final del PR 1). Solo restringe las acciones que
 * cierran una entrega (`DELIVERY_CLOSED_BY_ACTION`): quien administra entregas actúa sobre
 * cualquiera, y el resto solo sobre la pendiente del tipo que cierra la acción y asignada a él.
 * Sin entrega pendiente (datos anteriores a la Iteración 4) solo admin y recepción. El rol
 * para la acción en sí lo decide `canPerform`; esto es lo que se suma para las entregas.
 * Una sola fuente para la API (`CasesService.action`, 403) y la web (no mostrar el botón).
 */
export function canActOnDelivery(
  actor: { role: UserRole; userId: string },
  action: CaseAction,
  pending: PendingDelivery | null | undefined,
): boolean {
  const closes = DELIVERY_CLOSED_BY_ACTION[action]
  if (closes === null || hasRole(DELIVERY_MANAGE_ROLES, actor.role)) return true
  return pending?.type === closes && pending.courierId === actor.userId
}
