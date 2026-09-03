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

export const ACTIONS_REQUIRING_REASON: readonly CaseAction[] = ['pausar', 'cancelar']

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
