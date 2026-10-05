import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { AppShell } from '@/components/app-shell'
import { getAppSession } from '@/features/auth/session'

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ location }) => {
    // Sin red y con una sesión ya conocida deja pasar (UX4-26, ver `getAppSession`).
    const user = await getAppSession()
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
