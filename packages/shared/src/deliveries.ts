import { availableActions, canPerform, type CaseAction, type CaseStatus } from './case-status.ts'
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

/** Rótulo del evento `delivery_failed` en el historial según el tipo que guarda en `fromValue`
 * (UX4-16). `Record` exhaustivo: un tipo nuevo no compila sin su rótulo. */
export const DELIVERY_FAILED_LABEL: Record<DeliveryType, string> = {
  recogida: 'Recogida fallida',
  entrega: 'Entrega fallida',
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
 * entregado». `Record` exhaustivo. «No se pudo» no deriva su permiso de aquí: lo decide
 * `canFailDelivery` (UX4-10: el mensajero no recibe, pero sí marca «No se pudo» en su recogida). */
export const DELIVERY_CLOSING_ACTION: Record<DeliveryType, CaseAction> = {
  recogida: 'recibir',
  entrega: 'marcar_entregado',
}

/** A quién está asignada una entrega o recogida: lo que necesita quien decide si puede
 * cerrarla (`canActOnDelivery`). */
export type DeliveryAssignment = { type: DeliveryType; courierId: string }

/** La entrega o recogida pendiente de un trabajo, tal como la trae su ficha (UX4-07/09): de qué
 * tipo es, quién la tiene y para qué día está programada. Con su `id`, para que la ficha corta
 * del mensajero marque «Recogido» sobre ella (#118). Sin dinero. */
export type PendingDelivery = DeliveryAssignment & {
  id: string
  courierName: string
  /** `YYYY-MM-DD`. */
  scheduledFor: string
}

/** La última entrega hecha de un trabajo (UX4-09): cuándo, quién y con qué constancia. */
export type LastDelivered = {
  /** Timestamp ISO (UTC); formatea el cliente. */
  doneAt: string
  courierName: string
  proofAttachmentId: string | null
}

/** Verbo de la tarea del mensajero por tipo (UX4-07). En la recogida el mensajero **recoge** en
 * la clínica; quien lo recibe es el laboratorio. `Record` exhaustivo. */
export const COURIER_TASK_VERB: Record<DeliveryType, string> = {
  recogida: 'Recoger',
  entrega: 'Entregar',
}

/** «Entregar hoy en Clínica Norte» / «Recoger el 09/10/2026 en Clínica Sur» (UX4-07): `when` lo
 * formatea el cliente («hoy» o «el dd/mm/aaaa»). */
export function courierTaskTitle(type: DeliveryType, when: string, clinicName: string): string {
  return `${COURIER_TASK_VERB[type]} ${when} en ${clinicName}`
}

/** ¿La entrega está asignada a `userId`? La parte «es el mensajero asignado» de
 * `canActOnDelivery`, `canFailDelivery`, la ficha corta y `courierNoActionReason`. */
export function isOwnDelivery(
  userId: string,
  delivery: { courierId: string } | null | undefined,
): boolean {
  return !!delivery && delivery.courierId === userId
}

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
  pending: DeliveryAssignment | null | undefined,
): boolean {
  const closes = DELIVERY_CLOSED_BY_ACTION[action]
  if (closes === null || hasRole(DELIVERY_MANAGE_ROLES, actor.role)) return true
  return pending?.type === closes && isOwnDelivery(actor.userId, pending)
}

/**
 * ¿Puede `actor` saber algo de `delivery`, sea del tipo o en el estado que sea (M-6 de la
 * revisión final de #118)? Quien administra entregas, de cualquiera; el mensajero
 * (`DELIVERY_ROLES`), solo de la suya. La API lo comprueba antes que el estado o el tipo, así
 * que a quien no puede actuar sobre una entrega ajena le responde 403 sin revelar si está
 * cerrada o qué tipo es.
 */
export function canHandleDelivery(
  actor: { role: UserRole; userId: string },
  delivery: { courierId: string },
): boolean {
  if (hasRole(DELIVERY_MANAGE_ROLES, actor.role)) return true
  return hasRole(DELIVERY_ROLES, actor.role) && isOwnDelivery(actor.userId, delivery)
}

/**
 * ¿Puede `actor` marcar «No se pudo» en `delivery` (ENT-5)? Quien administra entregas, en
 * cualquiera; el mensajero (`DELIVERY_ROLES`), solo en la suya, sea recogida o entrega. No
 * depende de quién puede cerrarla (UX4-10: la recogida la recibe recepción). Una sola fuente
 * para la API (`DeliveriesService.fail`, 403) y la web (tarjeta de «Entregas»).
 */
export function canFailDelivery(
  actor: { role: UserRole; userId: string },
  delivery: DeliveryAssignment,
): boolean {
  return canHandleDelivery(actor, delivery)
}

/**
 * ¿Puede `actor` marcar «Recogido» en `delivery` (#118)? Solo en una recogida: quien administra
 * entregas, en cualquiera; el mensajero, solo en la suya. Cierra la recogida sin cambiar el
 * estado del trabajo, que sigue por recoger hasta «Recibido». Una sola fuente para la API
 * (`DeliveriesService.pickUp`, 403) y la web (botón «Recogido»).
 */
export function canMarkPickedUp(
  actor: { role: UserRole; userId: string },
  delivery: DeliveryAssignment,
): boolean {
  return delivery.type === 'recogida' && canHandleDelivery(actor, delivery)
}

/**
 * ¿Se le **ofrece** «Recogido» a `actor` en la UI (#118, decisión 4 del plan)? Solo al mensajero
 * en su recogida (`canMarkPickedUp`). Admin y recepción pueden marcarla en la API, pero la UI no
 * se lo ofrece: ven «Recibido», que también la cierra si el trabajo llega en mano, y así no hay
 * tres botones en la tarjeta.
 */
export function offersPickUp(
  actor: { role: UserRole; userId: string },
  delivery: DeliveryAssignment,
): boolean {
  return !hasRole(DELIVERY_MANAGE_ROLES, actor.role) && canMarkPickedUp(actor, delivery)
}

/** La última recogida hecha de un trabajo (#118): cuándo la recogió y quién. Sin dinero. */
export type LastPickedUp = {
  /** Timestamp ISO (UTC); formatea el cliente. */
  doneAt: string
  courierName: string
}

/** ¿Viene en camino al laboratorio (#118)? La recogida está hecha y el trabajo sigue por
 * recoger, sin otra recogida pendiente. Rótulo derivado, sin estado nuevo (ADR 16). */
export function isInTransitToLab(
  status: CaseStatus,
  pending: DeliveryAssignment | null | undefined,
  lastPickedUp: LastPickedUp | null | undefined,
): boolean {
  return status === 'por_recoger' && !pending && !!lastPickedUp
}

export const IN_TRANSIT_TO_LAB = 'En camino al laboratorio'

/** Línea del diálogo de cancelar un trabajo que viene en camino (#118, M-1 de la revisión
 * final): el mensajero ya lo tiene en la mano, y quien cancela debe saberlo. `null` si no viene
 * en camino (`isInTransitToLab`). */
export function inTransitCancelNote(
  status: CaseStatus,
  pending: DeliveryAssignment | null | undefined,
  lastPickedUp: LastPickedUp | null | undefined,
): string | null {
  if (!lastPickedUp || !isInTransitToLab(status, pending, lastPickedUp)) return null
  return `${lastPickedUp.courierName} ya lo recogió y viene en camino al laboratorio.`
}

/** «Recogido por Luis a las 10:32» (#118); `time` y `date` («04/10») ya formateadas por el
 * cliente. Lo recogido otro día lleva la fecha («Recogido por Luis el 04/10 a las 10:32», M-4
 * de la revisión final): lo que sigue en camino desde ayer no se lee como de hoy. */
export function pickedUpLine(courierName: string, time: string, date?: string | null): string {
  return date
    ? `Recogido por ${courierName} el ${date} a las ${time}`
    : `Recogido por ${courierName} a las ${time}`
}

/** Quién cierra cada tipo de entrega cuando no es quien la ve (UX4-10). `Record` exhaustivo. */
const DELIVERY_NEXT_STEP: Record<DeliveryType, string> = {
  recogida: 'Recepción lo marca como recibido al llegar al laboratorio.',
  entrega: 'Recepción lo marca como entregado.',
}

/** Qué sigue con una entrega que `role` no puede cerrar (UX4-10: el mensajero recoge, pero
 * «Recibido» lo marca recepción); `null` si la cierra él mismo. */
export function deliveryNextStep(role: UserRole, type: DeliveryType): string | null {
  return canPerform(role, DELIVERY_CLOSING_ACTION[type]) ? null : DELIVERY_NEXT_STEP[type]
}

/**
 * Las acciones de estado que `actor` ve y puede hacer sobre un trabajo: las del estado
 * (`availableActions`), las de su rol (`canPerform`) y, en las que cierran una entrega, solo la
 * suya (`canActOnDelivery`). Una sola fuente para la barra de acciones de la web y para saber si
 * la ficha corta del mensajero queda sin acción (UX4-08).
 */
export function actionsFor(
  actor: { role: UserRole; userId: string },
  status: CaseStatus,
  pending: DeliveryAssignment | null | undefined,
): CaseAction[] {
  return availableActions(status)
    .filter((a) => canPerform(actor.role, a))
    .filter((a) => canActOnDelivery(actor, a, pending))
}

/** Motivo de una recogida o entrega que tiene otro mensajero (UX4-08). `Record` exhaustivo. */
export const OTHER_COURIER_REASON: Record<DeliveryType, (courierName: string) => string> = {
  recogida: (name) => `Esta recogida la tiene ${name}.`,
  entrega: (name) => `Esta entrega la tiene ${name}.`,
}

/** Motivo de la ficha corta del mensajero cuando el trabajo no tiene entrega pendiente (UX4-08). */
export const NO_PENDING_DELIVERY_FOR_COURIER =
  'Este trabajo no tiene una entrega pendiente para ti.'

/** Qué sigue en la ficha corta del mensajero cuando el trabajo ya viene en camino (#118): la
 * recogida está hecha y «Recibido» lo marca recepción al llegar. */
export const PICKED_UP_NEXT_STEP = `Recogido. ${DELIVERY_NEXT_STEP.recogida}`

/**
 * Por qué el mensajero no tiene acción en la ficha corta (UX4-08): la recogida o entrega es de
 * otro, o no hay ninguna pendiente. En la suya no hace falta: su tarea («Recoger hoy en …») dice
 * qué hacer y tiene su botón («Recogido» en la recogida, #118). Si el trabajo ya viene en camino
 * (`inTransit`, `isInTransitToLab`), dice que lo recogió y que lo demás es de recepción.
 */
export function courierNoActionReason(
  pending: Pick<PendingDelivery, 'type' | 'courierId' | 'courierName'> | null | undefined,
  userId: string,
  inTransit = false,
): string | null {
  if (!pending) return inTransit ? PICKED_UP_NEXT_STEP : NO_PENDING_DELIVERY_FOR_COURIER
  if (!isOwnDelivery(userId, pending))
    return OTHER_COURIER_REASON[pending.type](pending.courierName)
  return null
}

/** Línea de la entrega pendiente en la ficha completa (UX4-09), por tipo; `when` lo formatea el
 * cliente («hoy» o «el dd/mm/aaaa»). `Record` exhaustivo. */
export const PENDING_DELIVERY_LINE: Record<
  DeliveryType,
  (when: string, courierName: string) => string
> = {
  recogida: (when, name) => `Recogida programada para ${when} con ${name}`,
  entrega: (when, name) => `Sale ${when} con ${name}`,
}

export function pendingDeliveryLine(type: DeliveryType, when: string, courierName: string) {
  return PENDING_DELIVERY_LINE[type](when, courierName)
}

/** «Entregado el 04/10/2026 por Mario» (UX4-09); `date` ya formateada por el cliente. */
export function deliveredLine(date: string, courierName: string): string {
  return `Entregado el ${date} por ${courierName}`
}
