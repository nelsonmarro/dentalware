import type { UserRole } from './roles.ts'

export const CASE_STATUSES = [
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

/**
 * `Record<CaseAction, boolean>` exhaustivo (pendiente de la Tarea 8, ronda de fixes 1): antes
 * `ACTIONS_REQUIRING_REASON` era una lista a mano (`readonly CaseAction[]`) que una acción
 * nueva podía dejar fuera sin que nada lo avisara. Con el `Record` exhaustivo, añadir una
 * acción a `CASE_ACTIONS` sin decidir aquí si pide motivo no compila.
 */
const REASON_REQUIRED_FOR_ACTION: Record<CaseAction, boolean> = {
  aceptar: false,
  pausar: true,
  reanudar: false,
  enviar_prueba: false,
  recibir_prueba: false,
  finalizar: false,
  marcar_enviado: false,
  marcar_entregado: false,
  cancelar: true,
}

export const ACTIONS_REQUIRING_REASON: readonly CaseAction[] = CASE_ACTIONS.filter(
  (a) => REASON_REQUIRED_FOR_ACTION[a],
)

export type ApplyResult = { ok: true; status: CaseStatus } | { ok: false; reason: string }

export function applyAction(status: CaseStatus, action: CaseAction): ApplyResult {
  const t = CASE_TRANSITIONS[action]
  if (!t.from.includes(status)) {
    return { ok: false, reason: `No se puede "${action}" un trabajo en estado "${status}"` }
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
 * "editar" de la ficha); el resto responde 409 si se intenta guardar. */
export const EDITABLE_CASE_STATUSES = [
  'nuevo',
  'en_proceso',
] as const satisfies readonly CaseStatus[]

export function isEditableStatus(status: CaseStatus): boolean {
  return (EDITABLE_CASE_STATUSES as readonly CaseStatus[]).includes(status)
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

/** Motivo (en español) de por qué no se puede cambiar de fase en cada estado que no sea
 * `en_proceso`: única fuente para el 409 del servicio (`CaseStateError`) y para el aviso de
 * solo lectura en la ficha de la web — antes eran dos `Record` con las mismas claves y texto
 * casi idéntico. `Record<Exclude<CaseStatus, 'en_proceso'>, string>` exhaustivo a propósito
 * (mismo patrón que `CONFIRM_DESCRIPTIONS` en la web): un estado nuevo no compila sin motivo. */
export const STAGE_CHANGE_BLOCKED_REASON: Record<Exclude<CaseStatus, 'en_proceso'>, string> = {
  nuevo: 'El trabajo todavía no tiene fase: acéptalo primero.',
  en_espera: 'El trabajo está en espera: reanúdalo para poder cambiar de fase.',
  en_prueba: 'El trabajo está en una prueba en boca: recíbela para poder cambiar de fase.',
  terminado: 'El trabajo ya está terminado.',
  enviado: 'El trabajo ya fue enviado.',
  entregado: 'El trabajo ya fue entregado.',
  cancelado: 'El trabajo está cancelado.',
}
