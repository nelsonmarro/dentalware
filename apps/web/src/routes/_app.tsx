import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { AppShell } from '@/components/app-shell'
import { getSession } from '@/features/auth/session'

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ location }) => {
    const user = await getSession()
    if (!user) throw redirect({ to: '/login', search: { redirect: location.href } })
    return { user }
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
