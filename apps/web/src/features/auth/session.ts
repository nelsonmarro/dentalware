import { userRoleSchema, type UserRole } from '@dentalware/shared'
import { authClient } from './auth-client'

export type SessionUser = { id: string; name: string; email: string; role: UserRole }

/** Mostrado cuando la sesión trae un rol que no es uno de los roles del dominio (issue #21). */
export const INVALID_ROLE_MESSAGE = 'Tu usuario tiene un rol no válido; avisa al administrador.'

export type SessionStatus =
  { status: 'ok'; user: SessionUser } | { status: 'anonymous' } | { status: 'invalid-role' }

/**
 * Estado fino de la sesión: distingue "sin sesión" de "sesión con un rol que no existe en
 * `USER_ROLES`" (una fila manipulada, una migración a medias). Lo usa `login.tsx` para mostrar
 * un mensaje claro en vez de rebotar en silencio contra `_app.tsx` (issue #21).
 */
export async function getSessionStatus(): Promise<SessionStatus> {
  const { data } = await authClient.getSession()
  if (!data) return { status: 'anonymous' }
  const role = userRoleSchema.safeParse(data.user.role)
  if (!role.success) return { status: 'invalid-role' }
  return { status: 'ok', user: { ...data.user, role: role.data } }
}

/**
 * Sesión tipada para el resto de la web. Un rol desconocido **no** se trata como ningún rol
 * concreto (nunca admin por casualidad): se trata como sin sesión válida.
 */
export async function getSession(): Promise<SessionUser | null> {
  const result = await getSessionStatus()
  return result.status === 'ok' ? result.user : null
}

export async function signIn(values: {
  email: string
  password: string
}): Promise<{ ok: true } | { ok: false }> {
  const { error } = await authClient.signIn.email(values)
  if (error) return { ok: false }
  return { ok: true }
}

export async function signOut(): Promise<void> {
  await authClient.signOut()
}
