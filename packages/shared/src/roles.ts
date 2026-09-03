export const USER_ROLES = ['admin', 'recepcion', 'tecnico', 'mensajero'] as const
export type UserRole = (typeof USER_ROLES)[number]
