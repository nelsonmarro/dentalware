import type { AppType } from '@dentalware/api/app'
import { hc } from 'hono/client'

export const api = hc<AppType>(window.location.origin, {
  init: { credentials: 'include' },
})
