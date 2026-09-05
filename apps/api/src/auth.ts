import { USER_ROLES } from '@dentalware/shared'
import { betterAuth } from 'better-auth'
import { admin } from 'better-auth/plugins'
import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2' // Drizzle 1.0: relaciones v2
import type { Config } from './config.ts'
import type { Db } from './db/index.ts'
import * as schema from './db/schema/index.ts'

export function createAuth(db: Db, config: Config) {
  return betterAuth({
    appName: 'Dentalware',
    baseURL: config.BETTER_AUTH_URL,
    basePath: '/api/auth',
    secret: config.BETTER_AUTH_SECRET,
    trustedOrigins: [config.WEB_ORIGIN],
    database: drizzleAdapter(db, { provider: 'pg', usePlural: true, schema }),
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    user: {
      additionalFields: {
        role: {
          type: [...USER_ROLES],
          required: true,
          defaultValue: 'tecnico',
          input: false, // el rol nunca lo elige el cliente
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 14, // 14 días
      updateAge: 60 * 60 * 24,
    },
    // better-auth aplica una regla especial fija de 3 solicitudes/10s a /sign-in*
    // y /sign-up*, sin importar window/max aquí; eso rompe la suite de tests
    // (varios sign-up/sign-in por caso). Se deshabilita solo en test.
    rateLimit: { enabled: config.NODE_ENV !== 'test', window: 60, max: 30 },
    advanced: {
      useSecureCookies: config.NODE_ENV === 'production',
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
    },
    plugins: [admin({ adminRoles: ['admin'], defaultRole: 'tecnico' })],
  })
}

export type Auth = ReturnType<typeof createAuth>
export type SessionUser = Auth['$Infer']['Session']['user']
