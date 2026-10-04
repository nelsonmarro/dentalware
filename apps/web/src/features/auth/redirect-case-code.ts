import { CASE_CODE_REGEX } from '@dentalware/shared'
import { safeRedirect } from './safe-redirect'

const QUICK_CASE_PREFIX = '/t/'

/**
 * Código del trabajo que abrirá el login tras entrar, si el destino (`?redirect=`) es la ficha
 * corta del QR (`/t/<código>`); `null` con cualquier otro destino (UX3-19). Pasa primero por
 * `safeRedirect` y exige un código válido (`CASE_CODE_REGEX`): lo que se pinta en pantalla
 * nunca es texto arbitrario de la URL.
 */
export function redirectCaseCode(redirect: string | undefined): string | null {
  const target = safeRedirect(redirect)
  if (!target?.startsWith(QUICK_CASE_PREFIX)) return null
  const code = target.slice(QUICK_CASE_PREFIX.length)
  return CASE_CODE_REGEX.test(code) ? code : null
}
