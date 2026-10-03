export const USER_ROLES = ['admin', 'recepcion', 'tecnico', 'mensajero'] as const
export type UserRole = (typeof USER_ROLES)[number]

/**
 * Técnico y mensajero nunca ven precios ni notas internas (ADR 31, `docs/conventions.md` §4).
 * Única fuente de esta regla (I-3, ronda de fixes 1 de la Tarea 14, #71): antes vivía repetida
 * a mano en `apps/api/src/features/cases/service.ts` y en cuatro sitios de `apps/web`
 * (`case-header.tsx`, `trabajos/$caseId.tsx`, `trabajos/index.tsx`,
 * `trabajos/$caseId_.imprimir.tsx`), sin test propio — una quinta copia (la orden imprimible)
 * repitió la expresión a mano en vez de importar una regla ya escrita cuatro veces.
 */
export function hidesPrices(role: UserRole): boolean {
  return role === 'tecnico' || role === 'mensajero'
}

/** ¿Está `role` en `roles`? Evita repetir `(X as readonly UserRole[]).includes(role)` en cada
 * llamador (las constantes de rol son tuplas `as const` y `includes` no acepta un `UserRole`). */
export function hasRole(roles: readonly UserRole[], role: UserRole): boolean {
  return roles.includes(role)
}
