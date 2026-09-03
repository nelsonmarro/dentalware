import type { UserRole } from '@dentalware/shared'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { AppShell } from '@/components/app-shell'
import { authClient } from '@/lib/auth-client'

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ location }) => {
    const { data } = await authClient.getSession()
    if (!data) throw redirect({ to: '/login', search: { redirect: location.href } })
    return { user: { ...data.user, role: data.user.role as UserRole } }
  },
  component: AppLayout,
})

function AppLayout() {
  const { user } = Route.useRouteContext()
  return (
    <AppShell user={user}>
      <Outlet />
    </AppShell>
  )
}
