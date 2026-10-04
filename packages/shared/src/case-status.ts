import { hasRole, type UserRole } from './roles.ts'

/** `por_recoger` es el primer estado del ciclo de vida (ENT-1, Iteración 4): el trabajo existe
 * en el sistema (recepción programó su recogida) pero todavía no llegó al laboratorio. Pasa a
 * `nuevo` con la acción `recibir`. */
export const CASE_STATUSES = [
  'por_recoger',
  'nuevo',
  'en_proceso',
  'en_espera',
  'en_prueba',
  'terminado',
  'enviado',
  'entregado',
  'cancelado',
] as const
export type CaseStatus = (typeof CASE_STATUSES)[number]

export const CASE_ACTIONS = [
  'recibir',
  'aceptar',
  'pausar',
  'reanudar',
  'enviar_prueba',
  'recibir_prueba',
  'finalizar',
  'marcar_enviado',
  'marcar_entregado',
  'cancelar',
] as const
export type CaseAction = (typeof CASE_ACTIONS)[number]

type Transition = { from: readonly CaseStatus[]; to: CaseStatus; roles: readonly UserRole[] }

const CANCELABLE: readonly CaseStatus[] = CASE_STATUSES.filter(
  (s) => s !== 'entregado' && s !== 'cancelado',
)

export const CASE_TRANSITIONS: Record<CaseAction, Transition> = {
  // UX4-10 (Nelson, 2026-10-04): «Recibido» lo marca recepción al llegar el trabajo al
  // laboratorio; el mensajero solo lo recoge (y puede marcar «No se pudo», `canFailDelivery`).
  recibir: { from: ['por_recoger'], to: 'nuevo', roles: ['admin', 'recepcion'] },
  aceptar: { from: ['nuevo'], to: 'en_proceso', roles: ['admin', 'recepcion'] },
  pausar: { from: ['en_proceso'], to: 'en_espera', roles: ['admin', 'recepcion'] },
  reanudar: { from: ['en_espera'], to: 'en_proceso', roles: ['admin', 'recepcion'] },
  enviar_prueba: { from: ['en_proceso'], to: 'en_prueba', roles: ['admin', 'recepcion'] },
  recibir_prueba: { from: ['en_prueba'], to: 'en_proceso', roles: ['admin', 'recepcion'] },
  finalizar: { from: ['en_proceso'], to: 'terminado', roles: ['admin', 'recepcion', 'tecnico'] },
  marcar_enviado: {
    from: ['terminado'],
    to: 'enviado',
    roles: ['admin', 'recepcion', 'mensajero'],
  },
  marcar_entregado: {
    from: ['enviado'],
    to: 'entregado',
    roles: ['admin', 'recepcion', 'mensajero'],
  },
  cancelar: { from: CANCELABLE, to: 'cancelado', roles: ['admin', 'recepcion'] },
}

/** Qué datos exige cada acción además de `accion` (Iteración 4, ENT-2/ENT-4). `Record`
 * exhaustivo: una acción nueva no compila sin decidir su carga útil. De aquí se derivan el
 * motivo obligatorio (antes `REASON_REQUIRED_FOR_ACTION`, un `Record<CaseAction, boolean>`
 * independiente que esta carga útil sustituye) y la validación de `caseActionSchema`. */
export type ActionPayload = 'ninguna' | 'motivo' | 'envio' | 'constancia'
export const ACTION_PAYLOAD = {
  recibir: 'ninguna',
  aceptar: 'ninguna',
  pausar: 'motivo',
  reanudar: 'ninguna',
  enviar_prueba: 'ninguna',
  recibir_prueba: 'ninguna',
  finalizar: 'ninguna',
  marcar_enviado: 'envio',
  marcar_entregado: 'constancia',
  cancelar: 'motivo',
} as const satisfies Record<CaseAction, ActionPayload>

/** Acciones que exigen motivo, como tipo (M-4, revisión de la Tarea 3): derivado de
 * `ACTION_PAYLOAD` (`motivo` ⇔ carga útil `'motivo'`), para que la web pueda exigir un texto
 * por cada una en un `Record<ActionRequiringReason, …>` exhaustivo. */
export type ActionRequiringReason = {
  [A in CaseAction]: (typeof ACTION_PAYLOAD)[A] extends 'motivo' ? A : never
}[CaseAction]

export function requiresReason(action: CaseAction): action is ActionRequiringReason {
  return ACTION_PAYLOAD[action] === 'motivo'
}

/** Acciones que piden datos de entrega (Iteración 4): `envio` (mensajero y fecha, ENT-2) o
 * `constancia` (foto de la entrega, ENT-4). Derivado de `ACTION_PAYLOAD` como
 * `ActionRequiringReason`, para que la web tenga un diálogo por cada una en un `Record`
 * exhaustivo. */
export type ActionRequiringDeliveryForm = {
  [A in CaseAction]: (typeof ACTION_PAYLOAD)[A] extends 'envio' | 'constancia' ? A : never
}[CaseAction]

export function requiresDeliveryForm(action: CaseAction): action is ActionRequiringDeliveryForm {
  const payload = ACTION_PAYLOAD[action]
  return payload === 'envio' || payload === 'constancia'
}

export const ACTIONS_REQUIRING_REASON: readonly CaseAction[] = CASE_ACTIONS.filter(requiresReason)

/** Rótulo de cada estado tal como lo ve el laboratorio (chip de la web, historial y mensajes
 * de error de la API). Fuente única (UX3-03): antes vivía solo en la web y la API interpolaba
 * la clave (`en_proceso`) en sus 409. `Record` exhaustivo: un estado nuevo no compila sin rótulo. */
export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  por_recoger: 'Por recoger',
  nuevo: 'Nuevo',
  en_proceso: 'En proceso',
  en_espera: 'En espera',
  en_prueba: 'En prueba',
  terminado: 'Terminado',
  enviado: 'Enviado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

/** Rótulo de cada acción: imperativo, el texto del botón que la dispara (no el estado destino).
 * Fuente única para la barra de acciones de la web y los 409 de la API (UX3-03). */
export const CASE_ACTION_LABEL: Record<CaseAction, string> = {
  recibir: 'Recibido',
  aceptar: 'Aceptar',
  pausar: 'Pausar',
  reanudar: 'Reanudar',
  enviar_prueba: 'Enviar a prueba',
  recibir_prueba: 'Recibir de prueba',
  finalizar: 'Finalizar',
  marcar_enviado: 'Marcar enviado',
  marcar_entregado: 'Marcar entregado',
  cancelar: 'Cancelar trabajo',
}

/** Forma única de los 409 por estado (M-3, revisión de la Tarea 3): qué no se puede hacer, en
 * qué estado está el trabajo (rótulo, nunca la clave) y la causa probable. No pide recargar: la
 * web refresca la ficha sola ante un 409 (I-1). */
function blockedByStatusMessage(what: string, status: CaseStatus): string {
  return `No se puede ${what}: el trabajo está en estado "${CASE_STATUS_LABEL[status]}". Puede que otra persona lo haya cambiado.`
}

export type ApplyResult = { ok: true; status: CaseStatus } | { ok: false; reason: string }

/** El motivo de rechazo llega tal cual al toast de la web (409): nombra la acción y el estado
 * con sus rótulos, nunca con las claves, y explica la causa probable — otra persona movió el
 * trabajo mientras esta tenía la ficha abierta. No pide recargar: la web refresca la ficha sola
 * ante un 409 (I-1, revisión de la Tarea 3). */
export function applyAction(status: CaseStatus, action: CaseAction): ApplyResult {
  const t = CASE_TRANSITIONS[action]
  if (!t.from.includes(status)) {
    return {
      ok: false,
      reason: blockedByStatusMessage(`"${CASE_ACTION_LABEL[action]}"`, status),
    }
  }
  return { ok: true, status: t.to }
}

export function availableActions(status: CaseStatus): CaseAction[] {
  return CASE_ACTIONS.filter((a) => CASE_TRANSITIONS[a].from.includes(status))
}

export function canPerform(role: UserRole, action: CaseAction): boolean {
  return CASE_TRANSITIONS[action].roles.includes(role)
}

/** Estados en los que un trabajo aún se puede editar (formulario de edición y botón
 * "editar" de la ficha); el resto responde 409 si se intenta guardar. `por_recoger` se suma
 * en la Iteración 4 (ENT-1): recepción completa los datos cuando el trabajo llega. */
export const EDITABLE_CASE_STATUSES = [
  'por_recoger',
  'nuevo',
  'en_proceso',
] as const satisfies readonly CaseStatus[]

export function isEditableStatus(status: CaseStatus): boolean {
  return (EDITABLE_CASE_STATUSES as readonly CaseStatus[]).includes(status)
}

/** Por qué no se puede editar un trabajo en `status`: único texto para el 409 de la API al
 * guardar y para el aviso de la web al abrir «Editar» (UX3-03: con el rótulo, no la clave). */
export function notEditableMessage(status: CaseStatus): string {
  return blockedByStatusMessage('editar', status)
}

/** Estados desde los que se puede repetir un trabajo (CIC-4): cualquier punto en el que ya se
 * vio o se entregó el resultado y se decidió que no sirve. */
export const REMAKEABLE_STATUSES = [
  'terminado',
  'enviado',
  'entregado',
] as const satisfies readonly CaseStatus[]

export function canRemake(status: CaseStatus): boolean {
  return (REMAKEABLE_STATUSES as readonly CaseStatus[]).includes(status)
}

/** 409 de repetir un trabajo en un estado de `canRemake` falso (repo y fakes de la API). */
export function notRemakeableMessage(status: CaseStatus): string {
  return blockedByStatusMessage('repetir', status)
}

/**
 * Roles y estados por operación sobre el trabajo, fuente única (I-5 + M-5 + M-9, ronda de
 * fixes 1 del PR 1): antes vivían duplicados a mano en `cases/routes.ts` (`canWrite`, `canAct`,
 * `canChangeStage`), en `cases/service.ts` (defensa en profundidad de cada método) y en la web
 * (`stage-control.tsx`, `technician-select.tsx`, `case-detail-tab.tsx`), sin nada que los
 * mantuviera sincronizados entre sí.
 */

/** Roles que pueden ejecutar **alguna** transición de estado: la unión de los roles de
 * `CASE_TRANSITIONS`, derivada y no escrita a mano, para que dar una acción nueva a un rol
 * amplíe también el guardián de `POST /:id/acciones` (ADR 27). Qué acción puede cada uno lo
 * decide después `canPerform` en el servicio. */
export const CASE_ACTION_ROLES: readonly UserRole[] = [
  ...new Set(Object.values(CASE_TRANSITIONS).flatMap((t) => t.roles)),
]

/** Roles que escriben sobre un trabajo por defecto: crear, editar, repetir, asignar técnico y
 * listar técnicos (mismo criterio que `canWrite` en `routes.ts`). */
export const CASE_WRITE_ROLES = ['admin', 'recepcion'] as const satisfies readonly UserRole[]

/** ¿Puede `role` crear y editar trabajos? (UX3-16: la web lo preguntaba con roles escritos a mano). */
export function canWriteCases(role: UserRole): boolean {
  return hasRole(CASE_WRITE_ROLES, role)
}

/** Roles que pueden eliminar un adjunto: mismos que `CASE_WRITE_ROLES`, nombrado aparte por la
 * misma razón que `ASSIGN_TECHNICIAN_ROLES` (el técnico sube fotos pero no las borra). */
export const ATTACHMENT_DELETE_ROLES: readonly UserRole[] = CASE_WRITE_ROLES

/** Roles que pueden cambiar la fase de producción (CIC-2): a diferencia del resto de
 * escrituras (`CASE_WRITE_ROLES`), el técnico también puede. */
export const STAGE_CHANGE_ROLES = [
  'admin',
  'recepcion',
  'tecnico',
] as const satisfies readonly UserRole[]

/** Roles que pueden asignar o quitar el técnico responsable (CIC-5): mismos que
 * `CASE_WRITE_ROLES`, nombrado aparte porque es una regla de negocio distinta que podría
 * divergir en el futuro. */
export const ASSIGN_TECHNICIAN_ROLES: readonly UserRole[] = CASE_WRITE_ROLES

/** Roles que pueden repetir un trabajo (CIC-4): mismos que `CASE_WRITE_ROLES`, nombrado aparte
 * por la misma razón que `ASSIGN_TECHNICIAN_ROLES`. */
export const REMAKE_ROLES: readonly UserRole[] = CASE_WRITE_ROLES

/** Único estado en el que un trabajo tiene una fase de producción en curso (CIC-2): `aceptar`
 * deja la fase inicial y desde `en_proceso` se finaliza. Lista blanca, no negra: un trabajo
 * `terminado`/`enviado`/`entregado`/`cancelado` no debe seguir cambiando de fase aunque
 * `finalizar` no limpie `currentStageId`. Predicado de tipo (no solo `boolean`) para que
 * `!canChangeStage(found.status)` estreche a `Exclude<CaseStatus, 'en_proceso'>` y así indexar
 * `STAGE_CHANGE_BLOCKED_REASON` sin un cast. */
export function canChangeStage(status: CaseStatus): status is 'en_proceso' {
  return status === 'en_proceso'
}

/** Estados terminales en los que ya no tiene sentido reasignar el técnico responsable
 * (CIC-5): a diferencia de `canChangeStage`, el resto de estados sí lo permite — corregir
 * quién es responsable de un trabajo que todavía se mueve por el laboratorio es legítimo. */
export const ASSIGN_TECHNICIAN_BLOCKED_STATUSES = [
  'entregado',
  'cancelado',
] as const satisfies readonly CaseStatus[]

export function canAssignTechnician(status: CaseStatus): boolean {
  return !(ASSIGN_TECHNICIAN_BLOCKED_STATUSES as readonly CaseStatus[]).includes(status)
}

/** 409 de reasignar el técnico en un estado de `canAssignTechnician` falso. */
export function notReassignableMessage(status: CaseStatus): string {
  return blockedByStatusMessage('reasignar el técnico', status)
}

/** Estados en los que la fecha de entrega está "activa": un trabajo cerrado (`terminado` en
 * adelante) ya no puede vencer ni estar atrasado. Fuente única para las vistas rápidas
 * `vencen_hoy`/`atrasados` de la API (`cases/repo.ts`, `cases/fakes.ts`) y para el semáforo de
 * fecha de la web (`dueBadge` en `case-views.ts`) — antes era la misma lista escrita a mano en
 * los tres sitios (M-2, ola de fixes del PR 2 de la Iteración 3). */
export const ACTIVE_FOR_DATES_STATUSES = [
  'nuevo',
  'en_proceso',
  'en_espera',
  'en_prueba',
] as const satisfies readonly CaseStatus[]

export function isActiveForDates(status: CaseStatus): boolean {
  return (ACTIVE_FOR_DATES_STATUSES as readonly CaseStatus[]).includes(status)
}

/** Estados que caen en la vista rápida `en_curso` (`CASE_VIEWS`): el trabajo ya se aceptó y
 * todavía no llega a un estado terminal de producción. Fuente única para `viewCondition`
 * (`cases/repo.ts`) y `matchesView` (`cases/fakes.ts`) — misma lista, antes escrita a mano en
 * ambos (M-2, ola de fixes del PR 2 de la Iteración 3). */
export const EN_CURSO_STATUSES = [
  'en_proceso',
  'en_espera',
  'en_prueba',
] as const satisfies readonly CaseStatus[]

export function isEnCurso(status: CaseStatus): boolean {
  return (EN_CURSO_STATUSES as readonly CaseStatus[]).includes(status)
}

/** Motivo (en español) de por qué no se puede cambiar de fase en cada estado que no sea
 * `en_proceso`: única fuente para el 409 del servicio (`CaseStateError`) y para el aviso de
 * solo lectura en la ficha de la web — antes eran dos `Record` con las mismas claves y texto
 * casi idéntico. `Record<Exclude<CaseStatus, 'en_proceso'>, string>` exhaustivo a propósito
 * (mismo patrón que `CONFIRM_DESCRIPTIONS` en la web): un estado nuevo no compila sin motivo. */
export const STAGE_CHANGE_BLOCKED_REASON: Record<Exclude<CaseStatus, 'en_proceso'>, string> = {
  por_recoger: 'El trabajo todavía no llegó al laboratorio: recíbelo y acéptalo primero.',
  nuevo: 'El trabajo todavía no tiene fase: acéptalo primero.',
  en_espera: 'El trabajo está en espera: reanúdalo para poder cambiar de fase.',
  en_prueba: 'El trabajo está en una prueba en boca: recíbela para poder cambiar de fase.',
  terminado: 'El trabajo ya está terminado.',
  enviado: 'El trabajo ya fue enviado.',
  entregado: 'El trabajo ya fue entregado.',
  cancelado: 'El trabajo está cancelado.',
}

/** Motivos de los 409 al mover la fase **dentro** de `en_proceso` (CIC-2): ya en la última al
 * avanzar, ya en la primera al retroceder, o la fase actual fuera de las activas (desactivada o
 * nula) — así no se le dice «última fase» a un trabajo cuya posición no se conoce. Única fuente
 * para el `CaseStateError` del servicio, junto a `STAGE_CHANGE_BLOCKED_REASON` (que cubre el
 * bloqueo por estado). */
export const STAGE_MOVE_BLOCKED_REASON = {
  ultima: `No se puede avanzar: el trabajo ya está en la última fase. Usa "${CASE_ACTION_LABEL.finalizar}" para terminarlo.`,
  primera: 'No se puede retroceder: el trabajo ya está en la primera fase.',
  desconocida:
    'No se puede cambiar de fase: no se pudo determinar la fase actual del trabajo. Puede que esté desactivada.',
} as const satisfies Record<'ultima' | 'primera' | 'desconocida', string>

/** En qué parte del ciclo está el trabajo, para titular y ordenar el panel de la ficha (UX4-24):
 * traerlo (`recogida`), hacerlo (`produccion`) o llevarlo (`entrega`). Un cancelado se queda en
 * `produccion`: lo que queda por hacer con él es repetirlo. `Record` exhaustivo: un estado nuevo
 * no compila sin decidir su fase. */
export const CASE_PHASES = ['recogida', 'produccion', 'entrega'] as const
export type CasePhase = (typeof CASE_PHASES)[number]

export const CASE_PHASE: Record<CaseStatus, CasePhase> = {
  por_recoger: 'recogida',
  nuevo: 'produccion',
  en_proceso: 'produccion',
  en_espera: 'produccion',
  en_prueba: 'produccion',
  terminado: 'entrega',
  enviado: 'entrega',
  entregado: 'entrega',
  cancelado: 'produccion',
}

/** Título del panel de la ficha por fase (UX4-24). `Record` exhaustivo. */
export const CASE_PHASE_TITLE: Record<CasePhase, string> = {
  recogida: 'Recogida',
  produccion: 'Producción',
  entrega: 'Entrega',
}
