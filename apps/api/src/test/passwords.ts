import { randomBytes } from 'node:crypto'

/**
 * Contraseña aleatoria para un usuario efímero de un test (Better Auth exige mínimo 8
 * caracteres, ver `minPasswordLength` en `auth.ts`). Ningún test escribe ya una contraseña
 * literal: el check de GitGuardian (GitHub App) corre en el servidor y no lee
 * `.gitguardian.yaml` —solo la CLI `ggshield` lo hace—, así que marcaba «Generic Password»
 * en cada PR que creaba un usuario de prueba.
 */
export function testPassword(): string {
  return `Aa1${randomBytes(9).toString('base64url')}`
}
