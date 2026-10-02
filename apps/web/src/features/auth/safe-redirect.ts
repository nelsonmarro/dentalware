/**
 * Valida que `redirect` (de `?redirect=`) sea una ruta interna segura antes de navegar a ella
 * tras iniciar sesión (issue #20). Solo acepta rutas que empiezan por `/` y no por `//` (URL
 * protocol-relative, salta al host que sea) ni `/\` (algunos navegadores lo tratan como `//`).
 * Cualquier otra cosa (URL absoluta, esquema `javascript:`, cadena vacía, `undefined`) se
 * rechaza devolviendo `null`, para que quien llame decida el destino por defecto (`/`).
 */
export function safeRedirect(redirect: string | undefined): string | null {
  if (!redirect) return null
  if (!redirect.startsWith('/')) return null
  if (redirect.startsWith('//') || redirect.startsWith('/\\')) return null
  return redirect
}
