import { userRoleSchema } from '@dentalware/shared'
import { authClient } from './auth-client'
import type { SessionUser } from './session'

/**
 * Un rol desconocido en la sesión (fila manipulada, migración a medias) se trata como sin
 * sesión: nunca como un rol concreto (issue #21, ver `session.ts`).
 */
export function useSession(): { user: SessionUser | null; isPending: boolean } {
  const { data, isPending } = authClient.useSession()
  const role = data ? userRoleSchema.safeParse(data.user.role) : null
  const user = data && role?.success ? { ...data.user, role: role.data } : null
  return { user, isPending }
}
