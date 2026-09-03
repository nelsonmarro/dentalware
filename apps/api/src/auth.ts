import { USER_ROLES } from '@dentalware/shared'
import { betterAuth } from 'better-auth'
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
    rateLimit: { enabled: true, window: 60, max: 30 },
    advanced: {
      useSecureCookies: config.NODE_ENV === 'production',
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>
export type SessionUser = Auth['$Infer']['Session']['user']
