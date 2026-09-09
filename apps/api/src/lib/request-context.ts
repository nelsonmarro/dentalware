import type { UserRole } from '@dentalware/shared'

/** Lo único que un caso de uso sabe de quién lo invoca. Nunca el Context de Hono. */
export type RequestContext = { userId: string; role: UserRole }
