import type { UserRole } from '@dentalware/shared'
import { authClient } from './auth-client'

export type SessionUser = { id: string; name: string; email: string; role: UserRole }

export async function getSession(): Promise<SessionUser | null> {
  const { data } = await authClient.getSession()
  if (!data) return null
  return { ...data.user, role: data.user.role as UserRole }
}

export async function signIn(values: {
  email: string
  password: string
}): Promise<{ ok: true } | { ok: false }> {
  const { error } = await authClient.signIn.email(values)
  if (error) return { ok: false }
  return { ok: true }
}

export async function signOut(): Promise<void> {
  await authClient.signOut()
}
