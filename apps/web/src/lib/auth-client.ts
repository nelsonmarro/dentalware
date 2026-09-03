import type { Auth } from '@dentalware/api/auth'
import { inferAdditionalFields } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: window.location.origin,
  basePath: '/api/auth',
  plugins: [inferAdditionalFields<Auth>()],
})

export type SessionData = NonNullable<Awaited<ReturnType<typeof authClient.getSession>>['data']>
