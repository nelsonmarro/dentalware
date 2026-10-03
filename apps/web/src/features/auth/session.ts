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

export type SignInFailureReason = 'credentials' | 'banned' | 'rate-limited' | 'network'
export type SignInResult = { ok: true } | { ok: false; reason: SignInFailureReason }

/**
 * Mensaje por motivo de fallo del login (ronda de fixes 1, UX3-10): `Record` exhaustivo para
 * que un motivo nuevo en `SignInFailureReason` no compile aquí hasta que alguien le ponga
 * texto — mismo criterio que `ACTION_EMPHASIS`/`CASE_STATUS_LABEL` en `shared`. `LoginForm` es el
 * único consumidor.
 */
export const SIGN_IN_FAILURE_MESSAGE: Record<SignInFailureReason, string> = {
  credentials: 'Correo o contraseña incorrectos',
  banned: 'Tu usuario está bloqueado: pide a administración que lo reactive.',
  'rate-limited': 'Demasiados intentos: espera un minuto e intenta de nuevo.',
  network: 'No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.',
}

/**
 * UX3-10/UX3-02: distingue credenciales incorrectas (401, el único caso en el que el usuario
 * puede corregir algo) de un usuario bloqueado (403 con `code: 'BANNED_USER'`, el plugin admin
 * de better-auth), de demasiados intentos (429, el limitador de better-auth) y de un fallo de
 * red o del servidor (todo lo demás: sin conexión, 500…), cada uno con su mensaje en
 * `LoginForm`. Un 403 **sin** ese `code` no es "bloqueado" (podría ser otro motivo) y cae en
 * `network`: solo el código exacto que pone el plugin admin cuenta.
 *
 * `authClient.signIn.email` solo devuelve `{ error }` cuando la petición llegó al servidor; un
 * fallo real de red (sin conexión) hace que la promesa se **rechace** en vez de resolver con un
 * error — sin este `try/catch` esa excepción quedaba sin capturar (`Uncaught (in promise)` en
 * la consola, UX3-02) porque nadie en `onSubmit` la esperaba con `catch`.
 */
export async function signIn(values: { email: string; password: string }): Promise<SignInResult> {
  try {
    const { error } = await authClient.signIn.email(values)
    if (!error) return { ok: true }
    const reason: SignInFailureReason =
      error.status === 401
        ? 'credentials'
        : error.status === 403 && error.code === 'BANNED_USER'
          ? 'banned'
          : error.status === 429
            ? 'rate-limited'
            : 'network'
    return { ok: false, reason }
  } catch {
    return { ok: false, reason: 'network' }
  }
}

export async function signOut(): Promise<void> {
  await authClient.signOut()
}
