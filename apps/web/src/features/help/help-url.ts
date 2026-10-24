import type { UserRole } from '@dentalware/shared'

/** Manual de usuario (Iteración 8). `VITE_DOCS_URL` se fija en build (como `VITE_PUBLIC_URL`);
 * por omisión, el manual público. */
const DEFAULT_DOCS_URL = 'https://docs.dentalware.naphsoft.dev'

/** Guía de cada rol: cada uno va a su sección del manual. `Record` exhaustivo: un rol nuevo no
 * compila sin decidir su guía. */
export const HELP_PATH: Record<UserRole, string> = {
  admin: '/administracion/',
  recepcion: '/recepcion/',
  tecnico: '/tecnico/',
  mensajero: '/mensajero/',
}

export function helpUrl(role: UserRole): string {
  const base = (import.meta.env.VITE_DOCS_URL || DEFAULT_DOCS_URL).replace(/\/+$/, '')
  return `${base}${HELP_PATH[role]}`
}
