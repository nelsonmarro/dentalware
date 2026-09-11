import type { UserRole } from '@dentalware/shared'
import { authClient } from './auth-client'
import type { SessionUser } from './session'

export function useSession(): { user: SessionUser | null; isPending: boolean } {
  const { data, isPending } = authClient.useSession()
  const user = data ? { ...data.user, role: data.user.role as UserRole } : null
  return { user, isPending }
}
