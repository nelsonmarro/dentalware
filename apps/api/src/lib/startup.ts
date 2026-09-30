import { ConfigError } from '../config.ts'

/**
 * Qué se imprime cuando `main.ts` no puede arrancar. Solo el `ConfigError` de `loadConfig` (ya
 * en español, ya sin detalle interno) se reduce a su mensaje; cualquier otro error (Postgres
 * caído, host inexistente, contraseña incorrecta…) se imprime completo, con traza y `cause`,
 * para no perder la causa real (issue #21, ronda de fixes 1, I-1).
 */
export function reportStartupError(error: unknown): void {
  if (error instanceof ConfigError) {
    console.error(error.message)
    return
  }
  console.error(error)
}
