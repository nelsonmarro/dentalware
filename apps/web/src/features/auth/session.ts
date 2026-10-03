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

export type SignInResult = { ok: true } | { ok: false; reason: 'credentials' | 'network' }

/**
 * UX3-10/UX3-02: distingue credenciales incorrectas (401, el único caso en el que el usuario
 * puede corregir algo) de un fallo de red o del servidor (todo lo demás: sin conexión, 429,
 * 500…), que se muestra con un mensaje distinto en `LoginForm`.
 *
 * `authClient.signIn.email` solo devuelve `{ error }` cuando la petición llegó al servidor; un
 * fallo real de red (sin conexión) hace que la promesa se **rechace** en vez de resolver con un
 * error — sin este `try/catch` esa excepción quedaba sin capturar (`Uncaught (in promise)` en
 * la consola, UX3-02) porque nadie en `onSubmit` la esperaba con `catch`.
 */
export async function signIn(values: { email: string; password: string }): Promise<SignInResult> {
  try {
    const { error } = await authClient.signIn.email(values)
    if (error) return { ok: false, reason: error.status === 401 ? 'credentials' : 'network' }
    return { ok: true }
  } catch {
    return { ok: false, reason: 'network' }
  }
}

export async function signOut(): Promise<void> {
  await authClient.signOut()
}
