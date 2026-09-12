import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Hasher de contraseñas **solo para `NODE_ENV=test`**: SHA-256 con sal, sin factor de
 * coste. Better Auth usa scrypt por defecto (~600 ms por hash), y cada test de API crea
 * y autentica usuarios: con 135 tests eso era la mitad del tiempo de `pnpm test`. En
 * desarrollo y producción `createAuth` no lo inyecta y se conserva scrypt.
 */
export const insecureTestPasswordHasher = {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(8).toString('hex')
    return `${salt}:${digest(salt, password)}`
  },
  async verify({ hash, password }: { hash: string; password: string }): Promise<boolean> {
    const [salt, expected] = hash.split(':')
    if (!salt || !expected) return false
    const actual = digest(salt, password)
    return (
      actual.length === expected.length &&
      timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
    )
  },
}

const digest = (salt: string, password: string) =>
  createHash('sha256').update(`${salt}:${password}`).digest('hex')
