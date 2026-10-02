import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * True solo cuando este proceso arrancó ejecutando `moduleUrl` como script (`tsx archivo.ts`,
 * `node dist/archivo.js`), no cuando otro módulo lo importa (p. ej. un test). Usa
 * `realpathSync` sobre `process.argv[1]`: sin resolverlo, arrancar por un symlink deja
 * `process.argv[1]` apuntando al symlink en vez de al archivo real, la comparación nunca
 * coincide, y el proceso sale con código 0 sin imprimir nada — el script "no arranca" en
 * silencio (issue #21, ronda de fixes 1, M-3).
 */
export function isMainModule(moduleUrl: string): boolean {
  if (!process.argv[1]) return false
  try {
    return fileURLToPath(moduleUrl) === realpathSync(process.argv[1])
  } catch {
    return false
  }
}
