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

/** Quién administra usuarios: `GET/POST /api/users` (`users/routes.ts`). */
export const USER_ADMIN_ROLES: readonly UserRole[] = ['admin']

/** Quién entra a `/configuracion` (catálogos, fases, usuarios, datos del laboratorio). */
export const SETTINGS_ROLES: readonly UserRole[] = ['admin']

/** Quién filtra la lista de trabajos por técnico: el filtro lee `GET /api/users`, así que sigue
 * a `USER_ADMIN_ROLES` (si recepción ganara acceso a usuarios, ganaría el filtro). */
export const TECHNICIAN_FILTER_ROLES: readonly UserRole[] = USER_ADMIN_ROLES

/** Quién ve «Cuentas» (saldos y cobros por clínica): nunca técnico ni mensajero, que no ven dinero. */
export const ACCOUNTS_ROLES: readonly UserRole[] = ['admin', 'recepcion']

/** Quién registra ajustes (también el saldo inicial) y anula pagos (Iteración 5, CTA-3): solo el
 * administrador. Registrar pagos y aplicar saldo a favor sigue a `ACCOUNTS_ROLES`. */
export const ACCOUNT_ADMIN_ROLES: readonly UserRole[] = ['admin']

/** Quién avisa a la clínica por WhatsApp desde la ficha (AVI-4): quien la atiende. */
export const CASE_NOTIFY_ROLES: readonly UserRole[] = ['admin', 'recepcion']
